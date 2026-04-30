// Generates SnoozeGuard thesis flyer as .pptx (portrait, 8.5x11 — print as PDF)
// Run: node FINAL_THESIS/build_flyer.js

const PptxGenJS = require("C:/Users/Luis/AppData/Roaming/npm/node_modules/pptxgenjs");
const path = require("path");

const pptx = new PptxGenJS();

// Portrait 8.5 x 11 inches
pptx.defineLayout({ name: "FLYER", width: 8.5, height: 11 });
pptx.layout = "FLYER";

const C = {
  navy:   "1B2A4A",
  blue:   "2563EB",
  accent: "38BDF8",
  white:  "FFFFFF",
  light:  "EFF6FF",
  gray:   "64748B",
  dark:   "0F172A",
  green:  "16A34A",
  orange: "EA580C",
  red:    "DC2626",
  yellow: "FBBF24",
};

function rect(s, x, y, w, h, fill, opts = {}) {
  s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: fill }, line: opts.line || { color: fill }, ...opts });
}

function txt(s, text, x, y, w, h, opts = {}) {
  s.addText(text, { x, y, w, h, fontFace: "Calibri", wrap: true, ...opts });
}

// ═══════════════════════════════════════════════════════════════════
// FLYER 1 — Main Research Flyer (Academic / Panel Presentation)
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();

  // Full background
  rect(s, 0, 0, 8.5, 11, C.navy);

  // Top hero band
  rect(s, 0, 0, 8.5, 3.6, C.blue);

  // Diagonal accent cut on hero
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 3.3, w: 8.5, h: 0.35, fill: { color: C.accent }, line: { color: C.accent } });

  // School header strip
  rect(s, 0, 0, 8.5, 0.45, C.navy);
  txt(s, "DIVINE WORD COLLEGE OF CALAPAN  ·  School of Engineering  ·  BS Computer Engineering",
    0, 0.05, 8.5, 0.35, { fontSize: 9, color: C.accent, align: "center", bold: false });

  // Eye icon decoration (circular shapes)
  s.addShape(pptx.ShapeType.ellipse, { x: 0.35, y: 0.65, w: 1.1, h: 1.1, fill: { color: "1E3A6E" }, line: { color: "1E3A6E" } });
  s.addShape(pptx.ShapeType.ellipse, { x: 0.55, y: 0.85, w: 0.7, h: 0.7, fill: { color: C.accent }, line: { color: C.accent } });
  s.addShape(pptx.ShapeType.ellipse, { x: 0.72, y: 1.02, w: 0.36, h: 0.36, fill: { color: C.navy }, line: { color: C.navy } });

  s.addShape(pptx.ShapeType.ellipse, { x: 7.05, y: 0.65, w: 1.1, h: 1.1, fill: { color: "1E3A6E" }, line: { color: "1E3A6E" } });
  s.addShape(pptx.ShapeType.ellipse, { x: 7.25, y: 0.85, w: 0.7, h: 0.7, fill: { color: C.accent }, line: { color: C.accent } });
  s.addShape(pptx.ShapeType.ellipse, { x: 7.42, y: 1.02, w: 0.36, h: 0.36, fill: { color: C.navy }, line: { color: C.navy } });

  // Title
  txt(s, "SnoozeGuard", 0.3, 0.55, 7.9, 1.5,
    { fontSize: 52, bold: true, color: C.white, align: "center" });

  txt(s, "AI-Driven Real-Time Driver Drowsiness\nMonitoring & Alert System", 0.3, 1.95, 7.9, 1.1,
    { fontSize: 17, color: C.accent, align: "center", bold: false });

  txt(s, "Prototype Development for Road Safety", 0.3, 2.9, 7.9, 0.45,
    { fontSize: 12, color: "CBD5E1", align: "center", italic: true });

  // Accent divider
  rect(s, 0.5, 3.72, 7.5, 0.06, C.accent);

  // ── What is SnoozeGuard? ─────────────────────────────────────────
  txt(s, "WHAT IS SNOOZEGUARD?", 0.4, 3.88, 7.7, 0.35,
    { fontSize: 11, bold: true, color: C.accent, charSpacing: 2 });

  txt(s,
    "SnoozeGuard is a multi-platform AI system that uses your smartphone's front camera and Google's MediaPipe to detect drowsiness in real time while driving — without any vehicle modification.",
    0.4, 4.22, 7.7, 0.75,
    { fontSize: 12.5, color: "CBD5E1", align: "left" });

  // ── Detection Signals ────────────────────────────────────────────
  txt(s, "HOW IT DETECTS DROWSINESS", 0.4, 5.05, 7.7, 0.35,
    { fontSize: 11, bold: true, color: C.accent, charSpacing: 2 });

  const signals = [
    { icon: "😮", label: "Yawn Detection",       detail: "jawOpen blend shape ≥ 0.70" },
    { icon: "😴", label: "Head Nodding",         detail: "Pitch/Roll threshold breach" },
    { icon: "↗️", label: "Sustained Tilt",       detail: "10 seconds off-center" },
    { icon: "🛑", label: "Sudden Brake",         detail: "Accelerometer delta > 0.45g" },
  ];

  signals.forEach((sig, i) => {
    const x = 0.4 + i * 1.92;
    rect(s, x, 5.42, 1.72, 1.05, "1E3A6E");
    txt(s, sig.icon, x, 5.47, 1.72, 0.42, { fontSize: 22, align: "center" });
    txt(s, sig.label, x, 5.88, 1.72, 0.3, { fontSize: 9.5, bold: true, color: C.white, align: "center" });
    txt(s, sig.detail, x, 6.17, 1.72, 0.28, { fontSize: 8.5, color: C.accent, align: "center" });
  });

  // ── Alert Levels ─────────────────────────────────────────────────
  txt(s, "10-LEVEL ALERT ESCALATION", 0.4, 6.6, 7.7, 0.35,
    { fontSize: 11, bold: true, color: C.accent, charSpacing: 2 });

  const alertLevels = [
    { label: "1–2",  desc: "Voice",                color: "22C55E" },
    { label: "3–5",  desc: "Voice + Vibration\n+ Alarm", color: C.yellow },
    { label: "6–8",  desc: "All above\n+ IoT Device", color: C.orange },
    { label: "9–10", desc: "All above\n+ Emergency SMS", color: C.red },
  ];

  alertLevels.forEach((al, i) => {
    const x = 0.4 + i * 1.92;
    rect(s, x, 6.97, 1.72, 1.05, al.color);
    txt(s, `Level ${al.label}`, x, 7.02, 1.72, 0.32, { fontSize: 11, bold: true, color: C.white, align: "center" });
    txt(s, al.desc, x, 7.34, 1.72, 0.62, { fontSize: 9.5, color: C.white, align: "center" });
  });

  // ── IoT Device strip ─────────────────────────────────────────────
  rect(s, 0, 8.1, 8.5, 0.55, "1E3A6E");
  txt(s, "📡  ESP32 IoT Alert Device  ·  MQTT HiveMQ TLS  ·  BLE Fallback  ·  DFPlayer MP3  ·  Physical Dismiss Button",
    0.2, 8.17, 8.1, 0.4, { fontSize: 10.5, color: C.white, align: "center" });

  // ── Tech Stack pills ─────────────────────────────────────────────
  txt(s, "BUILT WITH", 0.4, 8.75, 7.7, 0.3,
    { fontSize: 10, bold: true, color: C.accent, charSpacing: 2 });

  const tech = ["React Native", "MediaPipe", "Supabase", "ESP32", "HiveMQ MQTT", "PhilSMS", "Firebase", "Railway"];
  const techColors = [C.blue, C.green, C.green, C.orange, C.blue, C.red, C.orange, C.gray];

  tech.forEach((t, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.4 + col * 1.92;
    const y = 9.08 + row * 0.48;
    rect(s, x, y, 1.72, 0.35, techColors[i]);
    txt(s, t, x, y + 0.04, 1.72, 0.28, { fontSize: 9.5, bold: true, color: C.white, align: "center" });
  });

  // ── Authors strip ────────────────────────────────────────────────
  rect(s, 0, 10.1, 8.5, 0.9, C.navy);
  rect(s, 0, 10.1, 8.5, 0.04, C.accent);

  txt(s, "RESEARCHERS", 0.4, 10.17, 7.7, 0.28,
    { fontSize: 9, bold: true, color: C.accent, align: "center", charSpacing: 2 });
  txt(s, "Cart Jeuiel T. Agno   ·   Aira Mae T. Pilor   ·   Christian Eduard B. Ylagan Jr.",
    0.4, 10.45, 7.7, 0.28, { fontSize: 11, color: C.white, align: "center" });
  txt(s, "Research Adviser: Engr. Jezer E. Ilao   ·   2025–2026",
    0.4, 10.73, 7.7, 0.25, { fontSize: 10, color: "94A3B8", align: "center" });
}

