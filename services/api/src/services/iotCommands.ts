import type { createServiceClient } from "../supabase.js";
import { publishMqttCommand } from "../mqtt.js";

type Supabase = ReturnType<typeof createServiceClient>;

export async function updateDeviceHeartbeat(supabase: Supabase, deviceId: string): Promise<void> {
  await supabase
    .from("user_iot_devices")
    .update({ last_seen: new Date().toISOString() })
    .eq("device_id", deviceId);
}

export function signalIotBuzz(deviceId: string, alertId: string, level: number): void {
  publishMqttCommand(`snoozeguard/commands/${deviceId}`, {
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
