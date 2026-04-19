import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  level: number;
  title: string;
  actionsSummary: string;
  onDismiss: () => void;
  onRestStop?: () => void;
  flash?: boolean;
  elapsedMs?: number;
  emergencyPhone?: string | null;
  emergencyContactName?: string | null;
};

// ─── Per-level theme ──────────────────────────────────────────────────────────

type LevelTheme = {
  color: string;        // Tailwind text color class
  cardBg: string;       // main alert card bg
  cardBorder: string;
  barColor: string;     // bar fill color class
  glowRgb: string;      // for inline glow style
  urgency: string;
  headlineLines: [string, string];
  body: string;
  hint: string;
};

function getLevelTheme(level: number): LevelTheme {
  if (level >= 10)
    return {
      color: "text-error",
      cardBg: "bg-error-container/80",
      cardBorder: "border-error/30",
      barColor: "bg-error",
      glowRgb: "255,180,171",
      urgency: "CRITICAL EMERGENCY",
      headlineLines: ["STOP THE", "VEHICLE NOW"],
      body: "Critical drowsiness detected. Immediate danger to life. Pull over and stop the vehicle immediately — call for help now.",
      hint: "EMERGENCY — Pull over and rest immediately!",
    };
  if (level >= 9)
    return {
      color: "text-tertiary",
      cardBg: "bg-tertiary-container/90",
      cardBorder: "border-tertiary/20",
      barColor: "bg-tertiary",
      glowRgb: "255,179,173",
      urgency: "IMMEDIATE ACTION REQUIRED",
      headlineLines: ["PULL OVER", "IMMEDIATELY"],
      body: "Severe drowsiness detected. Your reaction time is critically impaired. Find the nearest rest stop or safe location now. Emergency contact will be notified.",
      hint: "Pull over immediately. Emergency contact will be notified.",
    };
  if (level >= 8)
    return {
      color: "text-tertiary",
      cardBg: "bg-tertiary-container/70",
      cardBorder: "border-tertiary/15",
      barColor: "bg-tertiary",
      glowRgb: "255,179,173",
      urgency: "HIGH FATIGUE — TAKE ACTION",
      headlineLines: ["PULL OVER", "SOON"],
      body: "High drowsiness detected. Your alertness is dangerously low. Begin looking for a safe place to stop and rest immediately.",
      hint: "Please pull over and rest now.",
    };
  if (level >= 7)
    return {
      color: "text-secondary",
      cardBg: "bg-secondary-container/40",
      cardBorder: "border-secondary/20",
      barColor: "bg-secondary",
      glowRgb: "255,185,95",
      urgency: "MODERATE FATIGUE",
      headlineLines: ["CONSIDER", "A BREAK"],
      body: "Moderate drowsiness detected. Your attention is fading. Stop at the next available rest area and take at least a 20-minute break.",
      hint: "Consider pulling over and taking a rest break.",
    };
  // level 6 default
  return {
    color: "text-secondary",
    cardBg: "bg-secondary-container/25",
    cardBorder: "border-secondary/15",
    barColor: "bg-secondary",
    glowRgb: "255,185,95",
    urgency: "MILD FATIGUE DETECTED",
    headlineLines: ["STAY", "ALERT"],
    body: "Early drowsiness signals detected. Stay active — open a window, adjust your seating, and remain focused. Plan a rest stop soon.",
    hint: "You can continue driving with caution. Stay active.",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDriveTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

// Five bars at increasing heights — always the same shape, opacity scales with level
const BAR_HEIGHTS = ["22%", "42%", "62%", "82%", "100%"];

// ─── Component ────────────────────────────────────────────────────────────────

export function DrowsinessAlertOverlay({
  open,
  level,
  title,
  actionsSummary,
  onDismiss,
  onRestStop,
  flash,
  elapsedMs,
  emergencyPhone,
  emergencyContactName,
}: Props) {
  const theme = getLevelTheme(level);
  const activeBars = Math.max(1, Math.round((level / 10) * 5));
  const isCritical = level >= 9;
  const isEmergency = level >= 10;

  // EC auto-notify countdown (mirrors mobile: 30s for level ≥9)
  const [ecCountdown, setEcCountdown] = useState<number | null>(null);
  const [ecNotified, setEcNotified] = useState(false);
  const ecIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open || level < 9) {
      if (ecIntervalRef.current) clearInterval(ecIntervalRef.current);
      setEcCountdown(null);
      setEcNotified(false);
      return;
    }
    setEcCountdown(30);
    setEcNotified(false);
    ecIntervalRef.current = setInterval(() => {
      setEcCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (ecIntervalRef.current) clearInterval(ecIntervalRef.current);
          setEcNotified(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (ecIntervalRef.current) clearInterval(ecIntervalRef.current);
    };
  }, [open, level]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Focus trap
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) containerRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const callHref = emergencyPhone ? `tel:${emergencyPhone}` : null;
  const smsHref = emergencyPhone
    ? `sms:${emergencyPhone}?body=URGENT: I triggered a Level ${level} drowsiness alert on SnoozeGuard. Please check on me immediately.`
    : null;
  const contactLabel = emergencyContactName ?? "Emergency Contact";
  const thresholdPct = Math.round(((level - 5) / 5) * 100);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] flex flex-col font-body text-on-surface overflow-hidden"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sg-alert-title"
      aria-describedby="sg-alert-desc"
      tabIndex={-1}
    >
      {/* ── Layered backdrop ── */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-2xl" />
      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 10%, rgba(0,0,0,0.6) 100%)" }}
      />
      {/* Severity glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 70% 45%, rgba(${theme.glowRgb},0.12) 0%, transparent 55%)` }}
      />

      {/* ── Flash bars (level 9–10 with iot_led) ── */}
      {(flash || isEmergency) && (
        <>
          <div className={`pointer-events-none absolute top-0 left-0 right-0 h-2 z-10 ${isEmergency ? "bg-error/80" : "bg-tertiary/70"} animate-pulse`} />
          <div className={`pointer-events-none absolute bottom-0 left-0 right-0 h-2 z-10 ${isEmergency ? "bg-error/80" : "bg-tertiary/70"} animate-pulse`} />
        </>
      )}

      {/* ── Faint header context (dimmed, non-interactive) ── */}
      <div className="relative z-10 flex justify-between items-center px-5 sm:px-8 py-3 sm:py-4 opacity-20 pointer-events-none select-none shrink-0">
        <span className="font-headline font-bold text-primary text-sm tracking-tight">SnoozeGuard</span>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">notifications_active</span>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">account_circle</span>
          <span className="bg-error-container text-error text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
            Emergency Stop
          </span>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-y-auto py-2">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 lg:gap-8 items-stretch my-auto">

          {/* ── Left: Risk card + Drive time ── */}
          <div className="md:col-span-4 flex flex-col gap-4 sm:gap-5">

            {/* Risk level card */}
            <div className="sg-glass-panel rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 lg:p-10 flex flex-col justify-between border border-outline-variant/10 flex-1">
              <div>
                <span className={`font-headline font-bold text-[10px] sm:text-sm tracking-[0.2em] uppercase ${theme.color}`}>
                  Current Risk
                </span>
                <h2
                  id="sg-alert-title"
                  className="font-headline font-extrabold text-4xl sm:text-6xl lg:text-7xl mt-2 sm:mt-3 text-on-surface leading-none"
                >
                  Level {level}
                </h2>
                {title && (
                  <p className={`text-sm font-semibold mt-2 ${theme.color}`}>{title}</p>
                )}
              </div>

              {/* Bar chart */}
              <div className="mt-6 sm:mt-8">
                <div className="flex items-end gap-1.5 sm:gap-2 h-20 sm:h-28 lg:h-32">
                  {BAR_HEIGHTS.map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-all duration-300 ${theme.barColor}`}
                      style={{
                        height: h,
                        opacity: i < activeBars
                          ? 0.25 + (i / (BAR_HEIGHTS.length - 1)) * 0.75
                          : 0.1,
                        boxShadow: i === activeBars - 1
                          ? `0 0 18px rgba(${theme.glowRgb},0.5)`
                          : "none",
                      }}
                    />
                  ))}
                </div>
                <p className="text-on-surface-variant text-[11px] sm:text-sm mt-3 sm:mt-4 font-medium">
                  {level >= 6
                    ? `Fatigue threshold exceeded by ${thresholdPct}%.`
                    : "Monitoring fatigue signals."}
                </p>
              </div>
            </div>

            {/* Drive time card */}
            <div className="sg-glass-panel rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 border border-outline-variant/10 flex items-center gap-4">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-xl sm:text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  timer
                </span>
              </div>
              <div>
                <p className="text-on-surface-variant text-[9px] sm:text-xs uppercase tracking-widest font-medium">Active Drive</p>
                <p className="text-on-surface font-headline font-bold text-lg sm:text-2xl">
                  {elapsedMs != null && elapsedMs > 0 ? formatDriveTime(elapsedMs) : "—"}
                </p>
              </div>
            </div>

            {/* EC section — level ≥9 only, visible on md+ in left column */}
            {isCritical && (
              <div className="hidden md:block sg-glass-panel rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 border border-outline-variant/10">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`material-symbols-outlined text-base ${theme.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    emergency
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.color}`}>
                    Emergency Contact
                  </span>
                </div>

                {!ecNotified && ecCountdown !== null ? (
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Auto-notifying{" "}
                    <span className="font-bold text-on-surface">{contactLabel}</span>{" "}
                    in{" "}
                    <span className={`font-mono font-black text-sm ${theme.color}`}>{ecCountdown}s</span>
                  </p>
                ) : (
                  <p className={`text-xs font-bold ${theme.color}`}>
                    {contactLabel} has been notified.
                  </p>
                )}

                {(callHref || smsHref) && (
                  <div className="flex gap-2 mt-3">
                    {callHref && (
                      <a
                        href={callHref}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-bold text-center flex items-center justify-center gap-1 ${
                          level >= 10
                            ? "bg-error/20 text-error border border-error/30"
                            : "bg-tertiary/20 text-tertiary border border-tertiary/30"
                        } active:scale-95 transition-transform`}
                      >
                        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
                        Call
                      </a>
                    )}
                    {smsHref && (
                      <a
                        href={smsHref}
                        className="flex-1 py-2 rounded-xl text-[10px] font-bold text-center bg-surface-bright text-on-surface border border-outline-variant/15 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                      >
                        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>sms</span>
                        SMS
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEcNotified(true); if (ecIntervalRef.current) clearInterval(ecIntervalRef.current); onRestStop?.(); }}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold ${
                        level >= 10
                          ? "bg-error/20 text-error border border-error/30"
                          : "bg-tertiary/20 text-tertiary border border-tertiary/30"
                      } flex items-center justify-center gap-1 active:scale-95 transition-transform`}
                    >
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
                      Notify
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right: Main instruction + actions ── */}
          <div className="md:col-span-8 flex flex-col gap-4 sm:gap-5">

            {/* Alert message card */}
            <div
              className={`flex-1 ${theme.cardBg} backdrop-blur-3xl rounded-[1.75rem] sm:rounded-[2.5rem] lg:rounded-[3rem] p-7 sm:p-10 lg:p-14 border ${theme.cardBorder} flex flex-col justify-center relative overflow-hidden`}
            >
              {/* Ambient glow blob */}
              <div
                className="absolute -top-20 -right-20 w-48 h-48 sm:w-72 sm:h-72 blur-[80px] pointer-events-none"
                style={{ background: `rgba(${theme.glowRgb},0.15)` }}
              />

              <div className="relative z-10">
                {/* Urgency tag */}
                <div className="flex items-center gap-3 mb-4 sm:mb-6 lg:mb-8">
                  <span
                    className={`material-symbols-outlined text-3xl sm:text-4xl lg:text-5xl ${theme.color}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {isEmergency ? "crisis_alert" : isCritical ? "warning" : level >= 8 ? "warning" : "info"}
                  </span>
                  <span className={`font-headline font-black text-sm sm:text-lg lg:text-xl tracking-tight uppercase italic ${theme.color}`}>
                    {theme.urgency}
                  </span>
                </div>

                {/* Main headline */}
                <h1
                  id="sg-alert-title"
                  className="font-headline font-black leading-none tracking-tighter mb-4 sm:mb-6 text-on-surface"
                  style={{ fontSize: "clamp(2.25rem, 6.5vw, 5.5rem)" }}
                >
                  {theme.headlineLines[0]}
                  <br />
                  {theme.headlineLines[1]}
                </h1>

                {/* Body text */}
                <p
                  id="sg-alert-desc"
                  className={`text-sm sm:text-lg lg:text-xl font-medium max-w-2xl leading-relaxed ${
                    isCritical ? "text-on-tertiary-container" : "text-on-surface-variant"
                  } opacity-90`}
                >
                  {theme.body}
                </p>

                {/* Hint (mobile-matching) */}
                {theme.hint && (
                  <p className={`mt-3 text-xs sm:text-sm font-semibold ${theme.color} opacity-80`}>
                    {theme.hint}
                  </p>
                )}

                {actionsSummary && (
                  <p className="mt-2 text-[10px] font-mono text-on-surface-variant/60">
                    Active responses: {actionsSummary}
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
              {/* I am Awake */}
              <button
                type="button"
                onClick={onDismiss}
                className="group h-16 sm:h-20 lg:h-24 bg-surface-bright hover:bg-surface-container-highest transition-all duration-200 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center gap-1 sm:gap-1.5 border border-outline-variant/10 active:scale-95"
              >
                <span
                  className="material-symbols-outlined text-on-surface group-hover:text-primary transition-colors text-[18px] sm:text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <span className="font-headline font-bold text-on-surface text-[10px] sm:text-sm leading-tight text-center px-1">
                  I am Awake
                </span>
              </button>

              {/* Emergency SOS — pulsing per theme */}
              <button
                type="button"
                onClick={() => { setEcNotified(true); if (ecIntervalRef.current) clearInterval(ecIntervalRef.current); onRestStop?.(); }}
                className="group h-16 sm:h-20 lg:h-24 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center gap-1 sm:gap-1.5 active:scale-95 transition-transform"
                style={{ animation: "sg-sos-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
              >
                <span
                  className="material-symbols-outlined text-white text-[18px] sm:text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  emergency
                </span>
                <span className="font-headline font-bold text-white text-[10px] sm:text-sm leading-tight text-center px-1">
                  Emergency SOS
                </span>
              </button>

              {/* Call Contact */}
              {callHref ? (
                <a
                  href={callHref}
                  className="group h-16 sm:h-20 lg:h-24 bg-surface-bright hover:bg-surface-container-highest transition-all duration-200 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center gap-1 sm:gap-1.5 border border-outline-variant/10 active:scale-95"
                >
                  <span
                    className="material-symbols-outlined text-on-surface group-hover:text-primary transition-colors text-[18px] sm:text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    contact_phone
                  </span>
                  <span className="font-headline font-bold text-on-surface text-[10px] sm:text-sm leading-tight text-center px-1">
                    Call Contact
                  </span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="group h-16 sm:h-20 lg:h-24 bg-surface-bright hover:bg-surface-container-highest transition-all duration-200 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center gap-1 sm:gap-1.5 border border-outline-variant/10 active:scale-95"
                >
                  <span
                    className="material-symbols-outlined text-on-surface group-hover:text-primary transition-colors text-[18px] sm:text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    contact_phone
                  </span>
                  <span className="font-headline font-bold text-on-surface text-[10px] sm:text-sm leading-tight text-center px-1">
                    Call Contact
                  </span>
                </button>
              )}
            </div>

            {/* EC section — mobile layout (shown on small screens only) */}
            {isCritical && (
              <div className="md:hidden sg-glass-panel rounded-[1.5rem] p-4 sm:p-5 border border-outline-variant/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`material-symbols-outlined text-sm ${theme.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    emergency
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.color}`}>Emergency Contact</span>
                </div>
                {!ecNotified && ecCountdown !== null ? (
                  <p className="text-xs text-on-surface-variant">
                    Auto-notifying <span className="font-bold text-on-surface">{contactLabel}</span> in{" "}
                    <span className={`font-mono font-black ${theme.color}`}>{ecCountdown}s</span>
                  </p>
                ) : (
                  <p className={`text-xs font-bold ${theme.color}`}>{contactLabel} has been notified.</p>
                )}
                {(callHref || smsHref) && (
                  <div className="flex gap-2 mt-2">
                    {callHref && (
                      <a href={callHref} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center ${level >= 10 ? "bg-error/20 text-error" : "bg-tertiary/20 text-tertiary"} flex items-center justify-center gap-1`}>
                        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
                        Call
                      </a>
                    )}
                    {smsHref && (
                      <a href={smsHref} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center bg-surface-bright text-on-surface flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>sms</span>
                        SMS
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEcNotified(true); if (ecIntervalRef.current) clearInterval(ecIntervalRef.current); onRestStop?.(); }}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${level >= 10 ? "bg-error/20 text-error" : "bg-tertiary/20 text-tertiary"} flex items-center justify-center gap-1`}
                    >
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
                      Notify
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 flex justify-between items-end px-5 sm:px-8 pb-4 sm:pb-7 pointer-events-none shrink-0">
        <div className="sg-glass-panel px-4 sm:px-6 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl border border-outline-variant/10">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary animate-pulse shrink-0" />
            <span className="text-on-surface font-headline font-bold text-[10px] sm:text-sm whitespace-nowrap">
              AI Guard Tracking Active
            </span>
          </div>
        </div>
        <div className="sg-glass-panel p-1.5 sm:p-2 rounded-full border border-outline-variant/10 flex gap-1.5 sm:gap-2 pointer-events-auto">
          <button type="button" className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-surface-bright text-on-surface hover:text-primary transition-colors active:scale-90">
            <span className="material-symbols-outlined text-[16px] sm:text-[22px]">volume_up</span>
          </button>
          <button type="button" className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-surface-bright text-on-surface hover:text-primary transition-colors active:scale-90">
            <span className="material-symbols-outlined text-[16px] sm:text-[22px]">settings</span>
          </button>
        </div>
      </footer>

      {/* ── Level-adaptive SOS keyframe ── */}
      <style>{`
        @keyframes sg-sos-pulse {
          0%, 100% { background-color: rgb(var(--sg-error-container)); }
          50%       { background-color: rgb(var(--sg-error)); }
        }
      `}</style>
    </div>
  );
}
