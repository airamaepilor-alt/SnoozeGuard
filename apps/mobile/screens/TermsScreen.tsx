import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { Theme } from "../theme";

const EFFECTIVE_DATE = "April 18, 2026";

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function TermsScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Terms & Privacy Policy</Text>
        <Text style={styles.heroSub}>Effective {EFFECTIVE_DATE}</Text>
      </View>

      <Section title="1. ACCEPTANCE OF TERMS" styles={styles}>
        <Text style={styles.body}>
          By using SnoozeGuard ("the App"), you agree to these Terms of Service and Privacy Policy.
          If you do not agree, do not use the App. These terms apply to all users of the App.
        </Text>
      </Section>

      <Section title="2. PURPOSE OF THE APP" styles={styles}>
        <Text style={styles.body}>
          SnoozeGuard is a research and thesis project designed to detect driver drowsiness in real time
          using your phone's front camera and motion sensors. The App is intended to assist — not replace —
          safe driving practices. It does not guarantee prevention of accidents.
        </Text>
      </Section>

      <Section title="3. CAMERA AND SENSOR USE" styles={styles}>
        <Text style={styles.body}>
          The App uses your front-facing camera during active driving sessions to monitor facial landmarks
          (eye openness, yawning, head position). Camera frames are processed locally on your device using
          Face Geometry Machine Learning; no video or images are transmitted to any server.
        </Text>
        <Text style={[styles.body, styles.bodyMargin]}>
          Motion sensor data (accelerometer) is used to detect sudden braking events.
          This data is also processed locally and only aggregated statistics are stored.
        </Text>
      </Section>

      <Section title="4. LOCATION DATA" styles={styles}>
        <Text style={styles.body}>
          Location access is requested only when a critical drowsiness alert is triggered and
          goes unacknowledged for 2 minutes. At that point, your current GPS coordinates are
          sent to your designated emergency contact via the cloud database backend. Location is not
          continuously tracked or stored.
        </Text>
      </Section>

      <Section title="5. DATA WE COLLECT AND STORE" styles={styles}>
        <Text style={styles.body}>The following data is collected and stored:</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Account information (email, display name) via cloud database authentication</Text>
          <Text style={styles.bullet}>• Driving session metadata (timestamps, device type)</Text>
          <Text style={styles.bullet}>• Drowsiness telemetry (aggregated event counts and levels per session)</Text>
          <Text style={styles.bullet}>• Emergency contact details (name, phone, email) you voluntarily provide</Text>
          <Text style={styles.bullet}>• Your mobile phone number (optional, used for emergency alerts)</Text>
          <Text style={styles.bullet}>• Push notification token (for in-app emergency alerts)</Text>
        </View>
        <Text style={[styles.body, styles.bodyMargin]}>
          No raw video, audio, or continuous GPS data is stored. All telemetry is tied to your account ID.
        </Text>
      </Section>

      <Section title="6. EMERGENCY CONTACT NOTIFICATIONS" styles={styles}>
        <Text style={styles.body}>
          By setting an emergency contact, you authorize the App to automatically send your name,
          phone number, and current GPS location to that contact if a Level 9–10 drowsiness alert
          goes unacknowledged for 2 minutes. Your emergency contact will receive an SMS and/or
          in-app notification.
        </Text>
        <Text style={[styles.body, styles.bodyMargin]}>
          You are responsible for informing your emergency contact that they may receive such alerts.
        </Text>
      </Section>

      <Section title="7. DATA STORAGE AND SECURITY" styles={styles}>
        <Text style={styles.body}>
          Your data is stored on a cloud database and locally on your device via SQLite.
          Local data enables offline access to your history and emergency contact information.
          The cloud database applies industry-standard encryption in transit (TLS) and at rest.
        </Text>
        <Text style={[styles.body, styles.bodyMargin]}>
          We do not sell, rent, or share your personal data with third parties, except as required
          for the emergency notification feature or by law.
        </Text>
      </Section>

      <Section title="8. YOUR RIGHTS" styles={styles}>
        <Text style={styles.body}>You have the right to:</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Access and update your profile information via the Account screen</Text>
          <Text style={styles.bullet}>• Delete your account and associated data via the Account screen</Text>
          <Text style={styles.bullet}>• Update or remove your emergency contact at any time</Text>
          <Text style={styles.bullet}>• Revoke camera or location permissions via your device settings</Text>
        </View>
      </Section>

      <Section title="9. LIMITATIONS OF LIABILITY" styles={styles}>
        <Text style={styles.body}>
          SnoozeGuard is a research prototype. It is provided "as is" without warranty of any kind.
          The developers are not liable for any accidents, injuries, or damages arising from reliance
          on the App's alerts or failure to detect drowsiness.
        </Text>
        <Text style={[styles.body, styles.bodyMargin]}>
          Always prioritize safe driving. If you feel drowsy, pull over safely regardless of the App's
          alert level.
        </Text>
      </Section>

      <Section title="10. CHANGES TO THESE TERMS" styles={styles}>
        <Text style={styles.body}>
          These terms may be updated as the project evolves. Continued use of the App after changes
          are posted constitutes your acceptance of the revised terms.
        </Text>
      </Section>

      <Section title="11. CONTACT" styles={styles}>
        <Text style={styles.body}>
          This App is a thesis project. For questions or data requests, contact the development team
          through your institution's research office.
        </Text>
      </Section>

      <Text style={styles.footer}>SnoozeGuard · Thesis Build · {EFFECTIVE_DATE}</Text>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.background },
  container: { padding: 20, paddingBottom: 48 },
  hero: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: `${t.primary}0d`,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${t.primary}22`,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: t.onSurface },
  heroSub: { fontSize: 12, color: t.onSurfaceVariant, marginTop: 6 },
  section: {
    backgroundColor: `${t.surfaceContainerLow}ee`,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${t.outlineVariant}44`,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: t.primary,
    marginBottom: 6,
  },
  body: { color: t.onSurfaceVariant, fontSize: 13, lineHeight: 21 },
  bodyMargin: { marginTop: 10 },
  bulletList: { gap: 4, marginTop: 8 },
  bullet: { color: t.onSurfaceVariant, fontSize: 13, lineHeight: 20, paddingLeft: 4 },
  footer: {
    color: t.onSurfaceVariant,
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
});
