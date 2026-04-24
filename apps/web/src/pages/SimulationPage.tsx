// SimulationPage.tsx — full-screen driving simulation with wheel/pedal controller

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SimEngine } from "../lib/sim/SimEngine";
import type { SimTickState } from "../lib/sim/SimEngine";
import { GamepadDriver, DEFAULT_MAPPING } from "../lib/sim/GamepadDriver";
import type { AxisMapping } from "../lib/sim/GamepadDriver";

// ── Calibration modal ────────────────────────────────────────────────────────

type CalibStep = "steer" | "throttle" | "brake" | "done";

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

  // Poll gamepad axes live
  useEffect(() => {
    const poll = () => {
      setRawAxes(driver.getRawAxes());
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, [driver]);

  const assignAxis = (axisIndex: number) => {
    const current = rawAxes[axisIndex] ?? 0;
    // Determine invert + range based on current resting value
    // If resting near +1: axis is inverted (rest=+1, press=-1)
    // If resting near -1: normal (rest=-1, press=+1)
    // If resting near 0: standard (-1 to +1, no invert)
    const isInverted = current > 0.6;
    const range: [number, number] = [-1, 1];

    setMapping((prev) => {
      const next = { ...prev };
      if (step === "steer") {
        next.steerAxis = axisIndex;
        next.steerInvert = current > 0.3; // usually not inverted
      } else if (step === "throttle") {
        next.throttleAxis = axisIndex;
        next.throttleInvert = isInverted;
        next.throttleRange = range;
      } else if (step === "brake") {
        next.brakeAxis = axisIndex;
        next.brakeInvert = isInverted;
        next.brakeRange = range;
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
      instruction: "Slowly turn your steering wheel fully left, then right. Click the axis that's moving.",
    },
    throttle: {
      title: "Step 2 / 3 — Accelerator Pedal",
      instruction: "Press the accelerator pedal fully down. Click the axis that changes.",
    },
    brake: {
      title: "Step 3 / 3 — Brake Pedal",
      instruction: "Press the brake pedal fully down. Click the axis that changes.",
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
                {rawAxes.map((val, i) => {
                  const pct = ((val + 1) / 2) * 100;
                  const isAssigned =
                    (step === "throttle" && mapping.steerAxis === i) ||
                    (step === "brake" &&
                      (mapping.steerAxis === i || mapping.throttleAxis === i));
                  return (
                    <button
                      key={i}
                      onClick={() => assignAxis(i)}
                      disabled={isAssigned}
                      className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none rounded-lg p-3 transition-colors text-left group"
                    >
                      <span className="text-xs text-slate-400 w-12 shrink-0 font-mono">
                        Axis {i}
                      </span>
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-400 rounded-full transition-all duration-75"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-12 text-right font-mono shrink-0">
                        {val.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-sky-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        SELECT
                      </span>
                    </button>
                  );
                })}
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SimEngine | null>(null);
  const driverRef = useRef<GamepadDriver>(new GamepadDriver());

  const [tick, setTick] = useState<SimTickState>({
    speedKph: 0,
    gpState: { steer: 0, throttle: 0, brake: 0, connected: false, deviceName: "" },
    gear: "N",
  });

  const [timeOfDay, setTimeOfDay] = useState<"day" | "night">("night");
  const [showCalib, setShowCalib] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Mount the 3D engine once the canvas is available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: SimEngine;
    try {
      engine = new SimEngine(canvas);
      engine.onTick = (state) => setTick(state);
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

  // Push camera mode into engine


  // Push time of day into engine
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
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-3 pb-2 pointer-events-auto">
            {/* Back button */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 rounded-full px-3 py-2 text-white/80 hover:text-white text-xs font-bold transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Exit
            </button>

            {/* Centre: title + controller badge */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black tracking-[0.25em] text-white/40 uppercase">
                SnoozeGuard Sim
              </span>
              <div
                className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  gpState.connected
                    ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                    : "bg-white/5 text-white/30 border-white/10"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${gpState.connected ? "bg-sky-400 animate-pulse" : "bg-white/20"}`}
                />
                {gpState.connected ? "Wheel Connected" : "Keyboard Mode  ↑↓←→"}
              </div>
            </div>

            {/* Right: camera + time of day + settings */}
            <div className="flex items-center gap-2">
              

              {/* Time of day toggle */}
              <div className="flex bg-black/50 backdrop-blur-sm border border-white/10 rounded-full overflow-hidden">
                {(["day", "night"] as const).map((tod) => (
                  <button
                    key={tod}
                    onClick={() => setTimeOfDay(tod)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      timeOfDay === tod
                        ? "bg-sky-500/20 text-sky-400"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {tod === "day" ? "☀️ Day" : "🌙 Night"}
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

          {/* ── Bottom-left: speedometer ──────────────────────────────────────── */}
          <div className="absolute bottom-6 left-6 flex flex-col items-center gap-1 pointer-events-none">
            <SpeedometerArc kph={speedKph} />
            {/* Gear indicator */}
            <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1 text-white font-mono font-black text-lg -mt-1">
              {gear}
            </div>
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
