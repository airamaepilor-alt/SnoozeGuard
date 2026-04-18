import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
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

  // Driver's own phone (stored in profiles.phone — shared with EC's alert view)
  const [myPhone, setMyPhone] = useState("");

  // Emergency contact fields
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecEmail, setEcEmail] = useState("");

  // Inline feedback
  const [ecError, setEcError] = useState("");
  const [ecSaved, setEcSaved] = useState(false);

  // Sign-out confirmation modal
  const [showSignOut, setShowSignOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ec, profileRes] = await Promise.all([
      getEmergencyContact(supabase, user.id),
      supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
    ]);
    if (ec) {
      setEcName(ec.contact_name);
      setEcPhone(ec.contact_phone ?? "");
      setEcEmail(ec.contact_email ?? "");
    }
    setMyPhone((profileRes.data as { phone?: string } | null)?.phone ?? "");
    setLoading(false);
  }, [user.id]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setEcError("");
    setEcSaved(false);
    if (!ecName.trim()) {
      setEcError("Emergency contact name is required.");
      return;
    }
    if (!ecPhone.trim() && !ecEmail.trim()) {
      setEcError("Provide at least a phone number or email for the emergency contact.");
      return;
    }
    setSaving(true);
    // Save emergency contact + driver's own phone in parallel
    const [ecRes] = await Promise.all([
      upsertEmergencyContact(supabase, user.id, {
        contact_name: ecName.trim(),
        contact_phone: ecPhone.trim(),
        contact_email: ecEmail.trim(),
      }),
      supabase.from("profiles").update({ phone: myPhone.trim() }).eq("id", user.id),
    ]);
    setSaving(false);
    if (ecRes.error) {
      setEcError(ecRes.error);
    } else {
      setEcSaved(true);
      setTimeout(() => setEcSaved(false), 3000);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>

      {/* ── Sign-out confirmation modal ── */}
      <Modal visible={showSignOut} transparent animationType="fade" onRequestClose={() => setShowSignOut(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalIcon}>👋</Text>
            <Text style={styles.modalTitle}>Sign out?</Text>
            <Text style={styles.modalBody}>You'll need to sign in again to access SnoozeGuard.</Text>
            <Pressable
              style={styles.modalDangerBtn}
              onPress={() => { setShowSignOut(false); void supabase.auth.signOut().then(onSignOut); }}
            >
              <Text style={styles.modalDangerText}>Sign out</Text>
            </Pressable>
            <Pressable style={styles.modalCancelBtn} onPress={() => setShowSignOut(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── User info ── */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
      </View>

      {/* ── Driver's own contact number ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>YOUR CONTACT NUMBER</Text>
        <Text style={styles.sectionHint}>
          This number is shown to your emergency contact when they receive a drowsiness alert so they can call you directly.
        </Text>
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 12 }} />
        ) : (
          <TextInput
            style={styles.input}
            value={myPhone}
            onChangeText={setMyPhone}
            placeholder="+63 912 345 6789"
            placeholderTextColor={theme.onSurfaceVariant}
            keyboardType="phone-pad"
          />
        )}
      </View>

      {/* ── Emergency contact ── */}
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
              onChangeText={(v) => { setEcName(v); setEcError(""); }}
              placeholder="e.g. Maria Santos"
              placeholderTextColor={theme.onSurfaceVariant}
            />

            <Text style={styles.fieldLabel}>Mobile number</Text>
            <TextInput
              style={styles.input}
              value={ecPhone}
              onChangeText={(v) => { setEcPhone(v); setEcError(""); }}
              placeholder="+63 912 345 6789"
              placeholderTextColor={theme.onSurfaceVariant}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>Email address</Text>
            <TextInput
              style={styles.input}
              value={ecEmail}
              onChangeText={(v) => { setEcEmail(v); setEcError(""); }}
              placeholder="contact@email.com"
              placeholderTextColor={theme.onSurfaceVariant}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.tip}>
              Tip: If your emergency contact also has the SnoozeGuard app, they'll see your
              live location on a map when an alert fires.
            </Text>

            {ecError ? <Text style={styles.errorText}>{ecError}</Text> : null}
            {ecSaved ? <Text style={styles.successText}>✓ Saved successfully</Text> : null}

            <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void save()}>
              {saving ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      {/* ── Quick contact actions ── */}
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

      {/* ── Sign out ── */}
      <Pressable style={styles.signOutBtn} onPress={() => setShowSignOut(true)}>
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
    marginBottom: 12,
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
    marginBottom: 10,
  },
  errorText: {
    color: theme.tertiary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  successText: {
    color: "#4ade80",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
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
  contactBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: "center", borderWidth: 1 },
  callBtn: { backgroundColor: "#4ade8022", borderColor: "#4ade8066" },
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

  // Sign-out modal
  modalOverlay: { flex: 1, backgroundColor: "#000000aa", justifyContent: "center", alignItems: "center", padding: 24 },
  modalSheet: {
    backgroundColor: theme.surfaceContainerLow, borderRadius: 24,
    padding: 28, width: "100%", maxWidth: 360, alignItems: "center",
    borderWidth: 1, borderColor: `${theme.outlineVariant}44`, gap: 10,
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, elevation: 16,
  },
  modalIcon: { fontSize: 42 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: theme.onSurface },
  modalBody: { fontSize: 14, color: theme.onSurfaceVariant, textAlign: "center", lineHeight: 20 },
  modalDangerBtn: {
    width: "100%", paddingVertical: 15, borderRadius: 16, alignItems: "center",
    backgroundColor: `${theme.tertiary}22`, borderWidth: 1, borderColor: `${theme.tertiary}88`,
  },
  modalDangerText: { color: theme.tertiary, fontWeight: "800", fontSize: 15 },
  modalCancelBtn: { paddingVertical: 10 },
  modalCancelText: { color: theme.onSurfaceVariant, fontSize: 14, fontWeight: "600" },
});
