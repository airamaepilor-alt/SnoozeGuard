import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { getDatabase } from "../db/database";
import { isOnline } from "../sync/flush";
import {
  acceptContactRequest,
  declineContactRequest,
  dismissEmergencyAlert,
  getPendingRequests,
  type PendingRequest,
} from "../lib/emergencyNotify";
import type { Theme } from "../theme";

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

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(-5);
  const hidden  = "•".repeat(Math.max(0, local.length - 5));
  return `${hidden}${visible}@${domain}`;
}

export function EmergencyAlertMapScreen({ onActionDone }: { onActionDone?: () => void }) {
  const session = useSession();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AlertEvent | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const loadingRef = useRef(false);

  function readAlertsFromCache(): AlertEvent[] {
    try {
      return getDatabase().getAllSync<AlertEvent>(
        `SELECT id, user_id, location_lat, location_lng, status, created_at,
                acknowledged_at, driver_name, driver_phone
         FROM emergency_alert_events_local
         WHERE status = 'active'
         ORDER BY created_at DESC`,
      );
    } catch { return []; }
  }

  function writeAlertsToCache(events: AlertEvent[]) {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      for (const ev of events) {
        db.runSync(
          `INSERT OR REPLACE INTO emergency_alert_events_local
           (id, user_id, location_lat, location_lng, status, created_at,
            acknowledged_at, driver_name, driver_phone, cached_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ev.id, ev.user_id, ev.location_lat ?? null, ev.location_lng ?? null,
          ev.status, ev.created_at, ev.acknowledged_at ?? null,
          ev.driver_name ?? "Driver", ev.driver_phone ?? null, now,
        );
      }
    } catch { /* ignore */ }
  }

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    // Show cached alerts immediately for offline-first display
    const cached = readAlertsFromCache();
    if (cached.length > 0) {
      setAlerts(cached);
      setSelected((prev) => prev ?? cached[0] ?? null);
    }

    try {
      const online = await isOnline();
      setIsOffline(!online);

      if (!online) {
        // Pending requests can't be fetched offline
        if (cached.length === 0) setAlerts([]);
        return;
      }

      const requests = await getPendingRequests(supabase, session.user.id);
      setPending(requests);

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
        return;
      }

      const since = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000).toISOString();
      const { data: events } = await supabase
        .from("emergency_alert_events")
        .select("id, user_id, location_lat, location_lng, status, created_at, acknowledged_at")
        .in("user_id", allDriverIds)
        .eq("status", "active")
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      const seenDrivers = new Set<string>();
      const deduped = (events ?? []).filter((ev) => {
        if (seenDrivers.has(ev.user_id)) return false;
        seenDrivers.add(ev.user_id);
        return true;
      });

      const enriched: AlertEvent[] = [];
      for (const ev of deduped) {
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

      // Update cache with fresh data
      writeAlertsToCache(enriched);
      setAlerts(enriched);

      if (enriched.length > 0) {
        const firstActive = enriched.find((a) => a.status === "active");
        const autoSelect = firstActive ?? enriched[0];
        setSelected((prev) => {
          if (!prev || prev.id !== autoSelect.id) {
            if (autoSelect.status === "active") {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            return autoSelect;
          }
          return autoSelect;
        });
      } else {
        setAlerts([]);
        setSelected(null);
      }
    } catch { /* keep last known state */ }
    finally {
      setLoading(false);
      loadingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id, session.user.email]);

  // Initial load + polling every 15s + realtime as bonus
  useEffect(() => {
    void load();

    const interval = setInterval(() => { void load(); }, 15_000);

    const channel = supabase
      .channel("emergency-alerts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_alert_events" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_contacts" }, () => void load())
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
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
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>Offline — showing cached alerts</Text>
        </View>
      )}

      {/* ── Pending contact requests ── */}
      {pending.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Requests</Text>
          {pending.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestInfo}>
                <Text style={styles.requestName}>{req.driver_name}</Text>
                {req.driver_email ? (
                  <Text style={styles.requestEmail}>{maskEmail(req.driver_email)}</Text>
                ) : null}
                <Text style={styles.requestSub}>wants to add you as their emergency contact</Text>
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

          {selected && (
            <View style={styles.card}>
              <View style={[styles.badge, styles.badgeActive]}>
                <Text style={[styles.badgeText, { color: theme.tertiary }]}>🚨  DROWSINESS ALERT</Text>
              </View>

              <Text style={styles.driverName}>{selected.driver_name ?? "Driver"}</Text>
              <Text style={styles.alertMessage}>
                Critical drowsiness detected — pull over and rest immediately.
              </Text>
              <Text style={styles.timeText}>
                Triggered at {new Date(selected.created_at).toLocaleString()}
              </Text>

              {/* Call + SMS side by side */}
              {selected.driver_phone ? (
                <View style={styles.contactRow}>
                  <Pressable
                    style={styles.callBtn}
                    onPress={() => void Linking.openURL(`tel:${selected.driver_phone}`)}
                  >
                    <Text style={styles.callBtnText}>📞  Call</Text>
                  </Pressable>
                  <Pressable
                    style={styles.smsBtn}
                    onPress={() =>
                      void Linking.openURL(
                        `sms:${selected.driver_phone}?body=Got your SnoozeGuard alert — are you okay?`,
                      )
                    }
                  >
                    <Text style={styles.smsBtnText}>💬  SMS</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.noPhoneNote}>
                  <Text style={styles.noPhoneText}>No phone number on file for this driver</Text>
                </View>
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
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  offlineBanner: {
    backgroundColor: `${t.secondary}22`, borderRadius: 12,
    padding: 10, borderWidth: 1, borderColor: `${t.secondary}55`, alignItems: "center",
  },
  offlineBannerText: { color: t.secondary, fontWeight: "700", fontSize: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: t.background },
  loadingText: { color: t.onSurfaceVariant, marginTop: 12 },
  emptyIcon: { fontSize: 44, color: "#4ade80", marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: t.onSurface, marginBottom: 8 },
  emptyHint: { color: t.onSurfaceVariant, textAlign: "center", fontSize: 13, lineHeight: 20 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: t.onSurfaceVariant, letterSpacing: 1, textTransform: "uppercase" },

  requestCard: {
    backgroundColor: t.surfaceContainerLow,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: `${t.primary}33`, gap: 12,
  },
  requestInfo: { gap: 2 },
  requestName: { fontSize: 16, fontWeight: "700", color: t.onSurface },
  requestEmail: { fontSize: 12, color: t.primary, fontFamily: "monospace", marginTop: 1 },
  requestSub: { fontSize: 13, color: t.onSurfaceVariant, marginTop: 2 },
  requestBtns: { flexDirection: "row", gap: 10 },
  reqBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  acceptBtn: { backgroundColor: `${t.primary}22`, borderColor: `${t.primary}66` },
  acceptBtnText: { color: t.primary, fontWeight: "700", fontSize: 14 },
  declineBtn: { backgroundColor: `${t.tertiary}11`, borderColor: `${t.tertiary}44` },
  declineBtnText: { color: t.onSurfaceVariant, fontWeight: "600", fontSize: 14 },

  chipRow: { maxHeight: 68 },
  chipContent: { gap: 8, paddingBottom: 4 },
  chip: { backgroundColor: t.surfaceContainerLow, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: `${t.outlineVariant}55` },
  chipSelected: { borderColor: t.tertiary },
  chipAlerted: { borderColor: "#4ade8088" },
  chipName: { color: t.onSurface, fontSize: 13, fontWeight: "700" },
  chipStatus: { color: t.onSurfaceVariant, fontSize: 11, marginTop: 2 },

  card: { backgroundColor: t.surfaceContainerLow, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: `${t.outlineVariant}33`, gap: 10 },
  badge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start", borderWidth: 1 },
  badgeText: { fontWeight: "800", fontSize: 12, letterSpacing: 0.8 },
  badgeActive: { backgroundColor: `${t.tertiary}18`, borderColor: `${t.tertiary}55` },
  driverName: { fontSize: 26, fontWeight: "800", color: t.onSurface },
  alertMessage: { color: t.tertiary, fontSize: 13, fontWeight: "600", lineHeight: 20 },
  timeText: { color: t.onSurfaceVariant, fontSize: 12 },

  locationBlock: { backgroundColor: `${t.background}99`, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: `${t.outlineVariant}33`, gap: 6 },
  locationLabel: { color: t.onSurfaceVariant, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  coords: { color: t.onSurface, fontSize: 13, fontFamily: "monospace" },
  noLocationText: { color: t.onSurfaceVariant, fontSize: 13 },
  mapsBtn: { backgroundColor: t.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  mapsBtnText: { color: t.onPrimary, fontWeight: "700", fontSize: 14 },

  contactRow: { flexDirection: "row", gap: 10 },
  callBtn: {
    flex: 1, backgroundColor: "#4ade8022", borderWidth: 1, borderColor: "#4ade8066",
    borderRadius: 14, paddingVertical: 13, alignItems: "center",
  },
  callBtnText: { color: "#4ade80", fontWeight: "800", fontSize: 14 },
  smsBtn: {
    flex: 1, backgroundColor: `${t.primary}22`, borderWidth: 1, borderColor: `${t.primary}66`,
    borderRadius: 14, paddingVertical: 13, alignItems: "center",
  },
  smsBtnText: { color: t.primary, fontWeight: "800", fontSize: 14 },
  noPhoneNote: {
    backgroundColor: `${t.outlineVariant}22`, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: `${t.outlineVariant}44`,
  },
  noPhoneText: { color: t.onSurfaceVariant, fontSize: 13, textAlign: "center" },

  resolveBtn: { alignItems: "center", paddingVertical: 10 },
  resolveText: { color: t.tertiary, fontSize: 13, textDecorationLine: "underline" },
});
