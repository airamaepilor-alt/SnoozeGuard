import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";
import { InfoModal } from "../components/InfoModal";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { getDatabase } from "../db/database";
import type { MainTabParamList } from "../navigation/types";
import { useTheme } from "../context/ThemeContext";
import type { Theme } from "../theme";

type Props = { session: Session; onSignOut?: () => void };

type DashboardMetrics = {
  ok: boolean;
  session_count_total: number;
  avg_drowsiness: number;
  avg_drive_seconds: number;
  drowsy_events: number;
  total_drive_seconds: number;
  focus_score: number | null;
  peak_hour: number | null;
  safest_hour: number | null;
};

type TooltipKey = "focus" | "sessions" | "drivetime" | "avgsession" | "drowsyevents" | null;

function dashboardFirstName(user: Session["user"]): string {
  const full = user.user_metadata?.full_name;
  if (typeof full === "string" && full.trim()) {
    const part = full.trim().split(/\s+/)[0];
    return part || "there";
  }
  const email = user.email;
  if (email) return email.split("@")[0] || "there";
  return "there";
}

function greetingHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function focusColor(score: number | null, t: Theme): string {
  if (score === null) return t.onSurfaceVariant;
  if (score >= 75) return "#4ade80";
  if (score >= 50) return t.secondary;
  return t.tertiary;
}

function formatDriveTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatHour(hr: number | null): string {
  if (hr === null) return "—";
  const suffix = hr >= 12 ? "PM" : "AM";
  const h = hr % 12 || 12;
  return `${h}:00 ${suffix}`;
}

const FILTER_OPTIONS = [
  { label: "1 Week", days: 7 },
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "All Time", days: 0 },
];

const TOOLTIPS: Record<NonNullable<TooltipKey>, { title: string; body: string }> = {
  focus: {
    title: "Focus Score",
    body: "A score from 0–100 based on your average drowsiness level across sessions. Higher is better. 100 means zero drowsiness detected; lower scores indicate more fatigue events were detected during your drives.",
  },
  sessions: {
    title: "Sessions",
    body: "Total number of driving sessions recorded in the selected time period. Each session starts when you tap 'Start Driving' and ends when you stop.",
  },
  drivetime: {
    title: "Drive Time",
    body: "Total time spent driving across all sessions in the selected period. Use this to understand how much you've been on the road.",
  },
  avgsession: {
    title: "Avg Session",
    body: "Average duration of a single driving session. Longer sessions increase fatigue risk — consider taking breaks every 2 hours.",
  },
  drowsyevents: {
    title: "Drowsy Events",
    body: "Total number of drowsiness signals detected: yawns, head drops, and head tilts combined. More events = higher fatigue load. Aim to keep this low by getting enough sleep before driving.",
  },
};

