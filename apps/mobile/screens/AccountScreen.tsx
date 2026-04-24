import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import type { Theme } from "../theme";

export function AccountScreen({ onSignOut }: { onSignOut: () => void }) {
  const session = useSession();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const user = session.user;

  const isGoogle = (user.app_metadata?.provider === "google") ||
    (user.identities ?? []).some((id: { provider: string }) => id.provider === "google");

  // True when the user has an email/password identity — even if they also have Google.
  // This is the correct guard for showing "Current password" field.
  const hasPassword = (user.identities ?? []).some(
    (id: { provider: string }) => id.provider === "email",
  );

  // Tracks whether the user has a password — either from Supabase identities or
  // because they just set one in this session (session refresh may lag behind).
  const [hasSetPassword, setHasSetPassword] = useState(hasPassword);

  const [displayName, setDisplayName] = useState(user.user_metadata?.full_name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const saveAccount = async () => {
    setErrorMsg("");
    setSavedMsg("");

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (newPassword && hasSetPassword && !currentPassword) {
      setErrorMsg("Enter your current password to set a new one.");
      return;
    }

    setSaving(true);
    try {
      // Verify current password before changing it
      if (newPassword && hasSetPassword && currentPassword) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: currentPassword,
        });
        if (verifyError) {
          setErrorMsg("Current password is incorrect.");
          return;
        }
      }

      const updates: Record<string, unknown> = {};
      if (displayName.trim()) updates.data = { full_name: displayName.trim() };
      if (newPassword) updates.password = newPassword;

      const { error: authError } = await supabase.auth.updateUser(
        updates as Parameters<typeof supabase.auth.updateUser>[0],
      );
      if (authError) {
        setErrorMsg(authError.message);
        return;
      }

      if (displayName.trim()) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: displayName.trim() })
          .eq("id", user.id);
        if (profileError) {
          setErrorMsg(profileError.message);
          return;
        }
      }

      if (newPassword) {
        setHasSetPassword(true);
        void supabase.auth.refreshSession();
      }
      setSavedMsg("✓ Account updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  const providerLabel = isGoogle && !hasPassword ? "Google" : isGoogle ? "Google + Password" : "Email / Password";

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

      {/* User card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(displayName || user.email || "U").charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{displayName || user.email || "User"}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={styles.providerBadge}>
            <Text style={styles.providerText}>Signed in with {providerLabel}</Text>
          </View>
        </View>
      </View>

      {/* Display name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DISPLAY NAME</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={(v) => { setDisplayName(v); setErrorMsg(""); }}
          placeholder="Your name"
          placeholderTextColor={theme.onSurfaceVariant}
          autoCapitalize="words"
        />
      </View>

      {/* Password section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isGoogle ? "SET A PASSWORD" : "CHANGE PASSWORD"}
        </Text>
        {isGoogle && (
          <Text style={styles.hint}>
            You can add a password so you can also sign in directly with your email.
          </Text>
        )}

        {hasSetPassword && (
          <>
            <Text style={styles.label}>Current password</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={currentPassword}
                onChangeText={(v) => { setCurrentPassword(v); setErrorMsg(""); }}
                placeholder="Enter your current password"
                placeholderTextColor={theme.onSurfaceVariant}
                secureTextEntry={!showCurrentPassword}
              />
              <Pressable style={styles.eyeBtn} onPress={() => setShowCurrentPassword(v => !v)}>
                <MaterialIcons name={showCurrentPassword ? "visibility-off" : "visibility"} size={20} color={theme.onSurfaceVariant} />
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.label}>New password</Text>
        <View style={styles.passwordInputWrap}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={newPassword}
            onChangeText={(v) => { setNewPassword(v); setErrorMsg(""); }}
            placeholder="At least 6 characters"
            placeholderTextColor={theme.onSurfaceVariant}
            secureTextEntry={!showNewPassword}
          />
          <Pressable style={styles.eyeBtn} onPress={() => setShowNewPassword(v => !v)}>
            <MaterialIcons name={showNewPassword ? "visibility-off" : "visibility"} size={20} color={theme.onSurfaceVariant} />
          </Pressable>
        </View>

        <Text style={styles.label}>Confirm password</Text>
        <View style={styles.passwordInputWrap}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setErrorMsg(""); }}
            placeholder="Re-enter password"
            placeholderTextColor={theme.onSurfaceVariant}
            secureTextEntry={!showConfirmPassword}
          />
          <Pressable style={styles.eyeBtn} onPress={() => setShowConfirmPassword(v => !v)}>
            <MaterialIcons name={showConfirmPassword ? "visibility-off" : "visibility"} size={20} color={theme.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      {savedMsg ? <Text style={styles.successText}>{savedMsg}</Text> : null}

      <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void saveAccount()}>
        {saving ? <ActivityIndicator color={theme.onPrimary} /> : (
          <Text style={styles.saveBtnText}>Save changes</Text>
        )}
      </Pressable>

      <Pressable style={styles.signOutBtn} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.background },
  container: { padding: 20, paddingBottom: 40 },
  userCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: `${t.surfaceContainerLow}ee`,
    borderRadius: 20, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: `${t.outlineVariant}44`,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: `${t.primary}33`,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: t.primary, fontSize: 22, fontWeight: "800" },
  userName: { color: t.onSurface, fontWeight: "700", fontSize: 16 },
  userEmail: { color: t.onSurfaceVariant, fontSize: 12, marginTop: 2 },
  providerBadge: {
    marginTop: 6, alignSelf: "flex-start",
    backgroundColor: `${t.primary}22`,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: `${t.primary}44`,
  },
  providerText: { color: t.primary, fontSize: 10, fontWeight: "700" },
  section: {
    backgroundColor: `${t.surfaceContainerLow}ee`,
    borderRadius: 20, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: `${t.outlineVariant}44`,
  },
  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: t.onSurfaceVariant, marginBottom: 10 },
  hint: { color: t.onSurfaceVariant, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  label: { color: t.onSurface, fontWeight: "600", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: `${t.outlineVariant}66`,
    borderRadius: 14, padding: 12, marginBottom: 4,
    color: t.onSurface, backgroundColor: t.surfaceContainerHigh, fontSize: 15, flex: 1,
  },
  passwordInputWrap: { flexDirection: "row", alignItems: "center", gap: 0, marginBottom: 12, position: "relative" },
  passwordInput: { marginBottom: 0, paddingRight: 48 },
  eyeBtn: { position: "absolute", right: 12, padding: 8 },
  errorText: { color: t.tertiary, fontSize: 13, fontWeight: "600", marginBottom: 10, textAlign: "center" },
  successText: { color: "#4ade80", fontSize: 13, fontWeight: "600", marginBottom: 10, textAlign: "center" },
  saveBtn: {
    backgroundColor: t.primary, padding: 16, borderRadius: 16,
    alignItems: "center", shadowColor: t.primary,
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4, marginBottom: 12,
  },
  saveBtnText: { color: t.onPrimary, fontWeight: "800", fontSize: 15 },
  signOutBtn: {
    borderWidth: 1, borderColor: `${t.tertiary}66`,
    padding: 16, borderRadius: 16, alignItems: "center",
  },
  signOutText: { color: t.tertiary, fontWeight: "700", fontSize: 15 },
});
