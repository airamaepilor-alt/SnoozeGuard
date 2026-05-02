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

export function signalIotBuzz(deviceId: string, alertId: string, level: number): boolean {
  return publishMqttCommand(`snoozeguard/commands/${deviceId}`, {
    command: "buzz",
    alert_id: alertId,
    level,
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
