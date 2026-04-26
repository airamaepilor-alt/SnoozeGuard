// DrivePage.tsx — Drowsiness Detection with MediaPipe Face Landmarker
// Real-time drowsiness scoring with facial analysis, alert management, and telemetry logging

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useWebFaceLandmarker } from "../hooks/useWebFaceLandmarker";
import { supabase } from "../lib/supabase";
import { offlineDb, getOpenLocalSession } from "../lib/offline/db";
import { ensureRemoteSession, flushOutbox, flushPendingTelemetry } from "../lib/offline/sync";
import {
  alertConfigForDrowsinessLevel,
  computeLevelFromAlertMap,
  drowsinessStatusLabel,
  parseAlertMap,
  shouldAlertForLevel,
} from "@snoozeguard/shared";
import { playWebAlert, stopWebAlert } from "../lib/alerts/playWebAlert";
import { getEmergencyContact, triggerEmergencyAlert, acknowledgeEmergencyAlert, type EmergencyContact } from "../lib/emergencyNotify";
import { createYawnDetector, createHeadDetector, createTiltDetector } from "../lib/ml/faceDetectors";
import { DrowsinessAlertOverlay, IotDevicePanel } from "./DrivePage.components";

const IOT_API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ─── Helper components ─────────────────────────────────────────────────────

function AttentionBars({ count }: { count: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-3 w-1 rounded-full transition-colors ${
            i <= count ? "bg-primary" : "bg-primary/20"
          }`}
        />
      ))}
    </div>
  );
}

function MetricCard({
  label,
  icon,
  iconColor,
  children,
  sub,
}: {
  label: string;
  icon: string;
  iconColor: string;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-surface-container-low p-4 sm:p-5 lg:p-6 rounded-2xl lg:rounded-3xl flex flex-col">
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <span className="text-[9px] sm:text-[10px] font-bold text-on-surface-variant tracking-widest uppercase leading-tight">
          {label}
        </span>
        <span
          className={`material-symbols-outlined text-base sm:text-lg ${iconColor}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
      <div className="flex-1">{children}</div>
      {sub && (
        <p className="text-[9px] sm:text-[10px] text-slate-500 mt-2 sm:mt-3 leading-relaxed hidden sm:block">
          {sub}
        </p>
      )}
    </div>
  );
}

