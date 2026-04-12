import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { supabase } from "../lib/supabase";
import { getDatabase } from "../db/database";
import type { MainTabParamList } from "../navigation/types";
import { theme } from "../theme";

type Props = { session: Session; onSignOut: () => void };

type DashboardMetrics = {
  ok: boolean;
  session_count_total: number;
  avg_drowsiness: number;
  yawn_delta_sum: number;
  head_delta_sum: number;
  l6_count: number;
  l7_count: number;
  l8_count: number;
  total_drive_seconds: number;
  focus_score: number | null;
  peak_hour: number | null;
  safest_hour: number | null;
};

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

function focusColor(score: number | null): string {
  if (score === null) return theme.onSurfaceVariant;
  if (score >= 75) return "#4ade80";
  if (score >= 50) return theme.secondary;
  return theme.tertiary;
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

export function HomeScreen({ session, onSignOut }: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const firstName = useMemo(() => dashboardFirstName(session.user), [session.user]);
  const refresh = useCallback(() => {
    setLoading(true);
    try {
      // Use the same local SQLite source as HistoryScreen for consistent counts
      const db = getDatabase();
      const rows = db.getAllSync<{
        started_at: string;
        ended_at: string | null;
        avg_drowsiness: number | null;
        yawn_sum: number;
        head_sum: number;
        sample_count: number;
      }>(
        `SELECT
           s.started_at,
           s.ended_at,
           AVG(t.drowsiness_level)                                      AS avg_drowsiness,
           COALESCE(SUM(t.yawn_count_delta), 0)                         AS yawn_sum,
           COALESCE(SUM(t.head_event_count_delta), 0)                   AS head_sum,
           COUNT(t.id)                                                   AS sample_count
         FROM driving_sessions_local s
         LEFT JOIN session_telemetry_local t ON t.local_session_id = s.id
         WHERE s.user_id = ?
         GROUP BY s.id
         ORDER BY s.started_at DESC
         LIMIT 40`,
        session.user.id,
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

      const yawnSum = rows.reduce((a, r) => a + Number(r.yawn_sum), 0);
      const headSum = rows.reduce((a, r) => a + Number(r.head_sum), 0);
      const avgValues = rows.map((r) => Number(r.avg_drowsiness ?? 0));
      const avgDrowsiness = avgValues.length > 0 ? avgValues.reduce((a, b) => a + b, 0) / avgValues.length : 0;

      // Count telemetry samples by level — query aggregated per session so we
      // use the per-session average to classify rather than individual ticks.
      const l6 = rows.filter((r) => { const a = Number(r.avg_drowsiness ?? 0); return a >= 6 && a < 7; }).length;
      const l7 = rows.filter((r) => { const a = Number(r.avg_drowsiness ?? 0); return a >= 7 && a < 8; }).length;
      const l8 = rows.filter((r) => Number(r.avg_drowsiness ?? 0) >= 8).length;
      const focusScore = Math.max(0, Math.round(100 - avgDrowsiness * 10));

      setMetrics({
        ok: true,
        session_count_total: rows.length,
        avg_drowsiness: avgDrowsiness,
        yawn_delta_sum: yawnSum,
        head_delta_sum: headSum,
        l6_count: l6,
        l7_count: l7,
        l8_count: l8,
        total_drive_seconds: Math.round(totalDriveSeconds),
        focus_score: focusScore,
        peak_hour: null,
        safest_hour: null,
      });
    } catch {
      // DB not ready yet — metrics stay null
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const score = metrics?.focus_score ?? null;
  const totalAlerts = metrics ? metrics.l6_count + metrics.l7_count + metrics.l8_count : 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>SNOOZEGUARD</Text>
      <Text style={styles.greet}>
        {greetingHour()}, <Text style={styles.greetAccent}>{firstName}</Text>
      </Text>
      <Text style={styles.sub}>Stay sharp on the road.</Text>

      {/* Focus score hero card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>FOCUS SCORE</Text>
        <Text style={[styles.heroStat, { color: focusColor(score) }]}>
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
          <Text style={styles.tileLabel}>SESSIONS</Text>
          <Text style={styles.tileStat}>{loading ? "…" : metrics?.session_count_total ?? 0}</Text>
          <Text style={styles.tileUnit}>total recorded</Text>
        </View>
        <View style={[styles.tile, styles.tileSecondary]}>
          <Text style={styles.tileLabel}>DRIVE TIME</Text>
          <Text style={styles.tileStat}>
            {loading ? "…" : metrics ? formatDriveTime(metrics.total_drive_seconds) : "—"}
          </Text>
          <Text style={styles.tileUnit}>last 40 sessions</Text>
        </View>
      </View>

      {/* Stats grid row 2 */}
      <View style={styles.row}>
        <View style={[styles.tile, styles.tileTertiary]}>
          <Text style={styles.tileLabel}>YAWNS DETECTED</Text>
          <Text style={styles.tileStat}>{loading ? "…" : metrics?.yawn_delta_sum ?? 0}</Text>
          <Text style={styles.tileUnit}>last 40 sessions</Text>
        </View>
        <View style={[styles.tile, styles.tileWarn]}>
          <Text style={styles.tileLabel}>ALERTS FIRED</Text>
          <Text style={styles.tileStat}>{loading ? "…" : totalAlerts}</Text>
          <Text style={styles.tileUnit}>L6 / L7 / L8 events</Text>
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

      <Pressable style={styles.secondary} onPress={() => void refresh()}>
        <Text style={styles.secondaryText}>Refresh stats</Text>
      </Pressable>
      <Pressable
        style={styles.outline}
        onPress={() => void supabase.auth.signOut().then(onSignOut)}
      >
        <Text style={styles.outlineText}>Sign out</Text>
      </Pressable>

      <Text style={styles.hint}>
        Telemetry is stored locally in SQLite and synced to Supabase when online.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.background },
  container: { padding: 24, paddingTop: 16, paddingBottom: 40 },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
    color: theme.onSurfaceVariant,
  },
  greet: { marginTop: 12, fontSize: 26, fontWeight: "800", color: theme.onSurface },
  greetAccent: { color: theme.primary },
  sub: { marginTop: 6, fontSize: 14, color: theme.onSurfaceVariant },
  heroCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 20,
    backgroundColor: `${theme.surfaceContainerHigh}cc`,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}55`,
  },
  heroLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: theme.onSurfaceVariant },
  heroStat: { marginTop: 8, fontSize: 32, fontWeight: "800" },
  heroUnit: { marginTop: 4, fontSize: 12, color: theme.onSurfaceVariant },
  row: { flexDirection: "row", gap: 12, marginTop: 12 },
  tile: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  tilePrimary: {
    backgroundColor: `${theme.surfaceContainer}aa`,
    borderColor: `${theme.primary}33`,
  },
  tileSecondary: {
    backgroundColor: `${theme.surfaceContainer}aa`,
    borderColor: `${theme.secondary}44`,
  },
  tileTertiary: {
    backgroundColor: `${theme.surfaceContainer}aa`,
    borderColor: `${theme.outlineVariant}44`,
  },
  tileWarn: {
    backgroundColor: `${theme.surfaceContainer}aa`,
    borderColor: `${theme.tertiary}44`,
  },
  tileLabel: { fontSize: 9, fontWeight: "700", color: theme.onSurfaceVariant, letterSpacing: 1 },
  tileStat: { marginTop: 6, fontSize: 22, fontWeight: "800", color: theme.onSurface },
  tileUnit: { marginTop: 2, fontSize: 10, color: theme.onSurfaceVariant },
  insightCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: `${theme.surfaceContainer}88`,
    borderWidth: 1,
    borderColor: `${theme.secondary}44`,
  },
  insightLabel: { fontSize: 9, fontWeight: "700", color: theme.onSurfaceVariant, letterSpacing: 1 },
  insightValue: { marginTop: 4, fontSize: 18, fontWeight: "800", color: theme.secondary },
  insightSub: { marginTop: 2, fontSize: 11, color: theme.onSurfaceVariant },
  startBtn: {
    marginTop: 24,
    backgroundColor: theme.primary,
    padding: 18,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: theme.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  startBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 17 },
  secondary: {
    marginTop: 12,
    backgroundColor: theme.surfaceContainerHigh,
    padding: 14,
    borderRadius: 14,
  },
  secondaryText: { color: theme.onSurface, textAlign: "center", fontWeight: "700" },
  outline: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}99`,
    padding: 14,
    borderRadius: 14,
  },
  outlineText: { color: theme.onSurfaceVariant, textAlign: "center", fontWeight: "600" },
  hint: { marginTop: 28, color: theme.onSurfaceVariant, fontSize: 12, lineHeight: 18 },
});
