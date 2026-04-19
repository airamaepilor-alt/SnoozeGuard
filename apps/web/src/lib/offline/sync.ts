import type { SupabaseClient } from "@supabase/supabase-js";
import { offlineDb } from "./db";

export function browserIsOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function ensureRemoteSession(supabase: SupabaseClient, userId: string, localSessionId: string): Promise<string | null> {
  if (!browserIsOnline()) return null;

  const row = await offlineDb.drivingSessionsLocal.get(localSessionId);
  if (!row || row.userId !== userId) return null;
  if (row.remoteId) return row.remoteId;

  const { data, error } = await supabase
    .from("driving_sessions")
    .insert({
      user_id: userId,
      device_type: "web",
      sync_status: "synced",
      started_at: row.startedAt,
    })
    .select("id")
    .single();

  if (error || !data?.id) return null;

  await offlineDb.drivingSessionsLocal.update(localSessionId, { remoteId: data.id });
  return data.id;
}

export async function flushPendingTelemetry(supabase: SupabaseClient, userId: string): Promise<number> {
  if (!browserIsOnline()) return 0;

  const pending = await offlineDb.sessionTelemetryLocal.filter((t) => t.remoteSynced === 0).toArray();
  let pushed = 0;

  for (const row of pending) {
    const session = await offlineDb.drivingSessionsLocal.get(row.localSessionId);
    if (!session || session.userId !== userId) continue;

    const remoteId = await ensureRemoteSession(supabase, userId, row.localSessionId);
    if (!remoteId || row.id === undefined) continue;

    const { error } = await supabase.from("session_telemetry").upsert({
      session_id: remoteId,
      recorded_at: row.recordedAt,
      drowsiness_level: row.drowsinessLevel,
      yawn_count_delta: row.yawnCountDelta,
      head_event_count_delta: row.headEventCountDelta,
      sudden_brake: Boolean(row.suddenBrake),
      source: row.source,
    }, { onConflict: "session_id,recorded_at", ignoreDuplicates: true });

    if (!error) {
      await offlineDb.sessionTelemetryLocal.update(row.id, { remoteSynced: 1 });
      pushed += 1;
    }
  }

  return pushed;
}

export async function flushEndedSessions(supabase: SupabaseClient, userId: string): Promise<void> {
  if (!browserIsOnline()) return;

  const locals = await offlineDb.drivingSessionsLocal.where("userId").equals(userId).toArray();
  for (const r of locals) {
    if (!r.endedAt || r.endedSynced || !r.remoteId) continue;
    const { error } = await supabase.from("driving_sessions").update({ ended_at: r.endedAt }).eq("id", r.remoteId);
    if (!error) {
      await offlineDb.drivingSessionsLocal.update(r.id, { endedSynced: 1 });
    }
  }
}

export async function flushOutbox(supabase: SupabaseClient, userId: string): Promise<void> {
  await flushEndedSessions(supabase, userId);
  await flushPendingTelemetry(supabase, userId);
}
