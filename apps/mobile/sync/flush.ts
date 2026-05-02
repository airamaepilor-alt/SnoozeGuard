import type { SupabaseClient } from "@supabase/supabase-js";
import NetInfo from "@react-native-community/netinfo";
import { getDatabase } from "../db/database";

export async function isOnline(): Promise<boolean> {
  const s = await NetInfo.fetch();
  return Boolean(s.isConnected && s.isInternetReachable !== false);
}

export async function ensureRemoteSession(supabase: SupabaseClient, userId: string, localSessionId: string): Promise<string | null> {
  if (!(await isOnline())) return null;

  const db = getDatabase();
  const row = db.getFirstSync<{ remote_id: string | null; started_at: string }>(
    "SELECT remote_id, started_at FROM driving_sessions_local WHERE id = ?",
    localSessionId,
  );
  if (!row) return null;
  if (row.remote_id) return row.remote_id;

  const { data, error } = await supabase
    .from("driving_sessions")
    .insert({
      user_id: userId,
      device_type: "mobile",
      sync_status: "synced",
      started_at: row.started_at,
    })
    .select("id")
    .single();

  if (error || !data?.id) return null;

  db.runSync("UPDATE driving_sessions_local SET remote_id = ? WHERE id = ?", data.id, localSessionId);
  return data.id;
}

export async function flushPendingTelemetry(supabase: SupabaseClient, userId: string, onProgress?: () => void): Promise<number> {
  if (!(await isOnline())) return 0;

  const db = getDatabase();
  const pending = db.getAllSync<{
    id: number;
    local_session_id: string;
    recorded_at: string;
    drowsiness_level: number;
    yawn_count_delta: number;
    head_event_count_delta: number;
    head_tilt_delta: number;
    sudden_brake: number;
    source: string;
  }>(
    `SELECT t.id, t.local_session_id, t.recorded_at, t.drowsiness_level, t.yawn_count_delta,
            t.head_event_count_delta, t.head_tilt_delta, t.sudden_brake, t.source
     FROM session_telemetry_local t
     JOIN driving_sessions_local s ON s.id = t.local_session_id
     WHERE t.remote_synced = 0 AND s.user_id = ?`,
    userId,
  );

  let pushed = 0;
  for (const row of pending) {
    const remoteId = await ensureRemoteSession(supabase, userId, row.local_session_id);
    if (!remoteId) continue;

    const { error } = await supabase.from("session_telemetry").upsert({
      session_id: remoteId,
      recorded_at: row.recorded_at,
      drowsiness_level: row.drowsiness_level,
      yawn_count_delta: row.yawn_count_delta,
      head_event_count_delta: row.head_event_count_delta,
      head_tilt_delta: row.head_tilt_delta,
      sudden_brake: Boolean(row.sudden_brake),
      source: row.source,
    }, { onConflict: "session_id,recorded_at", ignoreDuplicates: true });
    if (!error) {
      db.runSync("UPDATE session_telemetry_local SET remote_synced = 1 WHERE id = ?", row.id);
      pushed += 1;
      onProgress?.();
    }
  }
  return pushed;
}

/**
 * Pulls sessions (and their telemetry) from Supabase that are missing from local SQLite.
 * Called once on app startup after login. Covers the last 90 days.
 * Uses the remote UUID as both the local `id` and `remote_id` since the original
 * local UUID was lost when app data was cleared.
 */
