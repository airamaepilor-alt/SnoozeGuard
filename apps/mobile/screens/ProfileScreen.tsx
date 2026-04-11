import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getEmergencyContact, upsertEmergencyContact } from "../lib/emergencyNotify";
import { theme } from "../theme";

type Props = { session: Session; onSignOut: () => void };

export function ProfileScreen({ session, onSignOut }: Props) {
  const user = session.user;
  const displayName = user.user_metadata?.full_name ?? user.email ?? "User";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Emergency contact fields
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecEmail, setEcEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const ec = await getEmergencyContact(supabase, user.id);
    if (ec) {
      setEcName(ec.contact_name);
      setEcPhone(ec.contact_phone ?? "");
      setEcEmail(ec.contact_email ?? "");
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!ecName.trim()) {
      Alert.alert("Required", "Emergency contact name is required.");
      return;
    }
    if (!ecPhone.trim() && !ecEmail.trim()) {
      Alert.alert("Required", "Provide at least a phone number or email for the emergency contact.");
      return;
    }
    setSaving(true);
    const { error } = await upsertEmergencyContact(supabase, user.id, {
      contact_name: ecName.trim(),
      contact_phone: ecPhone.trim(),
      contact_email: ecEmail.trim(),
    });
    setSaving(false);
    if (error) {
      Alert.alert("Save failed", error);
    } else {
      Alert.alert("Saved", "Emergency contact updated.");
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* User info */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
      </View>

      {/* Emergency contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EMERGENCY CONTACT</Text>
        <Text style={styles.sectionHint}>
          If a Level 9 alert is not dismissed within 2 minutes, your location is automatically
          sent to this contact. You can also trigger it manually from the alert screen.
        </Text>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
        ) : (
          <>
            <Text style={styles.fieldLabel}>Full name *</Text>
            <TextInput
              style={styles.input}
              value={ecName}
              onChangeText={setEcName}
              placeholder="e.g. Maria Santos"
              placeholderTextColor={theme.onSurfaceVariant}
            />

            <Text style={styles.fieldLabel}>Mobile number</Text>
            <TextInput
              style={styles.input}
              value={ecPhone}
              onChangeText={setEcPhone}
              placeholder="+63 912 345 6789"
              placeholderTextColor={theme.onSurfaceVariant}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              value={ecEmail}
              onChangeText={setEcEmail}
              placeholder="contact@email.com"
              placeholderTextColor={theme.onSurfaceVariant}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.tip}>
              Tip: If your emergency contact also has the SnoozeGuard app, they'll see your
              live location on a map when an alert fires.
            </Text>

            <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void save()}>
              {saving ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>Save emergency contact</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      {/* Quick contact actions */}
      {ecPhone ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK CONTACT</Text>
          <View style={styles.contactRow}>
            <Pressable
              style={[styles.contactBtn, styles.callBtn]}
              onPress={() => void Linking.openURL(`tel:${ecPhone}`)}
            >
              <Text style={styles.contactBtnText}>📞 Call</Text>
            </Pressable>
            <Pressable
              style={[styles.contactBtn, styles.smsBtn]}
              onPress={() => void Linking.openURL(`sms:${ecPhone}`)}
            >
              <Text style={styles.contactBtnText}>💬 SMS</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Sign out */}
      <Pressable
        style={styles.signOutBtn}
        onPress={() =>
          Alert.alert("Sign out", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign out",
              style: "destructive",
              onPress: () => void supabase.auth.signOut().then(onSignOut),
            },
          ])
        }
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.background },
  container: { padding: 20, paddingBottom: 40 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: `${theme.surfaceContainerLow}ee`,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}44`,
    marginBottom: 20,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${theme.primary}33`,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: theme.primary, fontSize: 22, fontWeight: "800" },
  userName: { color: theme.onSurface, fontWeight: "700", fontSize: 16 },
  userEmail: { color: theme.onSurfaceVariant, fontSize: 12, marginTop: 2 },
  section: {
    backgroundColor: `${theme.surfaceContainerLow}ee`,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}44`,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: theme.onSurfaceVariant,
    marginBottom: 8,
  },
  sectionHint: {
    color: theme.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  fieldLabel: { color: theme.onSurface, fontWeight: "600", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}66`,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    color: theme.onSurface,
    backgroundColor: `${theme.background}99`,
    fontSize: 15,
  },
  tip: {
    color: theme.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 16,
    fontStyle: "italic",
    marginBottom: 14,
  },
  saveBtn: {
    backgroundColor: theme.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: theme.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 15 },
  contactRow: { flexDirection: "row", gap: 12 },
  contactBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  callBtn: { backgroundColor: `#4ade8022`, borderColor: `#4ade8066` },
  smsBtn: { backgroundColor: `${theme.primary}22`, borderColor: `${theme.primary}66` },
  contactBtnText: { color: theme.onSurface, fontWeight: "700", fontSize: 14 },
  signOutBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: `${theme.tertiary}66`,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  signOutText: { color: theme.tertiary, fontWeight: "700", fontSize: 15 },
});
