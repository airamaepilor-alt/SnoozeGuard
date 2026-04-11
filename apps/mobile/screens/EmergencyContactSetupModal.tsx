import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { upsertEmergencyContact } from "../lib/emergencyNotify";
import { theme } from "../theme";

type Props = {
  visible: boolean;
  userId: string;
  onDone: () => void;
  onSkip: () => void;
};

export function EmergencyContactSetupModal({ visible, userId, onDone, onSkip }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter the contact's name.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      Alert.alert("Required", "Enter at least a phone number or email.");
      return;
    }
    setSaving(true);
    const { error } = await upsertEmergencyContact(supabase, userId, {
      contact_name: name.trim(),
      contact_phone: phone.trim(),
      contact_email: email.trim(),
    });
    setSaving(false);
    if (error) {
      Alert.alert("Error", error);
    } else {
      onDone();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Emergency Contact</Text>
          <Text style={styles.subtitle}>
            Required for your safety. If a critical drowsiness alert goes unacknowledged for 2 minutes,
            your location will be sent to this person automatically.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Full name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Maria Santos"
            placeholderTextColor={theme.onSurfaceVariant}
          />

          <Text style={styles.label}>Mobile number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+63 912 345 6789"
            placeholderTextColor={theme.onSurfaceVariant}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="contact@email.com"
            placeholderTextColor={theme.onSurfaceVariant}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.tip}>
            If your emergency contact also uses SnoozeGuard, they'll receive an in-app alert
            showing your location on a map.
          </Text>
        </View>

        <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void save()}>
          {saving ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>Save & continue</Text>
          )}
        </Pressable>

        <Pressable style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Skip for now (you can add this in Profile)</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.background,
    padding: 24,
    justifyContent: "center",
  },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: "800", color: theme.onSurface },
  subtitle: {
    marginTop: 8,
    color: theme.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    backgroundColor: `${theme.surfaceContainerLow}ee`,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}44`,
    marginBottom: 20,
  },
  label: { color: theme.onSurface, fontWeight: "600", fontSize: 13, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}66`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
    color: theme.onSurface,
    backgroundColor: `${theme.background}99`,
    fontSize: 15,
  },
  tip: {
    color: theme.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 16,
    fontStyle: "italic",
    marginTop: 12,
  },
  saveBtn: {
    backgroundColor: theme.primary,
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    shadowColor: theme.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  saveBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
  skipBtn: { marginTop: 16, alignItems: "center", padding: 12 },
  skipText: { color: theme.onSurfaceVariant, fontSize: 13, textDecorationLine: "underline" },
});
