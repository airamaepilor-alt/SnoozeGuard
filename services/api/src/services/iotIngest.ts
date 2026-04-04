import type { Env } from "../env.js";
import type { IotPayload } from "@snoozeguard/shared";
import type { createServiceClient } from "../supabase.js";

type Supabase = ReturnType<typeof createServiceClient>;

export type IngestResult =
  | { ok: true; session_id: string }
  | { ok: false; status: number; error: string; message?: string };

export async function ingestIotTelemetry(env: Env, supabase: Supabase, body: IotPayload): Promise<IngestResult> {
  const userId = env.IOT_DEFAULT_USER_ID;
  if (!userId) {
    return {
      ok: false,
      status: 503,
      error: "iot_not_configured",
      message: "Set IOT_DEFAULT_USER_ID to a real user UUID for ingest, or extend schema for per-device users.",
    };
  }

  let sessionId: string | null = null;

  if (body.session_external_id) {
    const { data: existing } = await supabase
      .from("driving_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("external_session_id", body.session_external_id)
      .maybeSingle();

    if (existing?.id) sessionId = existing.id;
  }

  if (!sessionId) {
    const externalId = body.session_external_id ?? `iot-${body.device_id}-${Date.now()}`;
    const { data: created, error: createErr } = await supabase
      .from("driving_sessions")
      .insert({
        user_id: userId,
        external_session_id: externalId,
        device_type: "iot",
        sync_status: "synced",
      })
      .select("id")
      .single();

    if (createErr || !created) {
      return { ok: false, status: 500, error: "session_create_failed" };
    }
    sessionId = created.id;
  }

  if (!sessionId) {
    return { ok: false, status: 500, error: "session_missing" };
  }

  const { error: telErr } = await supabase.from("session_telemetry").insert({
    session_id: sessionId,
    recorded_at: body.recorded_at,
    drowsiness_level: body.drowsiness_level,
    yawn_count_delta: body.yawn_count ?? 0,
    head_event_count_delta: body.head_movement_events ?? 0,
    sudden_brake: body.sudden_brake ?? false,
    source: `iot:${body.device_id}`,
  });

  if (telErr) {
    return { ok: false, status: 500, error: "telemetry_insert_failed" };
  }

  return { ok: true, session_id: sessionId };
}