function SessionMetric({
  icon,
  iconColor,
  label,
  value,
  valueColor,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`w-11 h-11 lg:w-13 lg:h-13 rounded-2xl bg-background flex items-center justify-center shrink-0 ${iconColor}`}
      >
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <div>
        <p className="text-[9px] text-on-surface-variant font-bold tracking-widest uppercase mb-0.5">
          {label}
        </p>
        <p className={`text-lg lg:text-xl font-headline font-extrabold ${valueColor ?? "text-on-surface"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── DrivePage ────────────────────────────────────────────────────────────────

export function DrivePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [remoteSessionId, setRemoteSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // ── Live drowsiness state ──────────────────────────────────────────────
  const [liveLevel, setLiveLevel] = useState(0);
  const [liveYawns, setLiveYawns] = useState(0);
  const [liveHeads, setLiveHeads] = useState(0);
  const [liveTilts, setLiveTilts] = useState(0);
  const [liveSuddenBrakes, setLiveSuddenBrakes] = useState(0);
  const [sessionSecs, setSessionSecs] = useState(0);

  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const useManualOverride = false;
  const manualLevel = 4;

  // ── Alert state ─────────────────────────────────────────────────────────
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertLevel, setAlertLevel] = useState(0);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertActions, setAlertActions] = useState<string[]>([]);
  const [alertFlash, setAlertFlash] = useState(false);
  const [specialAlertOpen, setSpecialAlertOpen] = useState(false);
  const [specialAlertTitle, setSpecialAlertTitle] = useState("");
  const [specialAlertMessage, setSpecialAlertMessage] = useState("");
  const [ecCountdown, setEcCountdown] = useState<number | null>(null);
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact | null>(null);
  const [ecSent, setEcSent] = useState(false);

  // ── Guardian Pulse History (real-time tracking) ──────────────────────────
  const [pulseHistory, setPulseHistory] = useState<number[]>([
    60, 65, 75, 70, 85, 80, 90, 85, 100,
  ]);

  // ── Camera state ───────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [browserMlOn, setBrowserMlOn] = useState(false);
  const [mlError, setMlError] = useState<string | null>(null);

  // ── Face ML data ───────────────────────────────────────────────────────
  const [faceScore, setFaceScore] = useState<{
    pitch: number;
    yaw: number;
    jawOpen: number;
  } | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);

  // ── Refs for detector and scoring logic ───────────────────────────────
  const { start: faceMlStart, stop: faceMlStop } = useWebFaceLandmarker();
  
  const yawnDetectorRef = useRef(createYawnDetector(() => { yawnAccRef.current += 1; }));
  const headDetectorRef = useRef(createHeadDetector(() => { headAccRef.current += 1; }));
  const tiltDetectorRef = useRef(createTiltDetector(() => {
    headTiltAccRef.current += 1;
    const tiltMsg = "Alert, alert. Head is tilted for a long period of time. Please focus on the road.";
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(tiltMsg);
    utterance.rate = 0.9;
    utterance.lang = "en-US";
    window.speechSynthesis?.speak(utterance);
    window.speechSynthesis?.speak(utterance);
    setSpecialAlertTitle("Head tilted — keep your head straight!");
    setSpecialAlertMessage("Your head has been tilted for a prolonged period. Stay focused on the road.");
    setSpecialAlertOpen(true);
    if (navigator.vibrate) navigator.vibrate([0, 500, 200, 500]);
  }));

  // ── Drowsiness score accumulators (per session) ─────────────────────────
  const yawnAccRef = useRef(0);
  const headAccRef = useRef(0);
  const headTiltAccRef = useRef(0);
  const yawnLastTickRef = useRef(0);
  const headLastTickRef = useRef(0);
  const headTiltLastTickRef = useRef(0);
  const suddenBrakeAccRef = useRef(0);
  const suddenBrakeLastTickRef = useRef(0);

  // ── Level 10 retrigger baseline ────────────────────────────────────────
  const level10BaseYawnRef = useRef<number | null>(null);
  const level10BaseHeadRef = useRef<number | null>(null);
  const scoreResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Alert throttling and state ──────────────────────────────────────────
  const lastAlertRef = useRef<{ level: number; at: number } | null>(null);
  const dismissedLevelsRef = useRef<Set<number>>(new Set());
  const alertOpenRef = useRef(false);
  const alertLevelRef = useRef(0);
  const sessionActiveRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Emergency contact ───────────────────────────────────────────────────
  const ecTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ecAutoFiredRef = useRef(false);
  const activeAlertIdRef = useRef<string | null>(null);

  // ── IoT device ──────────────────────────────────────────────────────────────
  const iotDeviceIdRef = useRef<string | null>(null);
  const iotAlertIdRef = useRef<string | null>(null);

  // ── Admin runtime (alert config) ────────────────────────────────────────
  const adminRef = useRef({
    trigger: 6,
    map: parseAlertMap(undefined),
    scoreResetMinutes: 2,
    smsEnabled: false,
  });

  useEffect(() => {
    alertOpenRef.current = alertOpen;
  }, [alertOpen]);
  useEffect(() => {
    alertLevelRef.current = alertLevel;
  }, [alertLevel]);

  const resetDrowsinessScore = useCallback(() => {
    if (scoreResetTimerRef.current) { clearTimeout(scoreResetTimerRef.current); scoreResetTimerRef.current = null; }
    yawnAccRef.current = 0;
    headAccRef.current = 0;
    yawnLastTickRef.current = 0;
    headLastTickRef.current = 0;
    headTiltAccRef.current = 0;
    headTiltLastTickRef.current = 0;
    suddenBrakeAccRef.current = 0;
    suddenBrakeLastTickRef.current = 0;
    level10BaseYawnRef.current = null;
    level10BaseHeadRef.current = null;
    dismissedLevelsRef.current.clear();
    setLiveYawns(0);
    setLiveHeads(0);
    setLiveTilts(0);
    setLiveSuddenBrakes(0);
    setLiveLevel(0);
  }, []);

  const startScoreResetTimer = useCallback(() => {
    if (scoreResetTimerRef.current) clearTimeout(scoreResetTimerRef.current);
    scoreResetTimerRef.current = setTimeout(() => {
      resetDrowsinessScore();
    }, adminRef.current.scoreResetMinutes * 60_000);
  }, [resetDrowsinessScore]);

  const stopAlertAudio = useCallback(() => {
    stopWebAlert();
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

  const stopEcTimer = useCallback(() => {
    if (ecTimerRef.current) clearInterval(ecTimerRef.current);
    ecTimerRef.current = null;
    setEcCountdown(null);
  }, []);

  const fireEmergencyContact = useCallback(async () => {
    stopEcTimer();
    if (!user) return;
    const driverName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Driver";
    const { alertId } = await triggerEmergencyAlert(supabase, user.id, driverName, localSessionId, adminRef.current.smsEnabled);
    activeAlertIdRef.current = alertId;
    setEcSent(true);
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

  // ── Timers ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!localSessionId || sessionStartedAt == null) return;
    const id = window.setInterval(() => setElapsedMs(Date.now() - sessionStartedAt), 1000);
    return () => window.clearInterval(id);
  }, [localSessionId, sessionStartedAt]);

  // ── Guardian Pulse History: Update with real-time drowsiness level ────────
  useEffect(() => {
    if (!localSessionId) {
      setPulseHistory([60, 65, 75, 70, 85, 80, 90, 85, 100]);
      return;
    }
    const pulseUpdateInterval = setInterval(() => {
      setPulseHistory((prev) => {
        const scaled = Math.max(0, Math.min(100, (liveLevel / 10) * 100));
        return [...prev.slice(1), scaled];
      });
    }, 2000);
    return () => clearInterval(pulseUpdateInterval);
  }, [localSessionId, liveLevel]);

  // ── Session resume / sync ────────────────────────────────────────────────

  const refreshRemoteHint = useCallback(async () => {
    if (!localSessionId) {
      setRemoteSessionId(null);
      return;
    }
    const row = await offlineDb.drivingSessionsLocal.get(localSessionId);
    setRemoteSessionId(row?.remoteId ?? null);
  }, [localSessionId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const open = await getOpenLocalSession(user.id);
      if (!cancelled && open) {
        setLocalSessionId(open.id);
        setRemoteSessionId(open.remoteId ?? null);
        return;
      }
      const { data } = await supabase
        .from("driving_sessions")
        .select("id")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.id) {
        setLocalSessionId(null);
        setRemoteSessionId(data.id);
        setNote(
          "Active Supabase session found (no local row). End it from History or Supabase if stuck.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    void refreshRemoteHint();
  }, [localSessionId, refreshRemoteHint]);

  useEffect(() => {
    if (!user || !online) return;
    void flushOutbox(supabase, user.id).then(() => void refreshRemoteHint());
  }, [user, online, refreshRemoteHint]);

  useEffect(() => {
    void loadAdminConfig();
  }, [loadAdminConfig]);

  useEffect(() => {
    if (!user) return;
    void getEmergencyContact(supabase, user.id).then(setEmergencyContact);
  }, [user]);

  useEffect(() => {
    if (online) {
      void flushPendingTelemetry(supabase, user?.id ?? "");
      void loadAdminConfig();
    }
  }, [online, user?.id, loadAdminConfig]);

  // ── Camera ──────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    faceMlStop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setBrowserMlOn(false);
    setCameraOn(false);
    setFaceDetected(false);
    setFaceScore(null);
  }, [faceMlStop]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!window.isSecureContext) {
      setCameraError("Camera requires HTTPS. Open this page via https:// or localhost.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera API unavailable — try Chrome or Firefox over HTTPS.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not open camera";
      setCameraError(msg.includes("Permission") || msg.includes("permission")
        ? "Camera permission denied — allow camera access in your browser settings."
        : msg);
      setCameraOn(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ── Sudden brake detection via DeviceMotion (mobile web) ─────────────────
  useEffect(() => {
    let lastMag = 0;
    let lastTriggerAt = 0;
    const handler = (e: DeviceMotionEvent) => {
      if (!sessionActiveRef.current) return;
      const g = e.accelerationIncludingGravity;
      if (!g) return;
      const mag = Math.sqrt((g.x ?? 0) ** 2 + (g.y ?? 0) ** 2 + (g.z ?? 0) ** 2);
      const delta = Math.abs(mag - lastMag);
      if (lastMag > 0 && delta > 20) {
        const now = Date.now();
        if (now - lastTriggerAt > 3000) {
          lastTriggerAt = now;
          suddenBrakeAccRef.current += 1;
          setSpecialAlertTitle("Sudden Impact Detected!");
          setSpecialAlertMessage("A sudden brake or impact was detected. Pull over safely if needed and check your surroundings.");
          setSpecialAlertOpen(true);
          window.speechSynthesis?.cancel();
          const u = new SpeechSynthesisUtterance("Warning! Sudden impact detected. Please check your surroundings.");
          u.rate = 0.9;
          u.lang = "en-US";
          window.speechSynthesis?.speak(u);
          if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
        }
      }
      lastMag = mag;
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, []);

  // ── Session start / stop ────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setNote(null);
    try {
      await loadAdminConfig();
      const id = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      await offlineDb.drivingSessionsLocal.add({
        id,
        userId: user.id,
        startedAt,
        deviceType: "web",
        endedSynced: 0,
      });
      setLocalSessionId(id);
      setRemoteSessionId(null);
      lastAlertRef.current = null;
      yawnAccRef.current = 0;
      headAccRef.current = 0;
      yawnLastTickRef.current = 0;
      headLastTickRef.current = 0;
      headTiltAccRef.current = 0;
      headTiltLastTickRef.current = 0;
      suddenBrakeAccRef.current = 0;
      suddenBrakeLastTickRef.current = 0;
      level10BaseYawnRef.current = null;
      level10BaseHeadRef.current = null;
      dismissedLevelsRef.current.clear();
      const t0 = Date.now();
      sessionStartRef.current = t0;
      setSessionStartedAt(t0);
      setElapsedMs(0);
      setLiveLevel(0);
      setLiveYawns(0);
      setLiveHeads(0);
      setLiveTilts(0);
      setLiveSuddenBrakes(0);
      setSessionSecs(0);
      setPulseHistory([60, 65, 75, 70, 85, 80, 90, 85, 100]);
      setNote("Session started. MediaPipe face detection active.");
      sessionActiveRef.current = true;
      tiltDetectorRef.current.reset();
      await ensureRemoteSession(supabase, user.id, id);
      if (online) await flushPendingTelemetry(supabase, user.id);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed to start session");
    } finally {
      setBusy(false);
    }
  }, [user, online, loadAdminConfig]);

  const sessionStartRef = useRef<number | null>(null);

  const endSession = useCallback(() => {
    if (!localSessionId) return;
    // Stop all active loops immediately
    stopTick();
    sessionActiveRef.current = false;
    tiltDetectorRef.current.reset();
    stopAlertAudio();
    if (scoreResetTimerRef.current) { clearTimeout(scoreResetTimerRef.current); scoreResetTimerRef.current = null; }
    level10BaseYawnRef.current = null;
    level10BaseHeadRef.current = null;
    dismissedLevelsRef.current.clear();

    // Write ended_at synchronously — no network needed
    try {
      void offlineDb.drivingSessionsLocal.update(localSessionId, {
        endedAt: new Date().toISOString(),
      });
    } catch { /* ignore DB error */ }

    // Clear UI immediately
    const idToSync = localSessionId;
    setLocalSessionId(null);
    setAlertOpen(false);
    setLiveLevel(0);
    sessionStartRef.current = null;
    setSessionStartedAt(null);
    setElapsedMs(0);
    setNote("Session ended.");
    iotAlertIdRef.current = null;

    // Background sync — fire-and-forget
    void (async () => {
      try {
        if (user) {
          await flushOutbox(supabase, user.id);
          await flushPendingTelemetry(supabase, user.id);
        }
      } catch { /* sync will retry next time the app is online */ }
      void idToSync; // satisfy lint
    })();
  }, [localSessionId, stopTick, stopAlertAudio, user]);

  // ── Face ML + detectors ─────────────────────────────────────────────────

  useEffect(() => {
    if (!browserMlOn || !cameraOn) {
      faceMlStop();
      setMlError(null);
      setFaceDetected(false);
      setFaceScore(null);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setMlError(null);
    void faceMlStart(video, (scores) => {
        if (cancelled || !sessionActiveRef.current || alertOpenRef.current) return;
        setFaceDetected(scores.faceDetected);
        if (!scores.faceDetected) {
          setFaceScore(null);
          yawnDetectorRef.current.process(0);
          headDetectorRef.current.process(0, 0);
          tiltDetectorRef.current.process(0, 0);
          return;
        }
        setFaceScore({
          pitch: scores.pitchDeg,
          yaw: scores.yawDeg,
          jawOpen: scores.jawOpen,
        });

        yawnDetectorRef.current.process(scores.jawOpen);
        // Suppress head/tilt while jaw is wide open — yawning naturally tilts the head
        if (scores.jawOpen < 0.6) {
          headDetectorRef.current.process(scores.pitchDeg, scores.rollDeg);
          tiltDetectorRef.current.process(scores.pitchDeg, scores.rollDeg);
        }
      })
      .then((err) => {
        if (!cancelled && err) setMlError(err);
      });

    return () => {
      cancelled = true;
      faceMlStop();
    };
  }, [browserMlOn, cameraOn, faceMlStart, faceMlStop]);

  // ── Main scoring tick (1-second interval) ───────────────────────────────

  useEffect(() => {
    if (!localSessionId) {
      stopTick();
      return;
    }

    tickRef.current = setInterval(() => {
      const ar = adminRef.current;

      const yawnDelta = yawnAccRef.current - yawnLastTickRef.current;
      const headDelta = headAccRef.current - headLastTickRef.current;
      const suddenBrakeDelta = suddenBrakeAccRef.current > suddenBrakeLastTickRef.current;
      yawnLastTickRef.current = yawnAccRef.current;
      headLastTickRef.current = headAccRef.current;
      headTiltLastTickRef.current = headTiltAccRef.current;
      suddenBrakeLastTickRef.current = suddenBrakeAccRef.current;

      let level = 0;
      if (useManualOverride) {
        level = manualLevel;
      } else {
        level = computeLevelFromAlertMap(yawnAccRef.current, headAccRef.current, false, ar.map);
      }

      setLiveLevel(level);
      setLiveYawns(yawnAccRef.current);
      setLiveHeads(headAccRef.current);
      setLiveTilts(headTiltAccRef.current);
      setLiveSuddenBrakes(suddenBrakeAccRef.current);
      if (sessionStartRef.current) setSessionSecs(Math.floor((Date.now() - sessionStartRef.current) / 1000));

      void (async () => {
        if (!localSessionId || !user) return;
        try {
          await offlineDb.sessionTelemetryLocal.add({
            localSessionId,
            recordedAt: new Date().toISOString(),
            drowsinessLevel: level,
            yawnCountDelta: yawnDelta,
            headEventCountDelta: headDelta,
            suddenBrake: suddenBrakeDelta ? 1 : 0,
            source: browserMlOn ? "web_mediapipe_face" : "web_manual",
            remoteSynced: 0,
          });
          if (online) await flushPendingTelemetry(supabase, user.id);
        } catch { /* ignore */ }
      })();

      if (level >= 10 && level10BaseYawnRef.current === null) {
        level10BaseYawnRef.current = yawnAccRef.current;
        level10BaseHeadRef.current = headAccRef.current;
      }

      const LEVEL10_YAWN_RETRIGGER = 3;
      const LEVEL10_HEAD_RETRIGGER = 10;
      const l10YawnDelta = level10BaseYawnRef.current !== null
        ? yawnAccRef.current - level10BaseYawnRef.current : 0;
      const l10HeadDelta = level10BaseHeadRef.current !== null
        ? headAccRef.current - (level10BaseHeadRef.current ?? 0) : 0;
      const isLevel10Retrigger =
        level >= 10 &&
        level10BaseYawnRef.current !== null &&
        !alertOpenRef.current &&
        (l10YawnDelta >= LEVEL10_YAWN_RETRIGGER || l10HeadDelta >= LEVEL10_HEAD_RETRIGGER);

      // Higher level interrupts a currently-showing lower-level alert (matches mobile)
      const isLevelEscalation = level > alertLevelRef.current && alertOpenRef.current && !dismissedLevelsRef.current.has(level);
      const canAlert = (!alertOpenRef.current && shouldAlertForLevel(level, ar.trigger) && !dismissedLevelsRef.current.has(level))
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
          stopAlertAudio();

          if (isLevel10Retrigger) {
            level10BaseYawnRef.current = yawnAccRef.current;
            level10BaseHeadRef.current = headAccRef.current;
            startScoreResetTimer();
          }

          lastAlertRef.current = { level, at: now };
          alertLevelRef.current = level;
          setAlertFlash(actions.some((a: string) => a === "iot_led"));
          setAlertLevel(level);
          setAlertTitle(label);
          setAlertActions(actions);
          setAlertOpen(true);

          if (user) {
            void supabase.from("alert_events").insert({
              user_id: user.id,
              driving_session_id: remoteSessionId,
              local_session_hint: localSessionId,
              drowsiness_level: level,
              trigger_level: ar.trigger,
              alert_label: label,
              source: "web_drive",
            });
          }
          void playWebAlert(actions, level);

          // Signal IoT buzzer + LED for level 9/10
          if (user && iotDeviceIdRef.current && actions.some((a: string) => a === "iot_buzzer")) {
            void supabase
              .from("iot_alerts")
              .insert({ device_id: iotDeviceIdRef.current, user_id: user.id, drowsiness_level: level })
              .select("id")
              .single()
              .then(({ data }) => {
                if (!data?.id) return;
                iotAlertIdRef.current = data.id;
                if (IOT_API_URL) {
                  void supabase.auth.getSession().then(({ data: { session } }) => {
                    if (!session) return;
                    void fetch(`${IOT_API_URL}/v1/iot/buzz`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({
                        device_id: iotDeviceIdRef.current,
                        alert_id: data.id,
                        level,
                      }),
                    });
                  });
                }
              });
          }
        }
      }
    }, 1000);

    return () => {
      stopTick();
    };
  }, [localSessionId, user, online, browserMlOn, remoteSessionId, stopTick, startScoreResetTimer, stopAlertAudio]);

  const dismissAlert = useCallback(() => {
    dismissedLevelsRef.current.add(alertLevelRef.current);
    stopAlertAudio();
    stopEcTimer();
    if (alertLevelRef.current >= 10) startScoreResetTimer();
    if (activeAlertIdRef.current) {
      void acknowledgeEmergencyAlert(supabase, activeAlertIdRef.current);
      activeAlertIdRef.current = null;
    }
    setEcSent(false);
    if (iotAlertIdRef.current && iotDeviceIdRef.current) {
      const id = iotAlertIdRef.current;
      const dev = iotDeviceIdRef.current;
      iotAlertIdRef.current = null;
      void supabase.from("iot_alerts").update({
        status: "dismissed", dismissed_by: "driver", dismissed_at: new Date().toISOString(),
      }).eq("id", id);
      if (IOT_API_URL) {
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return;
          void fetch(`${IOT_API_URL}/v1/iot/dismiss`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ device_id: dev, alert_id: id }),
          });
        });
      }
    }
    setAlertOpen(false);
  }, [stopAlertAudio, stopEcTimer, startScoreResetTimer]);

  // ── IoT Realtime: auto-dismiss when physical button pressed ─────────────
  useEffect(() => {
    if (!localSessionId || !user) return;
    const ch = supabase
      .channel(`iot-alerts-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "iot_alerts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { id: string; status: string; dismissed_by: string };
          if (
            row.status === "dismissed" &&
            row.dismissed_by === "iot_button" &&
            row.id === iotAlertIdRef.current
          ) {
            dismissAlert();
            iotAlertIdRef.current = null;
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [localSessionId, user?.id, dismissAlert]);

  // ── Computed state ──────────────────────────────────────────────────────

  const activeLocal = Boolean(localSessionId);
  const status = drowsinessStatusLabel(liveLevel);
  const gaugePct = Math.min(100, Math.max(0, (liveLevel / 10) * 100));
  const alertnessScore = Math.round((1 - liveLevel / 10) * 100);
  const attentionBars = Math.round((alertnessScore / 100) * 5);

  const guardianPulse =
    liveLevel <= 2
      ? "VIGILANT"
      : liveLevel <= 5
        ? "MODERATE"
        : liveLevel <= 7
          ? "DROWSY"
          : "CRITICAL";

  const guardianColor =
    liveLevel <= 2
      ? "text-primary"
      : liveLevel <= 5
        ? "text-secondary"
        : "text-tertiary";

  const fatigueLabel =
    liveLevel <= 3 ? "Safe Range" : liveLevel <= 6 ? "Caution Zone" : "Danger Zone";

  const fatigueLabelColor =
    liveLevel <= 3 ? "text-primary" : liveLevel <= 6 ? "text-secondary" : "text-tertiary";

  const headPosition =
    browserMlOn && faceDetected && faceScore
      ? Math.abs(faceScore.pitch) < 10 && Math.abs(faceScore.yaw) < 10
        ? "STABLE"
        : "DRIFT"
      : browserMlOn && !faceDetected
        ? "NO FACE"
        : "STABLE";

  const headPositionColor =
    headPosition === "STABLE" ? "text-on-surface" : headPosition === "DRIFT" ? "text-secondary" : "text-slate-500";

  const perclosVal =
    faceDetected && faceScore != null ? faceScore.jawOpen.toFixed(2) : "0.04";

  const minutesDriven = Math.floor(elapsedMs / 60000);
  const breakInMins = Math.max(0, 120 - minutesDriven);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto lg:overflow-hidden lg:flex-row bg-background text-on-surface font-body">
      {/* Mobile back button — visible only when nav bars are hidden */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-3 left-3 z-50 lg:hidden bg-surface-container-low/90 backdrop-blur-sm border border-outline-variant/20 rounded-full p-2 shadow-lg active:scale-90 transition-transform"
        aria-label="Go back"
      >
        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>arrow_back</span>
      </button>

      {/* Alert overlay */}
      <DrowsinessAlertOverlay
        open={alertOpen}
        level={alertLevel}
        title={alertTitle}
        actionsSummary={alertActions.join(", ")}
        onDismiss={dismissAlert}
        flash={alertFlash}
        elapsedMs={elapsedMs}
        emergencyContact={emergencyContact}
        ecCountdown={ecCountdown}
        ecSent={ecSent}
        onNotifyNow={() => void fireEmergencyContact()}
      />

      {/* Special tilt alert */}
      {specialAlertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-container-low rounded-3xl p-8 max-w-md text-center">
            <h3 className="text-2xl font-bold text-tertiary mb-2">{specialAlertTitle}</h3>
            <p className="text-on-surface-variant mb-6">{specialAlertMessage}</p>
            <button
              onClick={() => setSpecialAlertOpen(false)}
              className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* EC countdown display */}
      {ecCountdown !== null && (
        <div className="fixed bottom-6 right-6 z-40 bg-tertiary/10 border border-tertiary/50 rounded-full px-6 py-4">
          <p className="text-sm font-bold text-tertiary">Emergency Contact in {ecCountdown}s</p>
        </div>
      )}

      {/* Left: Camera + Metrics */}
      <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        {/* Camera view */}
        <div
          className="relative h-[45vh] sm:h-[50vh] lg:flex-1 lg:min-h-0 bg-surface-container-lowest overflow-hidden"
        >
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
          />

          {!cameraOn && (
            <div className="absolute inset-0 bg-surface-container-lowest flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant text-3xl sm:text-4xl">
                  videocam_off
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface-variant">Camera offline</p>
                <p className="text-xs text-slate-600 mt-1 max-w-[180px] mx-auto">
                  Enable camera to start face monitoring
                </p>
              </div>
            </div>
          )}

          {cameraOn && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Eye tracking ellipse */}
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 sm:w-48 h-16 sm:h-24 border-2 border-primary/40 rounded-[100%] flex items-center justify-between px-5 sm:px-8">
                <div className="w-4 h-4 sm:w-6 sm:h-6 border border-primary animate-pulse rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-primary rounded-full" />
                </div>
                <div className="w-4 h-4 sm:w-6 sm:h-6 border border-primary animate-pulse rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-primary rounded-full" />
                </div>
              </div>

              {/* Top-left HUD */}
              <div className="absolute top-3 left-3 sm:top-5 sm:left-5 flex flex-col gap-2">
                <div className="sg-glass-panel px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-primary/20 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-ping shrink-0" />
                  <span className="text-[8px] sm:text-[10px] font-bold tracking-[0.2em] text-primary uppercase whitespace-nowrap">
                    IR Camera: Active
                  </span>
                </div>
                <div className="sg-glass-panel px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-white/10">
                  <span className="text-[8px] sm:text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">
                    Attention Level
                  </span>
                  <AttentionBars count={attentionBars} />
                </div>
              </div>

              {/* Bottom HUD */}
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-5 sm:left-5 sm:right-5 flex justify-between items-end gap-3">
                {/* Facial geometry */}
                <div className="sg-glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10 min-w-0">
                  <p className="text-[8px] sm:text-[10px] text-on-surface-variant font-medium mb-1.5 uppercase tracking-widest">
                    Facial Geometry
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <p className="text-[7px] sm:text-[9px] text-slate-500 uppercase">Pitch</p>
                      <p className="font-headline font-bold text-sm sm:text-lg text-primary leading-tight">
                        {faceScore
                          ? `${faceScore.pitch >= 0 ? "+" : ""}${faceScore.pitch.toFixed(1)}°`
                          : "+0.0°"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[7px] sm:text-[9px] text-slate-500 uppercase">Yaw</p>
                      <p className="font-headline font-bold text-sm sm:text-lg text-primary leading-tight">
                        {faceScore
                          ? `${faceScore.yaw >= 0 ? "+" : ""}${faceScore.yaw.toFixed(1)}°`
                          : "+0.0°"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Guardian Pulse status */}
                <div className="text-right flex flex-col items-end gap-2 sm:gap-3 shrink-0">
                  <div>
                    <p className="text-[7px] sm:text-[10px] text-on-surface-variant font-black tracking-widest uppercase mb-0.5">
                      Guardian Pulse
                    </p>
                    <h2
                      className={`text-xl sm:text-4xl font-headline font-extrabold leading-none ${guardianColor}`}
                    >
                      {guardianPulse}
                    </h2>
                  </div>
                  {/* Pulse wave bars */}
                  <div className="flex gap-0.5 sm:gap-1 items-end h-8 sm:h-12">
                    {pulseHistory.map((v, i) => (
                      <div
                        key={i}
                        className="w-1 bg-primary/20 rounded-full flex flex-col justify-end overflow-hidden"
                        style={{ height: "100%" }}
                      >
                        <div
                          className={`w-full rounded-full transition-all duration-500 ${
                            i === pulseHistory.length - 1
                              ? "bg-primary shadow-[0_0_10px_rgba(123,208,255,0.5)]"
                              : "bg-primary/70"
                          }`}
                          style={{ height: `${v}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Drowsiness gauge strip */}
          {activeLocal && (
            <div className="absolute top-0 left-0 right-0 h-1">
              <div
                className={`h-full transition-all duration-500 ${
                  status.band === "high"
                    ? "bg-gradient-to-r from-secondary to-tertiary shadow-[0_0_8px_rgba(255,185,95,0.5)]"
                    : "bg-gradient-to-r from-primary to-on-primary-container"
                }`}
                style={{ width: `${gaugePct}%` }}
              />
            </div>
          )}

          {/* Camera errors */}
          {(cameraError || mlError) && (
            <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1">
              {cameraError && (
                <p className="text-center text-[10px] text-secondary bg-black/70 rounded px-2 py-1">
                  {cameraError}
                </p>
              )}
              {mlError && (
                <p className="text-center text-[10px] text-tertiary bg-black/70 rounded px-2 py-1">
                  ML: {mlError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Metric cards row */}
        <div className="shrink-0 grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 p-3 sm:p-4 lg:p-6 bg-background">
          {/* Alertness Score */}
          <MetricCard
            label="Alertness Score"
            icon="bolt"
            iconColor="text-primary"
            sub={activeLocal ? `Session active · Level ${liveLevel}` : "Start a session to monitor."}
          >
            <div className="flex items-baseline gap-1 mb-2 sm:mb-3">
              <span className="text-2xl sm:text-4xl lg:text-5xl font-headline font-extrabold text-on-surface">
                {alertnessScore}
              </span>
              <span className="text-primary font-bold text-xs sm:text-sm">/100</span>
            </div>
            <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-on-primary-container transition-all duration-500"
                style={{ width: `${alertnessScore}%` }}
              />
            </div>
          </MetricCard>

          {/* Eye Closure (PERCLOS) */}
          <MetricCard
            label="Yawn Openness (PERCLOS)"
            icon="visibility"
            iconColor="text-secondary"
            sub={faceDetected ? "ML face tracking active." : "Enable Face ML for data."}
          >
            <div className="flex items-baseline gap-1 mb-2 sm:mb-3">
              <span className="text-2xl sm:text-4xl lg:text-5xl font-headline font-extrabold text-on-surface">
                {perclosVal}
              </span>
              <span className="text-secondary font-bold text-xs sm:text-sm">Hz</span>
            </div>
            <div className="flex items-end gap-0.5 h-1">
              {[10, 20, 40, 60, 100].map((op, i) => (
                <div
                  key={i}
                  className="flex-1 h-full rounded-full bg-secondary"
                  style={{ opacity: op / 100 }}
                />
              ))}
            </div>
          </MetricCard>

          {/* Head Position */}
          <MetricCard
            label="Head Position"
            icon="accessibility_new"
            iconColor="text-tertiary"
            sub={
              faceScore
                ? `P: ${faceScore.pitch.toFixed(1)}°  Y: ${faceScore.yaw.toFixed(1)}°`
                : "Direct center-line gaze."
            }
          >
            <div className="flex items-baseline gap-1 mb-2 sm:mb-3">
              <span
                className={`text-base sm:text-2xl lg:text-3xl font-headline font-extrabold leading-tight ${headPositionColor}`}
              >
                {headPosition}
              </span>
            </div>
            <div className="flex gap-1.5 items-center">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  headPosition === "STABLE" ? "bg-primary" : "bg-secondary"
                }`}
              />
              <div className="flex-1 h-px bg-outline-variant/20" />
            </div>
          </MetricCard>
        </div>

        {/* Event counters — always visible below camera on mobile */}
        <div className="shrink-0 grid grid-cols-4 gap-1.5 px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6 bg-background">
          {[
            { label: "Yawns", count: liveYawns, color: "text-secondary", ring: "border-secondary/25", active: "bg-secondary/10" },
            { label: "Head Moves", count: liveHeads, color: "text-primary", ring: "border-primary/25", active: "bg-primary/10" },
            { label: "Long Tilts", count: liveTilts, color: "text-tertiary", ring: "border-tertiary/25", active: "bg-tertiary/10" },
            { label: "Brakes", count: liveSuddenBrakes, color: "text-on-surface-variant", ring: "border-outline-variant/20", active: "bg-surface-container-highest" },
          ].map(({ label, count, color, ring, active }) => (
            <div key={label} className={`border ${ring} ${count > 0 ? active : "bg-surface-container-lowest"} rounded-xl p-2 flex flex-col items-center gap-1 transition-colors`}>
              <span className={`text-2xl font-headline font-extrabold leading-none ${count > 0 ? color : "text-on-surface-variant/25"}`}>{count}</span>
              <p className="text-[7px] font-bold uppercase tracking-wide text-on-surface-variant text-center leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Session panel */}
      <div className="lg:w-96 xl:w-[420px] lg:shrink-0 flex flex-col lg:overflow-y-auto bg-surface-container-low border-t lg:border-t-0 lg:border-l border-outline-variant/10 pb-4 lg:pb-6">

        {/* Header: camera + session controls */}
        <div className="p-5 sm:p-6 lg:p-8 shrink-0 border-b border-outline-variant/5">
          <h3 className="font-headline font-bold text-xl mb-4 text-on-surface">Active Session</h3>

          {/* Camera + ML toggles */}
          <div className="flex gap-2 mb-3">
            {!cameraOn ? (
              <button
                onClick={() => void startCamera()}
                className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">videocam</span>
                Enable Camera
              </button>
            ) : (
              <button
                onClick={() => stopCamera()}
                className="flex-1 py-2 bg-surface-container-high text-on-surface-variant rounded-xl text-xs font-bold border border-outline-variant/10 hover:bg-surface-bright transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">videocam_off</span>
                Stop Camera
              </button>
            )}
            <label
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95 ${
                browserMlOn
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-surface-container-high text-on-surface-variant border-outline-variant/10"
              } ${!cameraOn ? "opacity-40 pointer-events-none" : ""}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={browserMlOn}
                disabled={!cameraOn}
                onChange={(e) => setBrowserMlOn(e.target.checked)}
              />
              <span className="material-symbols-outlined text-sm">psychology</span>
              Face ML
            </label>
          </div>

          {/* IoT device pairing */}
          <div className="mb-3">
            <IotDevicePanel
              userId={user?.id}
              onDeviceBound={(id) => { iotDeviceIdRef.current = id; }}
            />
          </div>

          {/* Start / Stop */}
          {!activeLocal ? (
            <button
              disabled={busy}
              onClick={() => void startSession()}
              className="w-full py-3.5 bg-gradient-to-br from-primary to-on-primary-container text-on-primary rounded-xl font-headline font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                play_circle
              </span>
              Start Monitoring Session
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => endSession()}
              className="w-full py-3 bg-error-container/20 text-error rounded-xl font-bold text-xs active:scale-95 transition-all disabled:opacity-40 border border-error/20 hover:bg-error-container/30 flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">stop_circle</span>
              End Session
            </button>
          )}

          {note && (
            <p className="mt-3 text-xs text-secondary leading-relaxed">{note}</p>
          )}
        </div>

        {/* Session metrics */}
        <div className="p-5 sm:p-6 lg:p-8 space-y-5 lg:space-y-6 shrink-0">
          <SessionMetric
            icon="timer"
            iconColor="text-primary"
            label="Session Duration"
            value={sessionSecs > 0 ? `${sessionSecs}s` : "—"}
          />
          <SessionMetric
            icon="coffee"
            iconColor="text-secondary"
            label="Fatigue Level"
            value={fatigueLabel}
            valueColor={fatigueLabelColor}
          />
          <SessionMetric
            icon="warning"
            iconColor="text-tertiary"
            label="Events Detected"
            value={liveYawns + liveHeads + liveTilts + liveSuddenBrakes > 0
              ? `${liveYawns}Y · ${liveHeads}H · ${liveTilts}T · ${liveSuddenBrakes}B`
              : "0 Events"}
          />
        </div>

        {/* Break recommendation */}
        <div className="px-5 sm:px-6 lg:px-8 pb-4 shrink-0">
          <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-sm">info</span>
              <span className="text-[9px] font-bold text-primary uppercase tracking-widest">
                Next Break Recommendation
              </span>
            </div>
            <p className="text-sm text-on-surface font-medium mb-1">
              {activeLocal && elapsedMs > 0
                ? breakInMins > 0
                  ? `In approx. ${breakInMins} minutes`
                  : "Break overdue — please pull over safely."
                : "Start a session to track rest intervals."}
            </p>
            <p className="text-xs text-on-surface-variant">
              Recommended: take a break every 2 hours of driving.
            </p>
          </div>
        </div>

        {/* Guardian Pulse History chart */}
        <div className="px-5 sm:px-6 lg:px-8 pb-4 shrink-0">
          <div className="bg-background rounded-2xl lg:rounded-3xl p-5 lg:p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase">
                  Guardian Pulse History
                </h4>
                <span className="text-[10px] text-primary bg-primary/10 px-2 py-1 rounded font-bold">
                  LIVE
                </span>
              </div>
              <div className="flex items-end gap-1 h-20 sm:h-28 mb-3">
                {pulseHistory.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/15 rounded-t-sm flex flex-col justify-end overflow-hidden"
                    style={{ height: "100%" }}
                  >
                    <div
                      className={`w-full rounded-t-sm transition-all duration-500 ${
                        i === pulseHistory.length - 1
                          ? "bg-primary shadow-[0_0_15px_rgba(123,208,255,0.4)]"
                          : "bg-primary/60"
                      }`}
                      style={{ height: `${v}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 font-medium">
                <span>−{pulseHistory.length - 1} READINGS</span>
                <span>CURRENT</span>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}
