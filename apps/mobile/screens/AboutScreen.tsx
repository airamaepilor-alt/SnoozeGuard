import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { Theme } from "../theme";

const APP_VERSION = "1.0.0 (thesis build)";

export function AboutScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🛡️</Text>
        <Text style={styles.heroTitle}>SnoozeGuard</Text>
        <Text style={styles.heroVersion}>{APP_VERSION}</Text>
        <Text style={styles.heroTagline}>
          Real-time drowsiness detection for safer driving
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WHAT IT DOES</Text>
        <Text style={styles.body}>
          SnoozeGuard monitors driver fatigue in real time using your phone's front camera and motion sensors.
          When signs of drowsiness are detected, it sounds alerts, vibrates, and — at critical levels —
          automatically notifies your emergency contact with your location.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>HOW DETECTION WORKS</Text>
        <View style={styles.row}>
          <Text style={styles.rowIcon}>😮</Text>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Yawn Detection</Text>
            <Text style={styles.rowBody}>Camera captures mouth-open events using Face Geometry Machine Learning to identify drowsiness.</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowIcon}>😴</Text>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Head Drop</Text>
            <Text style={styles.rowBody}>Nose-tip position is tracked frame-by-frame; sudden drops indicate nodding off.</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowIcon}>↗️</Text>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Head Tilt</Text>
            <Text style={styles.rowBody}>Sustained lateral tilt beyond 20° for 10 s triggers a fatigue warning.</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowIcon}>🛑</Text>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Sudden Brake</Text>
            <Text style={styles.rowBody}>Accelerometer detects sharp deceleration events during a session.</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ALERT LEVELS</Text>
        <Text style={styles.body}>
          Drowsiness is scored from 0 to 10. Alerts begin at Level 6 and escalate based on accumulated events.
          Level 9–10 activates emergency contact notification and IoT hardware alerts if connected.
        </Text>
        <View style={styles.levelRow}>
          <View style={[styles.levelDot, { backgroundColor: "#4ade80" }]} />
          <Text style={styles.levelText}>Levels 1–5 — Normal, no alert</Text>
        </View>
        <View style={styles.levelRow}>
          <View style={[styles.levelDot, { backgroundColor: t.secondary }]} />
          <Text style={styles.levelText}>Levels 6–7 — Caution, voice alert</Text>
        </View>
        <View style={styles.levelRow}>
          <View style={[styles.levelDot, { backgroundColor: "#f97316" }]} />
          <Text style={styles.levelText}>Level 8 — High alert, pull over advised</Text>
        </View>
        <View style={styles.levelRow}>
          <View style={[styles.levelDot, { backgroundColor: t.tertiary }]} />
          <Text style={styles.levelText}>Levels 9–10 — Emergency, EC notified</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FOCUS SCORE</Text>
        <Text style={styles.body}>
          Your Focus Score (0–100) is calculated as{" "}
          <Text style={styles.code}>100 − (avg_drowsiness × 10)</Text> across all sessions in the selected period.
          A score above 75 is healthy. Below 50 means consistent drowsiness — consider adjusting your sleep schedule.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>THESIS CONTEXT</Text>
        <Text style={styles.body}>
          SnoozeGuard is a thesis project developed to address road accidents caused by driver fatigue.
          The system integrates mobile AI (Face Geometry Machine Learning), IoT hardware, and cloud infrastructure (Cloud Database)
          to provide a complete, real-world drowsiness detection solution.
        </Text>
      </View>

      <Pressable style={styles.websiteBtn} disabled>
        <Text style={styles.websiteBtnText}>🌐  Visit SnoozeGuard Website</Text>
        <Text style={styles.websiteBtnSub}>Coming soon</Text>
      </Pressable>

      <Text style={styles.footer}>
        Built with Mobile App Framework · Face Geometry Machine Learning · Cloud Database
      </Text>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.background },
  container: { padding: 20, paddingBottom: 48 },
  hero: {
    alignItems: "center", paddingVertical: 28,
    backgroundColor: `${t.primary}11`,
    borderRadius: 20, marginBottom: 16,
    borderWidth: 1, borderColor: `${t.primary}22`,
  },
  heroIcon: { fontSize: 52, marginBottom: 10 },
  heroTitle: { fontSize: 28, fontWeight: "800", color: t.onSurface },
  heroVersion: { fontSize: 12, color: t.onSurfaceVariant, marginTop: 4, fontFamily: "monospace" },
  heroTagline: { fontSize: 13, color: t.onSurfaceVariant, marginTop: 8, textAlign: "center", paddingHorizontal: 24, lineHeight: 19 },
  section: {
    backgroundColor: `${t.surfaceContainerLow}ee`,
    borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: `${t.outlineVariant}44`, gap: 10,
  },
  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: t.onSurfaceVariant },
  body: { color: t.onSurfaceVariant, fontSize: 13, lineHeight: 21 },
  code: { fontFamily: "monospace", color: t.primary, fontSize: 12 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  rowIcon: { fontSize: 24, marginTop: 2 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: t.onSurface, fontWeight: "700", fontSize: 13 },
  rowBody: { color: t.onSurfaceVariant, fontSize: 12, lineHeight: 18 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelText: { color: t.onSurfaceVariant, fontSize: 13 },
  websiteBtn: {
    backgroundColor: `${t.primary}15`, borderRadius: 16, padding: 16,
    alignItems: "center", borderWidth: 1, borderColor: `${t.primary}33`,
    marginBottom: 16, opacity: 0.65,
  },
  websiteBtnText: { color: t.primary, fontWeight: "700", fontSize: 15 },
  websiteBtnSub: { color: t.onSurfaceVariant, fontSize: 11, marginTop: 4 },
  footer: { color: t.onSurfaceVariant, fontSize: 11, textAlign: "center", marginTop: 8, fontStyle: "italic" },
});