export async function rehydrateSessions(supabase: SupabaseClient, userId: string): Promise<void> {
  if (!(await isOnline())) return;
  const db = getDatabase();

  // Collect remote_ids we already have locally so we don't re-insert them
  const existing = new Set(
    db
      .getAllSync<{ remote_id: string }>(
        "SELECT remote_id FROM driving_sessions_local WHERE user_id = ? AND remote_id IS NOT NULL",
        userId,
      )
      .map((r) => r.remote_id),
  );

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: remoteSessions } = await supabase
    .from("driving_sessions")
    .select("id, started_at, ended_at, device_type")
    .eq("user_id", userId)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(200);

  if (!remoteSessions?.length) return;

  for (const rs of remoteSessions as { id: string; started_at: string; ended_at: string | null; device_type: string }[]) {
    if (existing.has(rs.id)) continue;

    // Insert the session — use remote UUID as local id too
    db.runSync(
      `INSERT OR IGNORE INTO driving_sessions_local
         (id, user_id, remote_id, started_at, ended_at, device_type, ended_synced)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      rs.id,
      userId,
      rs.id,
      rs.started_at,
      rs.ended_at ?? null,
      rs.device_type ?? "mobile",
    );

    // Fetch and insert telemetry for this session.
    // .limit(10000) overrides Supabase's default 1000-row cap.
    const { data: trows } = await supabase
      .from("session_telemetry")
      .select("recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake, source")
      .eq("session_id", rs.id)
      .order("recorded_at", { ascending: true })
      .limit(10000);

    if (trows?.length) {
      for (const t of trows as { recorded_at: string; drowsiness_level: number; yawn_count_delta: number; head_event_count_delta: number; head_tilt_delta: number; sudden_brake: boolean; source: string }[]) {
        db.runSync(
          `INSERT OR IGNORE INTO session_telemetry_local
             (local_session_id, recorded_at, drowsiness_level, yawn_count_delta,
              head_event_count_delta, head_tilt_delta, sudden_brake, source, remote_synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          rs.id,
          t.recorded_at,
          t.drowsiness_level,
          t.yawn_count_delta,
          t.head_event_count_delta,
          t.head_tilt_delta ?? 0,
          t.sudden_brake ? 1 : 0,
          t.source ?? "mobile",
        );
      }
    }
  }
}

/**
 * Detects sessions that exist locally but were deleted from Supabase, re-inserts them,
 * and resets their telemetry remote_synced flag so flushPendingTelemetry re-uploads it.
 * Returns the number of sessions recovered.
 */
export async function recoverDeletedRemoteSessions(supabase: SupabaseClient, userId: string): Promise<number> {
  if (!(await isOnline())) return 0;
  const db = getDatabase();

  const synced = db.getAllSync<{ id: string; remote_id: string; started_at: string; ended_at: string }>(
    `SELECT id, remote_id, started_at, ended_at
     FROM driving_sessions_local
     WHERE user_id = ? AND remote_id IS NOT NULL AND ended_at IS NOT NULL`,
    userId,
  );
  if (!synced.length) return 0;

  const remoteIds = synced.map((r) => r.remote_id);
  const { data: existing } = await supabase
    .from("driving_sessions")
    .select("id")
    .in("id", remoteIds);

  const existingSet = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const missing = synced.filter((r) => !existingSet.has(r.remote_id));
  if (!missing.length) return 0;

  let recovered = 0;
  for (const row of missing) {
    const { error } = await supabase.from("driving_sessions").upsert(
      {
        id: row.remote_id,
        user_id: userId,
        device_type: "mobile",
        sync_status: "synced",
        started_at: row.started_at,
        ended_at: row.ended_at,
      },
      { onConflict: "id" },
    );
    if (!error) {
      db.runSync(
        "UPDATE session_telemetry_local SET remote_synced = 0 WHERE local_session_id = ?",
        row.id,
      );
      recovered += 1;
    }
  }
  return recovered;
}

export async function flushEndedSessions(supabase: SupabaseClient, userId: string, onProgress?: () => void): Promise<void> {
  if (!(await isOnline())) return;
  const db = getDatabase();
  const rows = db.getAllSync<{ id: string; remote_id: string | null; ended_at: string | null }>(
    "SELECT id, remote_id, ended_at FROM driving_sessions_local WHERE user_id = ? AND ended_at IS NOT NULL AND ended_synced = 0",
    userId,
  );
  for (const r of rows) {
    if (!r.remote_id || !r.ended_at) continue;
    const { error } = await supabase.from("driving_sessions").update({ ended_at: r.ended_at }).eq("id", r.remote_id);
    if (!error) {
      db.runSync("UPDATE driving_sessions_local SET ended_synced = 1 WHERE id = ?", r.id);
      onProgress?.();
    }
  }
}
