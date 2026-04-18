import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { getDatabase } from "../db/database";
import { DateRangePicker } from "../components/DateRangePicker";
import type { Theme } from "../theme";

type LocalSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  device_type: string;
  sample_count: number;
  avg_drowsiness: number;
  yawn_sum: number;
  head_sum: number;
  brake_count: number;
  tilt_count: number;
};

const PAGE = 20;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtRange(from: string, to: string): string {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");
  const fmtOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const fmtFull: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (f.getFullYear() === t.getFullYear()) {
    return `${f.toLocaleDateString("en", fmtOpts)} – ${t.toLocaleDateString("en", fmtFull)}`;
  }
  return `${f.toLocaleDateString("en", fmtFull)} – ${t.toLocaleDateString("en", fmtFull)}`;
}

export function HistoryScreen() {
  const session = useSession();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const user = session.user;
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  const defaultFrom = toDateStr(new Date(Date.now() - 30 * 86400 * 1000));
  const defaultTo = toDateStr(new Date());
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [showPicker, setShowPicker] = useState(false);

  const loadPage = useCallback(
    (reset: boolean) => {
      if (!user) return;
      if (reset) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      const offset = reset ? 0 : offsetRef.current;
      const since = `${fromDate}T00:00:00.000Z`;
      const until = `${toDate}T23:59:59.999Z`;

      try {
        const db = getDatabase();
        const rows = db.getAllSync<{
          id: string;
          started_at: string;
          ended_at: string | null;
          device_type: string;
          sample_count: number;
          avg_drowsiness: number | null;
          yawn_sum: number;
          head_sum: number;
          brake_count: number;
          tilt_count: number;
        }>(
          `SELECT
             s.id,
             s.started_at,
             s.ended_at,
             s.device_type,
             COUNT(t.id)                        AS sample_count,
             AVG(t.drowsiness_level)            AS avg_drowsiness,
             COALESCE(SUM(t.yawn_count_delta), 0)         AS yawn_sum,
             COALESCE(SUM(t.head_event_count_delta), 0)   AS head_sum,
             COALESCE(SUM(CASE WHEN t.sudden_brake = 1 THEN 1 ELSE 0 END), 0) AS brake_count,
             COALESCE(SUM(t.head_tilt_delta), 0) AS tilt_count
           FROM driving_sessions_local s
           LEFT JOIN session_telemetry_local t ON t.local_session_id = s.id
           WHERE s.user_id = ?
             AND s.started_at >= ?
             AND s.started_at <= ?
           GROUP BY s.id
           ORDER BY s.started_at DESC
           LIMIT ? OFFSET ?`,
          user.id, since, until, PAGE, offset,
        );

        const next: LocalSession[] = rows.map((r) => ({
          id: r.id,
          started_at: r.started_at,
          ended_at: r.ended_at,
          device_type: r.device_type,
          sample_count: Number(r.sample_count),
          avg_drowsiness: Number(r.avg_drowsiness ?? 0),
          yawn_sum: Number(r.yawn_sum),
          head_sum: Number(r.head_sum),
          brake_count: Number(r.brake_count),
          tilt_count: Number(r.tilt_count),
        }));

        if (reset) setSessions(next);
        else setSessions((prev) => [...prev, ...next]);

        offsetRef.current = offset + next.length;
        setHasMore(next.length >= PAGE);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user.id, fromDate, toDate],
  );

  useFocusEffect(useCallback(() => { loadPage(true); }, [loadPage]));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Pressable
          style={styles.rangeBtn}
          onPress={() => setShowPicker(true)}
        >
          <MaterialIcons name="date-range" size={16} color={theme.primary} />
          <Text style={styles.rangeBtnText}>{fmtRange(fromDate, toDate)}</Text>
          <MaterialIcons name="expand-more" size={16} color={theme.primary} />
        </Pressable>
      </View>

      <DateRangePicker
        visible={showPicker}
        fromDate={fromDate}
        toDate={toDate}
        onApply={(f, t) => {
          setFromDate(f);
          setToDate(t);
          setShowPicker(false);
        }}
        onClose={() => setShowPicker(false)}
      />

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.muted}>No sessions in this date range.</Text>}
          renderItem={({ item: s }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.date}>{new Date(s.started_at).toLocaleString()}</Text>
                <View style={[
                  styles.drowsyBadge,
                  { backgroundColor: s.avg_drowsiness >= 8 ? `${theme.tertiary}22` : s.avg_drowsiness >= 6 ? `${theme.secondary}22` : "#4ade8022" },
                ]}>
                  <Text style={[
                    styles.drowsyBadgeText,
                    { color: s.avg_drowsiness >= 8 ? theme.tertiary : s.avg_drowsiness >= 6 ? theme.secondary : "#4ade80" },
                  ]}>
                    {s.avg_drowsiness.toFixed(1)}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {s.device_type} · {s.sample_count} samples
              </Text>
              <Text style={styles.chips}>
                {s.yawn_sum > 0 ? `😮 ${s.yawn_sum} yawns  ` : ""}
                {s.head_sum > 0 ? `😴 ${s.head_sum} nods  ` : ""}
                {s.tilt_count > 0 ? `↗️ ${s.tilt_count} tilts  ` : ""}
                {s.brake_count > 0 ? `🛑 ${s.brake_count} brakes` : ""}
              </Text>
            </View>
          )}
          ListFooterComponent={
            hasMore ? (
              <Pressable
                style={styles.more}
                disabled={loadingMore}
                onPress={() => loadPage(false)}
              >
                {loadingMore ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <Text style={styles.moreText}>Load more</Text>
                )}
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background, paddingTop: 8, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 },
  title: { fontSize: 22, fontWeight: "800", color: t.onSurface },
  rangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${t.primary}66`,
    backgroundColor: `${t.primary}10`,
  },
  rangeBtnText: { color: t.primary, fontWeight: "700", fontSize: 12 },
  list: { paddingBottom: 24, marginTop: 12 },
  card: {
    borderWidth: 1,
    borderColor: `${t.outlineVariant}55`,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: `${t.surfaceContainerLow}ee`,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  date: { color: t.onSurface, fontWeight: "600", fontSize: 13, flex: 1 },
  drowsyBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  drowsyBadgeText: { fontWeight: "800", fontSize: 12 },
  meta: { color: t.onSurfaceVariant, fontSize: 12, marginTop: 2 },
  chips: { color: t.onSurface, fontSize: 12, marginTop: 8, lineHeight: 18 },
  muted: { color: t.onSurfaceVariant, marginTop: 24, textAlign: "center" },
  more: {
    marginTop: 8, padding: 14,
    backgroundColor: t.primary,
    borderRadius: 16, alignItems: "center",
  },
  moreText: { color: t.onPrimary, fontWeight: "800" },
});
