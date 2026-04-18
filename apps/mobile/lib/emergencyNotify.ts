import * as Location from "expo-location";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EmergencyContact = {
  id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_user_id: string | null;
  status: "pending" | "accepted";
};

export type PendingRequest = {
  id: string;
  user_id: string;
  driver_name: string;
  driver_email: string | null; // masked in UI — only last 5 chars shown
  created_at: string;
};

// ─── Lookup helper ───────────────────────────────────────────────────────────

async function lookupUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  if (!email?.trim()) return null;
  // Uses a SECURITY DEFINER RPC to query auth.users directly — bypasses RLS
  // which blocks users from reading other users' email in the profiles table.
  const { data, error } = await supabase.rpc("get_user_id_by_email", {
    p_email: email.trim().toLowerCase(),
  });
  if (error || !data) return null;
  return data as string;
}

// ─── Emergency contact CRUD ──────────────────────────────────────────────────

export async function getEmergencyContact(
  supabase: SupabaseClient,
  userId: string,
): Promise<EmergencyContact | null> {
  const { data } = await supabase
    .from("emergency_contacts")
    .select("id, contact_name, contact_phone, contact_email, contact_user_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    ...(data as EmergencyContact),
    status: (data as { status?: string }).status === "pending" ? "pending" : "accepted",
  };
}

export async function upsertEmergencyContact(
  supabase: SupabaseClient,
  userId: string,
  contact: { contact_name: string; contact_phone: string; contact_email: string },
): Promise<{ error: string | null; status: "pending" | "accepted" }> {
  // Check if contact email belongs to a registered SnoozeGuard user
  const contactUserId = contact.contact_email
    ? await lookupUserByEmail(supabase, contact.contact_email)
    : null;

  // If registered: create pending request (they must approve)
  // If not registered: auto-accepted (can't approve if not in app)
  const status: "pending" | "accepted" = contactUserId ? "pending" : "accepted";

  const { error } = await supabase
    .from("emergency_contacts")
    .upsert(
      {
        user_id: userId,
        contact_name: contact.contact_name,
        contact_phone: contact.contact_phone,
        contact_email: contact.contact_email,
        contact_user_id: contactUserId,
        status,
      },
      { onConflict: "user_id" },
    );

  if (error) return { error: error.message, status };

  // Notify the contact via push if they're registered
  if (contactUserId && status === "pending") {
    const { data: driverProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const driverName = (driverProfile as { full_name?: string } | null)?.full_name ?? "A SnoozeGuard user";

    const { data: tokenRow } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", contactUserId)
      .maybeSingle();

    if (tokenRow?.expo_push_token) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: tokenRow.expo_push_token,
          title: "Emergency contact request",
          body: `${driverName} wants to add you as their emergency contact in SnoozeGuard.`,
          sound: "default",
          priority: "default",
        }),
      }).catch(() => { /* non-fatal */ });
    }
  }

  return { error: null, status };
}

// ─── Pending request management ──────────────────────────────────────────────

/**
 * Get requests where someone wants to add the current user as their emergency contact.
 * These are pending and need Accept / Decline.
 */
export async function getPendingRequests(
  supabase: SupabaseClient,
  contactUserId: string,
): Promise<PendingRequest[]> {
  const { data } = await supabase
    .from("emergency_contacts")
    .select("id, user_id, created_at")
    .eq("contact_user_id", contactUserId)
    .eq("status", "pending");

  if (!data || data.length === 0) return [];

  const enriched: PendingRequest[] = [];
  for (const row of data) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", (row as { user_id: string }).user_id)
      .maybeSingle();
    enriched.push({
      id: (row as { id: string }).id,
      user_id: (row as { user_id: string }).user_id,
      driver_name: (profile as { full_name?: string } | null)?.full_name ?? "A SnoozeGuard user",
      driver_email: (profile as { email?: string } | null)?.email ?? null,
      created_at: (row as { created_at: string }).created_at,
    });
  }
  return enriched;
}

export async function acceptContactRequest(
  supabase: SupabaseClient,
  requestId: string,
): Promise<void> {
  await supabase
    .from("emergency_contacts")
    .update({ status: "accepted" })
    .eq("id", requestId);
}

