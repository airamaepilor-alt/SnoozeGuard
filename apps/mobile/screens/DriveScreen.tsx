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

type AdminRuntime = {
  trigger: number;
  map: ReturnType<typeof parseAlertMap>;
  yawn_threshold: number;
  head_movement_threshold: number;
};

async function playMobileAlertActions(actions: string[]) {
  for (const a of actions) {
    if (a === "sound" || a === "voice" || a === "alarm") {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        /* ignore */
      }
    }
    if (a === "vibration") {
      Vibration.vibrate(500);
    }
  }
}

export function DriveScreen() {
  const { user } = useSession();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");

  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [netLabel, setNetLabel] = useState("…");

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
      lastAlertRef.current = null;
      yawnAccRef.current = 0;
      headAccRef.current = 0;
      if (await isOnline()) {
        await flushPendingTelemetry(supabase, user.id);
      }
      setStatus("Session started locally. Telemetry queues to SQLite, syncs to Supabase when online.");
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
    try {
      const ended = new Date().toISOString();
      getDatabase().runSync("UPDATE driving_sessions_local SET ended_at = ? WHERE id = ?", ended, localSessionId);
      setLocalSessionId(null);
      setAlertOpen(false);
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
          const flash = actions.some((a) => a === "flashlight" || a === "iot_led");
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
      sub.remove();
      gsub.remove();
      stopTick();
    };
  }, [localSessionId, stopTick, user.id]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission required for the monitoring preview.</Text>
        <Pressable style={styles.btn} onPress={() => void requestPermission()}>
          <Text style={styles.btnText}>Grant permission</Text>
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
              <Text style={styles.btnText}>I’m alert — dismiss</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.preview}>
        <Camera style={StyleSheet.absoluteFill} device={device} isActive={Boolean(localSessionId)} />
        {!localSessionId ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>Start session to enable the camera preview + ML loop</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.meta}>Network: {netLabel}</Text>
        <Text style={styles.meta}>
          Motion ML: accelerometer + gyro → head/brake proxies; drowsiness blends with admin thresholds. Yawns need a vision plugin or web MediaPipe path.
        </Text>
        <View style={styles.row}>
          {!localSessionId ? (
            <Pressable style={[styles.btn, styles.go]} disabled={busy} onPress={() => void startSession()}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Start driving</Text>}
            </Pressable>
          ) : (
            <Pressable style={[styles.btn, styles.danger]} disabled={busy} onPress={() => void endSession()}>
              <Text style={styles.btnText}>End session</Text>
            </Pressable>
          )}
        </View>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b" },
  preview: { flex: 1, borderRadius: 16, overflow: "hidden", margin: 12, borderWidth: 1, borderColor: "#27272a" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 16,
  },
  overlayText: { color: "#e4e4e7", textAlign: "center" },
  panel: { padding: 16, gap: 8 },
  meta: { color: "#a1a1aa", fontSize: 12 },
  row: { flexDirection: "row", gap: 12, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  go: { backgroundColor: "#059669" },
  danger: { backgroundColor: "#7f1d1d" },
  btnText: { color: "#fff", fontWeight: "700" },
  status: { color: "#fcd34d", fontSize: 12, marginTop: 8 },
  center: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#09090b" },
  text: { color: "#e4e4e7", marginBottom: 16 },
  alertRoot: {
    flex: 1,
    backgroundColor: "#0b1326",
    justifyContent: "center",
    padding: 24,
  },
  alertFlash: { backgroundColor: "#1a0a0a" },
  alertBarTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: "#ef4444",
  },
  alertBarBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: "#ef4444",
  },
  alertBody: { alignItems: "center", gap: 12 },
  alertKicker: { color: "#fca5a5", fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  alertLevel: { color: "#fff", fontSize: 42, fontWeight: "800" },
  alertTitle: { color: "#7dd3fc", fontSize: 18, textAlign: "center" },
  alertHint: { color: "#a1a1aa", fontSize: 14, textAlign: "center", marginBottom: 24 },
  alertBtn: {
    backgroundColor: "#0284c7",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 260,
    alignItems: "center",
  },
});
