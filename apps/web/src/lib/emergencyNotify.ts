import type { SupabaseClient } from "@supabase/supabase-js";

export type EmergencyContact = {
  id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_user_id: string | null;
  status: "pending" | "accepted";
};

export type LocationSnapshot = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

export async function getEmergencyContact(
  supabase: SupabaseClient,
  userId: string,
): Promise<EmergencyContact | null> {
  const { data } = await supabase
    .from("emergency_contacts")
    .select("id, contact_name, contact_phone, contact_email, contact_user_id, status")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return {
    ...(data as EmergencyContact),
    status: (data as { status?: string }).status === "pending" ? "pending" : "accepted",
  };
}

export async function captureLocation(): Promise<LocationSnapshot | null> {
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: true },
    );
  });
}

const SMS_FUNCTION_SECRET = "sg-sms-2026";

async function sendAutoSms(
  phone: string,
  driverName: string,
  location: LocationSnapshot | null,
): Promise<void> {
  if (!phone?.trim()) return;
  try {
    await fetch("https://cjxxdqyhqscfklktxohq.supabase.co/functions/v1/dynamic-worker", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-snoozeguard-secret": SMS_FUNCTION_SECRET,
      },
      body: JSON.stringify({
        phone: phone.trim(),
        driverName,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      }),
    });
  } catch { /* non-fatal */ }
}

export async function triggerEmergencyAlert(
  supabase: SupabaseClient,
  userId: string,
  driverName: string,
  sessionId: string | null,
  smsEnabled?: boolean,
): Promise<{ alertId: string | null; location: LocationSnapshot | null }> {
  const location = await captureLocation();

  const { data } = await supabase
    .from("emergency_alert_events")
    .insert({
      user_id: userId,
      session_id: sessionId,
      location_lat: location?.lat ?? null,
      location_lng: location?.lng ?? null,
      status: "active",
    })
    .select("id")
    .single();

  const alertId = (data as { id?: string } | null)?.id ?? null;

  const ec = await getEmergencyContact(supabase, userId);
  if (!ec || ec.status !== "accepted") return { alertId, location };

  const pushBody = location
    ? `${driverName} needs a check-in. Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
    : `${driverName} triggered a drowsiness alert — please check in.`;

  if (ec.contact_user_id) {
    const { data: tokenRow } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", ec.contact_user_id)
      .maybeSingle();

    if ((tokenRow as { expo_push_token?: string } | null)?.expo_push_token) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: (tokenRow as { expo_push_token: string }).expo_push_token,
          title: "Check in on a driver",
          body: pushBody,
          data: { alertId, userId, lat: location?.lat, lng: location?.lng },
          sound: "default",
          priority: "high",
        }),
      }).catch(() => {});
    }
  }

  if (smsEnabled && ec.contact_phone) {
    await sendAutoSms(ec.contact_phone, driverName, location);
  }

  return { alertId, location };
}

export async function acknowledgeEmergencyAlert(
  supabase: SupabaseClient,
  alertId: string,
): Promise<void> {
  await supabase
    .from("emergency_alert_events")
    .update({ status: "alerted", acknowledged_at: new Date().toISOString() })
    .eq("id", alertId);
}
