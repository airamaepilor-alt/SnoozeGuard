import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  alertConfigForDrowsinessLevel,
  computeDrowsinessLevelFromSignals,
  drowsinessStatusLabel,
  shouldAlertForLevel,
} from "@snoozeguard/shared";
import { DrowsinessAlertOverlay } from "../components/DrowsinessAlertOverlay";
import { useAuth } from "../context/AuthContext";
import { useAdminConfig } from "../hooks/useAdminConfig";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useWebFaceLandmarker } from "../hooks/useWebFaceLandmarker";
import { playWebAlert } from "../lib/alerts/playWebAlert";
import { supabase } from "../lib/supabase";
import { getOpenLocalSession, offlineDb } from "../lib/offline/db";
import { ensureRemoteSession, flushOutbox, flushPendingTelemetry } from "../lib/offline/sync";

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

// ─── Attention bars ────────────────────────────────────────────────────────────

function AttentionBars({ count }: { count: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-4 h-1 rounded-full transition-all duration-300 ${
            i <= count ? "bg-primary" : "bg-primary/20"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Metric card ───────────────────────────────────────────────────────────────

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

// ─── Session metric row ───────────────────────────────────────────────────────

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

// ─── DrivePage ─────────────────────────────────────────────────────────────────

export function DrivePage() {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const { config: adminCfg } = useAdminConfig();
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);
  const [remoteSessionId, setRemoteSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [sessionYawns, setSessionYawns] = useState(0);
  const [sessionHeads, setSessionHeads] = useState(0);
  const [sessionBrakeFlags, setSessionBrakeFlags] = useState(0);
  const [brakePending, setBrakePending] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const lastSentRef = useRef({ y: 0, h: 0 });

  const [useManualOverride, setUseManualOverride] = useState(false);
  const [manualLevel, setManualLevel] = useState(4);
  const [lastTelemetryLevel, setLastTelemetryLevel] = useState<number | null>(null);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertLevel, setAlertLevel] = useState(0);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertActions, setAlertActions] = useState<string[]>([]);
  const lastAlertRef = useRef<{ level: number; at: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [browserMlOn, setBrowserMlOn] = useState(false);
  const [mlError, setMlError] = useState<string | null>(null);

  // Face ML data for AR overlays
  const [faceScore, setFaceScore] = useState<{
    pitch: number;
    yaw: number;
    jawOpen: number;
  } | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);

  // Rolling alertness history for the pulse chart (0-100)
  const [pulseHistory, setPulseHistory] = useState<number[]>([
    60, 65, 75, 70, 85, 80, 90, 85, 100,
  ]);

  const faceMl = useWebFaceLandmarker();
  const jawHighRef = useRef(0);
  const lastYawnMlRef = useRef(0);
  const prevEulerRef = useRef<{ yaw: number; pitch: number; roll: number } | null>(null);
  const lastHeadMlRef = useRef(0);

  const thresholds = useMemo(
    () => ({
      yawn_threshold: adminCfg.yawn_threshold,
      head_movement_threshold: adminCfg.head_movement_threshold,
    }),
    [adminCfg.yawn_threshold, adminCfg.head_movement_threshold],
  );

  const previewLevel = useMemo(() => {
    if (useManualOverride) return manualLevel;
    return computeDrowsinessLevelFromSignals({
      sessionYawnCount: sessionYawns,
      sessionHeadEventCount: sessionHeads,
      suddenBrakeThisTick: brakePending,
      thresholds,
    });
  }, [useManualOverride, manualLevel, sessionYawns, sessionHeads, brakePending, thresholds]);

  const status = drowsinessStatusLabel(previewLevel);
  const gaugePct = Math.min(100, Math.max(0, (previewLevel / 10) * 100));

  // Derived display values
  const alertnessScore = Math.round((1 - previewLevel / 10) * 100);
  const attentionBars = Math.round((alertnessScore / 100) * 5);

  const guardianPulse =
    previewLevel <= 2
      ? "VIGILANT"
      : previewLevel <= 5
        ? "MODERATE"
        : previewLevel <= 7
          ? "DROWSY"
          : "CRITICAL";

  const guardianColor =
    previewLevel <= 2
      ? "text-primary"
      : previewLevel <= 5
        ? "text-secondary"
        : "text-tertiary";

  const fatigueLabel =
    previewLevel <= 3 ? "Safe Range" : previewLevel <= 6 ? "Caution Zone" : "Danger Zone";

  const fatigueLabelColor =
    previewLevel <= 3 ? "text-primary" : previewLevel <= 6 ? "text-secondary" : "text-tertiary";

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

  const activeLocal = Boolean(localSessionId);

  const sessionStartTimeStr = useMemo(() => {
    if (!sessionStartedAt) return null;
    return new Date(sessionStartedAt).toLocaleTimeString("en", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [sessionStartedAt]);

  const minutesDriven = Math.floor(elapsedMs / 60000);
  const breakInMins = Math.max(0, 120 - minutesDriven);

  // ── Timers ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!localSessionId || sessionStartedAt == null) return;
    const id = window.setInterval(() => setElapsedMs(Date.now() - sessionStartedAt), 1000);
    return () => window.clearInterval(id);
  }, [localSessionId, sessionStartedAt]);

  // ── Session resume / sync ─────────────────────────────────────────────────

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

  // ── Camera ────────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    faceMl.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setBrowserMlOn(false);
    setCameraOn(false);
    setFaceDetected(false);
    setFaceScore(null);
  }, [faceMl]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not supported in this browser.");
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
      setCameraError(e instanceof Error ? e.message : "Could not open camera");
      setCameraOn(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ── Alert ─────────────────────────────────────────────────────────────────

  const fireAlert = useCallback(
    async (level: number, actions: string[], label: string) => {
      const now = Date.now();
      const prev = lastAlertRef.current;
      const throttleMs = 35_000;
      if (prev && now - prev.at < throttleMs && level <= prev.level) return;
      lastAlertRef.current = { level, at: now };

      if (user) {
        void supabase.from("alert_events").insert({
          user_id: user.id,
          driving_session_id: remoteSessionId,
          local_session_hint: localSessionId,
          drowsiness_level: level,
          trigger_level: adminCfg.drowsiness_trigger_level,
          alert_label: label,
          source: "web_drive",
        });
      }

      setAlertLevel(level);
      setAlertTitle(label);
      setAlertActions(actions);
      setAlertOpen(true);
      await playWebAlert(actions);
    },
    [user, remoteSessionId, localSessionId, adminCfg.drowsiness_trigger_level],
  );

  // ── Session start / stop ──────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setNote(null);
    try {
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
      setLastTelemetryLevel(null);
      lastAlertRef.current = null;
      setSessionYawns(0);
      setSessionHeads(0);
      setSessionBrakeFlags(0);
      setBrakePending(false);
      lastSentRef.current = { y: 0, h: 0 };
      const t0 = Date.now();
      setSessionStartedAt(t0);
      setElapsedMs(0);
      jawHighRef.current = 0;
      lastYawnMlRef.current = 0;
      prevEulerRef.current = null;
      lastHeadMlRef.current = 0;
      setPulseHistory([60, 65, 75, 70, 85, 80, 90, 85, 100]);
      setNote("Session saved locally. Syncs to Supabase when online.");
      await ensureRemoteSession(supabase, user.id, id);
      await flushPendingTelemetry(supabase, user.id);
      await refreshRemoteHint();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed to start session");
    } finally {
      setBusy(false);
    }
  }, [user, refreshRemoteHint]);

  const stop = useCallback(async () => {
    if (!localSessionId || !user) return;
    setBusy(true);
    setNote(null);
    try {
      const endedAt = new Date().toISOString();
      await offlineDb.drivingSessionsLocal.update(localSessionId, { endedAt });
      setLocalSessionId(null);
      setRemoteSessionId(null);
      setAlertOpen(false);
      setSessionStartedAt(null);
      setElapsedMs(0);
      await flushOutbox(supabase, user.id);
      setNote("Session ended. Outbox flushed.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed to end session");
    } finally {
      setBusy(false);
    }
  }, [localSessionId, user]);

  // ── Telemetry push ────────────────────────────────────────────────────────

  const pushSample = useCallback(async () => {
    if (!localSessionId || !user) return;
    setBusy(true);
    setNote(null);
    const yDelta = sessionYawns - lastSentRef.current.y;
    const hDelta = sessionHeads - lastSentRef.current.h;
    const sudden = brakePending;
    lastSentRef.current = { y: sessionYawns, h: sessionHeads };
    if (sudden) setSessionBrakeFlags((b) => b + 1);
    setBrakePending(false);

    const level = useManualOverride
      ? manualLevel
      : computeDrowsinessLevelFromSignals({
          sessionYawnCount: sessionYawns,
          sessionHeadEventCount: sessionHeads,
          suddenBrakeThisTick: sudden,
          thresholds,
        });

    try {
      await offlineDb.sessionTelemetryLocal.add({
        localSessionId,
        recordedAt: new Date().toISOString(),
        drowsinessLevel: level,
        yawnCountDelta: yDelta,
        headEventCountDelta: hDelta,
        suddenBrake: sudden ? 1 : 0,
        source: browserMlOn ? "web_mediapipe_face" : "web_demo",
        remoteSynced: 0,
      });
      setLastTelemetryLevel(level);

      // Update pulse history
      const alertnessVal = Math.round((1 - level / 10) * 100);
      setPulseHistory((prev) => [...prev.slice(-8), alertnessVal]);

      const n = await flushPendingTelemetry(supabase, user.id);
      await refreshRemoteHint();

      const trigger = adminCfg.drowsiness_trigger_level;
      if (shouldAlertForLevel(level, trigger)) {
        const band = alertConfigForDrowsinessLevel(level, adminCfg.alertMap);
        const actions = band?.actions ?? ["sound"];
        const label = band?.label ?? "Attention required";
        await fireAlert(level, actions, label);
      }

      setNote(
        n > 0
          ? `Telemetry synced (${n} row).`
          : "Telemetry queued locally.",
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed to log telemetry");
    } finally {
      setBusy(false);
    }
  }, [
    localSessionId,
    user,
    sessionYawns,
    sessionHeads,
    brakePending,
    useManualOverride,
    manualLevel,
    thresholds,
    adminCfg,
    refreshRemoteHint,
    fireAlert,
    browserMlOn,
  ]);

  // ── Face ML ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!browserMlOn || !cameraOn) {
      faceMl.stop();
      setMlError(null);
      setFaceDetected(false);
      setFaceScore(null);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setMlError(null);
    void faceMl
      .start(video, (scores) => {
        if (cancelled) return;
        setFaceDetected(scores.faceDetected);
        if (!scores.faceDetected) {
          setFaceScore(null);
          return;
        }
        setFaceScore({
          pitch: scores.pitchDeg,
          yaw: scores.yawDeg,
          jawOpen: scores.jawOpen,
        });

        const now = performance.now();
        if (scores.jawOpen > 0.48) jawHighRef.current += 1;
        else jawHighRef.current = 0;
        if (jawHighRef.current >= 5 && now - lastYawnMlRef.current > 2200) {
          lastYawnMlRef.current = now;
          jawHighRef.current = 0;
          setSessionYawns((y) => y + 1);
        }

        if (prevEulerRef.current === null) {
          prevEulerRef.current = {
            yaw: scores.yawDeg,
            pitch: scores.pitchDeg,
            roll: scores.rollDeg,
          };
          return;
        }
        const pe = prevEulerRef.current;
        const delta =
          Math.abs(scores.yawDeg - pe.yaw) +
          Math.abs(scores.pitchDeg - pe.pitch) +
          Math.abs(scores.rollDeg - pe.roll);
        prevEulerRef.current = {
          yaw: scores.yawDeg,
          pitch: scores.pitchDeg,
          roll: scores.rollDeg,
        };
        if (delta > 16 && now - lastHeadMlRef.current > 700) {
          lastHeadMlRef.current = now;
          setSessionHeads((h) => h + 1);
        }
      })
      .then((err) => {
        if (!cancelled && err) setMlError(err);
      });

    return () => {
      cancelled = true;
      faceMl.stop();
    };
  }, [browserMlOn, cameraOn, faceMl]);

  const dismissAlert = useCallback(() => {
    setAlertOpen(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-background text-on-surface font-body">
      <DrowsinessAlertOverlay
        open={alertOpen}
        level={alertLevel}
        title={alertTitle}
        actionsSummary={alertActions.join(", ")}
        onDismiss={dismissAlert}
        flash={alertActions.some((a) => a === "flashlight" || a === "iot_led")}
        elapsedMs={elapsedMs}
      />

      {/* ── Left: Camera + Metrics ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Camera view */}
        <div
          className="relative flex-1 min-h-0 bg-surface-container-lowest overflow-hidden"
          style={{ minHeight: "clamp(180px, 40vh, 500px)" }}
        >
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
          />

          {/* Camera off placeholder */}
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

          {/* AR overlays (camera on) */}
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

          {/* Active session: drowsiness gauge strip */}
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
            sub={activeLocal ? `Session active · Level ${previewLevel}` : "Start a session to monitor."}
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
            label="Eye Closure"
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
      </div>

      {/* ── Right: Session panel ───────────────────────────────────────────── */}
      <div className="lg:w-96 xl:w-[420px] shrink-0 flex flex-col overflow-y-auto bg-surface-container-low border-t lg:border-t-0 lg:border-l border-outline-variant/10 pb-16 lg:pb-6">

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

          {/* Start / Stop / Log */}
          {!activeLocal ? (
            <button
              disabled={busy}
              onClick={() => void start()}
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
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => void pushSample()}
                className="flex-1 py-3 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs active:scale-95 transition-all disabled:opacity-40 border border-outline-variant/10 hover:bg-surface-bright flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">upload</span>
                Log Sample
              </button>
              <button
                disabled={busy}
                onClick={() => void stop()}
                className="flex-1 py-3 bg-error-container/20 text-error rounded-xl font-bold text-xs active:scale-95 transition-all disabled:opacity-40 border border-error/20 hover:bg-error-container/30 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">stop_circle</span>
                End Session
              </button>
            </div>
          )}

          {note && (
            <p className="mt-3 text-xs text-secondary leading-relaxed">{note}</p>
          )}
          {lastTelemetryLevel !== null && (
            <p className="mt-1 text-[10px] text-slate-500">
              Last logged level: <span className="text-primary font-mono">{lastTelemetryLevel}</span>
            </p>
          )}
        </div>

        {/* Session metrics */}
        <div className="p-5 sm:p-6 lg:p-8 space-y-5 lg:space-y-6 shrink-0">
          <SessionMetric
            icon="timer"
            iconColor="text-primary"
            label="Continuous Drive"
            value={activeLocal && sessionStartedAt != null ? formatElapsed(elapsedMs) : "—:—:—"}
          />
          <SessionMetric
            icon="coffee"
            iconColor="text-secondary"
            label="Fatigue Threshold"
            value={fatigueLabel}
            valueColor={fatigueLabelColor}
          />
          <SessionMetric
            icon="warning"
            iconColor="text-tertiary"
            label="Recent Alerts"
            value={
              sessionYawns + sessionHeads > 0
                ? `${sessionYawns + sessionHeads} Events`
                : "0 Records"
            }
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
              {activeLocal
                ? "Recommended: take a break every 2 hours of driving."
                : "Monitoring will begin once a session starts."}
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

        {/* Demo / quick action buttons */}
        <div className="px-5 sm:px-6 lg:px-8 pb-4 shrink-0">
          {activeLocal ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={busy}
                onClick={() => setSessionYawns((n) => n + 1)}
                className="py-4 bg-surface-container-highest hover:bg-surface-bright rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border border-outline-variant/10 active:scale-95 disabled:opacity-40 group"
              >
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-xl">
                  face_retouching_natural
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  +Yawn
                </span>
              </button>
              <button
                disabled={busy}
                onClick={() => setSessionHeads((n) => n + 1)}
                className="py-4 bg-surface-container-highest hover:bg-surface-bright rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border border-outline-variant/10 active:scale-95 disabled:opacity-40 group"
              >
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-xl">
                  transfer_within_a_station
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  +Head Move
                </span>
              </button>
              <button
                disabled={busy}
                onClick={() => setBrakePending(true)}
                className="col-span-2 py-3.5 bg-secondary/10 hover:bg-secondary/20 rounded-2xl flex items-center justify-center gap-2 transition-all border border-secondary/20 active:scale-95 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-secondary text-xl">warning</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                  Flag Sudden Brake
                </span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button className="py-4 bg-surface-container-highest hover:bg-surface-bright rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border border-outline-variant/10 active:scale-95 group">
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-xl">
                  mic_off
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Mute Alerts
                </span>
              </button>
              <button className="py-4 bg-surface-container-highest hover:bg-surface-bright rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border border-outline-variant/10 active:scale-95 group">
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-xl">
                  brightness_high
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  Night Mode
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Manual override (debug) */}
        {activeLocal && (
          <div className="px-5 sm:px-6 lg:px-8 pb-4 shrink-0">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant mb-2">
              <input
                type="checkbox"
                checked={useManualOverride}
                onChange={(e) => setUseManualOverride(e.target.checked)}
                className="rounded border-outline-variant accent-primary"
              />
              Manual level override (debug alerts)
            </label>
            {useManualOverride && (
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={manualLevel}
                  onChange={(e) => setManualLevel(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <span className="text-xs font-mono text-primary">{manualLevel}</span>
              </div>
            )}
          </div>
        )}

        {/* Debug info */}
        <div className="px-5 sm:px-6 lg:px-8 pb-4 shrink-0 text-[9px] text-slate-600 space-y-0.5">
          <p>
            Local:{" "}
            <span className="font-mono text-slate-500">{localSessionId?.slice(0, 12) ?? "—"}</span>
          </p>
          <p>
            Remote:{" "}
            <span className="font-mono text-slate-500">
              {remoteSessionId?.slice(0, 12) ?? "—"}
            </span>
          </p>
          <p>
            Network:{" "}
            <span className={online ? "text-emerald-600" : "text-secondary"}>
              {online ? "online" : "offline"}
            </span>{" "}
            · Trigger:{" "}
            <span className="text-primary">{adminCfg.drowsiness_trigger_level}</span>
            {" · "}
            Brake events:{" "}
            <span className="text-slate-500">
              {sessionBrakeFlags}{brakePending ? " (pending)" : ""}
            </span>
          </p>
        </div>
      </div>

      {/* ── System: Armed floating pill ───────────────────────────────────── */}
      {activeLocal && (
        <div className="fixed bottom-[4.5rem] lg:bottom-6 right-4 lg:right-6 z-40 pointer-events-none">
          <div className="sg-glass-panel px-4 py-3 rounded-full border border-outline-variant/20 shadow-2xl flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(123,208,255,0.6)]" />
              <span className="text-[10px] font-black tracking-widest uppercase text-on-surface">
                System: Armed
              </span>
            </div>
            <div className="w-px h-3 bg-outline-variant/40" />
            <span className="text-[9px] text-on-surface-variant font-medium whitespace-nowrap">
              {sessionStartTimeStr ? `SINCE ${sessionStartTimeStr}` : "ACTIVE"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
