import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Audio } from "expo-av";
import { deleteAsync } from "expo-file-system/legacy";
import { Camera, useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import { drivingSessionActive, endSessionFn } from "../sessionState";
import { faceLandmarkDetectionOnImage, Delegate } from "react-native-mediapipe";
import { acknowledgeEmergencyAlert, getEmergencyContact, triggerEmergencyAlert, type EmergencyContact } from "../lib/emergencyNotify";
import {
  alertConfigForDrowsinessLevel,
  computeLevelFromAlertMap,
  parseAlertMap,
  shouldAlertForLevel,
} from "@snoozeguard/shared";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
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
import { ensureRemoteSession, flushEndedSessions, flushPendingTelemetry, isOnline } from "../sync/flush";
import type { Theme } from "../theme";

type AdminRuntime = {
  trigger: number;
  map: ReturnType<typeof parseAlertMap>;
  scoreResetMinutes: number;
  smsEnabled: boolean;
};

// ─── Real alert actions ───────────────────────────────────────────────────────
// voice      → TTS message, level-specific wording + repeat count
// alarm      → Android system alarm tone for 8 s (fallback: strong vibration)
// vibration  → repeating vibration pattern
// iot_led / iot_buzzer → handled server-side via IoT ingest

function getAlertVoiceMessage(level: number): string {
  if (level === 6)  return "Warning. Level 6 drowsiness detected. Please stay alert and active.";
  if (level === 7)  return "Warning, warning. Level 7 drowsiness detected. Please stay alert or pull over and rest.";
  if (level === 8)  return "High alert, high alert. Level 8 drowsiness detected. Please pull over and rest.";
  if (level === 9)  return "Critical alert, critical alert. Level 9 drowsiness detected. Please pull over and rest immediately.";
  if (level >= 10)  return "Emergency, emergency. Level 10 drowsiness detected. Please pull over immediately and rest.";
  return "Warning: drowsiness detected. Please stay alert.";
}

function getAlertVoiceRepeats(level: number): number {
  if (level === 8) return 2;
  if (level >= 9)  return 3;
  return 1;
}

function getAlertHint(level: number): string {
  if (level === 6)  return "Stay alert and active — you can continue driving.";
  if (level === 7)  return "Consider pulling over and taking a rest break.";
  if (level === 8)  return "Please pull over and rest now.";
  if (level === 9)  return "Pull over immediately. Emergency contact will be notified.";
  if (level >= 10)  return "EMERGENCY — Pull over and rest immediately!";
  return "Stay alert.";
}

// Yawn / head-event deltas above level-10 baseline that re-trigger an alert.
const LEVEL10_YAWN_RETRIGGER  = 3;
const LEVEL10_HEAD_RETRIGGER  = 10;

// soundRef tracks the currently-playing alarm so it can be cancelled on dismiss.
async function playMobileAlertActions(
  actions: string[],
  level: number,
  soundRef: { current: Audio.Sound | null },
) {
  // ── Fire voice IMMEDIATELY (non-blocking) so it starts as soon as the popup appears ──
  if (actions.includes("voice")) {
    const msg = getAlertVoiceMessage(level);
    const repeats = getAlertVoiceRepeats(level);
    for (let i = 0; i < repeats; i++) {
      Speech.speak(msg, { language: "en-US", rate: 0.9, pitch: 1.0 });
    }
  }

  // ── Vibration (non-blocking) ──
  if (actions.includes("vibration")) {
    Vibration.vibrate([0, 500, 300, 500, 300, 500, 300, 500, 300, 500], false);
  }

  // ── Alarm (async — loads system tone, tracks ref for cancellation) ──
  if (actions.includes("alarm")) {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });
      let played = false;
      for (const uri of [
        "content://settings/system/alarm_alert",
        "content://settings/system/ringtone",
      ]) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true, volume: 1.0 },
          );
          soundRef.current = sound;
          setTimeout(() => {
            void sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
            if (soundRef.current === sound) soundRef.current = null;
          }, 8000);
          played = true;
          break;
        } catch { /* try next */ }
      }
      if (!played) throw new Error("no uri worked");
    } catch {
      // Fallback: strong repeating vibration
      Vibration.vibrate([0, 800, 200, 800, 200, 800, 200, 800, 200, 800], false);
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
  onFaceResults: (bundle: MPResultsBundle) => void;
};

