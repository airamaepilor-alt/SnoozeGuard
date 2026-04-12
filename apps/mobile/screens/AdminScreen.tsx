import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSession } from "../context/SessionContext";
import { supabase } from "../lib/supabase";
import { DEFAULT_ALERT_MAP } from "@snoozeguard/shared";
import { theme } from "../theme";

const ALL_ACTIONS = ["voice", "vibration", "alarm", "iot_led", "iot_buzzer"] as const;
type Action = typeof ALL_ACTIONS[number];

type LevelConfig = { label: string; actions: Action[]; yawn_count: number; head_count: number };
type AlertMapDraft = Record<string, LevelConfig>;

const LEVELS = [6, 7, 8, 9, 10];

const actionLabel: Record<Action, string> = {
  voice: "Voice",
  vibration: "Vibrate",
  alarm: "Alarm",
  iot_led: "IoT LED",
  iot_buzzer: "IoT Buzzer",
};

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function AdminScreen() {
  const session = useSession();
  const user = session.user;
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Config fields
  const [yawnThreshold, setYawnThreshold] = useState("3");
  const [headThreshold, setHeadThreshold] = useState("20");
  const [triggerLevel, setTriggerLevel] = useState("6");
  const [alertMap, setAlertMap] = useState<AlertMapDraft>(() => {
    const out: AlertMapDraft = {};
    for (const lv of LEVELS) {
      const def = DEFAULT_ALERT_MAP[String(lv)];
      out[String(lv)] = {
        label: def?.label ?? `Level ${lv}`,
        actions: (def?.actions ?? ["voice"]) as Action[],
        yawn_count: def?.yawn_count ?? 3,
        head_count: def?.head_count ?? 20,
      };
    }
    return out;
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    setRole(prof?.role ?? "driver");

    const { data } = await supabase
      .from("admin_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      setYawnThreshold(String(data.yawn_threshold ?? 3));
      setHeadThreshold(String(data.head_movement_threshold ?? 20));
      setTriggerLevel(String(data.drowsiness_trigger_level ?? 6));
      if (data.alert_map && typeof data.alert_map === "object") {
        const raw = data.alert_map as Record<string, { label?: string; actions?: string[]; yawn_count?: number; head_count?: number }>;
        const draft: AlertMapDraft = {};
        for (const lv of LEVELS) {
          const key = String(lv);
          const def = DEFAULT_ALERT_MAP[key];
          const r = raw[key];
          draft[key] = {
            label: r?.label ?? def?.label ?? `Level ${lv}`,
            actions: ((r?.actions ?? def?.actions ?? ["voice"]) as Action[]),
            yawn_count: r?.yawn_count ?? def?.yawn_count ?? 3,
            head_count: r?.head_count ?? def?.head_count ?? 20,
          };
        }
        setAlertMap(draft);
      }
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => { void load(); }, [load]);

  const toggleAction = (level: number, action: Action) => {
    const key = String(level);
    setAlertMap((prev) => {
      const cur = prev[key];
      const has = cur.actions.includes(action);
      return {
        ...prev,
        [key]: {
          ...cur,
          actions: has
            ? cur.actions.filter((a) => a !== action)
            : [...cur.actions, action],
        },
      };
    });
  };

  const setLevelLabel = (level: number, label: string) => {
    setAlertMap((prev) => ({
      ...prev,
      [String(level)]: { ...prev[String(level)], label },
    }));
  };

  const setLevelYawn = (level: number, val: number) => {
    setAlertMap((prev) => ({
      ...prev,
      [String(level)]: { ...prev[String(level)], yawn_count: clamp(val, 1, 99) },
    }));
  };

  const setLevelHead = (level: number, val: number) => {
    setAlertMap((prev) => ({
      ...prev,
      [String(level)]: { ...prev[String(level)], head_count: clamp(val, 1, 999) },
    }));
  };

  const save = async () => {
    const tl = clamp(Number(triggerLevel) || 6, 1, 10);
    const lvl6 = alertMap["6"];
    const payload = {
      p_yawn_threshold: lvl6?.yawn_count ?? 3,
      p_head_movement_threshold: lvl6?.head_count ?? 20,
      p_drowsiness_trigger_level: tl,
      p_alert_map: alertMap,
      p_updated_by: user.id,
    };
    console.log("[AdminScreen] saving via RPC:", JSON.stringify(payload));
    setSaving(true);
    const { data, error } = await supabase.rpc("update_admin_config", payload);
    setSaving(false);
    console.log("[AdminScreen] RPC result:", JSON.stringify({ data, error }));
    if (error) {
      Alert.alert("Save failed", `${error.message}\n\nCode: ${error.code ?? "–"}\nHint: ${error.hint ?? "–"}`);
    } else {
      Alert.alert("Saved", "Admin configuration updated.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (role !== "super_admin") {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Admin</Text>
        <Text style={styles.body}>This area is only available to Super Admins.</Text>
        <Text style={styles.meta}>Your current role: {role ?? "driver"}</Text>
        <Text style={styles.meta}>
          Ask your administrator to update your role in Supabase → profiles → role → super_admin
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Config</Text>
      <Text style={styles.subtitle}>Changes apply to all drivers on next session.</Text>

      {/* Alert trigger level */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ALERT TRIGGER</Text>
        <View style={styles.fieldSingle}>
          <Text style={styles.fieldLabel}>Start alerting at level</Text>
          <Text style={styles.fieldHint}>Alerts only fire when drowsiness reaches this level or above</Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setTriggerLevel((v) => String(Math.max(1, Number(v) - 1)))}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <TextInput
              style={styles.stepValue}
              value={triggerLevel}
              onChangeText={setTriggerLevel}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Pressable
              style={styles.stepBtn}
              onPress={() => setTriggerLevel((v) => String(Math.min(10, Number(v) + 1)))}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Alert map per level */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ALERT ACTIONS PER LEVEL</Text>
        <Text style={styles.sectionHint}>
          Configure what happens when each drowsiness level is reached.
        </Text>

        {LEVELS.map((lv) => {
          const cfg = alertMap[String(lv)];
          return (
            <View key={lv} style={styles.levelCard}>
              <View style={styles.levelHeader}>
                <View style={[styles.levelBadge, lv >= 8 ? styles.badgeRed : lv >= 7 ? styles.badgeAmber : styles.badgeGreen]}>
                  <Text style={styles.levelBadgeText}>L{lv}</Text>
                </View>
                <TextInput
                  style={styles.labelInput}
                  value={cfg.label}
                  onChangeText={(t) => setLevelLabel(lv, t)}
                  placeholder={`Level ${lv} label`}
                  placeholderTextColor={theme.onSurfaceVariant}
                />
              </View>
              {/* Per-level detection thresholds */}
              <View style={styles.thresholdRow}>
                <View style={styles.thresholdBlock}>
                  <Text style={styles.thresholdLabel}>Yawns to reach</Text>
                  <View style={styles.miniStepper}>
                    <Pressable style={styles.miniBtn} onPress={() => setLevelYawn(lv, cfg.yawn_count - 1)}>
                      <Text style={styles.miniBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.miniVal}>{cfg.yawn_count}</Text>
                    <Pressable style={styles.miniBtn} onPress={() => setLevelYawn(lv, cfg.yawn_count + 1)}>
                      <Text style={styles.miniBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.thresholdDivider} />
                <View style={styles.thresholdBlock}>
                  <Text style={styles.thresholdLabel}>Head moves to reach</Text>
                  <View style={styles.miniStepper}>
                    <Pressable style={styles.miniBtn} onPress={() => setLevelHead(lv, cfg.head_count - 1)}>
                      <Text style={styles.miniBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.miniVal}>{cfg.head_count}</Text>
                    <Pressable style={styles.miniBtn} onPress={() => setLevelHead(lv, cfg.head_count + 1)}>
                      <Text style={styles.miniBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
              <Text style={styles.orHint}>Either threshold triggers this level</Text>

              {/* Actions */}
              <Text style={styles.actionsHeader}>ALERT ACTIONS</Text>
              <View style={styles.actionRow}>
                {ALL_ACTIONS.map((action) => {
                  const active = cfg.actions.includes(action);
                  return (
                    <Pressable
                      key={action}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleAction(lv, action)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {actionLabel[action]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void save()}>
        {saving ? (
          <ActivityIndicator color={theme.onPrimary} />
        ) : (
          <Text style={styles.saveBtnText}>Save configuration</Text>
        )}
      </Pressable>

      <Text style={styles.footer}>
        Config is stored in Supabase admin_config (id=1) and applied to all active sessions.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.background },
  container: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background },
  root: { flex: 1, backgroundColor: theme.background, padding: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: "800", color: theme.onSurface },
  subtitle: { color: theme.onSurfaceVariant, marginTop: 4, fontSize: 13, marginBottom: 20 },
  body: { color: theme.onSurfaceVariant, marginTop: 12, lineHeight: 22 },
  meta: { color: theme.onSurfaceVariant, marginTop: 12, fontSize: 12 },
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
    marginBottom: 14,
  },
  sectionHint: { fontSize: 12, color: theme.onSurfaceVariant, marginBottom: 12, marginTop: -8 },
  fieldRow: { flexDirection: "row", gap: 12 },
  fieldBlock: { flex: 1 },
  fieldSingle: { marginTop: 14 },
  fieldLabel: { color: theme.onSurface, fontWeight: "700", fontSize: 13 },
  fieldHint: { color: theme.onSurfaceVariant, fontSize: 11, marginTop: 2, marginBottom: 8 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${theme.surfaceContainer}cc`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}55`,
    overflow: "hidden",
    marginTop: 4,
  },
  stepBtn: {
    width: 38,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${theme.primary}22`,
  },
  stepBtnText: { color: theme.primary, fontSize: 20, fontWeight: "700" },
  stepValue: {
    flex: 1,
    textAlign: "center",
    color: theme.onSurface,
    fontWeight: "800",
    fontSize: 16,
    height: 42,
  },
  levelCard: {
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}44`,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: `${theme.surfaceContainer}66`,
  },
  levelHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  levelBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeGreen: { backgroundColor: "#4ade8033" },
  badgeAmber: { backgroundColor: `${theme.secondary}33` },
  badgeRed: { backgroundColor: `${theme.tertiary}33` },
  levelBadgeText: { color: theme.onSurface, fontWeight: "800", fontSize: 12 },
  labelInput: {
    flex: 1,
    color: theme.onSurface,
    fontWeight: "600",
    fontSize: 14,
    borderBottomWidth: 1,
    borderBottomColor: `${theme.outlineVariant}55`,
    paddingBottom: 2,
  },
  thresholdRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  thresholdBlock: { flex: 1, alignItems: "center" },
  thresholdDivider: { width: 1, height: 36, backgroundColor: `${theme.outlineVariant}44`, marginHorizontal: 8 },
  thresholdLabel: { fontSize: 10, fontWeight: "700", color: theme.onSurfaceVariant, marginBottom: 4, letterSpacing: 0.5 },
  miniStepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: `${theme.primary}22`,
    alignItems: "center",
    justifyContent: "center",
  },
  miniBtnText: { color: theme.primary, fontSize: 16, fontWeight: "700" },
  miniVal: { color: theme.onSurface, fontWeight: "800", fontSize: 16, minWidth: 28, textAlign: "center" },
  orHint: { color: theme.onSurfaceVariant, fontSize: 10, textAlign: "center", marginBottom: 8, fontStyle: "italic" },
  actionsHeader: { color: theme.onSurfaceVariant, fontSize: 10, fontWeight: "700", marginTop: 8, marginBottom: 6, letterSpacing: 1 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}66`,
    backgroundColor: `${theme.surfaceContainer}88`,
  },
  chipActive: {
    backgroundColor: `${theme.primary}22`,
    borderColor: theme.primary,
  },
  chipText: { color: theme.onSurfaceVariant, fontSize: 11, fontWeight: "600" },
  chipTextActive: { color: theme.primary },
  saveBtn: {
    backgroundColor: theme.primary,
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    shadowColor: theme.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 8,
  },
  saveBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
  footer: { color: theme.onSurfaceVariant, fontSize: 11, marginTop: 16, textAlign: "center", lineHeight: 16 },
});
