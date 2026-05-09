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
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function sendAlertNotification(opts: {
  phone?: string | null;
  contactEmail?: string | null;
  alertId?: string | null;
  driverName: string;
  location: LocationSnapshot | null;
}): Promise<void> {
  const { phone, contactEmail, alertId, driverName, location } = opts;
  if (!phone?.trim() && !contactEmail) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dynamic-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "x-snoozeguard-secret": SMS_FUNCTION_SECRET,
      },
      body: JSON.stringify({
        phone: phone?.trim() || null,
        contactEmail: contactEmail || null,
        alertId: alertId || null,
        driverName,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      }),
    });
    const txt = await res.text();
    console.log("[Alert] Notification HTTP", res.status, txt.slice(0, 300));
  } catch (e) {
    console.error("[Alert] Notification error:", e);
  }
}

export async function triggerEmergencyAlert(
  supabase: SupabaseClient,
  userId: string,
  driverName: string,
  sessionId: string | null,
  smsEnabled?: boolean,
): Promise<{ alertId: string | null; location: LocationSnapshot | null }> {
  console.log("[Alert] ===== triggerEmergencyAlert START (web) =====");
  console.log("[Alert] userId:", userId, "driverName:", driverName, "smsEnabled:", smsEnabled, "sessionId:", sessionId);

  const location = await captureLocation();
  console.log("[Alert] Location:", location ? `${location.lat.toFixed(5)},${location.lng.toFixed(5)} acc=${location.accuracy}` : "null");

  const { data: insertData, error: insertError } = await supabase
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

  const alertId = (insertData as { id?: string } | null)?.id ?? null;
  console.log("[Alert] Insert alert event — alertId:", alertId, "insertError:", insertError?.message ?? "none");

  // Dump ALL contacts for this user so we can see is_active + status
  const { data: allRows, error: allErr } = await supabase
    .from("emergency_contacts")
    .select("id, contact_name, contact_phone, contact_email, contact_user_id, status, is_active")
    .eq("user_id", userId);
  console.log("[Alert] All EC rows for user:", JSON.stringify(allRows ?? []), "error:", allErr?.message ?? "none");

  // Fetch all active accepted contacts
  const { data: activeRows, error: activeErr } = await supabase
    .from("emergency_contacts")
    .select("id, contact_name, contact_phone, contact_email, contact_user_id, status")
    .eq("user_id", userId)
    .eq("is_active", true);
  console.log("[Alert] Active EC rows (is_active=true):", JSON.stringify(activeRows ?? []), "error:", activeErr?.message ?? "none");

  const activeContacts: EmergencyContact[] = ((activeRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    contact_name: row.contact_name as string,
    contact_phone: row.contact_phone as string | null,
    contact_email: row.contact_email as string | null,
    contact_user_id: row.contact_user_id as string | null,
    status: (row.status as string) === "pending" ? "pending" : "accepted",
  }));

  const acceptedContacts = activeContacts.filter((ec) => ec.status === "accepted");
  console.log("[Alert] Active:", activeContacts.length, "Accepted+Active:", acceptedContacts.length);

  if (acceptedContacts.length === 0) {
    console.log("[Alert] STOPPING — no accepted+active contacts. Check DB rows above.");
    return { alertId, location };
  }

  const pushBody = location
    ? `${driverName} needs a check-in. Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
    : `${driverName} triggered a drowsiness alert — please check in.`;

  for (const ec of acceptedContacts) {
    console.log("[Alert] Processing contact:", ec.contact_name, "phone:", ec.contact_phone ? "yes" : "no", "email:", ec.contact_email ? "yes" : "no", "contact_user_id:", ec.contact_user_id ?? "none");

    if (ec.contact_user_id) {
      const { data: tokenRow } = await supabase
        .from("push_tokens")
        .select("expo_push_token")
        .eq("user_id", ec.contact_user_id)
        .maybeSingle();
      const token = (tokenRow as { expo_push_token?: string } | null)?.expo_push_token;
      console.log("[Alert] Push token:", token ? token.slice(0, 20) + "..." : "none");
      if (token) {
        const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: token,
            title: "Check in on a driver",
            body: pushBody,
            data: { alertId, userId, lat: location?.lat, lng: location?.lng },
            sound: "default",
            priority: "high",
          }),
        }).catch((e) => { console.log("[Alert] Push fetch error:", e); return null; });
        console.log("[Alert] Push HTTP:", pushRes?.status ?? "failed");
      }
    }

    const willSendSms = Boolean(smsEnabled && ec.contact_phone);
    const willSendEmail = Boolean(ec.contact_email);
    console.log("[Alert] Will send SMS:", willSendSms, "Will send email:", willSendEmail);

    if (willSendSms || willSendEmail) {
      await sendAlertNotification({
        phone: willSendSms ? ec.contact_phone : null,
        contactEmail: willSendEmail ? ec.contact_email : null,
        alertId,
        driverName,
        location,
      });
    } else {
      console.log("[Alert] Skipping dynamic-worker — no phone (or SMS disabled) and no email for this contact");
    }
  }

  console.log("[Alert] ===== triggerEmergencyAlert END =====");
  return { alertId, location };
}

export async function acknowledgeEmergencyAlert(
  supabase: SupabaseClient,
  alertId: string,
): Promise<void> {
  await supabase
    .from("emergency_alert_events")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", alertId);
}