function FaceCamera({ modelPath, sessionActive, onFaceResults }: FaceCameraProps) {
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
    />
  );
}

// ─── DriveScreen ─────────────────────────────────────────────────────────────

export function DriveScreen() {
  const session = useSession();
  const user = session.user;
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");

  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [netLabel, setNetLabel] = useState("…");
  const [showMountModal, setShowMountModal] = useState(false);

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

  // Special alerts: head tilt + sudden brake — independent of drowsiness level
  const [specialAlertOpen, setSpecialAlertOpen] = useState(false);
  const [specialAlertTitle, setSpecialAlertTitle] = useState("");
  const [specialAlertMessage, setSpecialAlertMessage] = useState("");

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
    headTiltAccRef.current += 1;
    const tiltMsg = "Alert, alert. Head is tilted for a long period of time. Please focus on the road.";
    Speech.speak(tiltMsg, { language: "en-US", rate: 0.9 });
    Speech.speak(tiltMsg, { language: "en-US", rate: 0.9 });
    setSpecialAlertTitle("Head tilted — keep your head straight!");
    setSpecialAlertMessage("Your head has been tilted for a prolonged period. Stay focused on the road.");
    setSpecialAlertOpen(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 500, 200, 500]);
  }));

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminRef = useRef<AdminRuntime>({ trigger: 6, map: parseAlertMap(undefined), scoreResetMinutes: 2, smsEnabled: false });
  const level10BaseYawnRef = useRef<number | null>(null);
  const level10BaseHeadRef = useRef<number | null>(null);
  const scoreResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yawnAccRef = useRef(0);
  const headAccRef = useRef(0);
  const yawnLastTickRef = useRef(0);
  const headLastTickRef = useRef(0);
  const suddenBrakeRef = useRef(false);
  const brakeAlertedAtRef = useRef(0);
  const headTiltAccRef = useRef(0);
  const headTiltLastTickRef = useRef(0); // timestamp of last brake — suppresses drowsiness popup for 10s
  const lastAlertRef = useRef<{ level: number; at: number } | null>(null);
  const sessionActiveRef = useRef(false);
  const alertOpenRef = useRef(false);
  const alertLevelRef = useRef(0);          // mirrors alertLevel for use inside tick closure
  const currentSoundRef = useRef<Audio.Sound | null>(null); // tracks playing alarm for cancellation
  // Levels dismissed in the current session — prevents re-trigger at same level after dismiss.
  // Level 10 is the exception (handled via isLevel10Retrigger delta logic).
  const dismissedLevelsRef = useRef<Set<number>>(new Set());
  const lastShakeTimeRef = useRef(0);
  const SHAKE_DELTA_THRESHOLD = 0.45;
  const SHAKE_COOLDOWN = 3000;

  // Keep refs in sync with state so non-React callbacks see current values
  useEffect(() => { alertOpenRef.current = alertOpen; }, [alertOpen]);
  useEffect(() => { alertLevelRef.current = alertLevel; }, [alertLevel]);

  // Reset all drowsiness accumulators (used when score-reset timer fires after level-10 idle)
  const resetDrowsinessScore = useCallback(() => {
    if (scoreResetTimerRef.current) { clearTimeout(scoreResetTimerRef.current); scoreResetTimerRef.current = null; }
    yawnAccRef.current = 0;
    headAccRef.current = 0;
    yawnLastTickRef.current = 0;
    headLastTickRef.current = 0;
    headTiltAccRef.current = 0;
    headTiltLastTickRef.current = 0;
    level10BaseYawnRef.current = null;
    level10BaseHeadRef.current = null;
    dismissedLevelsRef.current.clear();
    setLiveYawns(0);
    setLiveHead(0);
    setLiveLevel(0);
  }, []);

  const startScoreResetTimer = useCallback(() => {
    if (scoreResetTimerRef.current) clearTimeout(scoreResetTimerRef.current);
    scoreResetTimerRef.current = setTimeout(() => {
      resetDrowsinessScore();
    }, adminRef.current.scoreResetMinutes * 60_000);
  }, [resetDrowsinessScore]);

  // Stop all alert audio immediately (Speech, Vibration, alarm sound)
  const stopAlertAudio = useCallback(() => {
    Speech.stop();
    Vibration.cancel();
    const sound = currentSoundRef.current;
    currentSoundRef.current = null;
    if (sound) void sound.stopAsync().then(() => sound.unloadAsync()).catch(() => {});
  }, []);

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
      scoreResetMinutes: Number(data.score_reset_minutes) || 2,
      smsEnabled: Boolean(data.sms_enabled),
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
    const { alertId } = await triggerEmergencyAlert(supabase, user.id, driverName, localSessionId, adminRef.current.smsEnabled);
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
      void ensureRemoteSession(supabase, user.id, id);
      sessionActiveRef.current = true;
      drivingSessionActive.current = true;
      lastAlertRef.current = null;
      yawnAccRef.current = 0;
      headAccRef.current = 0;
      yawnLastTickRef.current = 0;
      headLastTickRef.current = 0;
      headTiltAccRef.current = 0;
      headTiltLastTickRef.current = 0;
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

  const endSession = useCallback(() => {
    if (!localSessionId) return;
    // Stop all active loops immediately
    stopTick();
    sessionActiveRef.current = false;
    drivingSessionActive.current = false;
    endSessionFn.current = null;
    tiltDetectorRef.current.reset();
    stopAlertAudio();
    if (scoreResetTimerRef.current) { clearTimeout(scoreResetTimerRef.current); scoreResetTimerRef.current = null; }
    level10BaseYawnRef.current = null;
    level10BaseHeadRef.current = null;
    dismissedLevelsRef.current.clear();

    // Write ended_at synchronously — no network needed
    try {
      getDatabase().runSync(
        "UPDATE driving_sessions_local SET ended_at = ? WHERE id = ?",
        new Date().toISOString(),
        localSessionId,
      );
    } catch { /* ignore DB error */ }

    // Clear UI immediately so the button never gets stuck
    const idToSync = localSessionId;
    setLocalSessionId(null);
    setAlertOpen(false);
    setLiveLevel(0);
    sessionStartRef.current = null;
    setStatus("Session ended.");

    // Background sync — fire-and-forget so it never blocks the UI
    void (async () => {
      try {
        await flushEndedSessions(supabase, user.id);
        await flushPendingTelemetry(supabase, user.id);
      } catch { /* sync will retry next time the app is online */ }
      void idToSync; // satisfy lint — idToSync captured for future use if needed
    })();
  }, [localSessionId, stopTick, stopAlertAudio, resetDrowsinessScore, user.id]);

  // Expose endSession to App.tsx so the nav-guard alert can call it
  useEffect(() => {
    endSessionFn.current = endSession;
    return () => { endSessionFn.current = null; };
  }, [endSession]);

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
            brakeAlertedAtRef.current = now;
            const isL10 = alertLevelRef.current >= 10;
            const brakeMsg = isL10
              ? "Emergency, emergency. Level 10 drowsiness with sudden brake or shake detected. Pull over immediately."
              : "Alert, alert. Sudden brake or shake detected. Please pull over safely.";
            const brakeRepeats = isL10 ? 3 : 1;
            for (let i = 0; i < brakeRepeats; i++) {
              Speech.speak(brakeMsg, { language: "en-US", rate: 0.9 });
            }
            setSpecialAlertTitle(isL10 ? "Level 10 + Sudden brake — Pull over NOW!" : "Sudden brake detected — pull over safely.");
            setSpecialAlertMessage(isL10
              ? "Critical drowsiness combined with a sudden brake or shake was detected. Pull over immediately."
              : "A sudden brake or shake was detected. Please pull over safely and rest.");
            setSpecialAlertOpen(true);
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
      const tiltDelta = headTiltAccRef.current - headTiltLastTickRef.current;
      yawnLastTickRef.current = yawnAccRef.current;
      headLastTickRef.current = headAccRef.current;
      headTiltLastTickRef.current = headTiltAccRef.current;

      const level = computeLevelFromAlertMap(yawnAccRef.current, headAccRef.current, brake, ar.map);
      setLiveLevel(level);
      setLiveYawns(yawnAccRef.current);
      setLiveHead(headAccRef.current);
      if (sessionStartRef.current) setSessionSecs(Math.floor((Date.now() - sessionStartRef.current) / 1000));

      getDatabase().runSync(
        `INSERT INTO session_telemetry_local
         (local_session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, sudden_brake, head_tilt_delta, source, remote_synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        localSessionId, new Date().toISOString(), level, yawnDelta, headDelta, brake ? 1 : 0, tiltDelta, "mobile_mediapipe",
      );
      void flushPendingTelemetry(supabase, user.id);

      // Track when level first reaches 10 — used for incremental re-trigger logic.
      if (level >= 10 && level10BaseYawnRef.current === null) {
        level10BaseYawnRef.current = yawnAccRef.current;
        level10BaseHeadRef.current = headAccRef.current;
      }

      // Post-level-10 re-trigger: every LEVEL10_YAWN_RETRIGGER yawns or
      // LEVEL10_HEAD_RETRIGGER head events above the baseline fires a new alert.
      const l10YawnDelta = level10BaseYawnRef.current !== null
        ? yawnAccRef.current - level10BaseYawnRef.current : 0;
      const l10HeadDelta = level10BaseHeadRef.current !== null
        ? headAccRef.current - (level10BaseHeadRef.current ?? 0) : 0;
      const isLevel10Retrigger =
        level >= 10 &&
        level10BaseYawnRef.current !== null &&
        !alertOpenRef.current &&
        (l10YawnDelta >= LEVEL10_YAWN_RETRIGGER || l10HeadDelta >= LEVEL10_HEAD_RETRIGGER);

      // Suppress drowsiness popup for 10s after a sudden brake fires its own special alert
      const recentBrake = Date.now() - brakeAlertedAtRef.current < 10_000;

      // Allow a HIGHER level to interrupt a currently-showing lower-level alert.
      const isLevelEscalation = !recentBrake && level > alertLevelRef.current && alertOpenRef.current && !dismissedLevelsRef.current.has(level);
      const canAlert = (!recentBrake && shouldAlertForLevel(level, ar.trigger) && !alertOpenRef.current && !dismissedLevelsRef.current.has(level))
        || isLevelEscalation
        || isLevel10Retrigger;

      if (canAlert) {
        const band = alertConfigForDrowsinessLevel(level, ar.map);
        const actions = band?.actions ?? ["voice"];
        const label = band?.label ?? "Attention required";
        const now = Date.now();
        const prev = lastAlertRef.current;
        const bypassCooldown = isLevelEscalation || isLevel10Retrigger;
        if (bypassCooldown || !prev || now - prev.at > 35_000 || level > prev.level) {
          // Stop current audio before triggering new alert
          Speech.stop();
          Vibration.cancel();
          const oldSound = currentSoundRef.current;
          currentSoundRef.current = null;
          if (oldSound) void oldSound.stopAsync().then(() => oldSound.unloadAsync()).catch(() => {});

          // Update level-10 baseline so next retrigger delta is relative to NOW
          if (isLevel10Retrigger) {
            level10BaseYawnRef.current = yawnAccRef.current;
            level10BaseHeadRef.current = headAccRef.current;
            startScoreResetTimer(); // restart 2-min idle-reset timer
          }

          lastAlertRef.current = { level, at: now };
          alertLevelRef.current = level;
          setAlertFlash(actions.some((a: string) => a === "iot_led"));
          setAlertLevel(level);
          setAlertTitle(label);
          setAlertOpen(true);
          void supabase.from("alert_events").insert({
            user_id: user.id, driving_session_id: null,
            local_session_hint: localSessionId, drowsiness_level: level,
            trigger_level: ar.trigger, alert_label: label, source: "mobile_drive",
          });
          void playMobileAlertActions(actions, level, currentSoundRef);
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
      {/* ── Device mount confirmation modal ── */}
      <Modal visible={showMountModal} animationType="slide" transparent onRequestClose={() => setShowMountModal(false)}>
        <View style={styles.mountOverlay}>
          <View style={styles.mountSheet}>
            <Text style={styles.mountIcon}>📷</Text>
            <Text style={styles.mountTitle}>Before you start</Text>
            <Text style={styles.mountBody}>
              Make sure your device is mounted securely and the front camera is facing you directly.
              {"\n\n"}The camera must have a clear, unobstructed view of your face throughout the drive.
            </Text>
            <Pressable
              style={styles.mountConfirmBtn}
              onPress={() => {
                setShowMountModal(false);
                void startSession();
              }}
            >
              <Text style={styles.btnTextPrimary}>I'm ready — Start session</Text>
            </Pressable>
            <Pressable style={styles.mountCancelBtn} onPress={() => setShowMountModal(false)}>
              <Text style={styles.mountCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={specialAlertOpen} animationType="fade" transparent={false} onRequestClose={() => { stopAlertAudio(); setSpecialAlertOpen(false); }}>
        <View style={styles.alertRoot}>
          <View style={styles.alertBody}>
            <Text style={styles.alertKicker}>⚠ SAFETY ALERT</Text>
            <Text style={styles.alertTitle}>{specialAlertTitle}</Text>
            <Text style={[styles.alertHint, { marginTop: 12 }]}>{specialAlertMessage}</Text>
            <Pressable style={styles.alertBtn} onPress={() => { stopAlertAudio(); setSpecialAlertOpen(false); }}>
              <Text style={styles.btnTextPrimary}>Understood — dismiss</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={alertOpen} animationType="fade" transparent={false} onRequestClose={() => setAlertOpen(false)}>
        <View style={[styles.alertRoot, alertFlash && styles.alertFlash]}>
          {alertFlash ? (
            <><View style={styles.alertBarTop} /><View style={styles.alertBarBottom} /></>
          ) : null}
          <View style={styles.alertBody}>
            <Text style={styles.alertKicker}>DROWSINESS ALERT</Text>
            <Text style={styles.alertLevel}>Level {alertLevel}</Text>
            <Text style={styles.alertTitle}>{alertTitle}</Text>
            <Text style={styles.alertHint}>{getAlertHint(alertLevel)}</Text>

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
                        void Linking.openURL(`sms:${emergencyContact.contact_phone}?body=URGENT: I triggered a drowsiness alert on SnoozeGuard. Please check on me or call me immediately.`)
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
              dismissedLevelsRef.current.add(alertLevelRef.current);
              stopAlertAudio();
              stopEcTimer();
              if (alertLevelRef.current >= 10) startScoreResetTimer();
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
        {modelPath ? (
          <FaceCamera
            modelPath={modelPath}
            sessionActive={Boolean(localSessionId)}
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
                backgroundColor: liveLevel >= 8 ? t.tertiary : liveLevel >= 6 ? t.secondary : t.primary,
              }]} />
            </View>
          </>
        ) : (
          <Text style={styles.meta}>Face detection is monitoring for drowsiness signs.</Text>
        )}

        <Text style={styles.metaSmall}>Network: {netLabel}</Text>

        <View style={styles.row}>
          {!localSessionId ? (
            <Pressable
              style={[styles.btn, styles.go, !modelPath && styles.btnDisabled]}
              disabled={busy || !modelPath}
              onPress={() => setShowMountModal(true)}
            >
              {busy ? <ActivityIndicator color={t.onPrimary} /> : <Text style={styles.btnTextPrimary}>Start driving</Text>}
            </Pressable>
          ) : (
            <Pressable style={[styles.btn, styles.danger]} disabled={busy} onPress={() => void endSession()}>
              {busy ? <ActivityIndicator color={t.tertiary} /> : <Text style={styles.btnTextDanger}>End session</Text>}
            </Pressable>
          )}
        </View>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },
  preview: {
    flex: 1, borderRadius: 20, overflow: "hidden", margin: 12,
    borderWidth: 1, borderColor: `${t.outlineVariant}66`,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject, justifyContent: "center",
    alignItems: "center", backgroundColor: "rgba(11, 19, 38, 0.72)", padding: 16,
  },
  overlayText: { color: t.onSurface, textAlign: "center", fontSize: 14 },
  panel: {
    padding: 16, gap: 8, borderTopWidth: 1,
    borderTopColor: `${t.outlineVariant}33`, backgroundColor: t.surfaceContainerLow,
  },
  meta: { color: t.onSurfaceVariant, fontSize: 12, lineHeight: 18 },
  metaSmall: { color: t.onSurfaceVariant, fontSize: 11, marginTop: 4 },
  gaugeRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  gaugeBlock: { alignItems: "center", flex: 1 },
  gaugeLabel: { fontSize: 8, fontWeight: "700", color: t.onSurfaceVariant, letterSpacing: 1 },
  gaugeValue: { fontSize: 22, fontWeight: "800", color: t.onSurface, marginTop: 2 },
  gaugeUnit: { fontSize: 9, color: t.onSurfaceVariant },
  gaugeGreen: { color: "#4ade80" },
  gaugeAmber: { color: t.secondary },
  gaugeRed: { color: t.tertiary },
  barBg: { height: 6, backgroundColor: `${t.outlineVariant}44`, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  barFill: { height: 6, borderRadius: 3 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  go: { backgroundColor: t.primary, shadowColor: t.primary, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6 },
  danger: { backgroundColor: `${t.tertiary}33`, borderWidth: 1, borderColor: `${t.tertiary}88` },
  btnTextPrimary: { color: t.onPrimary, fontWeight: "800", fontSize: 16 },
  btnTextDanger: { color: t.tertiary, fontWeight: "800", fontSize: 14 },
  status: { color: t.secondary, fontSize: 12, marginTop: 8 },
  center: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: t.background },
  text: { color: t.onSurface, marginBottom: 16 },
  alertRoot: { flex: 1, backgroundColor: t.background, justifyContent: "center", padding: 24 },
  alertFlash: { backgroundColor: t.background },
  alertBarTop: { position: "absolute", top: 0, left: 0, right: 0, height: 10, backgroundColor: t.tertiary },
  alertBarBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 10, backgroundColor: t.tertiary },
  alertBody: { alignItems: "center", gap: 12 },
  alertKicker: { color: t.tertiary, fontSize: 11, fontWeight: "800", letterSpacing: 3 },
  alertLevel: { color: t.onSurface, fontSize: 42, fontWeight: "800" },
  alertTitle: { color: t.primary, fontSize: 18, textAlign: "center", fontWeight: "600", width: "100%" },
  alertHint: { color: t.onSurfaceVariant, fontSize: 13, textAlign: "center", width: "100%", lineHeight: 20, marginBottom: 4 },
  ecSection: {
    width: "100%", backgroundColor: `${t.tertiary}11`, borderRadius: 16,
    padding: 14, marginBottom: 16, borderWidth: 1, borderColor: `${t.tertiary}44`,
  },
  ecCountdown: { color: t.tertiary, fontWeight: "700", textAlign: "center", fontSize: 13, marginBottom: 10 },
  ecSent: { color: "#4ade80", fontWeight: "700", textAlign: "center", fontSize: 13, marginBottom: 10 },
  ecBtnRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  ecBtnCall: { flex: 2, backgroundColor: "#4ade8022", borderWidth: 1, borderColor: "#4ade8066", padding: 10, borderRadius: 12, alignItems: "center" },
  ecBtnSms: { flex: 1, backgroundColor: `${t.primary}22`, borderWidth: 1, borderColor: `${t.primary}66`, padding: 10, borderRadius: 12, alignItems: "center" },
  ecBtnNotify: { flex: 1, backgroundColor: `${t.tertiary}22`, borderWidth: 1, borderColor: `${t.tertiary}66`, padding: 10, borderRadius: 12, alignItems: "center" },
  ecBtnText: { color: t.onSurface, fontWeight: "700", fontSize: 12 },
  alertBtn: { backgroundColor: t.primary, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12 },

  mountOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  mountSheet: {
    backgroundColor: t.surfaceContainerLow,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, gap: 14,
    borderTopWidth: 1, borderColor: `${t.outlineVariant}44`,
  },
  mountIcon: { fontSize: 40, textAlign: "center" },
  mountTitle: { fontSize: 22, fontWeight: "800", color: t.onSurface, textAlign: "center" },
  mountBody: { fontSize: 14, color: t.onSurfaceVariant, textAlign: "center", lineHeight: 22 },
  mountConfirmBtn: {
    backgroundColor: t.primary, paddingVertical: 16, borderRadius: 16,
    alignItems: "center", marginTop: 6,
    shadowColor: t.primary, shadowOpacity: 0.28, shadowRadius: 14, elevation: 6,
  },
  mountCancelBtn: { alignItems: "center", paddingVertical: 10 },
  mountCancelText: { color: t.onSurfaceVariant, fontSize: 14, fontWeight: "600" },
});
