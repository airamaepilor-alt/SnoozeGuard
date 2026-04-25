// SimulationPage.tsx — full-screen driving simulation with wheel/pedal controller
// Integrated drowsiness detection: face monitoring, yawn/head detection, sudden brake alerts

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SimEngine } from "../lib/sim/SimEngine";
import type { SimTickState } from "../lib/sim/SimEngine";
import { GamepadDriver, DEFAULT_MAPPING } from "../lib/sim/GamepadDriver";
import type { AxisMapping } from "../lib/sim/GamepadDriver";
import { useWebFaceLandmarker } from "../hooks/useWebFaceLandmarker";
import { createYawnDetector, createHeadDetector, createTiltDetector } from "../lib/ml/faceDetectors";
import {
  alertConfigForDrowsinessLevel,
  computeLevelFromAlertMap,
  parseAlertMap,
  shouldAlertForLevel,
} from "@snoozeguard/shared";
import { playWebAlert, stopWebAlert } from "../lib/alerts/playWebAlert";
import { useAuth } from "../context/AuthContext";
import { offlineDb } from "../lib/offline/db";
import { supabase } from "../lib/supabase";
import { ensureRemoteSession, flushEndedSessions, flushPendingTelemetry } from "../lib/offline/sync";

// ── Calibration modal ────────────────────────────────────────────────────────

type CalibStep = "steer" | "throttle" | "brake" | "done";

// ── End Session Confirmation Modal ────────────────────────────────────────────