export function HomeScreen({ session }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterDays, setFilterDays] = useState(30);
  const [tooltip, setTooltip] = useState<TooltipKey>(null);

  const firstName = useMemo(() => dashboardFirstName(session.user), [session.user]);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      const db = getDatabase();
      const since = filterDays > 0
        ? new Date(Date.now() - filterDays * 86400 * 1000).toISOString()
        : null;
      const rows = db.getAllSync<{
        started_at: string;
        ended_at: string | null;
        avg_drowsiness: number | null;
        yawn_sum: number;
        head_sum: number;
        tilt_sum: number;
        brake_sum: number;
        sample_count: number;
      }>(
        `SELECT
           s.started_at,
           s.ended_at,
           AVG(t.drowsiness_level)                                      AS avg_drowsiness,
           COALESCE(SUM(t.yawn_count_delta), 0)                         AS yawn_sum,
           COALESCE(SUM(t.head_event_count_delta), 0)                   AS head_sum,
           COALESCE(SUM(t.head_tilt_delta), 0)                          AS tilt_sum,
           COALESCE(SUM(CASE WHEN t.sudden_brake = 1 THEN 1 ELSE 0 END), 0) AS brake_sum,
           COUNT(t.id)                                                   AS sample_count
         FROM driving_sessions_local s
         LEFT JOIN session_telemetry_local t ON t.local_session_id = s.id
         WHERE s.user_id = ?${since ? " AND s.started_at >= ?" : ""}
         GROUP BY s.id
         ORDER BY s.started_at DESC`,
        ...(since ? [session.user.id, since] : [session.user.id]),
      );

      if (rows.length === 0) {
        setMetrics(null);
        return;
      }

      const totalDriveSeconds = rows.reduce((acc, r) => {
        if (r.started_at && r.ended_at) {
          acc += (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 1000;
        }
        return acc;
      }, 0);

      const avgValues = rows.map((r) => Number(r.avg_drowsiness ?? 0));
      const avgDrowsiness = avgValues.length > 0
        ? avgValues.reduce((a, b) => a + b, 0) / avgValues.length
        : 0;

      const avgDriveSeconds = rows.length > 0 ? Math.round(totalDriveSeconds / rows.length) : 0;
      const focusScore = Math.max(0, Math.round(100 - avgDrowsiness * 10));
      const drowsyEvents = rows.reduce((acc, r) => acc + r.yawn_sum + r.head_sum + r.tilt_sum, 0);

      setMetrics({
        ok: true,
        session_count_total: rows.length,
        avg_drowsiness: avgDrowsiness,
        avg_drive_seconds: avgDriveSeconds,
        drowsy_events: drowsyEvents,
        total_drive_seconds: Math.round(totalDriveSeconds),
        focus_score: focusScore,
        peak_hour: null,
        safest_hour: null,
      });
    } catch {
      // DB not ready yet
    } finally {
      setLoading(false);
    }
  }, [session.user.id, filterDays]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const score = metrics?.focus_score ?? null;

  const activeTooltip = tooltip ? TOOLTIPS[tooltip] : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {activeTooltip && (
        <InfoModal
          visible
          title={activeTooltip.title}
          body={activeTooltip.body}
          onClose={() => setTooltip(null)}
        />
      )}

      <Text style={styles.kicker}>SNOOZEGUARD</Text>
      <Text style={styles.greet}>
        {greetingHour()}, <Text style={styles.greetAccent}>{firstName}</Text>
      </Text>
      <Text style={styles.sub}>Stay sharp on the road.</Text>

      {/* Date filter pills */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => (
          <Pressable
            key={opt.days}
            style={[styles.filterPill, filterDays === opt.days && styles.filterPillActive]}
            onPress={() => setFilterDays(opt.days)}
          >
            <Text style={[styles.filterPillText, filterDays === opt.days && styles.filterPillTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Focus score hero card */}
      <View style={styles.heroCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.heroLabel}>FOCUS SCORE</Text>
          <Pressable onPress={() => setTooltip("focus")} hitSlop={8}>
            <MaterialIcons name="info-outline" size={16} color={theme.onSurfaceVariant} />
          </Pressable>
        </View>
        <Text style={[styles.heroStat, { color: focusColor(score, theme) }]}>
          {loading ? "…" : score !== null ? `${score} / 100` : "No data yet"}
        </Text>
        <Text style={styles.heroUnit}>
          {metrics && metrics.avg_drowsiness > 0
            ? `avg drowsiness ${Number(metrics.avg_drowsiness).toFixed(1)} / 10 · ${metrics.session_count_total} sessions`
            : loading
              ? "Fetching your stats…"
              : "Start a session to see your score"}
        </Text>
      </View>

      {/* Stats grid row 1 */}
      <View style={styles.row}>
        <View style={[styles.tile, styles.tilePrimary]}>
          <View style={styles.cardHeader}>
            <Text style={styles.tileLabel}>SESSIONS</Text>
            <Pressable onPress={() => setTooltip("sessions")} hitSlop={8}>
              <MaterialIcons name="info-outline" size={13} color={theme.onSurfaceVariant} />
            </Pressable>
          </View>
          <Text style={styles.tileStat}>{loading ? "…" : metrics?.session_count_total ?? 0}</Text>
          <Text style={styles.tileUnit}>total recorded</Text>
        </View>
        <View style={[styles.tile, styles.tileSecondary]}>
          <View style={styles.cardHeader}>
            <Text style={styles.tileLabel}>DRIVE TIME</Text>
            <Pressable onPress={() => setTooltip("drivetime")} hitSlop={8}>
              <MaterialIcons name="info-outline" size={13} color={theme.onSurfaceVariant} />
            </Pressable>
          </View>
          <Text style={styles.tileStat}>
            {loading ? "…" : metrics ? formatDriveTime(metrics.total_drive_seconds) : "—"}
          </Text>
          <Text style={styles.tileUnit}>{FILTER_OPTIONS.find(o => o.days === filterDays)?.label ?? ""}</Text>
        </View>
      </View>

      {/* Stats grid row 2 */}
      <View style={styles.row}>
        <View style={[styles.tile, styles.tileAlt]}>
          <View style={styles.cardHeader}>
            <Text style={styles.tileLabel}>AVG SESSION</Text>
            <Pressable onPress={() => setTooltip("avgsession")} hitSlop={8}>
              <MaterialIcons name="info-outline" size={13} color={theme.onSurfaceVariant} />
            </Pressable>
          </View>
          <Text style={styles.tileStat}>
            {loading ? "…" : metrics ? formatDriveTime(metrics.avg_drive_seconds) : "—"}
          </Text>
          <Text style={styles.tileUnit}>per drive</Text>
        </View>
        <View style={[styles.tile, styles.tileAlt]}>
          <View style={styles.cardHeader}>
            <Text style={styles.tileLabel}>DROWSY EVENTS</Text>
            <Pressable onPress={() => setTooltip("drowsyevents")} hitSlop={8}>
              <MaterialIcons name="info-outline" size={13} color={theme.onSurfaceVariant} />
            </Pressable>
          </View>
          <Text style={styles.tileStat}>{loading ? "…" : metrics?.drowsy_events ?? 0}</Text>
          <Text style={styles.tileUnit}>yawns + nods + tilts</Text>
        </View>
      </View>

      {/* Peak hour insight */}
      {metrics && metrics.peak_hour !== null ? (
        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>PEAK FATIGUE HOUR</Text>
          <Text style={styles.insightValue}>{formatHour(metrics.peak_hour)}</Text>
          {metrics.safest_hour !== null ? (
            <Text style={styles.insightSub}>Safest window: {formatHour(metrics.safest_hour)}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Primary CTA */}
      <Pressable style={styles.startBtn} onPress={() => navigation.navigate("Drive")}>
        <Text style={styles.startBtnText}>Start Driving</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.background },
  container: { padding: 24, paddingTop: 16, paddingBottom: 40 },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 4 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: t.onSurfaceVariant },
  filterPillActive: { backgroundColor: t.primary, borderColor: t.primary },
  filterPillText: { fontSize: 12, fontWeight: "600", color: t.onSurfaceVariant },
  filterPillTextActive: { color: t.onPrimary },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 3, color: t.onSurfaceVariant },
  greet: { marginTop: 12, fontSize: 26, fontWeight: "800", color: t.onSurface },
  greetAccent: { color: t.primary },
  sub: { marginTop: 6, fontSize: 14, color: t.onSurfaceVariant },
  heroCard: {
    marginTop: 24, padding: 20, borderRadius: 20,
    backgroundColor: `${t.surfaceContainerHigh}cc`,
    borderWidth: 1, borderColor: `${t.outlineVariant}55`,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: t.onSurfaceVariant },
  heroStat: { marginTop: 8, fontSize: 32, fontWeight: "800" },
  heroUnit: { marginTop: 4, fontSize: 12, color: t.onSurfaceVariant },
  row: { flexDirection: "row", gap: 12, marginTop: 12 },
  tile: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1 },
  tilePrimary: { backgroundColor: `${t.surfaceContainer}aa`, borderColor: `${t.primary}33` },
  tileSecondary: { backgroundColor: `${t.surfaceContainer}aa`, borderColor: `${t.secondary}44` },
  tileAlt: { backgroundColor: `${t.surfaceContainer}aa`, borderColor: `${t.outlineVariant}55` },
  tileLabel: { fontSize: 9, fontWeight: "700", color: t.onSurfaceVariant, letterSpacing: 1 },
  tileStat: { fontSize: 22, fontWeight: "800", color: t.onSurface },
  tileUnit: { marginTop: 2, fontSize: 10, color: t.onSurfaceVariant },
  insightCard: {
    marginTop: 12, padding: 14, borderRadius: 16,
    backgroundColor: `${t.surfaceContainer}88`,
    borderWidth: 1, borderColor: `${t.secondary}44`,
  },
  insightLabel: { fontSize: 9, fontWeight: "700", color: t.onSurfaceVariant, letterSpacing: 1 },
  insightValue: { marginTop: 4, fontSize: 18, fontWeight: "800", color: t.secondary },
  insightSub: { marginTop: 2, fontSize: 11, color: t.onSurfaceVariant },
  startBtn: {
    marginTop: 24, backgroundColor: t.primary, padding: 18,
    borderRadius: 20, alignItems: "center",
    shadowColor: t.primary, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  startBtnText: { color: t.onPrimary, fontWeight: "800", fontSize: 17 },
});
