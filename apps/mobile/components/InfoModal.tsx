import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

type Props = { visible: boolean; title: string; body: string; onClose: () => void };

export function InfoModal({ visible, title, body, onClose }: Props) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.card, { backgroundColor: theme.surfaceContainerLow, borderColor: `${theme.outlineVariant}66` }]}>
          <Text style={[styles.title, { color: theme.onSurface }]}>{title}</Text>
          <Text style={[styles.body, { color: theme.onSurfaceVariant }]}>{body}</Text>
          <Pressable style={[styles.btn, { backgroundColor: theme.primary }]} onPress={onClose}>
            <Text style={[styles.btnText, { color: theme.onPrimary }]}>Got it</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 28 },
  card: { borderRadius: 20, padding: 24, borderWidth: 1, gap: 12 },
  title: { fontSize: 16, fontWeight: "800" },
  body: { fontSize: 13, lineHeight: 20 },
  btn: { marginTop: 4, padding: 14, borderRadius: 14, alignItems: "center" },
  btnText: { fontWeight: "800", fontSize: 14 },
});
