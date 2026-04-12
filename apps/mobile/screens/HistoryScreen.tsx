import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSession } from "../context/SessionContext";
import { getDatabase } from "../db/database";
import { theme } from "../theme";

// Local SQLite is always the ground truth for counts — Supabase sync may lag.
// We query the local DB directly so yawn/head/brake totals are always accurate.

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
};

const PAGE = 20;

export function HistoryScreen() {
  const session = useSession();
  const user = session.user;
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

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

      try {
        const db = getDatabase();
        // Single query: join sessions with telemetry, aggregate counts per session
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
             COALESCE(SUM(CASE WHEN t.sudden_brake = 1 THEN 1 ELSE 0 END), 0) AS brake_count
           FROM driving_sessions_local s
           LEFT JOIN session_telemetry_local t ON t.local_session_id = s.id
           WHERE s.user_id = ?
           GROUP BY s.id
           ORDER BY s.started_at DESC
           LIMIT ? OFFSET ?`,
          user.id,
          PAGE,
          offset,
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
    [user.id],
  );

  // Reload every time the user switches to this tab
  useFocusEffect(useCallback(() => { loadPage(true); }, [loadPage]));

  return (
    <View style={styles.root}>
      <Text style={styles.title}>History</Text>
      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.muted}>No sessions yet.</Text>}
          renderItem={({ item: s }) => (
            <View style={styles.card}>
              <Text style={styles.date}>{new Date(s.started_at).toLocaleString()}</Text>
              <Text style={styles.meta}>
                {s.device_type} · {s.sample_count} samples · avg {Number(s.avg_drowsiness).toFixed(2)}
              </Text>
              <Text style={styles.chips}>
                YAWN +{s.yawn_sum} · HEAD +{s.head_sum}
                {s.brake_count > 0 ? ` · BRAKE ×${s.brake_count}` : ""}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background, paddingTop: 8, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: "800", color: theme.onSurface },
  list: { paddingBottom: 24, marginTop: 16 },
  card: {
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}55`,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: `${theme.surfaceContainerLow}ee`,
  },
  date: { color: theme.onSurface, fontWeight: "600" },
  meta: { color: theme.onSurfaceVariant, fontSize: 12, marginTop: 4 },
  chips: { color: theme.primary, fontSize: 11, marginTop: 8, fontWeight: "600" },
  muted: { color: theme.onSurfaceVariant, marginTop: 24 },
  more: {
    marginTop: 8,
    padding: 14,
    backgroundColor: theme.primary,
    borderRadius: 16,
    alignItems: "center",
  },
  moreText: { color: theme.onPrimary, fontWeight: "800" },
});
