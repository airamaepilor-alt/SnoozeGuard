import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../context/SessionContext";
import { supabase } from "../lib/supabase";
import { theme } from "../theme";

const webBase = process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, "") ?? "";

export function AdminScreen() {
  const session = useSession();
  const user = session.user;
  const [role, setRole] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    setRole(data?.role ?? "driver");
  }, [user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (role !== "super_admin") {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Admin</Text>
        <Text style={styles.body}>This area is only available to Super Admins.</Text>
        <Text style={styles.meta}>Your role: {role ?? "…"}</Text>
      </View>
    );
  }

  const adminUrl = webBase ? `${webBase}/admin` : "";

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Admin configuration</Text>
      <Text style={styles.body}>
        Thresholds and alert maps are edited on the web app (full parity with the BRD admin UI).
      </Text>
      {adminUrl ? (
        <Pressable
          style={styles.btn}
          onPress={() => void Linking.openURL(adminUrl)}
        >
          <Text style={styles.btnText}>Open admin in browser</Text>
        </Pressable>
      ) : (
        <Text style={styles.warn}>
          Set EXPO_PUBLIC_WEB_APP_URL in .env (e.g. https://your-app.pages.dev) to open the panel.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background, padding: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: "800", color: theme.onSurface },
  body: { color: theme.onSurfaceVariant, marginTop: 12, lineHeight: 22 },
  meta: { color: theme.onSurfaceVariant, marginTop: 16, fontSize: 12 },
  warn: { color: theme.secondary, marginTop: 16, fontSize: 13 },
  btn: {
    marginTop: 24,
    backgroundColor: theme.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: theme.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  btnText: { color: theme.onPrimary, fontWeight: "800" },
});
