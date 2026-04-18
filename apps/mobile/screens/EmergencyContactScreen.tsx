import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { getEmergencyContact, upsertEmergencyContact } from "../lib/emergencyNotify";
import { getDatabase } from "../db/database";
import { isOnline } from "../sync/flush";
import type { Theme } from "../theme";

type CachedEC = {
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  my_phone: string;
  pending_sync: number;
};

export function EmergencyContactScreen() {
  const session = useSession();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const user = session.user;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [myPhone, setMyPhone] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecEmail, setEcEmail] = useState("");
  const [ecError, setEcError] = useState("");
  const [ecSaved, setEcSaved] = useState(false);

  function readFromCache(): CachedEC | null {
    try {
      return getDatabase().getFirstSync<CachedEC>(
        "SELECT contact_name, contact_phone, contact_email, my_phone, pending_sync FROM emergency_contacts_local WHERE user_id = ?",
        user.id,
      ) ?? null;
    } catch { return null; }
  }

  function writeToCache(data: { contact_name: string; contact_phone: string; contact_email: string; my_phone: string; pending: boolean }) {
    try {
      getDatabase().runSync(
        `INSERT OR REPLACE INTO emergency_contacts_local
         (user_id, contact_name, contact_phone, contact_email, my_phone, pending_sync, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        user.id, data.contact_name, data.contact_phone, data.contact_email,
        data.my_phone, data.pending ? 1 : 0, new Date().toISOString(),
      );
    } catch { /* ignore */ }
  }

  const load = useCallback(async () => {
    setLoading(true);
    // 1. Show cached data immediately so screen is usable offline
    const cached = readFromCache();
    if (cached) {
      setEcName(cached.contact_name);
      setEcPhone(cached.contact_phone);
      setEcEmail(cached.contact_email);
      setMyPhone(cached.my_phone);
      setLoading(false);
    }

    // 2. Try Supabase in background and update cache
    try {
      const online = await isOnline();
      setOffline(!online);
      if (!online) return;

      const [ec, profileRes] = await Promise.all([
        getEmergencyContact(supabase, user.id),
        supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
      ]);
      const freshPhone = (profileRes.data as { phone?: string } | null)?.phone ?? "";
      if (ec) {
        setEcName(ec.contact_name);
        setEcPhone(ec.contact_phone ?? "");
        setEcEmail(ec.contact_email ?? "");
        setMyPhone(freshPhone);
        writeToCache({
          contact_name: ec.contact_name,
          contact_phone: ec.contact_phone ?? "",
          contact_email: ec.contact_email ?? "",
          my_phone: freshPhone,
          pending: false,
        });
      } else if (!cached) {
        setMyPhone(freshPhone);
      }
    } catch { /* stay with cached data */ }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setEcError("");
    setEcSaved(false);
    if (!ecName.trim()) { setEcError("Emergency contact name is required."); return; }
    if (!ecPhone.trim() && !ecEmail.trim()) {
      setEcError("Provide at least a phone number or email for the emergency contact.");
      return;
    }
    setSaving(true);

    // Always write to SQLite first — works offline
    writeToCache({
      contact_name: ecName.trim(),
      contact_phone: ecPhone.trim(),
      contact_email: ecEmail.trim(),
      my_phone: myPhone.trim(),
      pending: true,
    });

    // Then try Supabase
    try {
      const online = await isOnline();
      if (!online) {
        setEcSaved(true);
        setOffline(true);
        setTimeout(() => setEcSaved(false), 4000);
        setSaving(false);
        return;
      }
      const [ecRes] = await Promise.all([
        upsertEmergencyContact(supabase, user.id, {
          contact_name: ecName.trim(),
          contact_phone: ecPhone.trim(),
          contact_email: ecEmail.trim(),
        }),
        supabase.from("profiles").update({ phone: myPhone.trim() }).eq("id", user.id),
      ]);
      if (ecRes.error) {
        setEcError(ecRes.error);
      } else {
        writeToCache({
          contact_name: ecName.trim(),
          contact_phone: ecPhone.trim(),
          contact_email: ecEmail.trim(),
          my_phone: myPhone.trim(),
          pending: false,
        });
        setEcSaved(true);
        setOffline(false);
        setTimeout(() => setEcSaved(false), 3000);
      }
    } catch {
      setEcError("Saved locally. Will sync when online.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>Offline — showing cached data</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>YOUR MOBILE NUMBER</Text>
        <Text style={styles.hint}>
          Shown to your emergency contact so they can call you when an alert fires.
        </Text>
        {loading ? <ActivityIndicator color={t.primary} style={{ marginTop: 12 }} /> : (
          <TextInput
            style={styles.input}
            value={myPhone}
            onChangeText={setMyPhone}
            placeholder="+63 912 345 6789"
            placeholderTextColor={t.onSurfaceVariant}
            keyboardType="phone-pad"
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EMERGENCY CONTACT</Text>
        <Text style={styles.hint}>
          If a critical drowsiness alert goes unacknowledged for 2 minutes, your location
          is automatically sent to this person.
        </Text>
        {loading && !readFromCache() ? <ActivityIndicator color={t.primary} style={{ marginTop: 16 }} /> : (
          <>
            <Text style={styles.label}>Full name *</Text>
            <TextInput style={styles.input} value={ecName}
              onChangeText={(v) => { setEcName(v); setEcError(""); }}
              placeholder="e.g. Maria Santos" placeholderTextColor={t.onSurfaceVariant} />

            <Text style={styles.label}>Their mobile number</Text>
            <TextInput style={styles.input} value={ecPhone}
              onChangeText={(v) => { setEcPhone(v); setEcError(""); }}
              placeholder="+63 912 345 6789" placeholderTextColor={t.onSurfaceVariant}
              keyboardType="phone-pad" />

            <Text style={styles.label}>Their email address</Text>
            <TextInput style={styles.input} value={ecEmail}
              onChangeText={(v) => { setEcEmail(v); setEcError(""); }}
              placeholder="contact@email.com" placeholderTextColor={t.onSurfaceVariant}
              keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.tip}>
              If your emergency contact also uses SnoozeGuard, they'll receive an in-app alert with your location.
            </Text>

            {ecError ? <Text style={styles.errorText}>{ecError}</Text> : null}
            {ecSaved ? (
              <Text style={styles.successText}>
                {offline ? "✓ Saved locally — will sync when online" : "✓ Saved successfully"}
              </Text>
            ) : null}

            <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void save()}>
              {saving ? <ActivityIndicator color={t.onPrimary} /> : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      {ecPhone ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK CONTACT</Text>
          <View style={styles.contactRow}>
            <Pressable style={[styles.contactBtn, styles.callBtn]}
              onPress={() => void Linking.openURL(`tel:${ecPhone}`)}>
              <Text style={styles.contactBtnText}>📞 Call</Text>
            </Pressable>
            <Pressable style={[styles.contactBtn, styles.smsBtn]}
              onPress={() => void Linking.openURL(`sms:${ecPhone}`)}>
              <Text style={styles.contactBtnText}>💬 SMS</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.background },
  container: { padding: 20, paddingBottom: 40 },
  offlineBanner: {
    backgroundColor: `${t.secondary}22`, borderRadius: 12,
    padding: 10, marginBottom: 12, borderWidth: 1, borderColor: `${t.secondary}55`,
    alignItems: "center",
  },
  offlineBannerText: { color: t.secondary, fontWeight: "700", fontSize: 12 },
  section: {
    backgroundColor: `${t.surfaceContainerLow}ee`,
    borderRadius: 20, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: `${t.outlineVariant}44`,
  },
  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: t.onSurfaceVariant, marginBottom: 6 },
  hint: { color: t.onSurfaceVariant, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  label: { color: t.onSurface, fontWeight: "600", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: `${t.outlineVariant}66`,
    borderRadius: 14, padding: 12, marginBottom: 12,
    color: t.onSurface, backgroundColor: t.surfaceContainerHigh, fontSize: 15,
  },
  tip: { color: t.onSurfaceVariant, fontSize: 11, lineHeight: 16, fontStyle: "italic", marginBottom: 10 },
  errorText: { color: t.tertiary, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  successText: { color: "#4ade80", fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  saveBtn: { backgroundColor: t.primary, padding: 16, borderRadius: 16, alignItems: "center", shadowColor: t.primary, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  saveBtnText: { color: t.onPrimary, fontWeight: "800", fontSize: 15 },
  contactRow: { flexDirection: "row", gap: 12 },
  contactBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: "center", borderWidth: 1 },
  callBtn: { backgroundColor: "#4ade8022", borderColor: "#4ade8066" },
  smsBtn: { backgroundColor: `${t.primary}22`, borderColor: `${t.primary}66` },
  contactBtnText: { color: t.onSurface, fontWeight: "700", fontSize: 14 },
});
