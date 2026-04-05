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

  useEffect(() => {
    if (!localSessionId || sessionStartedAt == null) return;
    const id = window.setInterval(() => setElapsedMs(Date.now() - sessionStartedAt), 1000);
    return () => window.clearInterval(id);
  }, [localSessionId, sessionStartedAt]);

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
        setNote("Active Supabase session found (no local row). End it from History or Supabase if stuck.");
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

  const stopCamera = useCallback(() => {
    faceMl.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setBrowserMlOn(false);
    setCameraOn(false);
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
      setNote("Session saved locally (IndexedDB). Syncs to Supabase when online.");
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
      setNote("Session ended. Outbox flushed when online.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed to end session");
    } finally {
      setBusy(false);
    }
  }, [localSessionId, user]);

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
      const n = await flushPendingTelemetry(supabase, user.id);
      await refreshRemoteHint();

      const trigger = adminCfg.drowsiness_trigger_level;
      if (shouldAlertForLevel(level, trigger)) {
        const band = alertConfigForDrowsinessLevel(level, adminCfg.alertMap);
        const actions = band?.actions ?? ["sound"];
        const label = band?.label ?? "Attention required";
        await fireAlert(level, actions, label);
      }

      setNote(n > 0 ? `Telemetry queued; ${n} row(s) synced to Supabase.` : "Telemetry queued locally (offline or waiting for remote session).");
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

  useEffect(() => {
    if (!browserMlOn || !cameraOn) {
      faceMl.stop();
      setMlError(null);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setMlError(null);
    void faceMl.start(video, (scores) => {
      if (cancelled || !scores.faceDetected) return;
      const now = performance.now();

      if (scores.jawOpen > 0.48) jawHighRef.current += 1;
      else jawHighRef.current = 0;
      if (jawHighRef.current >= 5 && now - lastYawnMlRef.current > 2200) {
        lastYawnMlRef.current = now;
        jawHighRef.current = 0;
        setSessionYawns((y) => y + 1);
      }

      if (prevEulerRef.current === null) {
        prevEulerRef.current = { yaw: scores.yawDeg, pitch: scores.pitchDeg, roll: scores.rollDeg };
        return;
      }
      const pe = prevEulerRef.current;
      const delta =
        Math.abs(scores.yawDeg - pe.yaw) + Math.abs(scores.pitchDeg - pe.pitch) + Math.abs(scores.rollDeg - pe.roll);
      prevEulerRef.current = { yaw: scores.yawDeg, pitch: scores.pitchDeg, roll: scores.rollDeg };
      if (delta > 16 && now - lastHeadMlRef.current > 700) {
        lastHeadMlRef.current = now;
        setSessionHeads((h) => h + 1);
      }
    }).then((err) => {
      if (!cancelled && err) setMlError(err);
    });

    return () => {
      cancelled = true;
      faceMl.stop();
    };
  }, [browserMlOn, cameraOn, faceMl]);

  const activeLocal = Boolean(localSessionId);

  const dismissAlert = useCallback(() => {
    setAlertOpen(false);
  }, []);

  const yawnLabel = sessionYawns === 0 ? "None detected" : `${sessionYawns} event(s)`;
  const headLabel = sessionHeads === 0 ? "Steady" : `${sessionHeads} movement(s)`;
  const brakeLabel =
    sessionBrakeFlags === 0 && !brakePending ? "None this session" : `${sessionBrakeFlags} logged · ${brakePending ? "pending" : "ready"}`;

  return (
    <div className="space-y-6 font-body text-on-surface">
      <DrowsinessAlertOverlay
        open={alertOpen}
        level={alertLevel}
        title={alertTitle}
        actionsSummary={alertActions.join(", ")}
        onDismiss={dismissAlert}
        flash={alertActions.some((a) => a === "flashlight" || a === "iot_led")}
      />
      <div>
        <h1 className="font-headline text-2xl font-extrabold text-on-surface">Active monitoring</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Offline-first: <strong className="text-on-surface">IndexedDB</strong> (Dexie) → Supabase when online. Scoring uses{" "}
          <span className="text-primary">computeDrowsinessLevelFromSignals</span> + admin thresholds.{" "}
          <strong className="text-on-surface">Browser ML</strong> = MediaPipe Face Landmarker (FR-2/FR-3).
        </p>
        <p className="mt-2 text-xs text-on-surface-variant">
          Network:{" "}
          <span className={online ? "text-emerald-400" : "text-secondary"}>{online ? "online" : "offline"}</span>
          {" · "}
          Alert trigger: <span className="text-primary">{adminCfg.drowsiness_trigger_level}</span>
        </p>
      </div>

      {activeLocal ? (
        <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/90 p-5 shadow-sg-primary">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Current status</p>
              <h2 className="font-headline text-2xl font-extrabold text-primary">
                {status.label}{" "}
                <span className="text-base font-bold text-on-surface-variant">· Level {previewLevel}</span>
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Session time</p>
              <p className="font-headline text-xl font-bold text-on-surface">{sessionStartedAt != null ? formatElapsed(elapsedMs) : "—"}</p>
            </div>
          </div>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className={
                status.band === "high"
                  ? "h-full rounded-full bg-gradient-to-r from-secondary to-tertiary shadow-[0_0_12px_rgba(255,185,95,0.35)] transition-all duration-300"
                  : "h-full rounded-full bg-gradient-to-r from-primary to-on-primary-container shadow-[0_0_12px_rgba(123,208,255,0.35)] transition-all duration-300"
              }
              style={{ width: `${gaugePct}%` }}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-outline-variant/15 bg-surface-container-low/90 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Yawning</p>
            <p className="font-headline font-bold text-on-surface">{yawnLabel}</p>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(123,208,255,0.6)]" aria-hidden />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-outline-variant/15 bg-surface-container-low/90 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Head movement</p>
            <p className="font-headline font-bold text-on-surface">{headLabel}</p>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(123,208,255,0.6)]" aria-hidden />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-outline-variant/15 bg-surface-container-low/90 p-4 sm:col-span-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sudden braking</p>
            <p className="font-headline font-bold text-on-surface">{brakeLabel}</p>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(255,185,95,0.5)]" aria-hidden />
        </div>
      </div>

      {activeLocal ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setSessionYawns((n) => n + 1)}
            className="rounded-xl border border-outline-variant/40 bg-surface-container-high px-3 py-2 text-sm text-on-surface hover:bg-surface-bright disabled:opacity-40"
          >
            + Yawn (demo)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setSessionHeads((n) => n + 1)}
            className="rounded-xl border border-outline-variant/40 bg-surface-container-high px-3 py-2 text-sm text-on-surface hover:bg-surface-bright disabled:opacity-40"
          >
            + Head movement
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setBrakePending(true)}
            className="rounded-xl border border-secondary/40 bg-secondary/10 px-3 py-2 text-sm text-secondary hover:bg-secondary/20 disabled:opacity-40"
          >
            Flag sudden brake (next sample)
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/20 px-4 py-2">
            <span className="text-sm font-medium text-on-surface">Camera preview</span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={browserMlOn}
                  disabled={!cameraOn}
                  onChange={(e) => setBrowserMlOn(e.target.checked)}
                  className="rounded border-outline-variant"
                />
                Browser ML
              </label>
              {!cameraOn ? (
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="rounded-lg bg-surface-container-high px-3 py-1 text-xs text-on-surface hover:bg-surface-bright"
                >
                  Enable camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => stopCamera()}
                  className="rounded-lg bg-surface-container-high px-3 py-1 text-xs text-on-surface hover:bg-surface-bright"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
          <div className="relative aspect-video bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            {!cameraOn ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-on-surface-variant">
                <span>Optional live preview (getUserMedia).</span>
                <span className="text-xs text-on-surface-variant/70">Enable Browser ML for MediaPipe (WASM + model from CDN).</span>
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="sg-vision-pulse rounded-full border-2 border-primary/40 p-16">
                  <div className="h-1 w-1 animate-ping rounded-full bg-primary" />
                </div>
                <p className="mt-3 rounded-full border border-primary/25 bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  {browserMlOn ? "Front camera · Face Landmarker" : "Front camera · preview"}
                </p>
              </div>
            )}
          </div>
          {cameraError ? <p className="px-4 py-2 text-xs text-secondary">{cameraError}</p> : null}
          {mlError ? <p className="px-4 py-2 text-xs text-tertiary">ML: {mlError}</p> : null}
        </div>

        <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/90 p-6">
          <p className="mb-2 text-sm text-on-surface-variant">
            Local session: <span className="font-mono text-on-surface">{localSessionId ?? "—"}</span>
          </p>
          <p className="mb-4 text-sm text-on-surface-variant">
            Remote (Supabase): <span className="font-mono text-on-surface">{remoteSessionId ?? "not synced yet"}</span>
          </p>
          {activeLocal ? (
            <>
              <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={useManualOverride}
                  onChange={(e) => setUseManualOverride(e.target.checked)}
                  className="rounded border-outline-variant"
                />
                Manual level override (debug alerts)
              </label>
              {useManualOverride ? (
                <label className="mb-4 block text-sm text-on-surface-variant">
                  Override level
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={manualLevel}
                    onChange={(e) => setManualLevel(Number(e.target.value))}
                    className="mt-2 w-full accent-primary"
                  />
                  <span className="mt-1 block font-mono text-on-surface">{manualLevel}</span>
                </label>
              ) : (
                <p className="mb-4 text-xs text-on-surface-variant">
                  Computed preview: <span className="font-mono text-primary">{previewLevel}</span> — add signals, then log.
                </p>
              )}
            </>
          ) : null}
          {lastTelemetryLevel !== null ? (
            <p className="mb-4 text-xs text-on-surface-variant">Last logged level: {lastTelemetryLevel}</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || activeLocal}
              onClick={() => void start()}
              className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 px-4 py-2 font-headline font-semibold text-white shadow-lg shadow-emerald-900/30 disabled:opacity-40"
            >
              Start session
            </button>
            <button
              type="button"
              disabled={busy || !activeLocal}
              onClick={() => void pushSample()}
              className="rounded-xl bg-surface-container-high px-4 py-2 font-medium text-on-surface hover:bg-surface-bright disabled:opacity-40"
            >
              Log telemetry sample
            </button>
            <button
              type="button"
              disabled={busy || !activeLocal}
              onClick={() => void stop()}
              className="rounded-xl border border-tertiary/40 bg-tertiary/15 px-4 py-2 font-medium text-tertiary hover:bg-tertiary/25 disabled:opacity-40"
            >
              End session
            </button>
          </div>
          {note ? <p className="mt-4 text-sm text-secondary">{note}</p> : null}
        </div>
      </div>
    </div>
  );
}
