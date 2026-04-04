import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

type Props = { onSignedIn: () => void };

export function LoginScreen({ onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) Alert.alert("Sign in failed", error.message);
        else onSignedIn();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) Alert.alert("Sign up failed", error.message);
        else Alert.alert("Check email", "Confirm your address if required by project settings.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SnoozeGuard</Text>
      <Text style={styles.sub}>Supabase Auth</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#71717a"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#71717a"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={[styles.button, busy && styles.disabled]} onPress={() => void submit()} disabled={busy}>
        <Text style={styles.buttonText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
        <Text style={styles.link}>{mode === "signin" ? "Need an account?" : "Have an account?"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#09090b" },
  title: { fontSize: 28, fontWeight: "800", color: "#7dd3fc", textAlign: "center" },
  sub: { fontSize: 14, color: "#a1a1aa", textAlign: "center", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    color: "#fafafa",
    backgroundColor: "#18181b",
  },
  button: { backgroundColor: "#0284c7", padding: 16, borderRadius: 14, marginTop: 8 },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "700" },
  link: { color: "#a1a1aa", textAlign: "center", marginTop: 16, textDecorationLine: "underline" },
});
