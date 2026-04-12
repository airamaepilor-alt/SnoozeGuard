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
import { supabase } from "../lib/supabase";
import { theme } from "../theme";

type HistoryRpcSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  device_type: string;
  sample_count: number;
  avg_drowsiness: number;
  yawn_sum: number;
  head_sum: number;
  brake_count: number;
  series: { t: string; level: number }[];
};

type HistoryRpcPayload = {
  ok?: boolean;
  sessions?: HistoryRpcSession[];
  has_more?: boolean;
};

const PAGE = 20;

export function HistoryScreen() {
  const session = useSession();
  const user = session.user;
  const [sessions, setSessions] = useState<HistoryRpcSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const loadPage = useCallback(
    async (reset: boolean) => {
      if (!user) return;
      if (reset) {
        setLoading(true);
        cursorRef.current = null;
      } else {
        setLoadingMore(true);
      }

      // Query directly from Supabase tables — accurate and always up to date
      const cursor = reset ? null : cursorRef.current;
      let query = supabase
        .from("driving_sessions")
        .select("id, started_at, ended_at, device_type")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(PAGE);
      if (cursor) query = query.lt("started_at", cursor);


      const { data: sess } = await query;
      const ids = (sess ?? []).map((s) => s.id as string);

      if (ids.length === 0) {
        if (reset) setSessions([]);
        setHasMore(false);
        cursorRef.current = null;
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const { data: tel } = await supabase
        .from("session_telemetry")
        .select("session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, sudden_brake")
        .in("session_id", ids);

      const bySession = new Map<string, NonNullable<typeof tel>>();
      for (const row of tel ?? []) {
        const sid = row.session_id as string;
        const list = bySession.get(sid) ?? [];
        list.push(row);
        bySession.set(sid, list);
      }

      const next: HistoryRpcSession[] = (sess ?? []).map((s) => {
        const rows = bySession.get(s.id as string) ?? [];
        const n = rows.length;
        const avg = n ? rows.reduce((a, r) => a + Number(r.drowsiness_level), 0) / n : 0;
        const yawn_sum = rows.reduce((a, r) => a + (Number(r.yawn_count_delta) || 0), 0);
        const head_sum = rows.reduce((a, r) => a + (Number(r.head_event_count_delta) || 0), 0);
        const brake_count = rows.filter((r) => r.sudden_brake).length;
        const series = rows
          .slice(-40)
          .map((r) => ({ t: r.recorded_at as string, level: Number(r.drowsiness_level) }));
        return {
          id: s.id as string,
          started_at: s.started_at as string,
          ended_at: (s.ended_at as string | null) ?? null,
          device_type: s.device_type as string,
          sample_count: n,
          avg_drowsiness: avg,
          yawn_sum,
          head_sum,
          brake_count,
          series,
        };
      });

      if (reset) setSessions(next);
      else setSessions((prev) => [...prev, ...next]);
      setHasMore(next.length >= PAGE);
      cursorRef.current = next.length > 0 ? next[next.length - 1].started_at : reset ? null : cursorRef.current;
      setLoading(false);
      setLoadingMore(false);
    },
    [user.id],
  );

  // Reload every time the user switches to this tab
  useFocusEffect(useCallback(() => { void loadPage(true); }, [loadPage]));

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
                onPress={() => void loadPage(false)}
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
  warn: { color: theme.secondary, fontSize: 11, marginTop: 8 },
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