// ═══════════════════════════════════════════════════════════════════
// FLYER 2 — System Flow Flyer (How It Works)
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();

  rect(s, 0, 0, 8.5, 11, C.white);
  rect(s, 0, 0, 8.5, 1.8, C.navy);
  rect(s, 0, 1.8, 8.5, 0.07, C.accent);
  rect(s, 0, 10.93, 8.5, 0.07, C.blue);

  txt(s, "SnoozeGuard", 0.3, 0.18, 7.9, 0.9,
    { fontSize: 38, bold: true, color: C.white, align: "center" });
  txt(s, "HOW IT WORKS", 0.3, 1.02, 7.9, 0.5,
    { fontSize: 15, color: C.accent, align: "center", charSpacing: 4 });

  // Step flow
  const steps = [
    {
      n: "01", color: C.blue,
      title: "Camera Captures Face",
      body: "The smartphone front camera takes a snapshot every 600ms. MediaPipe Face Landmarker processes 478 facial landmarks and 52 blend shape coefficients on the device — no internet required for detection.",
    },
    {
      n: "02", color: C.navy,
      title: "Signals Are Detected",
      body: "Four drowsiness signals are extracted: yawning (jawOpen ≥ 0.70), head nodding (pitch/roll threshold), sustained head tilt (10 seconds), and sudden braking (accelerometer delta > 0.45g).",
    },
    {
      n: "03", color: C.orange,
      title: "Drowsiness Level Computed",
      body: "Yawn and head movement counts feed into a configurable 10-level scoring engine. The administrator can tune thresholds per level via the Admin Config screen.",
    },
    {
      n: "04", color: C.orange,
      title: "Graduated Alerts Fire",
      body: "Levels 1–5: Voice + vibration on the smartphone.\nLevels 6–8: Additionally activates the ESP32 IoT alert device (MP3 audio, vibration pulses, LED).\nLevels 9–10: All of the above + 120-second emergency countdown.",
    },
    {
      n: "05", color: C.red,
      title: "Emergency Notification Sent",
      body: "If the driver does not dismiss the alert within 120 seconds, an Expo push notification and a PhilSMS text message are automatically sent to the driver's designated emergency contact with the driver's GPS location.",
    },
    {
      n: "06", color: C.green,
      title: "Guardian Responds",
      body: "The emergency contact opens the SnoozeGuard app, sees the driver's live location on a map, and can acknowledge or dismiss the alert — completing the safety loop.",
    },
  ];

  steps.forEach((step, i) => {
    const y = 2.05 + i * 1.45;
    // Number badge
    rect(s, 0.3, y, 0.65, 0.65, step.color);
    txt(s, step.n, 0.3, y + 0.1, 0.65, 0.45, { fontSize: 18, bold: true, color: C.white, align: "center" });
    // Connector line
    if (i < steps.length - 1) {
      s.addShape(pptx.ShapeType.line, { x: 0.625, y: y + 0.68, w: 0, h: 0.77, line: { color: "CBD5E1", width: 1.5 } });
    }
    // Content
    txt(s, step.title, 1.15, y, 7.1, 0.42, { fontSize: 14, bold: true, color: step.color });
    txt(s, step.body, 1.15, y + 0.42, 7.1, 0.95, { fontSize: 11.5, color: C.dark });
  });

  // Bottom banner
  rect(s, 0, 10.55, 8.5, 0.45, C.navy);
  txt(s, "Cart Jeuiel T. Agno  ·  Aira Mae T. Pilor  ·  Christian Eduard B. Ylagan Jr.  ·  DWCC School of Engineering  ·  2025–2026",
    0.2, 10.6, 8.1, 0.35, { fontSize: 9, color: "94A3B8", align: "center" });
}