export async function declineContactRequest(
  supabase: SupabaseClient,
  requestId: string,
): Promise<void> {
  await supabase
    .from("emergency_contacts")
    .delete()
    .eq("id", requestId);
}

// ─── Push token ───────────────────────────────────────────────────────────────

export async function registerPushToken(
  supabase: SupabaseClient,
  userId: string,
  token: string,
): Promise<void> {
  await supabase
    .from("push_tokens")
    .upsert({ user_id: userId, expo_push_token: token }, { onConflict: "user_id" });
}

// ─── Location ────────────────────────────────────────────────────────────────

export type LocationSnapshot = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

export async function captureLocation(): Promise<LocationSnapshot | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy };
  } catch {
    return null;
  }
}

// ─── SMS via Supabase Edge Function ──────────────────────────────────────────

const SMS_FUNCTION_SECRET = "sg-sms-2026";

async function sendAutoSms(
  supabase: SupabaseClient,
  phone: string,
  driverName: string,
  location: LocationSnapshot | null,
): Promise<void> {
  if (!phone?.trim()) {
    console.log("[SMS] Skipped — phone is empty");
    return;
  }
  console.log("[SMS] Invoking dynamic-worker for phone:", phone.trim().slice(0, 6) + "***");
  try {
    const res = await fetch("https://cjxxdqyhqscfklktxohq.supabase.co/functions/v1/dynamic-worker", {
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
    const text = await res.text();
    console.log("[SMS] Status:", res.status, "Response:", text.slice(0, 200));
  } catch (e) {
    console.log("[SMS] Exception:", String(e));
  }
}

// ─── Emergency alert ─────────────────────────────────────────────────────────

export async function triggerEmergencyAlert(
  supabase: SupabaseClient,
  userId: string,
  driverName: string,
  sessionId: string | null,
  smsEnabled?: boolean,
): Promise<{ alertId: string | null; location: LocationSnapshot | null }> {
  console.log("[Alert] triggerEmergencyAlert — smsEnabled:", smsEnabled, "userId:", userId);
  const location = await captureLocation();
  console.log("[Alert] Location captured:", location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "null");

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

  const alertId = data?.id ?? null;

  // Only notify if emergency contact has accepted
  const ec = await getEmergencyContact(supabase, userId);
  console.log("[Alert] EC found:", ec ? `${ec.contact_name} status=${ec.status} phone=${ec.contact_phone ? "yes" : "no"} userId=${ec.contact_user_id ? "yes" : "no"}` : "null");
  if (!ec || ec.status !== "accepted") {
    console.log("[Alert] Skipping notifications — EC missing or not accepted");
    return { alertId, location };
  }

  const pushBody = location
    ? `${driverName} needs a check-in. Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
    : `${driverName} triggered a drowsiness alert — please check in.`;

  // Push notification if contact is registered
  console.log("[Alert] Push check — contact_user_id:", ec.contact_user_id ? "yes" : "no (not a SnoozeGuard user)");
  if (ec.contact_user_id) {
    const { data: tokenRow } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", ec.contact_user_id)
      .maybeSingle();
    console.log("[Alert] Push token found:", tokenRow?.expo_push_token ? "yes" : "no");

    if (tokenRow?.expo_push_token) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: tokenRow.expo_push_token,
          title: "Check in on a driver",
          body: pushBody,
          data: { alertId, userId, lat: location?.lat, lng: location?.lng },
          sound: "default",
          priority: "high",
        }),
      }).catch(() => { /* non-fatal */ });
    }
  }

  // SMS via Edge Function — send regardless of whether contact is in the app
  console.log("[Alert] SMS check — smsEnabled:", smsEnabled, "contact_phone:", ec.contact_phone ? "yes" : "no");
  if (smsEnabled && ec.contact_phone) {
    await sendAutoSms(supabase, ec.contact_phone, driverName, location);
  } else {
    console.log("[Alert] SMS skipped —", !smsEnabled ? "smsEnabled is false (toggle off in admin)" : "no contact phone");
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

export async function dismissEmergencyAlert(
  supabase: SupabaseClient,
  alertId: string,
): Promise<void> {
  await supabase
    .from("emergency_alert_events")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", alertId);
}
