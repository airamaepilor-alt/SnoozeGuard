import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { DEFAULT_ALERT_MAP } from "@snoozeguard/shared";
import type { Theme } from "../theme";

const ALL_ACTIONS = ["voice", "vibration", "iot_led", "iot_buzzer"] as const;
type Action = typeof ALL_ACTIONS[number];

type LevelConfig = { label: string; actions: Action[]; yawn_count: number; head_count: number };
type AlertMapDraft = Record<string, LevelConfig>;

const LEVELS = [6, 7, 8, 9, 10];

const actionLabel: Record<Action, string> = {
  voice: "Voice",
  vibration: "Vibrate",
  iot_led: "IoT LED",
  iot_buzzer: "IoT Buzzer",
};

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function AdminScreen() {
  const session = useSession();
  const user = session.user;
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [scoreResetMinutes, setScoreResetMinutes] = useState(2);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsRateLimitEnabled, setSmsRateLimitEnabled] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [saveSaved, setSaveSaved] = useState(false);
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
      setScoreResetMinutes(Number(data.score_reset_minutes) || 2);
      setSmsEnabled(Boolean(data.sms_enabled));
      setSmsRateLimitEnabled(data.sms_rate_limit_enabled !== false); // default true
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
    setSaveError("");
    setSaveSaved(false);
    const lvl6 = alertMap["6"];
    const payload = {
      p_yawn_threshold: lvl6?.yawn_count ?? 3,
      p_head_movement_threshold: lvl6?.head_count ?? 20,
      p_drowsiness_trigger_level: 6,
      p_alert_map: alertMap,
      p_updated_by: user.id,
      p_score_reset_minutes: clamp(scoreResetMinutes, 1, 60),
      p_sms_enabled: smsEnabled,
      p_sms_rate_limit_enabled: smsRateLimitEnabled,
    };
    setSaving(true);
    const { error } = await supabase.rpc("update_admin_config", payload);
    setSaving(false);
    if (error) {
      setSaveError(`Save failed: ${error.message}`);
    } else {
      setSaveSaved(true);
      setTimeout(() => setSaveSaved(false), 3000);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.primary} />
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LEVEL-10 SCORE RESET</Text>
        <View style={styles.fieldSingle}>
          <Text style={styles.fieldLabel}>Reset drowsiness after (minutes)</Text>
          <Text style={styles.fieldHint}>
            After the driver dismisses a level-10 alert and no new level-10 trigger fires within this time,
            all drowsiness accumulators reset to zero.
          </Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => setScoreResetMinutes((v) => Math.max(1, v - 1))}>
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <TextInput
              style={styles.stepValue}
              value={String(scoreResetMinutes)}
              onChangeText={(v) => setScoreResetMinutes(Math.max(1, Number(v) || 1))}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Pressable style={styles.stepBtn} onPress={() => setScoreResetMinutes((v) => Math.min(60, v + 1))}>
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EMERGENCY SMS</Text>
        <Text style={styles.sectionHint}>
          When enabled, an SMS is sent automatically to the emergency contact when a level 9/10 alert fires.
          API keys are configured in Supabase Edge Function secrets (TextBelt → Infobip → Semaphore fallback).
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.fieldLabel}>Enable auto SMS</Text>
          <Switch
            value={smsEnabled}
            onValueChange={setSmsEnabled}
            trackColor={{ false: `${t.outlineVariant}88`, true: `${t.primary}88` }}
            thumbColor={smsEnabled ? t.primary : t.onSurfaceVariant}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Enable rate limit per user</Text>
            <Text style={styles.fieldHint}>
              When enabled, only 1 SMS per phone number per day is sent. Disable if you don't need this limit.
            </Text>
          </View>
          <Switch
            value={smsRateLimitEnabled}
            onValueChange={setSmsRateLimitEnabled}
            trackColor={{ false: `${t.outlineVariant}88`, true: `${t.primary}88` }}
            thumbColor={smsRateLimitEnabled ? t.primary : t.onSurfaceVariant}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ALERT ACTIONS PER LEVEL</Text>
        <Text style={styles.sectionHint}>Configure what happens when each drowsiness level is reached.</Text>

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
                  onChangeText={(v) => setLevelLabel(lv, v)}
                  placeholder={`Level ${lv} label`}
                  placeholderTextColor={t.onSurfaceVariant}
                />
              </View>
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

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      {saveSaved ? <Text style={styles.saveSuccess}>✓ Configuration saved</Text> : null}

      <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void save()}>
        {saving ? (
          <ActivityIndicator color={t.onPrimary} />
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

const makeStyles = (t: Theme) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.background },
  container: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: t.background },
  root: { flex: 1, backgroundColor: t.background, padding: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: "800", color: t.onSurface },
  subtitle: { color: t.onSurfaceVariant, marginTop: 4, fontSize: 13, marginBottom: 20 },
  body: { color: t.onSurfaceVariant, marginTop: 12, lineHeight: 22 },
  meta: { color: t.onSurfaceVariant, marginTop: 12, fontSize: 12 },
  section: {
    backgroundColor: `${t.surfaceContainerLow}ee`,
    borderRadius: 20, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: `${t.outlineVariant}44`,
  },
  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: t.onSurfaceVariant, marginBottom: 14 },
  sectionHint: { fontSize: 12, color: t.onSurfaceVariant, marginBottom: 12, marginTop: -8 },
  fieldSingle: { marginTop: 14 },
  fieldLabel: { color: t.onSurface, fontWeight: "700", fontSize: 13 },
  fieldHint: { color: t.onSurfaceVariant, fontSize: 11, marginTop: 2, marginBottom: 8 },
  stepper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: `${t.surfaceContainer}cc`,
    borderRadius: 12, borderWidth: 1,
    borderColor: `${t.outlineVariant}55`, overflow: "hidden", marginTop: 4,
  },
  stepBtn: { width: 38, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: `${t.primary}22` },
  stepBtnText: { color: t.primary, fontSize: 20, fontWeight: "700" },
  stepValue: { flex: 1, textAlign: "center", color: t.onSurface, fontWeight: "800", fontSize: 16, height: 42 },
  levelCard: {
    borderWidth: 1, borderColor: `${t.outlineVariant}44`,
    borderRadius: 14, padding: 12, marginBottom: 10,
    backgroundColor: `${t.surfaceContainer}66`,
  },
  levelHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  levelBadge: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  badgeGreen: { backgroundColor: "#4ade8033" },
  badgeAmber: { backgroundColor: `${t.secondary}33` },
  badgeRed: { backgroundColor: `${t.tertiary}33` },
  levelBadgeText: { color: t.onSurface, fontWeight: "800", fontSize: 12 },
  labelInput: {
    flex: 1, color: t.onSurface, fontWeight: "600", fontSize: 14,
    borderBottomWidth: 1, borderBottomColor: `${t.outlineVariant}55`, paddingBottom: 2,
  },
  thresholdRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  thresholdBlock: { flex: 1, alignItems: "center" },
  thresholdDivider: { width: 1, height: 36, backgroundColor: `${t.outlineVariant}44`, marginHorizontal: 8 },
  thresholdLabel: { fontSize: 10, fontWeight: "700", color: t.onSurfaceVariant, marginBottom: 4, letterSpacing: 0.5 },
  miniStepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: `${t.primary}22`, alignItems: "center", justifyContent: "center" },
  miniBtnText: { color: t.primary, fontSize: 16, fontWeight: "700" },
  miniVal: { color: t.onSurface, fontWeight: "800", fontSize: 16, minWidth: 28, textAlign: "center" },
  orHint: { color: t.onSurfaceVariant, fontSize: 10, textAlign: "center", marginBottom: 8, fontStyle: "italic" },
  actionsHeader: { color: t.onSurfaceVariant, fontSize: 10, fontWeight: "700", marginTop: 8, marginBottom: 6, letterSpacing: 1 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: `${t.outlineVariant}66`, backgroundColor: `${t.surfaceContainer}88` },
  chipActive: { backgroundColor: `${t.primary}22`, borderColor: t.primary },
  chipText: { color: t.onSurfaceVariant, fontSize: 11, fontWeight: "600" },
  chipTextActive: { color: t.primary },
  saveBtn: {
    backgroundColor: t.primary, padding: 18, borderRadius: 18, alignItems: "center",
    shadowColor: t.primary, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginTop: 8,
  },
  saveBtnText: { color: t.onPrimary, fontWeight: "800", fontSize: 16 },
  footer: { color: t.onSurfaceVariant, fontSize: 11, marginTop: 16, textAlign: "center", lineHeight: 16 },
  saveError: { color: t.tertiary, fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 8 },
  saveSuccess: { color: "#4ade80", fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 8 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
});
