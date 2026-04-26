const APP_VERSION = "1.0.0 (thesis build)";

const VECTORS = [
  {
    icon: "face",
    color: "text-primary",
    bg: "bg-primary/10",
    hoverBg: "group-hover:bg-primary",
    hoverText: "group-hover:text-on-primary",
    title: "Yawn Detection",
    description:
      "Camera captures mouth-open events using Face Geometry Machine Learning. The system continuously monitors oral aperture dynamics to distinguish drowsiness-induced yawning from normal speech.",
    layer: "Biometric Layer",
    layerColor: "text-primary",
    code: "V-01",
  },
  {
    icon: "arrow_downward",
    color: "text-secondary",
    bg: "bg-secondary/10",
    hoverBg: "group-hover:bg-secondary",
    hoverText: "group-hover:text-on-secondary",
    title: "Head Drop",
    description:
      "Nose-tip position is tracked frame-by-frame. Sudden forward drops indicate nodding off — triggering immediate audio feedback to prevent loss of control before it occurs.",
    layer: "Kinetic Layer",
    layerColor: "text-secondary",
    code: "V-02",
  },
  {
    icon: "rebase_edit",
    color: "text-tertiary",
    bg: "bg-tertiary/10",
    hoverBg: "group-hover:bg-tertiary",
    hoverText: "group-hover:text-on-tertiary",
    title: "Head Tilt",
    description:
      "Sustained lateral tilt beyond 20° for 10 seconds triggers a fatigue warning. Detecting gravitational shifts in posture before they become dangerous steering deviations.",
    layer: "Posture Layer",
    layerColor: "text-tertiary",
    code: "V-03",
  },
  {
    icon: "emergency_home",
    color: "text-error",
    bg: "bg-error-container/30",
    hoverBg: "group-hover:bg-error-container",
    hoverText: "group-hover:text-on-error-container",
    title: "Sudden Brake",
    description:
      "Integrated accelerometer telemetry analyzes deceleration patterns to identify panic responses or delayed reaction times — hallmarks of microsleep-induced driving.",
    layer: "Telemetry Layer",
    layerColor: "text-error",
    code: "V-04",
  },
];

const ALERT_LEVELS = [
  { dot: "bg-emerald-500", label: "Levels 1–5 — Normal, no alert triggered" },
  { dot: "bg-secondary", label: "Levels 6–7 — Caution, voice alert activated" },
  { dot: "bg-orange-500", label: "Level 8 — High alert, pull over advised" },
  { dot: "bg-error", label: "Levels 9–10 — Emergency, EC notified + IoT hardware" },
];

