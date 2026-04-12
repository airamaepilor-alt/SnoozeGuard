import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Vibration,
  Linking,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Accelerometer } from "expo-sensors";
import * as Crypto from "expo-crypto";
import NetInfo from "@react-native-community/netinfo";
import * as Speech from "expo-speech";
import { deleteAsync } from "expo-file-system/legacy";
import { Camera, useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import { faceLandmarkDetectionOnImage, Delegate } from "react-native-mediapipe";
import { acknowledgeEmergencyAlert, getEmergencyContact, triggerEmergencyAlert, type EmergencyContact } from "../lib/emergencyNotify";
import {
  alertConfigForDrowsinessLevel,
  computeLevelFromAlertMap,
  parseAlertMap,
  shouldAlertForLevel,
} from "@snoozeguard/shared";
import { useSession } from "../context/SessionContext";
import { getDatabase } from "../db/database";
import { supabase } from "../lib/supabase";
import {
  parseFaceFrame,
  createYawnDetector,
  createHeadDetector,
  createTiltDetector,
  ensureModelPath,
  type MPResultsBundle,
} from "../ml/faceDetection";
import { flushEndedSessions, flushPendingTelemetry, isOnline } from "../sync/flush";
import { theme } from "../theme";

type AdminRuntime = {
  trigger: number;
  map: ReturnType<typeof parseAlertMap>;
};

// ─── Real alert actions ───────────────────────────────────────────────────────
// voice      → TTS "drowsiness detected, please pull over"
// alarm      → Android system alarm tone for 8 s (fallback: strong vibration)
// flashlight → phone torch flicker (on/off every 250 ms for 5 s)
// vibration  → device vibration
// iot_led / iot_buzzer → handled server-side via IoT ingest

async function playMobileAlertActions(
  actions: string[],
  setTorchOn: (on: boolean) => void,
  flickerIntervalRef: { current: ReturnType<typeof setInterval> | null },
) {
  for (const action of actions) {
    if (action === "voice") {
      Speech.speak("Warning: drowsiness detected. Please pull over and rest.", {
        language: "en-US",
        rate: 0.85,
        pitch: 1.0,
      });
    }
    if (action === "alarm") {
      try {
        const { Audio } = await import("expo-av");
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false });
        const { sound } = await Audio.Sound.createAsync(
          { uri: "content://settings/system/alarm_alert" },
          { shouldPlay: true, volume: 1.0 },
        );
        setTimeout(() => void sound.unloadAsync(), 8000);
      } catch {
        Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500]);
      }
    }
    if (action === "flashlight") {
      // Clear any in-progress flicker before starting a new one
      if (flickerIntervalRef.current) {
        clearInterval(flickerIntervalRef.current);
        flickerIntervalRef.current = null;
      }
      let count = 0;
      setTorchOn(true);
      flickerIntervalRef.current = setInterval(() => {
        count++;
        setTorchOn(count % 2 === 0); // even → on, odd → off
        if (count >= 20) {
          // 20 × 250 ms = 5 seconds total
          clearInterval(flickerIntervalRef.current!);
          flickerIntervalRef.current = null;
          setTorchOn(false);
        }
      }, 250);
    }
    if (action === "vibration") {
      Vibration.vibrate(500);
    }
  }
}

// ─── FaceCamera: snapshot-based MediaPipe detection ──────────────────────────
// Uses takeSnapshot + faceLandmarkDetectionOnImage (IMAGE mode).
// Frame processors are disabled in the existing native Android build so we
// cannot use LIVE_STREAM mode.  The native detectOnImage OOM leak is fixed by
// the postinstall patch which calls helper.clearFaceLandmarker() after each
// detection call, freeing the 5 MB MediaPipe model from native memory immediately.

type FaceCameraProps = {
  modelPath: string;
  sessionActive: boolean;
  torchOn: boolean;
  onFaceResults: (bundle: MPResultsBundle) => void;
};

