import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { useTheme } from "../context/ThemeContext";
import { TermsScreen } from "./TermsScreen";
import type { Theme } from "../theme";

type Props = { onSignedIn: () => void };

export function LoginScreen({ onSignedIn }: Props) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [infoText, setInfoText] = useState("");
  const [showTerms, setShowTerms] = useState(false);

  async function signInWithGoogle() {
    setErrorText("");
    setInfoText("");
    setBusy(true);
    try {
      const redirectTo = Linking.createURL("auth/callback", { scheme: "snoozeguard" });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        setErrorText(error?.message ?? "Could not start Google sign-in.");
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { showInRecents: true });
      if (result.type === "cancel" || result.type === "dismiss") return;
      if (result.type === "success" && result.url) {
        const url = result.url;
        const parsed = Linking.parse(url);
        const code = typeof parsed.queryParams?.code === "string"
          ? parsed.queryParams.code
          : Array.isArray(parsed.queryParams?.code)
            ? parsed.queryParams.code[0]
            : undefined;
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) { setErrorText(exchangeError.message); return; }
          onSignedIn();
          return;
        }
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) {
          const hash = url.slice(hashIndex + 1);
          const params = Object.fromEntries(new URLSearchParams(hash));
          const accessToken = params["access_token"];
          const refreshToken = params["refresh_token"] ?? "";
          if (accessToken) {
            const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (sessionError) { setErrorText(sessionError.message); return; }
            onSignedIn();
            return;
          }
        }
        const oauthError = parsed.queryParams?.error_description ?? parsed.queryParams?.error;
        setErrorText(typeof oauthError === "string" ? oauthError : "Google sign-in failed. Please try again.");
      }
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setErrorText("");
    setInfoText("");
    if (mode === "signup") {
      if (!displayName.trim()) { setErrorText("Please enter your display name."); return; }
      if (password !== confirmPassword) { setErrorText("Passwords do not match."); return; }
      if (password.length < 6) { setErrorText("Password must be at least 6 characters."); return; }
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setErrorText(error.message);
        else onSignedIn();
      } else {
        const redirectTo = Linking.createURL("auth/callback", { scheme: "snoozeguard" });
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: { full_name: displayName.trim() },
          },
        });
        if (error) setErrorText(error.message);
        else setInfoText("Account created! Check your email to confirm, then sign in.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.brand}>SNOOZEGUARD</Text>
        <Text style={styles.title}>{mode === "signin" ? "Welcome back" : "Create account"}</Text>
        <Text style={styles.sub}>Sign in with Google or email</Text>

        <Pressable style={[styles.google, busy && styles.disabled]} disabled={busy} onPress={() => void signInWithGoogle()}>
          {busy ? <ActivityIndicator color="#18181b" /> : (
            <Text style={styles.googleText}>Continue with Google</Text>
          )}
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or email</Text>
          <View style={styles.orLine} />
        </View>

        {mode === "signup" && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={t.onSurfaceVariant}
              autoCapitalize="words"
              value={displayName}
              onChangeText={(v) => { setDisplayName(v); setErrorText(""); }}
            />
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={t.onSurfaceVariant}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(v) => { setEmail(v); setErrorText(""); }}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, styles.inputWithEye]}
              placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
              placeholderTextColor={t.onSurfaceVariant}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrorText(""); }}
            />
            <Pressable style={styles.eyeAbsolute} onPress={() => setShowPassword(v => !v)}>
              <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={20} color={t.onSurfaceVariant} />
            </Pressable>
          </View>
        </View>

        {mode === "signup" && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, styles.inputWithEye]}
                placeholder="Repeat your password"
                placeholderTextColor={t.onSurfaceVariant}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setErrorText(""); }}
              />
              <Pressable style={styles.eyeAbsolute} onPress={() => setShowConfirm(v => !v)}>
                <MaterialIcons name={showConfirm ? "visibility-off" : "visibility"} size={20} color={t.onSurfaceVariant} />
              </Pressable>
            </View>
          </View>
        )}

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        {infoText ? <Text style={styles.infoText}>{infoText}</Text> : null}

        <Pressable style={[styles.button, busy && styles.disabled]} onPress={() => void submit()} disabled={busy}>
          {busy ? <ActivityIndicator color={t.onPrimary} /> : (
            <Text style={styles.buttonText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setErrorText(""); setInfoText(""); }}>
          <Text style={styles.link}>{mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}</Text>
        </Pressable>

        <Pressable onPress={() => setShowTerms(true)} style={styles.termsBtn}>
          <Text style={styles.termsText}>Terms of Service & Privacy Policy</Text>
        </Pressable>
      </View>

      <Modal visible={showTerms} animationType="slide" onRequestClose={() => setShowTerms(false)}>
        <View style={{ flex: 1, backgroundColor: t.background }}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowTerms(false)} hitSlop={12} style={styles.modalClose}>
              <MaterialIcons name="close" size={22} color={t.onSurface} />
            </Pressable>
          </View>
          <TermsScreen />
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.background },
  container: { flexGrow: 1, justifyContent: "center", padding: 24, paddingVertical: 40 },
  card: {
    borderRadius: 24, padding: 28,
    backgroundColor: `${t.surfaceContainerLow}ee`,
    borderWidth: 1, borderColor: `${t.outlineVariant}44`,
    gap: 4,
  },
  brand: { fontSize: 10, fontWeight: "800", letterSpacing: 3, color: t.primary, textAlign: "center" },
  title: { marginTop: 10, fontSize: 26, fontWeight: "800", color: t.onSurface, textAlign: "center" },
  sub: { fontSize: 14, color: t.onSurfaceVariant, textAlign: "center", marginBottom: 16 },
  google: {
    backgroundColor: t.surfaceBright, paddingVertical: 16, borderRadius: 14,
    alignItems: "center", minHeight: 52, justifyContent: "center", marginBottom: 8,
    borderWidth: 1, borderColor: `${t.outlineVariant}66`,
  },
  googleText: { color: t.onSurface, fontWeight: "700", fontSize: 15 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 8 },
  orLine: { flex: 1, height: 1, backgroundColor: `${t.outlineVariant}66` },
  orText: { color: t.onSurfaceVariant, fontSize: 12 },
  fieldGroup: { gap: 6, marginTop: 8 },
  label: { color: t.onSurface, fontWeight: "700", fontSize: 14 },
  inputWrap: { position: "relative" },
  input: {
    borderWidth: 1, borderColor: `${t.outlineVariant}66`,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15,
    color: t.onSurface, backgroundColor: `${t.surfaceContainerHigh}cc`,
    fontSize: 15,
  },
  inputWithEye: { paddingRight: 48 },
  eyeAbsolute: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center", padding: 4 },
  errorText: { color: t.tertiary, fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 6 },
  infoText: { color: "#4ade80", fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 6 },
  button: {
    backgroundColor: t.primary, paddingVertical: 17, borderRadius: 16, marginTop: 12,
    shadowColor: t.primary, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
    alignItems: "center", minHeight: 54, justifyContent: "center",
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: t.onPrimary, fontWeight: "800", fontSize: 16 },
  link: { color: t.onSurfaceVariant, textAlign: "center", marginTop: 16, textDecorationLine: "underline", fontSize: 14 },
  termsBtn: { alignItems: "center", marginTop: 20, paddingVertical: 8 },
  termsText: { color: t.onSurfaceVariant, fontSize: 11, textDecorationLine: "underline", opacity: 0.7 },
  modalHeader: { paddingTop: 48, paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", justifyContent: "flex-end" },
  modalClose: { padding: 8, borderRadius: 20, backgroundColor: `${t.outlineVariant}33` },
});
