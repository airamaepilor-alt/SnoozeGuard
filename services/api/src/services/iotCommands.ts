import type { createServiceClient } from "../supabase.js";
import { publishMqttCommand } from "../mqtt.js";

type Supabase = ReturnType<typeof createServiceClient>;

export async function updateDeviceHeartbeat(supabase: Supabase, deviceId: string): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[HEARTBEAT UPDATE] Device: ${deviceId} | Timestamp: ${timestamp}`);

  // Record raw ping so pair_iot_device can verify the device exists before pairing
  await supabase
    .from("iot_device_heartbeats")
    .upsert({ device_id: deviceId, last_seen: timestamp }, { onConflict: "device_id" });

  const { error, data } = await supabase
    .from("user_iot_devices")
    .update({ last_seen: timestamp })
    .eq("device_id", deviceId)
    .select();

  if (error) {
    console.error(`[HEARTBEAT UPDATE FAILED] Device: ${deviceId} | Error:`, error.message);
  } else {
    console.log(`[HEARTBEAT UPDATE SUCCESS] Device: ${deviceId} | Rows updated:`, data?.length ?? 0);
  }
}

// Creates a pending link request initiated by the device (called from MQTT handler).
export async function requestDeviceLink(
  supabase: Supabase,
  deviceId: string,
  email: string
): Promise<void> {
  const normalizedId    = deviceId.toLowerCase().trim();
  const normalizedEmail = email.toLowerCase().trim();

  // Resolve user by email using existing RPC
  const { data: userId } = await supabase.rpc("get_user_id_by_email", {
    p_email: normalizedEmail,
  });
  if (!userId) {
    console.log(`[LINK REQUEST] No user for email: ${normalizedEmail}`);
    return;
  }

  // Skip if user already has an accepted device
  const { data: userRow } = await supabase
    .from("user_iot_devices")
    .select("device_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (userRow?.status === "accepted") {
    console.log(`[LINK REQUEST] User already has accepted device: ${userRow.device_id}`);
    return;
  }

  // Skip if device is already claimed by a DIFFERENT user
  const { data: deviceRow } = await supabase
    .from("user_iot_devices")
    .select("user_id")
    .eq("device_id", normalizedId)
    .neq("user_id", userId)
    .maybeSingle();
  if (deviceRow) {
    console.log(`[LINK REQUEST] Device ${normalizedId} already linked to another user`);
    return;
  }

  const { error } = await supabase.from("user_iot_devices").upsert(
    {
      user_id:         userId,
      device_id:       normalizedId,
      status:          "pending",
      requested_email: normalizedEmail,
      last_seen:       new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error(`[LINK REQUEST] Failed:`, error.message);
  } else {
    console.log(`[LINK REQUEST] Pending: ${normalizedId} → ${normalizedEmail}`);
  }
}

// Only signals devices that have been accepted by their user.
export async function signalIotBuzz(
  supabase: Supabase,
  deviceId: string,
  alertId: string,
  level: number,
  event?: "drowsiness" | "sudden_brake" | "head_tilted",
): Promise<boolean> {
  const { data } = await supabase
    .from("user_iot_devices")
    .select("status")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (!data || data.status !== "accepted") {
    console.log(`[BUZZ] Device ${deviceId} not accepted — skipping`);
    return false;
  }

  return publishMqttCommand(`snoozeguard/commands/${deviceId}`, {
    command: "buzz",
    alert_id: alertId,
    level,
    ...(event ? { event } : {}),
  });
}

export async function dismissIotAlert(
  supabase: Supabase,
  alertId: string,
  dismissedBy: "driver" | "iot_button",
): Promise<void> {
  const { data } = await supabase
    .from("iot_alerts")
    .update({
      status: "dismissed",
      dismissed_by: dismissedBy,
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", alertId)
    .eq("status", "active")
    .select("device_id")
    .maybeSingle();

  if (data?.device_id) {
    publishMqttCommand(`snoozeguard/commands/${data.device_id}`, {
      command: "all_clear",
      alert_id: alertId,
    });
  }
}
