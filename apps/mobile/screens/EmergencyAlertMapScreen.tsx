import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSession } from "../context/SessionContext";
import { supabase } from "../lib/supabase";
import {
  acceptContactRequest,
  declineContactRequest,
  dismissEmergencyAlert,
  getPendingRequests,
  type PendingRequest,
} from "../lib/emergencyNotify";
import { theme } from "../theme";

type AlertStatus = "active" | "alerted" | "dismissed";

type AlertEvent = {
  id: string;
  user_id: string;
  location_lat: number | null;
  location_lng: number | null;
  status: AlertStatus;
  created_at: string;
  acknowledged_at?: string | null;
  driver_name?: string;
  driver_phone?: string;
};

const HISTORY_HOURS = 24;

/** Shows last 5 chars of the local part + full domain — e.g. "•••••oobar@gmail.com" */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(-5);
  const hidden  = "•".repeat(Math.max(0, local.length - 5));
  return `${hidden}${visible}@${domain}`;
}

export function EmergencyAlertMapScreen({ onActionDone }: { onActionDone?: () => void }) {
  const session = useSession();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AlertEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    // Load pending contact requests (someone wants to add this user as emergency contact)
    const requests = await getPendingRequests(supabase, session.user.id);
    setPending(requests);

    // Find accepted drivers where this user is emergency contact
    const [byUserId, byEmail] = await Promise.all([
      supabase
        .from("emergency_contacts")
        .select("user_id")
        .eq("contact_user_id", session.user.id)
        .eq("status", "accepted"),
      supabase
        .from("emergency_contacts")
        .select("user_id")
        .ilike("contact_email", session.user.email ?? "__no_email__")
        .neq("status", "pending"),
    ]);

    const allDriverIds = Array.from(new Set([
      ...(byUserId.data ?? []).map((c) => c.user_id as string),
      ...(byEmail.data ?? []).map((c) => c.user_id as string),
    ]));

    if (allDriverIds.length === 0) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const since = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000).toISOString();
    const { data: events } = await supabase
      .from("emergency_alert_events")
      .select("id, user_id, location_lat, location_lng, status, created_at, acknowledged_at")
      .in("user_id", allDriverIds)
      .in("status", ["active", "alerted"])
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    const enriched: AlertEvent[] = [];
    for (const ev of events ?? []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", ev.user_id)
        .maybeSingle();
      enriched.push({
        ...(ev as AlertEvent),
        driver_name: (profile as { full_name?: string; phone?: string } | null)?.full_name ?? "Driver",
        driver_phone: (profile as { full_name?: string; phone?: string } | null)?.phone ?? undefined,
      });
    }

    setAlerts(enriched);
    const firstActive = enriched.find((a) => a.status === "active");
    const autoSelect = firstActive ?? enriched[0] ?? null;
    if (autoSelect && autoSelect.id !== selected?.id) {
      setSelected(autoSelect);
      if (autoSelect.status === "active") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }

    setLoading(false);
  }, [session.user.id, session.user.email, selected?.id]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
        <Text style={styles.loadingText}>Loading alerts…</Text>
      </View>
    );
  }

  const hasContent = pending.length > 0 || alerts.length > 0;

  if (!hasContent) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>✓</Text>
        <Text style={styles.emptyTitle}>No active alerts</Text>
        <Text style={styles.emptyHint}>
          You'll see alerts here when a driver you're emergency contact for needs help.
          Contact requests from drivers also appear here.
        </Text>
        <Pressable style={styles.refreshBtn} onPress={() => void load()}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>

      {/* ── Pending contact requests ── */}
      {pending.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Requests</Text>
          {pending.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestInfo}>
                <Text style={styles.requestName}>{req.driver_name}</Text>
                {req.driver_email ? (
                  <Text style={styles.requestEmail}>
                    {maskEmail(req.driver_email)}
                  </Text>
                ) : null}
                <Text style={styles.requestSub}>
                  wants to add you as their emergency contact
                </Text>
              </View>
              <View style={styles.requestBtns}>
                <Pressable
                  style={[styles.reqBtn, styles.acceptBtn]}
                  onPress={async () => {
                    await acceptContactRequest(supabase, req.id);
                    void load();
                    onActionDone?.();
                  }}
                >
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </Pressable>
                <Pressable
                  style={[styles.reqBtn, styles.declineBtn]}
                  onPress={async () => {
                    await declineContactRequest(supabase, req.id);
                    void load();
                    onActionDone?.();
                  }}
                >
                  <Text style={styles.declineBtnText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Active / acknowledged alerts ── */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Alerts</Text>

          {/* Driver chips if multiple */}
          {alerts.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipContent}
              style={styles.chipRow}
            >
              {alerts.map((a) => (
                <Pressable
                  key={a.id}
                  style={[
                    styles.chip,
                    selected?.id === a.id && styles.chipSelected,
                    a.status === "alerted" && styles.chipAlerted,
                  ]}
                  onPress={() => setSelected(a)}
                >
                  <Text style={styles.chipName}>{a.driver_name}</Text>
                  <Text style={styles.chipStatus}>
                    {a.status === "active" ? "🚨 Active" : "✓ Alert"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Selected alert card */}
          {selected && (
            <View style={styles.card}>
              {selected.status === "active" ? (
                <View style={[styles.badge, styles.badgeActive]}>
                  <Text style={[styles.badgeText, { color: theme.tertiary }]}>🚨  ACTIVE ALERT</Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.badgeAlerted]}>
                  <Text style={[styles.badgeText, { color: "#4ade80" }]}>✓  DRIVER IS ALERT</Text>
                </View>
              )}

              <Text style={styles.driverName}>{selected.driver_name ?? "Driver"}</Text>
              <Text style={styles.timeText}>
                Triggered at {new Date(selected.created_at).toLocaleTimeString()}
              </Text>
              {selected.acknowledged_at && (
                <Text style={styles.timeText}>
                  Acknowledged at {new Date(selected.acknowledged_at).toLocaleTimeString()}
                </Text>
              )}

              {selected.location_lat && selected.location_lng ? (
                <View style={styles.locationBlock}>
                  <Text style={styles.locationLabel}>LAST KNOWN LOCATION</Text>
                  <Text style={styles.coords}>
                    {selected.location_lat.toFixed(6)}, {selected.location_lng.toFixed(6)}
                  </Text>
                  <Pressable
                    style={styles.mapsBtn}
                    onPress={() =>
                      void Linking.openURL(
                        `https://maps.google.com/?q=${selected.location_lat},${selected.location_lng}`,
                      )
                    }
                  >
                    <Text style={styles.mapsBtnText}>🗺  Open in Google Maps</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.locationBlock}>
                  <Text style={styles.locationLabel}>LOCATION</Text>
                  <Text style={styles.noLocationText}>Not captured for this alert</Text>
                </View>
              )}

              <View style={styles.actionRow}>
                {selected.driver_phone && (
                  <>
                    <Pressable
                      style={[styles.actionBtn, styles.callBtn]}
                      onPress={() => void Linking.openURL(`tel:${selected.driver_phone}`)}
                    >
                      <Text style={styles.actionBtnText}>📞 Call</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.smsBtn]}
                      onPress={() =>
                        void Linking.openURL(
                          `sms:${selected.driver_phone}&body=Got your SnoozeGuard alert — are you okay?`,
                        )
                      }
                    >
                      <Text style={styles.actionBtnText}>💬 SMS</Text>
                    </Pressable>
                  </>
                )}
              </View>

              {selected.status === "active" ? (
                <Pressable
                  style={styles.resolveBtn}
                  onPress={async () => {
                    await dismissEmergencyAlert(supabase, selected.id);
                    void load();
                    onActionDone?.();
                  }}
                >
                  <Text style={styles.resolveText}>Mark as resolved</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.refreshSmall} onPress={() => void load()}>
                  <Text style={styles.refreshSmallText}>Refresh</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: theme.background },
  loadingText: { color: theme.onSurfaceVariant, marginTop: 12 },
  emptyIcon: { fontSize: 44, color: "#4ade80", marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.onSurface, marginBottom: 8 },
  emptyHint: { color: theme.onSurfaceVariant, textAlign: "center", fontSize: 13, lineHeight: 20 },
  refreshBtn: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: theme.surfaceContainerLow, borderRadius: 14 },
  refreshText: { color: theme.onSurface, fontWeight: "600" },

  section: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: theme.onSurfaceVariant, letterSpacing: 1, textTransform: "uppercase" },

  // Pending request cards
  requestCard: {
    backgroundColor: theme.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: `${theme.primary}33`,
    gap: 12,
  },
  requestInfo: { gap: 2 },
  requestName: { fontSize: 16, fontWeight: "700", color: theme.onSurface },
  requestEmail: { fontSize: 12, color: theme.primary, fontFamily: "monospace", marginTop: 1 },
  requestSub: { fontSize: 13, color: theme.onSurfaceVariant, marginTop: 2 },
  requestBtns: { flexDirection: "row", gap: 10 },
  reqBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  acceptBtn: { backgroundColor: `${theme.primary}22`, borderColor: `${theme.primary}66` },
  acceptBtnText: { color: theme.primary, fontWeight: "700", fontSize: 14 },
  declineBtn: { backgroundColor: `${theme.tertiary}11`, borderColor: `${theme.tertiary}44` },
  declineBtnText: { color: theme.onSurfaceVariant, fontWeight: "600", fontSize: 14 },

  // Chip row
  chipRow: { maxHeight: 68 },
  chipContent: { gap: 8, paddingBottom: 4 },
  chip: { backgroundColor: theme.surfaceContainerLow, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: `${theme.outlineVariant}55` },
  chipSelected: { borderColor: theme.tertiary },
  chipAlerted: { borderColor: "#4ade8088" },
  chipName: { color: theme.onSurface, fontSize: 13, fontWeight: "700" },
  chipStatus: { color: theme.onSurfaceVariant, fontSize: 11, marginTop: 2 },

  // Alert card
  card: { backgroundColor: theme.surfaceContainerLow, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: `${theme.outlineVariant}33`, gap: 10 },
  badge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start", borderWidth: 1 },
  badgeText: { fontWeight: "800", fontSize: 12, letterSpacing: 0.8 },
  badgeActive: { backgroundColor: `${theme.tertiary}18`, borderColor: `${theme.tertiary}55` },
  badgeAlerted: { backgroundColor: "#4ade8018", borderColor: "#4ade8055" },
  driverName: { fontSize: 26, fontWeight: "800", color: theme.onSurface },
  timeText: { color: theme.onSurfaceVariant, fontSize: 12 },

  locationBlock: { backgroundColor: `${theme.background}99`, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: `${theme.outlineVariant}33`, gap: 6 },
  locationLabel: { color: theme.onSurfaceVariant, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  coords: { color: theme.onSurface, fontSize: 13, fontFamily: "monospace" },
  noLocationText: { color: theme.onSurfaceVariant, fontSize: 13 },
  mapsBtn: { backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  mapsBtnText: { color: theme.onPrimary, fontWeight: "700", fontSize: 14 },

  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, padding: 13, borderRadius: 14, alignItems: "center", borderWidth: 1 },
  callBtn: { backgroundColor: "#4ade8022", borderColor: "#4ade8066" },
  smsBtn: { backgroundColor: `${theme.primary}22`, borderColor: `${theme.primary}66` },
  actionBtnText: { color: theme.onSurface, fontWeight: "700", fontSize: 13 },

  resolveBtn: { alignItems: "center", paddingVertical: 10 },
  resolveText: { color: theme.tertiary, fontSize: 13, textDecorationLine: "underline" },
  refreshSmall: { alignItems: "center", paddingVertical: 10 },
  refreshSmallText: { color: theme.onSurfaceVariant, fontSize: 12, textDecorationLine: "underline" },
});