function EndSessionModal({
  open,
  sessionDuration,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  sessionDuration: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const mins = Math.floor(sessionDuration / 60);
  const secs = sessionDuration % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
      <div className="rounded-2xl p-8 max-w-sm text-center border border-white/10 bg-black/80">
        <span className="material-symbols-outlined text-amber-400 text-4xl mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>
          stop_circle
        </span>
        <h2 className="text-2xl font-bold text-white mb-2">End Simulation Session?</h2>
        <p className="text-white/70 text-sm mb-6">
          Session duration: <span className="font-mono font-bold text-white">{mins}:{secs.toString().padStart(2, "0")}</span>
        </p>
        <p className="text-white/60 text-xs mb-6">
          This will save your drowsiness metrics to your driving history as a simulation session.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg font-bold text-white/70 border border-white/10 hover:bg-white/5 transition-colors"
          >
            Continue Driving
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drowsiness Alert Overlay ──────────────────────────────────────────────────

function SimDrowsinessAlert({
  open,
  level,
  title,
  onDismiss,
}: {
  open: boolean;
  level: number;
  title: string;
  onDismiss: () => void;
}) {
  if (!open) return null;
  
  const levelColor =
    level <= 4 ? "text-sky-400" : level <= 6 ? "text-amber-400" : "text-red-400";
  const levelBg =
    level <= 4 ? "bg-sky-500/10 border-sky-500/30" : level <= 6 ? "bg-amber-500/10 border-amber-500/30" : "bg-red-500/10 border-red-500/30";
  
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
      <div className={`rounded-2xl p-6 max-w-sm text-center border ${levelBg}`}>
        <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${levelColor}`}>
          Alert Level {level}
        </p>
        <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
        <p className="text-white/70 text-sm mb-6">
          Drowsiness detected during simulation. Stay alert and focused on the road.
        </p>
        <button
          onClick={onDismiss}
          className={`px-6 py-2 rounded-lg font-bold text-white transition-colors ${
            level <= 4
              ? "bg-sky-500/20 hover:bg-sky-500/30"
              : level <= 6
                ? "bg-amber-500/20 hover:bg-amber-500/30"
                : "bg-red-500/20 hover:bg-red-500/30"
          }`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── Crash Alert ───────────────────────────────────────────────────────────────

function SimCrashAlert({
  open,
  speedKph,
  onDismiss,
}: {
  open: boolean;
  speedKph: number;
  onDismiss: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto">
      <div className="rounded-2xl p-8 max-w-sm w-full mx-4 text-center border border-red-500/40 bg-red-950/90 shadow-2xl shadow-red-900/50">
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
            <span
              className="material-symbols-outlined text-red-400 text-5xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              car_crash
            </span>
          </div>
        </div>
        <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2">Collision Detected</p>
        <h2 className="text-3xl font-black text-white mb-2">Crash!</h2>
        <p className="text-red-300 text-sm font-semibold mb-4">
          {speedKph > 1 ? `Impact at ${Math.round(speedKph)} km/h` : "Vehicle left the road"}
        </p>
        <p className="text-white/60 text-xs mb-6 leading-relaxed">
          Drowsy driving reduces reaction time and can cause loss of vehicle control.
          Always pull over and rest if you feel fatigued.
        </p>
        <button
          onClick={onDismiss}
          className="w-full px-6 py-3 rounded-xl font-bold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/50 transition-colors active:scale-95"
        >
          Continue Driving
        </button>
      </div>
    </div>
  );
}

// ── Special Alert (sudden brake, head tilt) ───────────────────────────────────

function SimSpecialAlert({
  open,
  title,
  message,
  onDismiss,
}: {
  open: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
      <div className="rounded-2xl p-8 max-w-sm text-center border border-red-500/30 bg-red-950/80">
        <div className="flex justify-center mb-4">
          <span className="material-symbols-outlined text-red-400 text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            warning
          </span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">⚠ SAFETY ALERT</h2>
        <p className="text-lg font-semibold text-red-300 mb-3">{title}</p>
        <p className="text-white/70 text-sm mb-6 leading-relaxed">{message}</p>
        <button
          onClick={onDismiss}
          className="w-full px-6 py-3 rounded-lg font-bold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/50 transition-colors"
        >
          Understood — dismiss
        </button>
      </div>
    </div>
  );
}

// ── Calibration modal ────────────────────────────────────────────────────────

function CalibrationModal({
  driver,
  onClose,
}: {
  driver: GamepadDriver;
  onClose: () => void;
}) {
  const [step, setStep] = useState<CalibStep>("steer");
  const [rawAxes, setRawAxes] = useState<number[]>([]);
  const [mapping, setMapping] = useState<AxisMapping>(driver.getMapping());
  const rafRef = useRef<number>(0);
  const rawAxesRef = useRef<number[]>([]);
  const restingAxesRef = useRef<number[]>([]);

  // Poll gamepad axes live
  useEffect(() => {
    const poll = () => {
      const axes = driver.getRawAxes();
      rawAxesRef.current = axes;
      setRawAxes(axes);
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [driver]);

  // Capture resting axis values 400 ms after each step change so the user has
  // time to release the previous pedal before we snapshot the rest position.
  useEffect(() => {
    const t = setTimeout(() => {
      restingAxesRef.current = [...rawAxesRef.current];
    }, 400);
    return () => clearTimeout(t);
  }, [step]);

  const assignAxis = (axisIndex: number) => {
    const pressed = rawAxes[axisIndex] ?? 0;
    const resting = restingAxesRef.current[axisIndex] ?? 0;
    const delta = pressed - resting;

    setMapping((prev) => {
      const next = { ...prev };
      if (step === "steer") {
        next.steerAxis = axisIndex;
        next.steerInvert = pressed > 0.3;
      } else if (step === "throttle") {
        next.throttleAxis = axisIndex;
        if (delta > 0.15) {
          // Pressing moves axis up (e.g., combined axis: rest≈0 → +1 when pressed)
          next.throttleInvert = false;
          next.throttleRange = [resting, 1];
        } else if (delta < -0.15) {
          // Pressing moves axis down (e.g., Logitech G29: rest=+1 → -1 when pressed)
          next.throttleInvert = true;
          next.throttleRange = [-1, resting];
        } else {
          // No clear movement — fall back to resting-value heuristic
          next.throttleInvert = resting > 0.5;
          next.throttleRange = [-1, 1];
        }
      } else if (step === "brake") {
        next.brakeAxis = axisIndex;
        if (delta < -0.15) {
          // Pressing moves axis down (combined: rest≈0 → -1, or G29 brake)
          next.brakeInvert = true;
          next.brakeRange = [-1, resting];
        } else if (delta > 0.15) {
          // Pressing moves axis up (unusual orientation)
          next.brakeInvert = false;
          next.brakeRange = [resting, 1];
        } else {
          next.brakeInvert = resting > 0.5;
          next.brakeRange = [-1, 1];
        }
      }
      return next;
    });

    const order: CalibStep[] = ["steer", "throttle", "brake", "done"];
    const next = order[order.indexOf(step) + 1] ?? "done";
    setStep(next);
  };

  const handleSave = () => {
    driver.saveMapping(mapping);
    onClose();
  };

  const handleReset = () => {
    driver.resetMapping();
    setMapping({ ...DEFAULT_MAPPING });
    setStep("steer");
  };

  const stepInfo: Record<Exclude<CalibStep, "done">, { title: string; instruction: string }> = {
    steer: {
      title: "Step 1 / 3 — Steering Wheel",
      instruction: "Keep pedals released. Slowly turn your steering wheel left and right. Click the axis that highlights.",
    },
    throttle: {
      title: "Step 2 / 3 — Accelerator Pedal",
      instruction: "Release all pedals first — then press ONLY the accelerator fully down. Click the highlighted axis.",
    },
    brake: {
      title: "Step 3 / 3 — Brake Pedal",
      instruction: "Release all pedals first — then press ONLY the brake pedal fully down. Click the highlighted axis.",
    },
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0e1520] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Configure Controller</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Maps your steering wheel and pedals to the simulation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-1"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {step !== "done" ? (
          <>
            {/* Step header */}
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <p className="text-[11px] font-bold text-sky-400 uppercase tracking-widest mb-1">
                {stepInfo[step].title}
              </p>
              <p className="text-sm text-slate-300">{stepInfo[step].instruction}</p>
            </div>

            {/* Live axis list */}
            {rawAxes.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No controller detected. Connect a USB/Bluetooth wheel and press any button.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(() => {
                  const deltas = rawAxes.map((v, idx) =>
                    Math.abs(v - (restingAxesRef.current[idx] ?? v))
                  );
                  const maxDelta = Math.max(0.01, ...deltas);
                  return rawAxes.map((val, i) => {
                    const pct = ((val + 1) / 2) * 100;
                    // Only disable the steer axis for pedal steps; throttle/brake may
                    // share the same axis on combined pedal units.
                    const isAssigned =
                      (step === "throttle" && mapping.steerAxis === i) ||
                      (step === "brake" && mapping.steerAxis === i);
                    const isActive = !isAssigned && deltas[i] > 0.12 && deltas[i] === maxDelta;
                    return (
                      <button
                        key={i}
                        onClick={() => assignAxis(i)}
                        disabled={isAssigned}
                        className={`w-full flex items-center gap-3 rounded-lg p-3 transition-colors text-left group disabled:opacity-30 disabled:pointer-events-none ${
                          isActive
                            ? "bg-sky-500/20 border border-sky-500/50 hover:bg-sky-500/30"
                            : "bg-white/5 hover:bg-white/10 border border-transparent"
                        }`}
                      >
                        <span className="text-xs text-slate-400 w-12 shrink-0 font-mono">
                          Axis {i}
                        </span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-75 ${isActive ? "bg-sky-400" : "bg-white/40"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs w-12 text-right font-mono shrink-0 ${isActive ? "text-sky-300 font-bold" : "text-slate-400"}`}>
                          {val.toFixed(2)}
                        </span>
                        {isActive ? (
                          <span className="text-[10px] text-sky-400 font-bold shrink-0 animate-pulse">
                            ← SELECT
                          </span>
                        ) : (
                          <span className="text-[10px] text-sky-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            SELECT
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-sky-400/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-sky-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">All axes configured!</h3>
            <p className="text-slate-400 text-sm mb-2">
              Steer → Axis {mapping.steerAxis} &nbsp;·&nbsp; Throttle → Axis{" "}
              {mapping.throttleAxis} &nbsp;·&nbsp; Brake → Axis {mapping.brakeAxis}
            </p>
            <p className="text-slate-500 text-xs">
              Settings saved in your browser. Redo this if your mapping feels wrong.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-5 pt-4 border-t border-white/5">
          <button
            onClick={handleReset}
            className="flex-1 py-2 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
          {step === "done" ? (
            <button
              onClick={handleSave}
              className="flex-1 py-2 text-xs font-bold bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border border-sky-500/30 rounded-lg transition-colors"
            >
              Save & Close
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-2 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
            >
              Skip / Use Defaults
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Speedometer arc ───────────────────────────────────────────────────────────

function SpeedometerArc({ kph }: { kph: number }) {
  const MAX_KPH = 180;
  const pct = Math.min(1, kph / MAX_KPH);
  const R = 48;
  const CX = 56;
  const CY = 56;
  const START_ANG = (210 * Math.PI) / 180;
  const SWEEP = (300 * Math.PI) / 180;

  const arcPath = (fraction: number) => {
    const sweep = SWEEP * fraction;
    const endAngle = START_ANG + sweep;
    const x = CX + R * Math.cos(endAngle - Math.PI);
    const y = CY + R * Math.sin(endAngle - Math.PI);
    const startX = CX + R * Math.cos(START_ANG - Math.PI);
    const startY = CY + R * Math.sin(START_ANG - Math.PI);
    const largeArc = sweep > Math.PI ? 1 : 0;
    return `M ${startX} ${startY} A ${R} ${R} 0 ${largeArc} 1 ${x} ${y}`;
  };

  const arcColor = kph < 80 ? "#38bdf8" : kph < 140 ? "#f59e0b" : "#f87171";

  return (
    <svg width={112} height={112} viewBox="0 0 112 112">
      {/* Track */}
      <path d={arcPath(1)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} strokeLinecap="round" />
      {/* Fill */}
      <path d={arcPath(pct)} fill="none" stroke={arcColor} strokeWidth={5} strokeLinecap="round"
        style={{ transition: "all 0.12s linear" }} />
      {/* Speed text */}
      <text x={CX} y={CY + 4} textAnchor="middle" fill="white" fontSize={20} fontWeight="bold"
        fontFamily="system-ui, sans-serif">
        {Math.round(kph)}
      </text>
      <text x={CX} y={CY + 18} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={8}
        fontFamily="system-ui, sans-serif" letterSpacing="2">
        km/h
      </text>
    </svg>
  );
}

// ── PedalBar ──────────────────────────────────────────────────────────────────

function PedalBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 w-10">
      <div className="w-3 h-20 bg-white/5 rounded-full overflow-hidden flex flex-col justify-end">
        <div
          className="w-full rounded-full transition-all duration-75"
          style={{ height: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[9px] text-white/40 uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ── SimulationPage ────────────────────────────────────────────────────────────

export function SimulationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionVideoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<SimEngine | null>(null);
  const driverRef = useRef<GamepadDriver>(new GamepadDriver());
  const { start: faceMlStart, stop: faceMlStop } = useWebFaceLandmarker();

  // ── Session management ─────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const sessionTelemetryRef = useRef<any[]>([]);

  const [tick, setTick] = useState<SimTickState>({
    speedKph: 0,
    gpState: { steer: 0, throttle: 0, brake: 0, connected: false, deviceName: "" },
    gear: "N",
  });

  const [timeOfDay, setTimeOfDay] = useState<"day" | "night">("night");
  const [showCalib, setShowCalib] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // ── Detection state ────────────────────────────────────────────────────────
  const [detectionEnabled, setDetectionEnabled] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Drowsiness metrics ─────────────────────────────────────────────────────
  const [liveLevel, setLiveLevel] = useState(0);
  const [liveYawns, setLiveYawns] = useState(0);
  const [liveHeads, setLiveHeads] = useState(0);
  const [liveTilts, setLiveTilts] = useState(0);

  // ── Alert state ────────────────────────────────────────────────────────────
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertLevel, setAlertLevel] = useState(0);
  const [alertTitle, setAlertTitle] = useState("");

  // ── Special alerts (sudden brake, head tilt) ──────────────────────────────
  const [specialAlertOpen, setSpecialAlertOpen] = useState(false);
  const [specialAlertTitle, setSpecialAlertTitle] = useState("");
  const [specialAlertMessage, setSpecialAlertMessage] = useState("");

  // ── Crash alert ────────────────────────────────────────────────────────────
  const [crashOpen, setCrashOpen] = useState(false);
  const [crashSpeedKph, setCrashSpeedKph] = useState(0);
  const [crashFlash, setCrashFlash] = useState(false);

  // ── Face detection state ───────────────────────────────────────────────────
  const [faceDetected, setFaceDetected] = useState(false);

  // ── Admin config (threshold for alerts) ────────────────────────────────────
  const adminRef = useRef({
    trigger: 6,
    map: parseAlertMap(undefined),
    scoreResetMinutes: 2,
    smsEnabled: false,
  });

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

  // ── Detectors and accumulators ─────────────────────────────────────────────
  const yawnAccRef = useRef(0);
  const headAccRef = useRef(0);
  const headTiltAccRef = useRef(0);
  const yawnLastTickRef = useRef(0);
  const headLastTickRef = useRef(0);
  const headTiltLastTickRef = useRef(0);
  const suddenBrakeAccRef = useRef(0);
  const suddenBrakeLastTickRef = useRef(0);
  const lastBrakeValueRef = useRef(0);
  const lastBrakeDetectionTimeRef = useRef(0);
  const lastSpecialAlertTimeRef = useRef(0);

  const yawnDetectorRef = useRef(createYawnDetector(() => { yawnAccRef.current += 1; }));
  const headDetectorRef = useRef(createHeadDetector(() => { headAccRef.current += 1; }));
  const tiltDetectorRef = useRef(createTiltDetector(() => { headTiltAccRef.current += 1; }));

  // ── Alert refs ─────────────────────────────────────────────────────────────
  const lastAlertRef = useRef<{ level: number; at: number } | null>(null);
  const dismissedLevelsRef = useRef<Set<number>>(new Set());
  const alertOpenRef = useRef(false);
  const alertLevelRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void loadAdminConfig();
  }, [loadAdminConfig]);

  useEffect(() => {
    alertOpenRef.current = alertOpen;
  }, [alertOpen]);
  useEffect(() => {
    alertLevelRef.current = alertLevel;
  }, [alertLevel]);

  // Mount the 3D engine once the canvas is available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: SimEngine;
    try {
      engine = new SimEngine(canvas);
      engine.onTick = (state) => setTick(state);
      engine.onCrash = (kph) => {
        setCrashSpeedKph(kph);
        setCrashOpen(true);
        setCrashFlash(true);
        setTimeout(() => setCrashFlash(false), 600);
      };
      engine.start();
      engineRef.current = engine;
      setEngineReady(true);
    } catch (err) {
      setInitError(err instanceof Error ? err.message : "Failed to start simulation.");
      return;
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // ── Camera management ──────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    faceMlStop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (detectionVideoRef.current) detectionVideoRef.current.srcObject = null;
    setCameraOn(false);
    setFaceDetected(false);
  }, [faceMlStop]);

  const startCamera = useCallback(async () => {
    if (!window.isSecureContext) {
      console.warn("Camera requires HTTPS");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn("Camera API unavailable");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (detectionVideoRef.current) {
        detectionVideoRef.current.srcObject = stream;
        await detectionVideoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      console.error("Camera error:", e);
      setCameraOn(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ── Toggle detection (camera + ML) ─────────────────────────────────────────

  useEffect(() => {
    if (detectionEnabled) {
      void startCamera();
    } else {
      stopCamera();
      setDetectionEnabled(false);
    }
  }, [detectionEnabled, startCamera, stopCamera]);

  // ── Face ML detection ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!cameraOn || !detectionEnabled) {
      faceMlStop();
      return;
    }
    const video = detectionVideoRef.current;
    if (!video) return;

    let cancelled = false;
    void faceMlStart(video, (scores) => {
      if (cancelled) return;
      setFaceDetected(scores.faceDetected);
      if (!scores.faceDetected) {
        yawnDetectorRef.current.process(0);
        headDetectorRef.current.process(0, 0);
        tiltDetectorRef.current.process(0, 0);
        return;
      }

      yawnDetectorRef.current.process(scores.jawOpen);
      if (scores.jawOpen < 0.6) {
        headDetectorRef.current.process(scores.pitchDeg, scores.rollDeg);
        tiltDetectorRef.current.process(scores.pitchDeg, scores.rollDeg);
      }
    }).catch((err) => {
      if (!cancelled) console.error("ML detection error:", err);
    });

    return () => {
      cancelled = true;
      faceMlStop();
    };
  }, [cameraOn, detectionEnabled, faceMlStart, faceMlStop]);

  // ── Sudden brake detection (from gamepad) ──────────────────────────────────

  useEffect(() => {
    const { speedKph, gpState } = tick;
    const currentBrake = gpState.brake;
    const lastBrake = lastBrakeValueRef.current;
    const now = Date.now();

    // Sudden brake: large increase in brake pressure (delta > 0.3) with cooldown
    const brakeDelta = currentBrake - lastBrake;
    const timeSinceLastDetection = now - lastBrakeDetectionTimeRef.current;

    if (
      brakeDelta > 0.2 &&           // Sudden increase of 20%+ (more sensitive)
      currentBrake > 0.2 &&         // Current brake pressure > 20%
      speedKph > 5 &&               // Moving (> 5 km/h)
      timeSinceLastDetection > 2000 // Cooldown: at least 2 seconds since last detection
    ) {
      suddenBrakeAccRef.current += 1;
      lastBrakeDetectionTimeRef.current = now;
      console.log(`[SimDrowsiness] Sudden brake detected! Delta: ${(brakeDelta * 100).toFixed(0)}%, Current: ${(currentBrake * 100).toFixed(0)}%, Speed: ${speedKph.toFixed(0)} km/h`);
      
      // Trigger special alert popup (with 1-second alert cooldown to prevent rapid re-triggers)
      const timeSinceLastAlert = now - lastSpecialAlertTimeRef.current;
      if (timeSinceLastAlert > 1000) {
        lastSpecialAlertTimeRef.current = now;
        console.log("[SimDrowsiness] Showing sudden brake alert popup");
        setSpecialAlertTitle("Sudden brake detected — pull over safely.");
        setSpecialAlertMessage("A sudden brake was detected. Please pull over safely and rest if needed.");
        setSpecialAlertOpen(true);
      }
    }

    lastBrakeValueRef.current = currentBrake;
  }, [tick]);

  // ── Main scoring tick (1-second interval) ──────────────────────────────────

  useEffect(() => {
    if (!detectionEnabled) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }

    tickRef.current = setInterval(() => {
      const ar = adminRef.current;

      yawnLastTickRef.current = yawnAccRef.current;
      headLastTickRef.current = headAccRef.current;
      headTiltLastTickRef.current = headTiltAccRef.current;
      suddenBrakeLastTickRef.current = suddenBrakeAccRef.current;

      const level = computeLevelFromAlertMap(yawnAccRef.current, headAccRef.current, false, ar.map);

      setLiveLevel(level);
      setLiveYawns(yawnAccRef.current);
      setLiveHeads(headAccRef.current);
      setLiveTilts(headTiltAccRef.current);

      // Check if we should alert
      const canAlert = (!alertOpenRef.current && shouldAlertForLevel(level, ar.trigger) && !dismissedLevelsRef.current.has(level));

      if (canAlert) {
        const band = alertConfigForDrowsinessLevel(level, ar.map);
        const actions = band?.actions ?? ["voice"];
        const label = band?.label ?? "Attention required";
        const now = Date.now();
        const prev = lastAlertRef.current;

        if (!prev || now - prev.at > 35_000 || level > prev.level) {
          stopWebAlert();
          lastAlertRef.current = { level, at: now };
          alertLevelRef.current = level;
          setAlertLevel(level);
          setAlertTitle(label);
          setAlertOpen(true);

          void playWebAlert(actions, level);
        }
      }
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [detectionEnabled]);

  // ── Time of day ────────────────────────────────────────────────────────────
  useEffect(() => {
    engineRef.current?.setTimeOfDay(timeOfDay);
  }, [timeOfDay]);

  // Show calibration on first visit if no custom mapping exists
  useEffect(() => {
    if (engineReady && !driverRef.current.hasCustomMapping()) {
      setShowCalib(true);
    }
  }, [engineReady]);

  const handleKeyHint = useCallback((e: React.KeyboardEvent) => {
    // Prevent page navigation shortcuts while focused on canvas
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }
  }, []);

  const dismissAlert = useCallback(() => {
    dismissedLevelsRef.current.add(alertLevelRef.current);
    stopWebAlert();
    setAlertOpen(false);
  }, []);

  // ── Session start / end handlers ───────────────────────────────────────────

  const startSimulationSession = useCallback(async () => {
    if (!user) {
      console.warn("Cannot start session: user not authenticated");
      return;
    }

    const newSessionId = crypto.randomUUID();
    const now = Date.now();

    try {
      await offlineDb.drivingSessionsLocal.add({
        id: newSessionId,
        userId: user.id,
        startedAt: new Date().toISOString(),
        deviceType: "web",
        endedSynced: 0,
      });
      setSessionId(newSessionId);
      setSessionStartTime(now);
      setSessionDuration(0);
      sessionTelemetryRef.current = [];
    } catch (err) {
      console.error("Failed to start simulation session:", err);
    }
  }, [user]);

  const endSimulationSession = useCallback(async () => {
    if (!sessionId || !sessionStartTime || !user) {
      setShowEndConfirm(false);
      return;
    }

    const sid = sessionId; // capture before state is cleared
    const endTime = new Date().toISOString();

    try {
      // 1. Persist end time locally
      await offlineDb.drivingSessionsLocal.update(sid, { endedAt: endTime });

      // 2. Ensure at least one telemetry record exists for the session
      if (sessionTelemetryRef.current.length === 0) {
        await offlineDb.sessionTelemetryLocal.add({
          localSessionId: sid,
          recordedAt: endTime,
          drowsinessLevel: liveLevel,
          yawnCountDelta: 0,
          headEventCountDelta: 0,
          suddenBrake: 0,
          source: "simulation",
          remoteSynced: 0,
        });
      }

      // 3. Sync to Supabase: create remote row if needed, then push ended_at + telemetry
      await ensureRemoteSession(supabase, user.id, sid);
      await flushEndedSessions(supabase, user.id);
      await flushPendingTelemetry(supabase, user.id);

      // 4. Clear local state then navigate
      setSessionId(null);
      setSessionStartTime(null);
      setSessionDuration(0);
      sessionTelemetryRef.current = [];
      setShowEndConfirm(false);

      navigate("/drive");
    } catch (err) {
      console.error("Failed to end simulation session:", err);
      setShowEndConfirm(false);
    }
  }, [sessionId, sessionStartTime, liveLevel, user, navigate]);

  // ── Session duration timer ─────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionStartTime) return;

    const timer = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionStartTime]);

  // ── Record telemetry during session ────────────────────────────────────────

  useEffect(() => {
    if (!sessionId || !detectionEnabled) return;

    const telemetryInterval = setInterval(() => {
      void (async () => {
        try {
          const entry = {
            localSessionId: sessionId,
            recordedAt: new Date().toISOString(),
            drowsinessLevel: liveLevel,
            yawnCountDelta: 0,
            headEventCountDelta: 0,
            suddenBrake: 0,
            source: "simulation",
            remoteSynced: 0,
          };
          await offlineDb.sessionTelemetryLocal.add(entry);
          sessionTelemetryRef.current.push(entry);
        } catch (err) {
          console.error("Failed to record telemetry:", err);
        }
      })();
    }, 5000); // Record every 5 seconds

    return () => clearInterval(telemetryInterval);
  }, [sessionId, detectionEnabled, liveLevel]);

  // ── Handle back button with confirmation ────────────────────────────────

  const handleBackClick = useCallback(() => {
    if (sessionId) {
      setShowEndConfirm(true);
    } else {
      navigate(-1);
    }
  }, [sessionId, navigate]);

  const { speedKph, gpState, gear } = tick;

  return (
    <div
      className="relative w-screen h-screen bg-black overflow-hidden select-none"
      onKeyDown={handleKeyHint}
    >
      {/* ── 3D Canvas ─────────────────────────────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        tabIndex={0}
        style={{ outline: "none" }}
      />

      {/* ── Init error ────────────────────────────────────────────────────────── */}
      {initError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="bg-red-950/80 border border-red-500/30 rounded-2xl p-8 text-center max-w-sm">
            <span className="material-symbols-outlined text-red-400 text-4xl mb-3 block">error</span>
            <p className="text-white font-bold mb-2">Could not start simulation</p>
            <p className="text-red-300 text-sm mb-5">{initError}</p>
            <button onClick={() => navigate(-1)} className="px-6 py-2 bg-red-500/20 text-red-300 rounded-xl text-sm font-bold border border-red-500/30">
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* ── HUD overlay (pointer-events-none wrapper so canvas stays interactive) */}
      {!initError && (
        <div className="absolute inset-0 pointer-events-none">

          {/* ── Top bar ──────────────────────────────────────────────────────── */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-3 pb-2 gap-2 pointer-events-auto">
            {/* Back button — icon-only on mobile, icon+text on sm+ */}
            <button
              onClick={handleBackClick}
              className="flex items-center gap-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 rounded-full p-2 sm:px-3 sm:py-2 text-white/80 hover:text-white text-xs font-bold transition-all active:scale-95 shrink-0"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span className="hidden sm:inline">Exit</span>
            </button>

            {/* Centre: controller badge (title hidden on mobile) */}
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <span className="hidden sm:block text-[10px] font-black tracking-[0.25em] text-white/40 uppercase">
                SnoozeGuard Sim
              </span>
              <div
                className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border truncate max-w-full ${
                  gpState.connected
                    ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                    : "bg-white/5 text-white/30 border-white/10"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${gpState.connected ? "bg-sky-400 animate-pulse" : "bg-white/20"}`}
                />
                <span className="truncate">
                  {gpState.connected ? "Wheel Connected" : <><span className="hidden xs:inline">Keyboard Mode </span>↑↓←→</>}
                </span>
              </div>
            </div>

            {/* Right: camera + time of day + settings */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Detection toggle */}
              <button
                onClick={() => setDetectionEnabled(!detectionEnabled)}
                className={`flex items-center gap-1.5 backdrop-blur-sm border rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                  detectionEnabled
                    ? "bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40 text-sky-400"
                    : "bg-white/10 hover:bg-white/15 border-white/25 text-white hover:border-white/40"
                }`}
                title={detectionEnabled ? "Disable drowsiness detection" : "Enable drowsiness detection"}
              >
                {detectionEnabled ? (
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
                ) : (
                  <span className="material-symbols-outlined text-[15px] leading-none shrink-0">
                    videocam_off
                  </span>
                )}
                <span className="leading-none">
                  {detectionEnabled ? "Detecting" : <><span className="sm:hidden">Detect</span><span className="hidden sm:inline">Start Detection</span></>}
                </span>
              </button>

              {/* Time of day toggle — icon-only on mobile, labeled on sm+ */}
              <div className="flex bg-black/50 backdrop-blur-sm border border-white/10 rounded-full overflow-hidden">
                {(["day", "night"] as const).map((tod) => (
                  <button
                    key={tod}
                    onClick={() => setTimeOfDay(tod)}
                    className={`px-2 py-1.5 sm:px-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      timeOfDay === tod
                        ? "bg-sky-500/20 text-sky-400"
                        : "text-white/40 hover:text-white/70"
                    }`}
                    title={tod === "day" ? "Day mode" : "Night mode"}
                  >
                    <span>{tod === "day" ? "☀️" : "🌙"}</span>
                    <span className="hidden sm:inline ml-1">{tod === "day" ? "Day" : "Night"}</span>
                  </button>
                ))}
              </div>

              {/* Controller config */}
              <button
                onClick={() => setShowCalib(true)}
                className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 rounded-full p-2 text-white/50 hover:text-white/80 transition-all"
                title="Configure controller"
              >
                <span className="material-symbols-outlined text-base">settings</span>
              </button>
            </div>
          </div>

          {/* ── Bottom-left: speedometer + detection metrics ──────────────────── */}
          <div className="absolute bottom-6 left-6 flex flex-col items-center gap-3 pointer-events-none">
            <div className="flex flex-col items-center gap-1">
              <SpeedometerArc kph={speedKph} />
              {/* Gear indicator */}
              <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1 text-white font-mono font-black text-lg -mt-1">
                {gear}
              </div>
            </div>

            {/* Detection metrics (only show when detection enabled) */}
            {detectionEnabled && (
              <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-xs space-y-2 min-w-fit">
                {/* Session duration */}
                {sessionId && (
                  <div className="flex items-center justify-between gap-4 text-white/70 pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span>Duration:</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 uppercase tracking-wider">In Progress</span>
                    </div>
                    <span className="font-mono text-sky-400 font-bold">
                      {Math.floor(sessionDuration / 60)}:{(sessionDuration % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 text-white/70">
                  <span>Level:</span>
                  <span className={`font-bold ${liveLevel <= 4 ? "text-sky-400" : liveLevel <= 6 ? "text-amber-400" : "text-red-400"}`}>
                    {liveLevel} / 10
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-white/70">
                  <span>Yawns:</span>
                  <span className="font-mono text-white/90">{liveYawns}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-white/70">
                  <span>Head:</span>
                  <span className="font-mono text-white/90">{liveHeads}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-white/70">
                  <span>Tilts:</span>
                  <span className="font-mono text-white/90">{liveTilts}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-white/70">
                  <span>Face:</span>
                  <span className={`font-mono ${faceDetected ? "text-green-400" : "text-red-400"}`}>
                    {faceDetected ? "✓" : "✗"}
                  </span>
                </div>

                {/* Session buttons */}
                {sessionId ? (
                  <button
                    onClick={() => setShowEndConfirm(true)}
                    className="w-full mt-2 pt-2 border-t border-white/10 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded font-bold text-[10px] uppercase tracking-wider transition-colors pointer-events-auto"
                  >
                    End Session
                  </button>
                ) : (
                  <button
                    onClick={() => void startSimulationSession()}
                    className="w-full mt-2 pt-2 border-t border-white/10 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded font-bold text-[10px] uppercase tracking-wider transition-colors pointer-events-auto"
                  >
                    Start Session
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Bottom-right: pedal bars + steer indicator ────────────────────── */}
          <div className="absolute bottom-6 right-6 flex items-end gap-3 pointer-events-none">
            {/* Steer indicator (horizontal bar) */}
            <div className="flex flex-col items-center gap-1 mr-2">
              <span className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Steer</span>
              <div className="w-28 h-3 bg-white/5 rounded-full relative overflow-hidden">
                {/* Centre line */}
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                {/* Steer dot */}
                <div
                  className="absolute top-0.5 bottom-0.5 w-3 bg-sky-400 rounded-full transition-all duration-75"
                  style={{
                    left: `calc(${((gpState.steer + 1) / 2) * 100}% - 6px)`,
                  }}
                />
              </div>
            </div>

            <PedalBar label="Gas" value={gpState.throttle} color="#38bdf8" />
            <PedalBar label="Brake" value={gpState.brake} color="#f87171" />
          </div>

          {/* ── Loading overlay ───────────────────────────────────────────────── */}
          {!engineReady && (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/60 text-sm">Building road…</p>
              </div>
            </div>
          )}

          {/* ── Keyboard hint (fades after 4 s) ──────────────────────────────── */}
          {engineReady && !gpState.connected && (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-none">
              <KeyboardHint />
            </div>
          )}
        </div>
      )}

      {/* ── Hidden detection video element ────────────────────────────────── */}
      {detectionEnabled && (
        <video
          ref={detectionVideoRef}
          className="hidden"
          playsInline
          muted
        />
      )}

      {/* ── Crash red flash ──────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-30 pointer-events-none bg-red-600"
        style={{
          opacity: crashFlash ? 0.45 : 0,
          transition: crashFlash ? "opacity 0s" : "opacity 0.6s ease-out",
        }}
      />

      {/* ── Crash alert ──────────────────────────────────────────────────── */}
      <SimCrashAlert
        open={crashOpen}
        speedKph={crashSpeedKph}
        onDismiss={() => setCrashOpen(false)}
      />

      {/* ── Special alert (sudden brake, head tilt) ───────────────────────── */}
      <SimSpecialAlert
        open={specialAlertOpen}
        title={specialAlertTitle}
        message={specialAlertMessage}
        onDismiss={() => setSpecialAlertOpen(false)}
      />

      {/* ── Drowsiness alert overlay ──────────────────────────────────────── */}
      <SimDrowsinessAlert
        open={alertOpen}
        level={alertLevel}
        title={alertTitle}
        onDismiss={dismissAlert}
      />

      {/* ── End session confirmation modal ─────────────────────────────────── */}
      <EndSessionModal
        open={showEndConfirm}
        sessionDuration={sessionDuration}
        onConfirm={() => void endSimulationSession()}
        onCancel={() => setShowEndConfirm(false)}
      />

      {/* ── Calibration modal ────────────────────────────────────────────────── */}
      {showCalib && (
        <CalibrationModal driver={driverRef.current} onClose={() => setShowCalib(false)} />
      )}
    </div>
  );
}

// ── KeyboardHint — fades out after 4 seconds ──────────────────────────────────

function KeyboardHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="flex gap-3 items-center bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2 text-white/50 text-xs">
      <span>W / ↑ &nbsp; accelerate</span>
      <span className="text-white/20">·</span>
      <span>S / ↓ &nbsp; brake</span>
      <span className="text-white/20">·</span>
      <span>A D / ← → &nbsp; steer</span>
    </div>
  );
}
