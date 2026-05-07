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

export type EmergencyContactEntry = {
  id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_user_id: string | null;
  status: "pending" | "accepted";
  is_active: boolean;
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
  const { data, error } = await supabase.rpc("get_user_id_by_email", {
    p_email: email.trim().toLowerCase(),
  });
  if (error || !data) return null;
  return data as string;
}

// ─── Emergency contact CRUD ──────────────────────────────────────────────────

/** Returns the currently active emergency contact for the driver. */
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

/** Returns all emergency contacts for the driver, active first. */
export async function listEmergencyContacts(
  supabase: SupabaseClient,
  userId: string,
): Promise<EmergencyContactEntry[]> {
  const { data } = await supabase
    .from("emergency_contacts")
    .select("id, contact_name, contact_phone, contact_email, contact_user_id, status, is_active")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });
  if (!data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    contact_name: row.contact_name as string,
    contact_phone: row.contact_phone as string | null,
    contact_email: row.contact_email as string | null,
    contact_user_id: row.contact_user_id as string | null,
    status: (row.status as string) === "pending" ? "pending" : "accepted",
    is_active: Boolean(row.is_active),
  }));
}

/** Adds a new emergency contact. Automatically activates it if it's the first one. */
export async function addEmergencyContact(
  supabase: SupabaseClient,
  userId: string,
  contact: { contact_name: string; contact_phone: string; contact_email: string },
): Promise<{ error: string | null; id: string | null; status: "pending" | "accepted" }> {
  const contactUserId = contact.contact_email
    ? await lookupUserByEmail(supabase, contact.contact_email)
    : null;
  const status: "pending" | "accepted" = contactUserId ? "pending" : "accepted";

  // If no contacts exist yet, make this one active
  const { count: activeCount } = await supabase
    .from("emergency_contacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true);
  const shouldAutoActivate = (activeCount ?? 0) < 3;

  const { data, error } = await supabase
    .from("emergency_contacts")
    .insert({
      user_id: userId,
      contact_name: contact.contact_name,
      contact_phone: contact.contact_phone || null,
      contact_email: contact.contact_email || null,
      contact_user_id: contactUserId,
      status,
      is_active: shouldAutoActivate,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, id: null, status };

  const newId = (data as { id: string } | null)?.id ?? null;

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

  return { error: null, id: newId, status };
}

/** Updates an existing emergency contact by its ID. */
export async function updateEmergencyContact(
  supabase: SupabaseClient,
  contactId: string,
  userId: string,
  contact: { contact_name: string; contact_phone: string; contact_email: string },
): Promise<{ error: string | null; status: "pending" | "accepted" }> {
  const contactUserId = contact.contact_email
    ? await lookupUserByEmail(supabase, contact.contact_email)
    : null;
  const status: "pending" | "accepted" = contactUserId ? "pending" : "accepted";

  const { error } = await supabase
    .from("emergency_contacts")
    .update({
      contact_name: contact.contact_name,
      contact_phone: contact.contact_phone || null,
      contact_email: contact.contact_email || null,
      contact_user_id: contactUserId,
      status,
    })
    .eq("id", contactId)
    .eq("user_id", userId);

  if (error) return { error: error.message, status };
  return { error: null, status };
}

/** Removes an emergency contact by ID. */
export async function removeEmergencyContactById(
  supabase: SupabaseClient,
  contactId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("emergency_contacts")
    .delete()
    .eq("id", contactId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  return { error: null };
}

/** Toggles a contact's active state. Max 3 active guardians per driver. */
export async function toggleActiveEmergencyContact(
  supabase: SupabaseClient,
  userId: string,
  contactId: string,
): Promise<{ error: string | null; nowActive: boolean }> {
  const { data: current } = await supabase
    .from("emergency_contacts")
    .select("is_active")
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();

  const isCurrentlyActive = Boolean((current as { is_active?: boolean } | null)?.is_active);

  if (isCurrentlyActive) {
    const { error } = await supabase
      .from("emergency_contacts")
      .update({ is_active: false })
      .eq("id", contactId)
      .eq("user_id", userId);
    if (error) return { error: error.message, nowActive: true };
    return { error: null, nowActive: false };
  }

  const { count } = await supabase
    .from("emergency_contacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true);

  if ((count ?? 0) >= 3) {
    return { error: "Maximum of 3 active guardians allowed. Deactivate one first.", nowActive: false };
  }

  const { error } = await supabase
    .from("emergency_contacts")
    .update({ is_active: true })
    .eq("id", contactId)
    .eq("user_id", userId);
  if (error) return { error: error.message, nowActive: false };
  return { error: null, nowActive: true };
}

/**
 * Compat shim used by ProfileScreen and EmergencyContactSetupModal.
 * Updates the active contact if one exists, otherwise adds a new one (auto-activated).
 */
export async function upsertEmergencyContact(
  supabase: SupabaseClient,
  userId: string,
  contact: { contact_name: string; contact_phone: string; contact_email: string },
): Promise<{ error: string | null; status: "pending" | "accepted" }> {
  const existing = await getEmergencyContact(supabase, userId);
  if (existing) {
    return updateEmergencyContact(supabase, existing.id, userId, contact);
  }
  const res = await addEmergencyContact(supabase, userId, contact);
  return { error: res.error, status: res.status };
}

// ─── Pending request management ──────────────────────────────────────────────

export async function getPendingRequests(
  supabase: SupabaseClient,
  contactUserId: string,
  contactEmail?: string | null,
): Promise<PendingRequest[]> {
  const [byId, byEmail] = await Promise.all([
    supabase
      .from("emergency_contacts")
      .select("id, user_id, created_at")
      .eq("contact_user_id", contactUserId)
      .eq("status", "pending"),
    contactEmail
      ? supabase
          .from("emergency_contacts")
          .select("id, user_id, created_at")
          .ilike("contact_email", contactEmail)
          .eq("status", "pending")
      : Promise.resolve({ data: [] }),
  ]);

  // Deduplicate by row id
  const seen = new Set<string>();
  const rows: Array<{ id: string; user_id: string; created_at: string }> = [];
  for (const row of [...(byId.data ?? []), ...(byEmail.data ?? [])]) {
    const rowId = (row as { id: string }).id;
    if (rowId && !seen.has(rowId)) {
      seen.add(rowId);
      rows.push(row as typeof rows[number]);
    }
  }

  if (rows.length === 0) return [];

  const enriched: PendingRequest[] = [];
  for (const row of rows) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", row.user_id)
      .maybeSingle();
    enriched.push({
      id: row.id,
      user_id: row.user_id,
      driver_name: (profile as { full_name?: string } | null)?.full_name ?? "A SnoozeGuard user",
      driver_email: (profile as { email?: string } | null)?.email ?? null,
      created_at: row.created_at,
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

  // Notify all active accepted emergency contacts (up to 3)
  const { data: activeRows } = await supabase
    .from("emergency_contacts")
    .select("id, contact_name, contact_phone, contact_email, contact_user_id, status")
    .eq("user_id", userId)
    .eq("is_active", true);

  const activeContacts: EmergencyContact[] = ((activeRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    contact_name: row.contact_name as string,
    contact_phone: row.contact_phone as string | null,
    contact_email: row.contact_email as string | null,
    contact_user_id: row.contact_user_id as string | null,
    status: (row.status as string) === "pending" ? "pending" : "accepted",
  }));

  const acceptedContacts = activeContacts.filter((ec) => ec.status === "accepted");
  console.log("[Alert] Active ECs:", activeContacts.length, "accepted:", acceptedContacts.length);

  if (acceptedContacts.length === 0) {
    console.log("[Alert] Skipping notifications — no accepted active contacts");
    return { alertId, location };
  }

  const pushBody = location
    ? `${driverName} needs a check-in. Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
    : `${driverName} triggered a drowsiness alert — please check in.`;

  for (const ec of acceptedContacts) {
    console.log("[Alert] Notifying:", ec.contact_name, "userId:", ec.contact_user_id ? "yes" : "no");

    if (ec.contact_user_id) {
      const { data: tokenRow } = await supabase
        .from("push_tokens")
        .select("expo_push_token")
        .eq("user_id", ec.contact_user_id)
        .maybeSingle();

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

    console.log("[Alert] SMS check — smsEnabled:", smsEnabled, "phone:", ec.contact_phone ? "yes" : "no");
    if (smsEnabled && ec.contact_phone) {
      await sendAutoSms(supabase, ec.contact_phone, driverName, location);
    }
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