function FaceCamera({ modelPath, sessionActive, torchOn, onFaceResults }: FaceCameraProps) {
  const device = useCameraDevice("front");
  const cameraRef = useRef<Camera>(null);
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!sessionActive) {
      activeRef.current = false;
      if (loopRef.current) clearTimeout(loopRef.current);
      return;
    }
    activeRef.current = true;

    const runLoop = async () => {
      if (!activeRef.current) return;
      if (!processingRef.current) {
        processingRef.current = true;
        let snapshotPath: string | null = null;
        try {
          const snapshot = await cameraRef.current?.takeSnapshot({ quality: 40 });
          if (snapshot?.path) {
            snapshotPath = snapshot.path;
            const bundle = await faceLandmarkDetectionOnImage(
              snapshotPath,
              modelPath,
              { delegate: Delegate.CPU, numFaces: 1 },
            );
            if (bundle) onFaceResults(bundle as unknown as MPResultsBundle);
          }
        } catch {
          // skip frame silently
        } finally {
          processingRef.current = false;
          if (snapshotPath) void deleteAsync(`file://${snapshotPath}`, { idempotent: true });
        }
      }
      if (activeRef.current) loopRef.current = setTimeout(() => { void runLoop(); }, 600);
    };

    loopRef.current = setTimeout(() => { void runLoop(); }, 1000);
    return () => {
      activeRef.current = false;
      if (loopRef.current) clearTimeout(loopRef.current);
    };
  }, [sessionActive, modelPath, onFaceResults]);

  if (!device) return null;

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={sessionActive}
      photo={false}
      video={false}
      torch={torchOn ? "on" : "off"}
    />
  );
}

// ─── DriveScreen ─────────────────────────────────────────────────────────────

