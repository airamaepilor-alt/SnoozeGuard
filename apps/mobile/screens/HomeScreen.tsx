import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type RootStackParamList = {
  Home: undefined;
  Drive: undefined;
};

type Nav = NativeStackNavigationProp<RootStackParamList, "Home">;

type Props = { session: Session; onSignOut: () => void };

export function HomeScreen({ session, onSignOut }: Props) {
  const navigation = useNavigation<Nav>();
  const [count, setCount] = useState<number | null>(null);

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
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.meta}>Signed in as {session.user.email}</Text>
      <Text style={styles.stat}>Sessions (total): {count ?? "…"}</Text>
      <Pressable style={styles.primary} onPress={() => navigation.navigate("Drive")}>
        <Text style={styles.primaryText}>Drive (camera + ML)</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => void refresh()}>
        <Text style={styles.secondaryText}>Refresh</Text>
      </Pressable>
      <Pressable style={styles.outline} onPress={() => void supabase.auth.signOut().then(onSignOut)}>
        <Text style={styles.outlineText}>Sign out</Text>
      </Pressable>
      <Text style={styles.hint}>
        Uses Expo dev client + Vision Camera. Telemetry is written to SQLite first, then synced to Supabase when online.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 56, backgroundColor: "#09090b" },
  title: { fontSize: 24, fontWeight: "800", color: "#fafafa" },
  meta: { color: "#a1a1aa", marginTop: 8 },
  stat: { color: "#e4e4e7", marginTop: 24, fontSize: 18 },
  primary: { marginTop: 20, backgroundColor: "#0284c7", padding: 14, borderRadius: 12 },
  primaryText: { color: "#fff", textAlign: "center", fontWeight: "700" },
  secondary: { marginTop: 12, backgroundColor: "#27272a", padding: 14, borderRadius: 12 },
  secondaryText: { color: "#fafafa", textAlign: "center", fontWeight: "600" },
  outline: { marginTop: 12, borderWidth: 1, borderColor: "#52525b", padding: 14, borderRadius: 12 },
  outlineText: { color: "#e4e4e7", textAlign: "center", fontWeight: "600" },
  hint: { marginTop: 32, color: "#71717a", fontSize: 12, lineHeight: 18 },
});
