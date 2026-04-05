import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { theme } from "../theme";

type Props = { session: Session; onSignOut: () => void };

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

export function HomeScreen({ session, onSignOut }: Props) {
  const [count, setCount] = useState<number | null>(null);

  const firstName = useMemo(() => dashboardFirstName(session.user), [session.user]);

  const refresh = useCallback(async () => {
    const { count: c } = await supabase
      .from("driving_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.user.id);
    setCount(c ?? 0);
  }, [session.user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>SNOOZEGUARD</Text>
      <Text style={styles.greet}>
        {greetingHour()}, <Text style={styles.greetAccent}>{firstName}</Text>
      </Text>
      <Text style={styles.sub}>Stay sharp on the road.</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Focus overview</Text>
        <Text style={styles.heroStat}>{count ?? "…"}</Text>
        <Text style={styles.heroUnit}>sessions recorded</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.tile, styles.tileSecondary]}>
          <Text style={styles.tileLabel}>Next step</Text>
          <Text style={styles.tileValue}>Drive tab</Text>
        </View>
        <View style={[styles.tile, styles.tileTertiary]}>
          <Text style={styles.tileLabel}>Sync</Text>
          <Text style={styles.tileValue}>SQLite → cloud</Text>
        </View>
      </View>

      <Text style={styles.hintTab}>Open the Drive tab to start a monitoring session.</Text>
      <Pressable style={styles.secondary} onPress={() => void refresh()}>
        <Text style={styles.secondaryText}>Refresh stats</Text>
      </Pressable>
      <Pressable style={styles.outline} onPress={() => void supabase.auth.signOut().then(onSignOut)}>
        <Text style={styles.outlineText}>Sign out</Text>
      </Pressable>
      <Text style={styles.hint}>
        Expo dev client + Vision Camera. Telemetry is written to SQLite first, then synced to Supabase when online.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 16, backgroundColor: theme.background },
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
  heroStat: { marginTop: 8, fontSize: 40, fontWeight: "800", color: theme.primary },
  heroUnit: { marginTop: 4, fontSize: 13, color: theme.onSurfaceVariant },
  row: { flexDirection: "row", gap: 12, marginTop: 16 },
  tile: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  tileSecondary: {
    backgroundColor: `${theme.surfaceContainer}aa`,
    borderColor: `${theme.secondary}44`,
  },
  tileTertiary: {
    backgroundColor: `${theme.surfaceContainer}aa`,
    borderColor: `${theme.tertiary}44`,
  },
  tileLabel: { fontSize: 10, fontWeight: "700", color: theme.onSurfaceVariant, letterSpacing: 1 },
  tileValue: { marginTop: 6, fontSize: 14, fontWeight: "700", color: theme.onSurface },
  hintTab: { marginTop: 24, color: theme.primary, fontSize: 14, fontWeight: "600" },
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