// ═══════════════════════════════════════════════════════════════════
// FLYER 3 — IoT Device Spotlight
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();

  rect(s, 0, 0, 8.5, 11, C.light);
  rect(s, 0, 0, 8.5, 0.06, C.blue);
  rect(s, 0, 10.94, 8.5, 0.06, C.accent);

  // Header
  rect(s, 0, 0.06, 8.5, 2.3, C.orange);
  txt(s, "IoT Alert Device", 0.3, 0.25, 7.9, 1.1,
    { fontSize: 40, bold: true, color: C.white, align: "center" });
  txt(s, "ESP32-Based Physical Alert Peripheral", 0.3, 1.25, 7.9, 0.45,
    { fontSize: 15, color: "FED7AA", align: "center" });
  txt(s, "SnoozeGuard — Hardware Component", 0.3, 1.72, 7.9, 0.38,
    { fontSize: 11, color: "FFF7ED", align: "center", italic: true });

  rect(s, 0, 2.36, 8.5, 0.06, C.accent);

  // Hardware specs
  txt(s, "HARDWARE COMPONENTS", 0.4, 2.55, 7.7, 0.32,
    { fontSize: 10.5, bold: true, color: C.orange, charSpacing: 2 });

  const hw = [
    ["ESP32 DevKit",       "Dual-core 240MHz · WiFi + BLE + GPIO"],
    ["DFPlayer Mini",      "UART2 (GPIO 16/17) · Plays 0001–0005.mp3 from MicroSD"],
    ["3W Speaker",         "Connected to DFPlayer for audio alert output"],
    ["Buzzer (GPIO 26)",   "Continuous or pulsed vibration alert"],
    ["LED × 2 (27, 32)",   "Alert indicator — pulsed, continuous, or flashing"],
    ["BLE LED (GPIO 33)",  "Bluetooth connection status indicator"],
    ["Dismiss Button",     "GPIO 25 · INPUT_PULLUP · 200ms debounce"],
  ];

  hw.forEach((h, i) => {
    const y = 2.92 + i * 0.52;
    rect(s, 0.35, y, 2.3, 0.38, C.orange, { rounding: 0.05 });
    txt(s, h[0], 0.35, y + 0.06, 2.3, 0.28, { fontSize: 10.5, bold: true, color: C.white, align: "center" });
    txt(s, h[1], 2.8, y + 0.07, 5.35, 0.28, { fontSize: 11, color: C.dark });
  });

  rect(s, 0.35, 6.6, 7.8, 0.05, C.accent);

  // Alert behavior table
  txt(s, "ALERT BEHAVIOR BY DROWSINESS LEVEL", 0.4, 6.73, 7.7, 0.32,
    { fontSize: 10.5, bold: true, color: C.orange, charSpacing: 2 });

  const rows = [
    ["Level", "Audio",       "Vibration Pattern",                   "LED",                C.navy],
    ["6",     "0001.mp3",    "3 short pulses (200ms on/150ms off)", "Pulsed",             C.green],
    ["7",     "0002.mp3",    "3 medium pulses (400ms on/150ms off)","Pulsed",             "84CC16"],
    ["8",     "0003.mp3",    "3 long pulses (600ms on/150ms off)",  "Pulsed",             C.yellow],
    ["9",     "0004.mp3",    "Continuous buzzer",                   "Continuous on",      C.orange],
    ["10",    "0005.mp3",    "Continuous buzzer",                   "Flashing (400ms)",   C.red],
  ];

  rows.forEach((row, ri) => {
    const y = 7.1 + ri * 0.5;
    const isHeader = ri === 0;
    const widths = [0.6, 1.2, 3.5, 1.8];
    const xs = [0.35, 0.95, 2.15, 5.65];
    row.slice(0, 4).forEach((cell, ci) => {
      rect(s, xs[ci], y, widths[ci], 0.42, isHeader ? row[4] : (ri % 2 === 0 ? "DBEAFE" : C.white));
      txt(s, cell, xs[ci] + 0.05, y + 0.08, widths[ci] - 0.1, 0.28,
        { fontSize: isHeader ? 10 : 10.5, bold: isHeader, color: isHeader ? C.white : C.dark, align: isHeader ? "center" : "left" });
    });
    // Color swatch for level
    if (!isHeader) {
      rect(s, 7.45, y + 0.06, 0.5, 0.3, row[4]);
    }
  });

  // Dismiss button callout
  rect(s, 0.35, 10.15, 7.8, 0.65, C.navy);
  txt(s, "🔘  Physical Dismiss Button — Press to stop all alerts\nPublishes MQTT + BLE NOTIFY → syncs dismiss state to mobile app and web dashboard",
    0.55, 10.2, 7.4, 0.55, { fontSize: 10.5, color: C.white });

  // Footer
  txt(s, "SnoozeGuard  ·  DWCC School of Engineering  ·  BS Computer Engineering  ·  2025–2026",
    0.3, 10.85, 7.9, 0.25, { fontSize: 9, color: C.gray, align: "center" });
}

// ═══════════════════════════════════════════════════════════════════
// Write
// ═══════════════════════════════════════════════════════════════════
const outPath = path.join(__dirname, "snooze_guard_flyers.pptx");
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log("snooze_guard_flyers.pptx written to", outPath);
});
