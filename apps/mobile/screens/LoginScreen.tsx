import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { theme } from "../theme";

type Props = { onSignedIn: () => void };

export function LoginScreen({ onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const redirectTo = Linking.createURL("auth/callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        Alert.alert("Google sign-in", error?.message ?? "Could not start Google sign-in.");
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "cancel" || result.type === "dismiss") return;
      if (result.type === "success" && result.url) {
        const parsed = Linking.parse(result.url);
        const code =
          typeof parsed.queryParams?.code === "string"
            ? parsed.queryParams.code
            : Array.isArray(parsed.queryParams?.code)
              ? parsed.queryParams?.code[0]
              : undefined;
        if (!code) {
          Alert.alert("Google sign-in", "No authorization code in redirect URL.");
          return;
        }
        const exchange = await supabase.auth.exchangeCodeForSession(code);
        if (exchange.error) {
          Alert.alert("Google sign-in", exchange.error.message);
          return;
        }
        onSignedIn();
      }
    } catch (e) {
      Alert.alert("Google sign-in", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

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
      <View style={styles.card}>
        <Text style={styles.brand}>SNOOZEGUARD</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>Sign in with Google or email</Text>
        <Pressable
          style={[styles.google, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void signInWithGoogle()}
        >
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>
        <Text style={styles.or}>or email</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={theme.onSurfaceVariant}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.onSurfaceVariant}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: theme.background,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: `${theme.surfaceContainerLow}ee`,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}44`,
  },
  brand: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
    color: theme.primary,
    textAlign: "center",
  },
  title: { marginTop: 12, fontSize: 24, fontWeight: "800", color: theme.onSurface, textAlign: "center" },
  sub: { fontSize: 14, color: theme.onSurfaceVariant, textAlign: "center", marginBottom: 20 },
  google: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  googleText: { color: "#18181b", textAlign: "center", fontWeight: "700" },
  or: { color: theme.onSurfaceVariant, textAlign: "center", fontSize: 12, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}66`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    color: theme.onSurface,
    backgroundColor: `${theme.background}99`,
  },
  button: {
    backgroundColor: theme.primary,
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: theme.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: theme.onPrimary, textAlign: "center", fontWeight: "800", fontSize: 16 },
  link: { color: theme.onSurfaceVariant, textAlign: "center", marginTop: 16, textDecorationLine: "underline" },
});
