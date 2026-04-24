import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { upsertEmergencyContact, getEmergencyContact } from "../lib/emergencyNotify";
import { upsertLocalEC } from "../db/database";
import { useTheme } from "../context/ThemeContext";
import { isOnline } from "../sync/flush";
import { OfflineNotificationModal } from "../components/OfflineNotificationModal";
import type { Theme } from "../theme";

type Props = {
  visible: boolean;
  userId: string;
  onDone: () => void;
  onSkip: () => void;
};

export function EmergencyContactSetupModal({ visible, userId, onDone, onSkip }: Props) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [myPhone, setMyPhone] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  // Check if offline when modal becomes visible
  useEffect(() => {
    if (!visible) return;
    const checkOnlineStatus = async () => {
      const online = await isOnline();
      setOffline(!online);
      if (!online) {
        setShowOfflineModal(true);
      }
    };
    void checkOnlineStatus();
  }, [visible]);

  const save = async () => {
    setError("");
    if (!name.trim()) {
      setError("Please enter the emergency contact's name.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("Enter at least a phone number or email for the emergency contact.");
      return;
    }
    setSaving(true);

    // Always write to SQLite first — works offline
    try {
      getDatabase().runSync(
        `INSERT OR REPLACE INTO emergency_contacts_local
         (user_id, contact_name, contact_phone, contact_email, my_phone, pending_sync, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        userId, name.trim(), phone.trim(), email.trim(), myPhone.trim(), 1, new Date().toISOString(),
      );
    } catch { /* ignore */ }

    // Then try Supabase
    try {
      const online = await isOnline();
      if (!online) {
        setSaving(false);
        onDone();
        return;
      }
      const [ecRes] = await Promise.all([
        upsertEmergencyContact(supabase, userId, {
          contact_name: name.trim(),
          contact_phone: phone.trim(),
          contact_email: email.trim(),
        }),
        myPhone.trim()
          ? supabase.from("profiles").update({ phone: myPhone.trim() }).eq("id", userId)
          : Promise.resolve(),
      ]);
      setSaving(false);
      if (ecRes.error) {
        setError(ecRes.error);
      } else {
        // Cache to SQLite with new multi-contact schema
        try {
          const saved = await getEmergencyContact(supabase, userId);
          if (saved?.id) {
            upsertLocalEC({
              id: saved.id,
              user_id: userId,
              contact_name: name.trim(),
              contact_phone: phone.trim(),
              contact_email: email.trim(),
              my_phone: myPhone.trim(),
              is_active: 1,
              pending_sync: 0,
              updated_at: new Date().toISOString(),
            });
          }
        } catch { /* ignore */ }
        onDone();
      }
    } catch (e) {
      setSaving(false);
      setError("Saved locally. Will sync when online.");
    }
  };

  return (
    <>
      <OfflineNotificationModal
        visible={showOfflineModal}
        onDismiss={() => setShowOfflineModal(false)}
        title="Offline Mode"
        message="You're offline. Automatic emergency notifications and SMS alerts to your contact are unavailable. However, rest assured that real-time drowsiness detection and alerts on this device remain fully functional. Your contact information will sync when you reconnect."
        dismissButtonText="Got it"
      />
      <Modal visible={visible && !showOfflineModal} animationType="slide" transparent={false}>
        <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Emergency Contact</Text>
          <Text style={styles.subtitle}>
            Required for your safety. If a critical drowsiness alert goes unacknowledged for 2 minutes,
            your location will be sent to this person automatically.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formSectionLabel}>YOUR MOBILE NUMBER</Text>
          <Text style={styles.formSectionHint}>
            Your emergency contact will see this number so they can call you directly when an alert fires.
          </Text>
          <TextInput
            style={styles.input}
            value={myPhone}
            onChangeText={(v) => { setMyPhone(v); setError(""); }}
            placeholder="+63 912 345 6789"
            placeholderTextColor={t.onSurfaceVariant}
            keyboardType="phone-pad"
          />

          <View style={styles.divider} />

          <Text style={styles.formSectionLabel}>EMERGENCY CONTACT DETAILS</Text>
          <Text style={styles.label}>Full name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(v) => { setName(v); setError(""); }}
            placeholder="e.g. Maria Santos"
            placeholderTextColor={t.onSurfaceVariant}
          />

          <Text style={styles.label}>Their mobile number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(v) => { setPhone(v); setError(""); }}
            placeholder="+63 912 345 6789"
            placeholderTextColor={t.onSurfaceVariant}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Their email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(""); }}
            placeholder="contact@email.com"
            placeholderTextColor={t.onSurfaceVariant}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.tip}>
            If your emergency contact also uses SnoozeGuard, they'll receive an in-app alert
            showing your location on a map.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void save()}>
          {saving ? (
            <ActivityIndicator color={t.onPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>Save & continue</Text>
          )}
        </Pressable>

        <Pressable style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for now (you can add this in Profile)</Text>
        </Pressable>
        </ScrollView>
      </Modal>
    </>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },
  content: { padding: 24, paddingBottom: 48 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: "800", color: t.onSurface },
  subtitle: { marginTop: 8, color: t.onSurfaceVariant, fontSize: 14, lineHeight: 20 },
  form: {
    backgroundColor: `${t.surfaceContainerLow}ee`,
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: `${t.outlineVariant}44`,
    marginBottom: 20, gap: 2,
  },
  formSectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: t.onSurfaceVariant, marginBottom: 4, marginTop: 8 },
  formSectionHint: { color: t.onSurfaceVariant, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  divider: { height: 1, backgroundColor: `${t.outlineVariant}44`, marginVertical: 14 },
  label: { color: t.onSurface, fontWeight: "600", fontSize: 13, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: `${t.outlineVariant}66`,
    borderRadius: 14, padding: 14, marginBottom: 4,
    color: t.onSurface, backgroundColor: `${t.surfaceContainerHigh}cc`, fontSize: 15,
  },
  tip: { color: t.onSurfaceVariant, fontSize: 11, lineHeight: 16, fontStyle: "italic", marginTop: 12 },
  errorText: { color: t.tertiary, fontSize: 13, fontWeight: "600", marginTop: 10, textAlign: "center" },
  saveBtn: {
    backgroundColor: t.primary, padding: 18, borderRadius: 18, alignItems: "center",
    shadowColor: t.primary, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6,
  },
  saveBtnText: { color: t.onPrimary, fontWeight: "800", fontSize: 16 },
  skipBtn: { marginTop: 16, alignItems: "center", padding: 12 },
  skipText: { color: t.onSurfaceVariant, fontSize: 13, textDecorationLine: "underline" },
});
