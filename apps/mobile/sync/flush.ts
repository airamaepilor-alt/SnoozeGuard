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

export async function flushPendingTelemetry(supabase: SupabaseClient, userId: string): Promise<number> {
  if (!(await isOnline())) return 0;

  const db = getDatabase();
  const pending = db.getAllSync<{
    id: number;
    local_session_id: string;
    recorded_at: string;
    drowsiness_level: number;
    yawn_count_delta: number;
    head_event_count_delta: number;
    sudden_brake: number;
    source: string;
  }>(
    `SELECT t.id, t.local_session_id, t.recorded_at, t.drowsiness_level, t.yawn_count_delta,
            t.head_event_count_delta, t.sudden_brake, t.source
     FROM session_telemetry_local t
     JOIN driving_sessions_local s ON s.id = t.local_session_id
     WHERE t.remote_synced = 0 AND s.user_id = ?`,
    userId,
  );

  let pushed = 0;
  for (const row of pending) {
    const remoteId = await ensureRemoteSession(supabase, userId, row.local_session_id);
    if (!remoteId) continue;

    const { error } = await supabase.from("session_telemetry").insert({
      session_id: remoteId,
      recorded_at: row.recorded_at,
      drowsiness_level: row.drowsiness_level,
      yawn_count_delta: row.yawn_count_delta,
      head_event_count_delta: row.head_event_count_delta,
      sudden_brake: Boolean(row.sudden_brake),
      source: row.source,
    });
    if (!error) {
      db.runSync("UPDATE session_telemetry_local SET remote_synced = 1 WHERE id = ?", row.id);
      pushed += 1;
    }
  }
  return pushed;
}

export async function flushEndedSessions(supabase: SupabaseClient, userId: string): Promise<void> {
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
    }
  }
}