export function DriveScreen() {
  const session = useSession();
  const user = session.user;
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");

  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [netLabel, setNetLabel] = useState("…");

  // Empty until downloaded — FaceCamera only mounts when this is set
  const [modelPath, setModelPath] = useState("");
  const modelPathRef = useRef(""); // mirrors state; used in callbacks to avoid stale closure

  // Live metrics
  const [liveLevel, setLiveLevel] = useState(0);
  const [liveYawns, setLiveYawns] = useState(0);
  const [liveHead, setLiveHead] = useState(0);
  const [sessionSecs, setSessionSecs] = useState(0);
  const sessionStartRef = useRef<number | null>(null);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertLevel, setAlertLevel] = useState(0);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertFlash, setAlertFlash] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Emergency contact
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact | null>(null);
  const [ecCountdown, setEcCountdown] = useState<number | null>(null);
  const ecTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ecAutoFiredRef = useRef(false);
  const activeAlertIdRef = useRef<string | null>(null);

  // Detectors
  const yawnDetectorRef = useRef(createYawnDetector(() => { yawnAccRef.current += 1; }));
  const headDetectorRef = useRef(createHeadDetector(() => { headAccRef.current += 1; }));
  const tiltDetectorRef = useRef(createTiltDetector(() => {
    setAlertLevel(8);
    setAlertTitle("Head turned away — eyes on the road!");
    setAlertFlash(true);
    setAlertOpen(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 500, 200, 500]);
  }));

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminRef = useRef<AdminRuntime>({ trigger: 6, map: parseAlertMap(undefined) });
  const yawnAccRef = useRef(0);
  const headAccRef = useRef(0);
  const yawnLastTickRef = useRef(0);
  const headLastTickRef = useRef(0);
  const suddenBrakeRef = useRef(false);
  const lastAlertRef = useRef<{ level: number; at: number } | null>(null);
  const sessionActiveRef = useRef(false);
  const alertOpenRef = useRef(false);
  const flickerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastShakeTimeRef = useRef(0);
  const SHAKE_DELTA_THRESHOLD = 0.45;
  const SHAKE_COOLDOWN = 3000;

  // Keep alertOpenRef in sync so non-React callbacks can read it without stale closures
  useEffect(() => { alertOpenRef.current = alertOpen; }, [alertOpen]);

  // ─── Face results from FaceCamera child ─────────────────────────────────────
  const handleFaceResults = useCallback((bundle: MPResultsBundle) => {
    if (!sessionActiveRef.current || alertOpenRef.current) return;
    const result = bundle.results?.[0];
    if (!result) return;
    const face = parseFaceFrame(result);
    const now = Date.now();
    yawnDetectorRef.current.process(face, now);
    // Suppress head movement while jaw is wide open — yawning naturally tilts the head
    // and would otherwise double-count every yawn as a head movement event too.
    const jawIsOpen = face !== null && face.jawOpen >= 0.6;
    if (!jawIsOpen) {
      headDetectorRef.current.process(face, now);
      tiltDetectorRef.current.process(face, now);
    }
  }, []);

  const loadAdminConfig = useCallback(async () => {
    const { data } = await supabase.from("admin_config").select("*").eq("id", 1).maybeSingle();
    if (!data) return;
    adminRef.current = {
      trigger: Number(data.drowsiness_trigger_level) || 6,
      map: parseAlertMap(data.alert_map),
    };
  }, []);

  // Download model on mount
  useEffect(() => {
    void ensureModelPath((msg) => { setStatus(msg); }).then((path) => {
      modelPathRef.current = path; // sync ref so startSession closure sees it
      setModelPath(path);
      setStatus("Face detection ready.");
    }).catch((err: unknown) => {
      console.error("[DriveScreen] model download failed:", JSON.stringify(err));
      setStatus("Model download failed — check connection.");
    });
  }, []);

  useEffect(() => {
    getDatabase();
    if (!hasPermission) void requestPermission();
    void getEmergencyContact(supabase, user.id).then(setEmergencyContact);
  }, [hasPermission, requestPermission, user.id]);

  useEffect(() => { void loadAdminConfig(); }, [loadAdminConfig]);

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

  const stopEcTimer = useCallback(() => {
    if (ecTimerRef.current) clearInterval(ecTimerRef.current);
    ecTimerRef.current = null;
    setEcCountdown(null);
  }, []);

  const fireEmergencyContact = useCallback(async () => {
    stopEcTimer();
    const driverName = user.user_metadata?.full_name ?? user.email ?? "Driver";
    const { alertId } = await triggerEmergencyAlert(supabase, user.id, driverName, localSessionId);
    activeAlertIdRef.current = alertId;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
  }, [user, localSessionId, stopEcTimer]);

  const startEcCountdown = useCallback(() => {
    if (ecTimerRef.current) return;
    ecAutoFiredRef.current = false;
    setEcCountdown(120);
    ecTimerRef.current = setInterval(() => {
      setEcCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (!ecAutoFiredRef.current) {
            ecAutoFiredRef.current = true;
            void fireEmergencyContact();
          }
          if (ecTimerRef.current) clearInterval(ecTimerRef.current);
          ecTimerRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [fireEmergencyContact]);

  const stopTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  useEffect(() => {
    if (alertOpen && alertLevel >= 9) startEcCountdown();
    else stopEcTimer();
  }, [alertOpen, alertLevel, startEcCountdown, stopEcTimer]);

  const startSession = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      await loadAdminConfig();
      const id = Crypto.randomUUID();
      const startedAt = new Date().toISOString();
      getDatabase().runSync(
        "INSERT INTO driving_sessions_local (id, user_id, started_at, device_type, ended_synced) VALUES (?, ?, ?, 'mobile', 0)",
        id, user.id, startedAt,
      );
      setLocalSessionId(id);
      sessionActiveRef.current = true;
      lastAlertRef.current = null;
      yawnAccRef.current = 0;
      headAccRef.current = 0;
      yawnLastTickRef.current = 0;
      headLastTickRef.current = 0;
      suddenBrakeRef.current = false;
      sessionStartRef.current = Date.now();
      tiltDetectorRef.current.reset();
      setLiveLevel(0); setLiveYawns(0); setLiveHead(0); setSessionSecs(0);
      if (await isOnline()) await flushPendingTelemetry(supabase, user.id);
      setStatus("Session started. MediaPipe face detection active.");
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
    tiltDetectorRef.current.reset();
    if (flickerIntervalRef.current) {
      clearInterval(flickerIntervalRef.current);
      flickerIntervalRef.current = null;
    }
    setTorchOn(false);
    try {
      getDatabase().runSync("UPDATE driving_sessions_local SET ended_at = ? WHERE id = ?", new Date().toISOString(), localSessionId);
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
    if (!localSessionId) { stopTick(); return; }

    Accelerometer.setUpdateInterval(100);
    let prevMag: number | null = null;
    let highDeltaCount = 0;

    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (prevMag !== null) {
        const delta = Math.abs(magnitude - prevMag);
        if (delta > SHAKE_DELTA_THRESHOLD) highDeltaCount = Math.min(highDeltaCount + 1, 6);
        else highDeltaCount = Math.max(0, highDeltaCount - 1);
        if (highDeltaCount >= 2) {
          const now = Date.now();
          if (now - lastShakeTimeRef.current > SHAKE_COOLDOWN) {
            lastShakeTimeRef.current = now;
            highDeltaCount = 0;
            suddenBrakeRef.current = true;
            setAlertLevel(9);
            setAlertTitle("Sudden brake detected — pull over safely.");
            setAlertFlash(true);
            setAlertOpen(true);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Vibration.vibrate([0, 400, 100, 400]);
          }
        }
      }
      prevMag = magnitude;
    });

    tickRef.current = setInterval(() => {
      const ar = adminRef.current;
      const brake = suddenBrakeRef.current;
      suddenBrakeRef.current = false;

      const yawnDelta = yawnAccRef.current - yawnLastTickRef.current;
      const headDelta = headAccRef.current - headLastTickRef.current;
      yawnLastTickRef.current = yawnAccRef.current;
      headLastTickRef.current = headAccRef.current;

      const level = computeLevelFromAlertMap(yawnAccRef.current, headAccRef.current, brake, ar.map);
      setLiveLevel(level);
      setLiveYawns(yawnAccRef.current);
      setLiveHead(headAccRef.current);
      if (sessionStartRef.current) setSessionSecs(Math.floor((Date.now() - sessionStartRef.current) / 1000));

      getDatabase().runSync(
        `INSERT INTO session_telemetry_local
         (local_session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, sudden_brake, source, remote_synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        localSessionId, new Date().toISOString(), level, yawnDelta, headDelta, brake ? 1 : 0, "mobile_mediapipe",
      );
      void flushPendingTelemetry(supabase, user.id);

      if (!alertOpenRef.current && shouldAlertForLevel(level, ar.trigger)) {
        const band = alertConfigForDrowsinessLevel(level, ar.map);
        const actions = band?.actions ?? ["voice"];
        const label = band?.label ?? "Attention required";
        const now = Date.now();
        const prev = lastAlertRef.current;
        if (!prev || now - prev.at > 35_000 || level > prev.level) {
          lastAlertRef.current = { level, at: now };
          setAlertFlash(actions.some((a: string) => a === "flashlight" || a === "iot_led"));
          setAlertLevel(level);
          setAlertTitle(label);
          setAlertOpen(true);
          void supabase.from("alert_events").insert({
            user_id: user.id, driving_session_id: null,
            local_session_hint: localSessionId, drowsiness_level: level,
            trigger_level: ar.trigger, alert_label: label, source: "mobile_drive",
          });
          void playMobileAlertActions(actions, setTorchOn, flickerIntervalRef);
        }
      }
    }, 1000);

    return () => {
      sessionActiveRef.current = false;
      sub.remove();
      stopTick();
    };
  }, [localSessionId, stopTick, user.id]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission required for face detection.</Text>
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
            <><View style={styles.alertBarTop} /><View style={styles.alertBarBottom} /></>
          ) : null}
          <View style={styles.alertBody}>
            <Text style={styles.alertKicker}>DROWSINESS ALERT</Text>
            <Text style={styles.alertLevel}>Level {alertLevel}</Text>
            <Text style={styles.alertTitle}>{alertTitle}</Text>
            <Text style={styles.alertHint}>Pull over when safe.</Text>

            {alertLevel >= 9 && (
              <View style={styles.ecSection}>
                {ecCountdown !== null ? (
                  <Text style={styles.ecCountdown}>Auto-notifying emergency contact in {ecCountdown}s</Text>
                ) : (
                  <Text style={styles.ecSent}>Emergency contact has been notified.</Text>
                )}
                {emergencyContact && (
                  <View style={styles.ecBtnRow}>
                    <Pressable style={styles.ecBtnCall} onPress={() => {
                      if (emergencyContact.contact_phone)
                        void Linking.openURL(`tel:${emergencyContact.contact_phone}`);
                    }}>
                      <Text style={styles.ecBtnText}>📞 Call {emergencyContact.contact_name}</Text>
                    </Pressable>
                    {emergencyContact.contact_phone && (
                      <Pressable style={styles.ecBtnSms} onPress={() =>
                        void Linking.openURL(`sms:${emergencyContact.contact_phone}&body=I triggered a drowsiness alert. Please check on me.`)
                      }>
                        <Text style={styles.ecBtnText}>💬 SMS</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.ecBtnNotify} onPress={() => void fireEmergencyContact()}>
                      <Text style={styles.ecBtnText}>🚨 Notify Now</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            <Pressable style={styles.alertBtn} onPress={() => {
              stopEcTimer();
              if (flickerIntervalRef.current) {
                clearInterval(flickerIntervalRef.current);
                flickerIntervalRef.current = null;
              }
              setTorchOn(false);
              if (activeAlertIdRef.current)
                void acknowledgeEmergencyAlert(supabase, activeAlertIdRef.current);
              setAlertOpen(false);
            }}>
              <Text style={styles.btnTextPrimary}>I'm alert — dismiss</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.preview}>
        {/* FaceCamera mounts once model is ready — detector is created once and
            reused for every frame (LIVE_STREAM mode), fixing the OOM crash */}
        {modelPath ? (
          <FaceCamera
            modelPath={modelPath}
            sessionActive={Boolean(localSessionId)}
            torchOn={torchOn}
            onFaceResults={handleFaceResults}
          />
        ) : null}
        {!localSessionId ? (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              {modelPath ? "Start session for MediaPipe face detection" : "Preparing face detection model…"}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        {localSessionId ? (
          <>
            <View style={styles.gaugeRow}>
              <View style={styles.gaugeBlock}>
                <Text style={styles.gaugeLabel}>DROWSINESS</Text>
                <Text style={[styles.gaugeValue, liveLevel >= 8 ? styles.gaugeRed : liveLevel >= 6 ? styles.gaugeAmber : styles.gaugeGreen]}>
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
              <View style={[styles.barFill, {
                width: `${Math.min(100, liveLevel * 10)}%` as `${number}%`,
                backgroundColor: liveLevel >= 8 ? theme.tertiary : liveLevel >= 6 ? theme.secondary : theme.primary,
              }]} />
            </View>
          </>
        ) : (
          <Text style={styles.meta}>MediaPipe face detection + shake-based brake alerts active during session.</Text>
        )}

        <Text style={styles.metaSmall}>Network: {netLabel}</Text>

        <View style={styles.row}>
          {!localSessionId ? (
            <Pressable
              style={[styles.btn, styles.go, !modelPath && styles.btnDisabled]}
              disabled={busy || !modelPath}
              onPress={() => void startSession()}
            >
              {busy ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.btnTextPrimary}>Start driving</Text>}
            </Pressable>
          ) : (
            <Pressable style={[styles.btn, styles.danger]} disabled={busy} onPress={() => void endSession()}>
              {busy ? <ActivityIndicator color={theme.tertiary} /> : <Text style={styles.btnTextDanger}>End session</Text>}
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
    flex: 1, borderRadius: 20, overflow: "hidden", margin: 12,
    borderWidth: 1, borderColor: `${theme.outlineVariant}66`,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject, justifyContent: "center",
    alignItems: "center", backgroundColor: "rgba(11, 19, 38, 0.72)", padding: 16,
  },
  overlayText: { color: theme.onSurface, textAlign: "center", fontSize: 14 },
  panel: {
    padding: 16, gap: 8, borderTopWidth: 1,
    borderTopColor: `${theme.outlineVariant}33`, backgroundColor: theme.surfaceContainerLow,
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
  barBg: { height: 6, backgroundColor: `${theme.outlineVariant}44`, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  barFill: { height: 6, borderRadius: 3 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  go: { backgroundColor: theme.primary, shadowColor: theme.primary, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6 },
  danger: { backgroundColor: `${theme.tertiary}33`, borderWidth: 1, borderColor: `${theme.tertiary}88` },
  btnTextPrimary: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
  btnTextDanger: { color: theme.tertiary, fontWeight: "800", fontSize: 14 },
  status: { color: theme.secondary, fontSize: 12, marginTop: 8 },
  center: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.background },
  text: { color: theme.onSurface, marginBottom: 16 },
  alertRoot: { flex: 1, backgroundColor: theme.background, justifyContent: "center", padding: 24 },
  alertFlash: { backgroundColor: `${theme.background}` },
  alertBarTop: { position: "absolute", top: 0, left: 0, right: 0, height: 10, backgroundColor: theme.tertiary },
  alertBarBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 10, backgroundColor: theme.tertiary },
  alertBody: { alignItems: "center", gap: 12 },
  alertKicker: { color: theme.tertiary, fontSize: 11, fontWeight: "800", letterSpacing: 3 },
  alertLevel: { color: theme.onSurface, fontSize: 42, fontWeight: "800" },
  alertTitle: { color: theme.primary, fontSize: 18, textAlign: "center", fontWeight: "600" },
  alertHint: { color: theme.onSurfaceVariant, fontSize: 14, textAlign: "center", marginBottom: 12 },
  ecSection: {
    width: "100%", backgroundColor: `${theme.tertiary}11`, borderRadius: 16,
    padding: 14, marginBottom: 16, borderWidth: 1, borderColor: `${theme.tertiary}44`,
  },
  ecCountdown: { color: theme.tertiary, fontWeight: "700", textAlign: "center", fontSize: 13, marginBottom: 10 },
  ecSent: { color: "#4ade80", fontWeight: "700", textAlign: "center", fontSize: 13, marginBottom: 10 },
  ecBtnRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  ecBtnCall: { flex: 2, backgroundColor: `#4ade8022`, borderWidth: 1, borderColor: `#4ade8066`, padding: 10, borderRadius: 12, alignItems: "center" },
  ecBtnSms: { flex: 1, backgroundColor: `${theme.primary}22`, borderWidth: 1, borderColor: `${theme.primary}66`, padding: 10, borderRadius: 12, alignItems: "center" },
  ecBtnNotify: { flex: 1, backgroundColor: `${theme.tertiary}22`, borderWidth: 1, borderColor: `${theme.tertiary}66`, padding: 10, borderRadius: 12, alignItems: "center" },
  ecBtnText: { color: theme.onSurface, fontWeight: "700", fontSize: 12 },
  alertBtn: { backgroundColor: theme.primary, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12 },
});
