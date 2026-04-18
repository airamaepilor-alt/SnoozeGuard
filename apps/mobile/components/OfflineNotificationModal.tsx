import { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { Theme } from "../theme";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onSkip?: () => void;
  title?: string;
  message?: string;
  dismissButtonText?: string;
  skipButtonText?: string;
};

export function OfflineNotificationModal({
  visible,
  onDismiss,
  onSkip,
  title = "Offline Mode",
  message = "You're currently offline. Data is cached locally on your device and will sync when you reconnect to the internet.",
  dismissButtonText = "Got it",
  skipButtonText,
}: Props) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content} scrollEnabled={false}>
            {/* Icon/Header */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>⚠️</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoBullet}>
                💾 Your changes are saved locally on this device
              </Text>
              <Text style={styles.infoBullet}>
                🔄 Data will automatically sync when you're back online
              </Text>
              <Text style={styles.infoBullet}>
                📍 Some features may be limited or display cached information
              </Text>
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {skipButtonText ? (
              <Pressable
                style={[styles.button, styles.skipButton]}
                onPress={onSkip}
              >
                <Text style={styles.skipButtonText}>{skipButtonText}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.button, styles.dismissButton]}
              onPress={onDismiss}
            >
              <Text style={styles.dismissButtonText}>{dismissButtonText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: t.surface,
    borderRadius: 24,
    maxWidth: 400,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  content: {
    padding: 24,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: t.onSurface,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 14,
    color: t.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: `${t.secondary}11`,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${t.secondary}33`,
    gap: 10,
  },
  infoBullet: {
    fontSize: 13,
    color: t.onSurfaceVariant,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: `${t.outlineVariant}22`,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButton: {
    backgroundColor: `${t.outlineVariant}22`,
    borderWidth: 1,
    borderColor: `${t.outlineVariant}55`,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: t.onSurface,
  },
  dismissButton: {
    backgroundColor: t.primary,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: t.onPrimary,
  },
});
