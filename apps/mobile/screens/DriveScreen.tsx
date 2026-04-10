import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Vibration,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Accelerometer, Gyroscope } from "expo-sensors";
import * as Crypto from "expo-crypto";
import NetInfo from "@react-native-community/netinfo";
import { Camera, useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import {
  alertConfigForDrowsinessLevel,
  computeDrowsinessLevelFromSignals,
  parseAlertMap,
  shouldAlertForLevel,
} from "@snoozeguard/shared";
import { useSession } from "../context/SessionContext";
import { getDatabase } from "../db/database";
import { supabase } from "../lib/supabase";
import { HeuristicDrowsinessEstimator } from "../ml/heuristicEstimator";
import { flushEndedSessions, flushPendingTelemetry, isOnline } from "../sync/flush";
import { theme } from "../theme";

type AdminRuntime = {
  trigger: number;
  map: ReturnType<typeof parseAlertMap>;
  yawn_threshold: number;
  head_movement_threshold: number;
};

async function playMobileAlertActions(actions: string[]) {
  for (const action of actions) {
    if (action === "sound" || action === "voice" || action === "alarm") {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        /* ignore */
      }
    }
    if (action === "vibration") {
      Vibration.vibrate(500);
    }
  }
}

export function DriveScreen() {
  const session = useSession();
  const user = session.user;
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");

  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [netLabel, setNetLabel] = useState("…");

  // Live metrics for real-time display
  const [liveLevel, setLiveLevel] = useState(0);
  const [liveYawns, setLiveYawns] = useState(0);
  const [liveHead, setLiveHead] = useState(0);
  const [sessionSecs, setSessionSecs] = useState(0);
  const sessionStartRef = useRef<number | null>(null);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertLevel, setAlertLevel] = useState(0);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertFlash, setAlertFlash] = useState(false);

  const estimatorRef = useRef(new HeuristicDrowsinessEstimator());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminRef = useRef<AdminRuntime>({
    trigger: 6,
    map: parseAlertMap(undefined),
    yawn_threshold: 3,
    head_movement_threshold: 20,
  });
  const yawnAccRef = useRef(0);
  const headAccRef = useRef(0);
  const lastAlertRef = useRef<{ level: number; at: number } | null>(null);
  const sessionActiveRef = useRef(false);

  const loadAdminConfig = useCallback(async () => {
    const { data } = await supabase.from("admin_config").select("*").eq("id", 1).maybeSingle();
    if (!data) return;
    adminRef.current = {
      trigger: Number(data.drowsiness_trigger_level) || 6,
      map: parseAlertMap(data.alert_map),
      yawn_threshold: Number(data.yawn_threshold) || 3,
      head_movement_threshold: Number(data.head_movement_threshold) || 20,
    };
  }, []);

  useEffect(() => {
    getDatabase();
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    void loadAdminConfig();
  }, [loadAdminConfig]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      setNetLabel(s.isConnected ? (s.isInternetReachable === false ? "no internet" : "online") : "offline");
      if (s.isConnected) {
        void flushPendingTelemetry(supabase, user.id);
        void flushEndedSessions(supabase, user.id);
        void loadAdminConfig();
      }
    });
    return () => unsub();
  }, [user.id, loadAdminConfig]);

  const stopTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const startSession = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      await loadAdminConfig();
      const id = await Crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const db = getDatabase();
      db.runSync(
        "INSERT INTO driving_sessions_local (id, user_id, started_at, device_type, ended_synced) VALUES (?, ?, ?, 'mobile', 0)",
        id,
        user.id,
        startedAt,
      );
      setLocalSessionId(id);
      sessionActiveRef.current = true;
      lastAlertRef.current = null;
      yawnAccRef.current = 0;
      headAccRef.current = 0;
      sessionStartRef.current = Date.now();
      setLiveLevel(0);
      setLiveYawns(0);
      setLiveHead(0);
      setSessionSecs(0);
      if (await isOnline()) {
        await flushPendingTelemetry(supabase, user.id);
      }
      setStatus("Session started. Telemetry queues to SQLite, syncs to Supabase when online.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to start session");
    } finally {
      setBusy(false);
    }
  }, [user.id, loadAdminConfig]);

  const endSession = useCallback(async () => {
    if (!localSessionId) return;
    setBusy(true);
    stopTick();
    sessionActiveRef.current = false;
    try {
      const ended = new Date().toISOString();
      getDatabase().runSync("UPDATE driving_sessions_local SET ended_at = ? WHERE id = ?", ended, localSessionId);
      setLocalSessionId(null);
      setAlertOpen(false);
      setLiveLevel(0);
      sessionStartRef.current = null;
      setStatus("Session ended. Syncing…");
      await flushEndedSessions(supabase, user.id);
      await flushPendingTelemetry(supabase, user.id);
      setStatus("Session ended.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to end session");
    } finally {
      setBusy(false);
    }
  }, [localSessionId, stopTick, user.id]);

  useEffect(() => {
    if (!localSessionId) {
      stopTick();
      return;
    }

    Accelerometer.setUpdateInterval(200);
    Gyroscope.setUpdateInterval(200);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      estimatorRef.current.pushAccel(x, y, z);
    });
    const gsub = Gyroscope.addListener(({ x, y, z }) => {
      estimatorRef.current.pushGyro(x, y, z);
    });

    tickRef.current = setInterval(() => {
      const sample = estimatorRef.current.tick(1000);
      yawnAccRef.current += sample.yawnCountDelta;
      headAccRef.current += sample.headEventCountDelta;
      const ar = adminRef.current;
      const level = computeDrowsinessLevelFromSignals({
        sessionYawnCount: yawnAccRef.current,
        sessionHeadEventCount: headAccRef.current,
        suddenBrakeThisTick: sample.suddenBrake,
        thresholds: {
          yawn_threshold: ar.yawn_threshold,
          head_movement_threshold: ar.head_movement_threshold,
        },
        motionProxyLevel: sample.drowsinessLevel,
      });

      setLiveLevel(level);
      setLiveYawns(yawnAccRef.current);
      setLiveHead(headAccRef.current);
      if (sessionStartRef.current) {
        setSessionSecs(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }

      const recordedAt = new Date().toISOString();
      getDatabase().runSync(
        `INSERT INTO session_telemetry_local
         (local_session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, sudden_brake, source, remote_synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        localSessionId,
        recordedAt,
        level,
        sample.yawnCountDelta,
        sample.headEventCountDelta,
        sample.suddenBrake ? 1 : 0,
        "mobile_heuristic",
      );
      void flushPendingTelemetry(supabase, user.id);

      const { trigger, map } = ar;
      if (shouldAlertForLevel(level, trigger)) {
        const band = alertConfigForDrowsinessLevel(level, map);
        const actions = band?.actions ?? ["sound"];
        const label = band?.label ?? "Attention required";
        const now = Date.now();
        const prev = lastAlertRef.current;
        const throttleMs = 35_000;
        if (!prev || now - prev.at > throttleMs || level > prev.level) {
          lastAlertRef.current = { level, at: now };
          const flash = actions.some((act: string) => act === "flashlight" || act === "iot_led");
          setAlertFlash(flash);
          setAlertLevel(level);
          setAlertTitle(label);
          setAlertOpen(true);
          void supabase.from("alert_events").insert({
            user_id: user.id,
            driving_session_id: null,
            local_session_hint: localSessionId,
            drowsiness_level: level,
            trigger_level: trigger,
            alert_label: label,
            source: "mobile_drive",
          });
          void playMobileAlertActions(actions);
        }
      }
    }, 1000);

    return () => {
      sessionActiveRef.current = false;
      sub.remove();
      gsub.remove();
      stopTick();
    };
  }, [localSessionId, stopTick, user.id]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission required for the monitoring preview.</Text>
        <Pressable style={[styles.btn, styles.go]} onPress={() => void requestPermission()}>
          <Text style={styles.btnTextPrimary}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>No front camera found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Modal visible={alertOpen} animationType="fade" transparent={false} onRequestClose={() => setAlertOpen(false)}>
        <View style={[styles.alertRoot, alertFlash && styles.alertFlash]}>
          {alertFlash ? (
            <>
              <View style={styles.alertBarTop} />
              <View style={styles.alertBarBottom} />
            </>
          ) : null}
          <View style={styles.alertBody}>
            <Text style={styles.alertKicker}>DROWSINESS ALERT</Text>
            <Text style={styles.alertLevel}>Level {alertLevel}</Text>
            <Text style={styles.alertTitle}>{alertTitle}</Text>
            <Text style={styles.alertHint}>Pull over when safe.</Text>
            <Pressable style={styles.alertBtn} onPress={() => setAlertOpen(false)}>
              <Text style={styles.btnTextPrimary}>I'm alert — dismiss</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.preview}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={Boolean(localSessionId)}
        />
        {!localSessionId ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>Start session to enable the camera preview + motion tracking</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        {localSessionId ? (
          <>
            <View style={styles.gaugeRow}>
              <View style={styles.gaugeBlock}>
                <Text style={styles.gaugeLabel}>DROWSINESS</Text>
                <Text style={[
                  styles.gaugeValue,
                  liveLevel >= 8 ? styles.gaugeRed : liveLevel >= 6 ? styles.gaugeAmber : styles.gaugeGreen,
                ]}>
                  {liveLevel.toFixed(0)}
                </Text>
                <Text style={styles.gaugeUnit}>/ 10</Text>
              </View>
              <View style={styles.gaugeBlock}>
                <Text style={styles.gaugeLabel}>YAWNS</Text>
                <Text style={styles.gaugeValue}>{liveYawns}</Text>
                <Text style={styles.gaugeUnit}>detected</Text>
              </View>
              <View style={styles.gaugeBlock}>
                <Text style={styles.gaugeLabel}>HEAD MOVES</Text>
                <Text style={styles.gaugeValue}>{liveHead}</Text>
                <Text style={styles.gaugeUnit}>events</Text>
              </View>
              <View style={styles.gaugeBlock}>
                <Text style={styles.gaugeLabel}>DURATION</Text>
                <Text style={styles.gaugeValue}>
                  {Math.floor(sessionSecs / 60)}:{String(sessionSecs % 60).padStart(2, "0")}
                </Text>
                <Text style={styles.gaugeUnit}>min:sec</Text>
              </View>
            </View>

            <View style={styles.barBg}>
              <View style={[
                styles.barFill,
                {
                  width: `${Math.min(100, liveLevel * 10)}%` as `${number}%`,
                  backgroundColor: liveLevel >= 8 ? theme.tertiary : liveLevel >= 6 ? theme.secondary : theme.primary,
                },
              ]} />
            </View>
          </>
        ) : (
          <Text style={styles.meta}>
            Camera preview and accelerometer/gyro motion tracking will activate when you start a session.
          </Text>
        )}

        <Text style={styles.metaSmall}>Network: {netLabel}</Text>

        <View style={styles.row}>
          {!localSessionId ? (
            <Pressable style={[styles.btn, styles.go]} disabled={busy} onPress={() => void startSession()}>
              {busy ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={styles.btnTextPrimary}>Start driving</Text>
              )}
            </Pressable>
          ) : (
            <Pressable style={[styles.btn, styles.danger]} disabled={busy} onPress={() => void endSession()}>
              {busy ? (
                <ActivityIndicator color={theme.tertiary} />
              ) : (
                <Text style={styles.btnTextDanger}>End session</Text>
              )}
            </Pressable>
          )}
        </View>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  preview: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    margin: 12,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}66`,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(11, 19, 38, 0.72)",
    padding: 16,
  },
  overlayText: { color: theme.onSurface, textAlign: "center", fontSize: 14 },
  panel: {
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: `${theme.outlineVariant}33`,
    backgroundColor: theme.surfaceContainerLow,
  },
  meta: { color: theme.onSurfaceVariant, fontSize: 12, lineHeight: 18 },
  metaSmall: { color: theme.onSurfaceVariant, fontSize: 11, marginTop: 4 },
  gaugeRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  gaugeBlock: { alignItems: "center", flex: 1 },
  gaugeLabel: { fontSize: 8, fontWeight: "700", color: theme.onSurfaceVariant, letterSpacing: 1 },
  gaugeValue: { fontSize: 22, fontWeight: "800", color: theme.onSurface, marginTop: 2 },
  gaugeUnit: { fontSize: 9, color: theme.onSurfaceVariant },
  gaugeGreen: { color: "#4ade80" },
  gaugeAmber: { color: theme.secondary },
  gaugeRed: { color: theme.tertiary },
  barBg: {
    height: 6,
    backgroundColor: `${theme.outlineVariant}44`,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  barFill: { height: 6, borderRadius: 3 },
  row: { flexDirection: "row", gap: 12, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  go: {
    backgroundColor: theme.primary,
    shadowColor: theme.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  danger: {
    backgroundColor: `${theme.tertiary}33`,
    borderWidth: 1,
    borderColor: `${theme.tertiary}88`,
  },
  btnTextPrimary: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
  btnTextDanger: { color: theme.tertiary, fontWeight: "800", fontSize: 16 },
  status: { color: theme.secondary, fontSize: 12, marginTop: 8 },
  center: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.background },
  text: { color: theme.onSurface, marginBottom: 16 },
  alertRoot: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: "center",
    padding: 24,
  },
  alertFlash: { backgroundColor: `${theme.background}` },
  alertBarTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: theme.tertiary,
  },
  alertBarBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: theme.tertiary,
  },
  alertBody: { alignItems: "center", gap: 12 },
  alertKicker: {
    color: theme.tertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
  },
  alertLevel: { color: theme.onSurface, fontSize: 42, fontWeight: "800" },
  alertTitle: { color: theme.primary, fontSize: 18, textAlign: "center", fontWeight: "600" },
  alertHint: { color: theme.onSurfaceVariant, fontSize: 14, textAlign: "center", marginBottom: 24 },
  alertBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    minWidth: 260,
    alignItems: "center",
    shadowColor: theme.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
});