export function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto font-body text-on-surface space-y-20 pb-16">

      {/* ── Hero ── */}
      <section className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-center">
        {/* Left */}
        <div className="flex-1 space-y-6">
          {/* Academic badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-container text-primary text-xs font-bold tracking-widest uppercase font-label">
            <span className="material-symbols-outlined text-sm">school</span>
            Academic Research Project
          </div>

          <h1 className="font-headline text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tighter text-on-surface">
            The Science of{" "}
            <span className="text-primary">Vigilance.</span>
          </h1>

          <p className="text-on-surface-variant text-base sm:text-lg leading-relaxed max-w-xl">
            SnoozeGuard monitors driver fatigue in real time using your phone's front camera and
            motion sensors. When signs of drowsiness are detected, it sounds alerts, vibrates, and
            — at critical levels — automatically notifies your emergency contact with your location.
          </p>

          {/* Tech stack badges */}
          <div className="flex flex-wrap gap-3 pt-2">
            {["Mobile App Framework", "Face Geometry Machine Learning", "Cloud Database", "IoT Hardware"].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant text-xs font-semibold border border-outline-variant/20"
              >
                {tech}
              </span>
            ))}
          </div>

          {/* Version chip */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            <span className="text-xs text-on-surface-variant font-mono">{APP_VERSION}</span>
          </div>
        </div>

        {/* Right: atmospheric card */}
        <div className="flex-1 w-full lg:max-w-sm">
          <div className="relative aspect-square rounded-3xl overflow-hidden bg-surface-container-low">
            {/* Layered glow gradients */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
            {/* Large icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-primary opacity-20"
                style={{ fontSize: "12rem", fontVariationSettings: "'FILL' 1" }}
              >
                shield
              </span>
            </div>
            {/* Overlay text */}
            <div className="absolute bottom-8 left-8 space-y-1 z-10">
              <p className="text-primary font-bold text-xs font-label tracking-widest uppercase">System Core</p>
              <p className="text-2xl font-bold font-headline text-on-surface">Neural Monitoring</p>
              <p className="text-on-surface-variant text-xs max-w-[200px] leading-relaxed">
                Real-time drowsiness detection for safer driving.
              </p>
            </div>
            {/* Corner accent */}
            <div className="absolute top-6 right-6 w-3 h-3 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
      </section>

      {/* ── Detection Vectors ── */}
      <section className="space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="font-headline text-3xl sm:text-4xl font-bold text-on-surface">
            Detection Vectors
          </h2>
          <p className="text-on-surface-variant">
            Our algorithm analyzes four distinct behavioral signals to predict microsleep onset
            before it happens — combining vision AI with inertial telemetry.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {VECTORS.map((v) => (
            <div
              key={v.code}
              className="group bg-surface-container-low p-8 rounded-3xl flex flex-col justify-between min-h-[320px] hover:bg-surface-container-high transition-colors duration-300"
            >
              <div className="space-y-5">
                <div
                  className={`w-14 h-14 rounded-2xl ${v.bg} flex items-center justify-center ${v.color} ${v.hoverBg} ${v.hoverText} transition-all duration-300`}
                >
                  <span className="material-symbols-outlined text-3xl">{v.icon}</span>
                </div>
                <h3 className="font-headline text-2xl font-bold text-on-surface">{v.title}</h3>
                <p className="text-on-surface-variant leading-relaxed text-sm">{v.description}</p>
              </div>
              <div className="pt-6 mt-4 border-t border-outline-variant/15 flex justify-between items-center">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${v.layerColor}`}>
                  {v.layer}
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">{v.code}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Alert Levels ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <h2 className="font-headline text-2xl sm:text-3xl font-bold text-on-surface">Alert Levels</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Drowsiness is scored 0–10. Alerts begin at Level 6 and escalate based on accumulated
            events. Level 9–10 activates emergency contact notification and IoT hardware alerts
            if a device is connected.
          </p>
          <div className="space-y-3 pt-2">
            {ALERT_LEVELS.map((l) => (
              <div key={l.label} className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full shrink-0 ${l.dot}`} />
                <span className="text-on-surface-variant text-sm">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Focus Score */}
        <div className="bg-surface-container-low rounded-3xl p-7 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">bar_chart</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface">Focus Score</h3>
          </div>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Your Focus Score (0–100) is calculated as{" "}
            <code className="font-mono text-primary text-xs bg-primary/10 px-1.5 py-0.5 rounded">
              100 − (avg_drowsiness × 10)
            </code>{" "}
            across all sessions in the selected period.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-surface-container-high rounded-2xl p-4 text-center">
              <p className="font-headline font-black text-2xl text-emerald-500">75+</p>
              <p className="text-xs text-on-surface-variant mt-1">Healthy focus score</p>
            </div>
            <div className="bg-surface-container-high rounded-2xl p-4 text-center">
              <p className="font-headline font-black text-2xl text-error">{"<50"}</p>
              <p className="text-xs text-on-surface-variant mt-1">Consistent drowsiness risk</p>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant italic pt-1">
            A score below 50 means consistent drowsiness — consider adjusting your sleep schedule.
          </p>
        </div>
      </section>

      {/* ── Research Philosophy / Thesis Context ── */}
      <section className="sg-glass-panel rounded-[2rem] p-10 sm:p-14 overflow-hidden relative">
        {/* Decorative bg accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/5 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 space-y-10 max-w-3xl">
          <div className="space-y-3">
            <h2 className="font-headline text-3xl sm:text-4xl font-extrabold text-on-surface">
              Research Philosophy
            </h2>
            <div className="w-20 h-1 bg-primary rounded-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
            <div className="space-y-3">
              <h4 className="text-primary font-bold uppercase text-xs tracking-widest font-label">
                The Problem
              </h4>
              <p className="text-on-surface leading-relaxed italic text-sm sm:text-base">
                "Fatigue accounts for 20% of all motorway accidents. Our research focuses on
                sub-second detection — the critical window where life-saving intervention is
                still possible."
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="text-primary font-bold uppercase text-xs tracking-widest font-label">
                The Methodology
              </h4>
              <p className="text-on-surface-variant leading-relaxed text-sm">
                SnoozeGuard is a thesis project integrating mobile AI (MediaPipe), IoT hardware
                (ESP32-CAM), and cloud infrastructure (Supabase) to provide a complete, real-world
                drowsiness detection solution. The dataset includes diverse lighting scenarios and
                real driving conditions.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              disabled
              className="inline-flex items-center gap-3 bg-primary text-on-primary px-7 py-4 rounded-xl font-headline font-bold text-base hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
              Read Full Thesis
              <span className="material-symbols-outlined">menu_book</span>
            </button>
            <div className="inline-flex items-center gap-2 px-4 py-4 rounded-xl bg-surface-container-high/60 text-on-surface-variant text-sm">
              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                language
              </span>
              Visit SnoozeGuard Website{" "}
              <span className="text-xs text-outline">(coming soon)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="text-center space-y-3 pb-4">
        <div className="flex justify-center gap-3 flex-wrap">
          {[
            { icon: "shield", label: "SnoozeGuard" },
            { icon: "smartphone", label: "Mobile App Framework" },
            { icon: "visibility", label: "Face Geometry Machine Learning" },
            { icon: "cloud", label: "Cloud Database" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-1.5 text-on-surface-variant text-xs"
            >
              <span className="material-symbols-outlined text-sm text-outline">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-outline italic">{APP_VERSION}</p>
      </footer>
    </div>
  );
}
