// Generates SnoozeGuard thesis presentation as .pptx
// Run: node FINAL_THESIS/build_pptx.js

const PptxGenJS = require("C:/Users/Luis/AppData/Roaming/npm/node_modules/pptxgenjs");
const path = require("path");
const fs = require("fs");

const pptx = new PptxGenJS();

// ── Theme ────────────────────────────────────────────────────────────────────
const C = {
  navy:    "1B2A4A",
  blue:    "2563EB",
  accent:  "38BDF8",
  white:   "FFFFFF",
  light:   "F0F6FF",
  gray:    "64748B",
  dark:    "0F172A",
  green:   "16A34A",
  orange:  "EA580C",
  red:     "DC2626",
};

pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

// ── Helpers ──────────────────────────────────────────────────────────────────
function addSlide(opts = {}) {
  const slide = pptx.addSlide();
  // Background
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: "100%",
    fill: { color: opts.dark ? C.navy : C.white },
  });
  // Accent bar top
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: 0.08,
    fill: { color: C.blue },
  });
  // Accent bar bottom
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.42, w: "100%", h: 0.08,
    fill: { color: C.accent },
  });
  return slide;
}

function heading(slide, text, y = 0.3, color = C.navy, size = 28) {
  slide.addText(text, {
    x: 0.5, y, w: 12.33, h: 0.6,
    fontSize: size, bold: true, color,
    fontFace: "Calibri",
  });
}

function subheading(slide, text, y, color = C.blue) {
  slide.addText(text, {
    x: 0.5, y, w: 12.33, h: 0.4,
    fontSize: 16, bold: true, color,
    fontFace: "Calibri",
  });
}

function body(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontSize: opts.size || 13,
    color: opts.color || C.dark,
    fontFace: "Calibri",
    bullet: opts.bullet || false,
    bold: opts.bold || false,
    align: opts.align || "left",
    valign: opts.valign || "top",
    wrap: true,
    ...opts,
  });
}

function divider(slide, y) {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.5, y, w: 12.33, h: 0,
    line: { color: C.accent, width: 1.5 },
  });
}

function box(slide, x, y, w, h, fillColor, text, textColor = C.white, size = 13) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    fill: { color: fillColor },
    line: { color: fillColor },
    rounding: 0.1,
  });
  if (text) {
    slide.addText(text, {
      x, y, w, h,
      fontSize: size, color: textColor, bold: true,
      fontFace: "Calibri", align: "center", valign: "middle",
    });
  }
}

function pill(slide, x, y, text, color) {
  box(slide, x, y, 2.2, 0.42, color, text, C.white, 11);
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide({ dark: true });

  // Large navy background already set; add gradient feel
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: "100%",
    fill: { color: C.navy },
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.12, h: "100%",
    fill: { color: C.blue },
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: 0.08,
    fill: { color: C.accent },
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.42, w: "100%", h: 0.08,
    fill: { color: C.accent },
  });

  s.addText("SnoozeGuard", {
    x: 0.5, y: 0.9, w: 12.33, h: 1.1,
    fontSize: 54, bold: true, color: C.white,
    fontFace: "Calibri", align: "center",
  });
  s.addText("Prototype Development of an AI-Driven\nReal-Time Drowsiness Monitoring System for Road Safety", {
    x: 0.5, y: 2.0, w: 12.33, h: 1.0,
    fontSize: 20, color: C.accent,
    fontFace: "Calibri", align: "center",
  });

  s.addShape(pptx.ShapeType.line, {
    x: 3.5, y: 3.15, w: 6.33, h: 0,
    line: { color: C.blue, width: 1.5 },
  });

  s.addText("Cart Jeuiel T. Agno  ·  Aira Mae T. Pilor  ·  Christian Eduard B. Ylagan Jr.", {
    x: 0.5, y: 3.35, w: 12.33, h: 0.4,
    fontSize: 14, color: C.white,
    fontFace: "Calibri", align: "center",
  });
  s.addText("Research Adviser: Engr. Jezer E. Ilao", {
    x: 0.5, y: 3.82, w: 12.33, h: 0.35,
    fontSize: 13, color: C.accent,
    fontFace: "Calibri", align: "center",
  });
  s.addText("Divine Word College of Calapan  ·  School of Engineering  ·  BS Computer Engineering  ·  2025–2026", {
    x: 0.5, y: 6.9, w: 12.33, h: 0.35,
    fontSize: 11, color: C.gray,
    fontFace: "Calibri", align: "center",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Outline
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Presentation Outline");
  divider(s, 1.05);

  const items = [
    ["01", "Background & Problem", C.blue],
    ["02", "Objectives of the Study", C.blue],
    ["03", "System Overview", C.navy],
    ["04", "Detection Algorithm", C.navy],
    ["05", "Alert Escalation System", C.orange],
    ["06", "IoT Alert Device", C.orange],
    ["07", "Emergency Notification", C.red],
    ["08", "Methodology & Evaluation", C.green],
    ["09", "Results & Conclusions", C.green],
  ];

  items.forEach(([num, label, color], i) => {
    const col = i < 5 ? 0 : 1;
    const row = i < 5 ? i : i - 5;
    const x = col === 0 ? 0.5 : 6.8;
    const y = 1.25 + row * 1.05;
    box(s, x, y, 0.55, 0.55, color, num, C.white, 14);
    s.addText(label, {
      x: x + 0.65, y: y + 0.08, w: 5.5, h: 0.4,
      fontSize: 14, color: C.dark, fontFace: "Calibri",
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Background
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Background");
  divider(s, 1.05);

  const points = [
    "Drowsy driving contributes to ~20% of all motorway accidents (Horne & Reyner, 1995)",
    "WHO (2023): road traffic injuries are the 8th leading cause of death globally",
    "Microsleep episodes (3–30 seconds) cause vehicles to travel 100+ meters uncontrolled",
    "Commercial Driver Monitoring Systems (DMS) are prohibitively expensive for most drivers",
    "Smartphone-based detection offers an accessible, vehicle-agnostic alternative",
    "No existing low-cost system combines multi-signal detection + IoT alerts + emergency notification",
  ];

  points.forEach((pt, i) => {
    const y = 1.2 + i * 0.9;
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: y + 0.1, w: 0.08, h: 0.08,
      fill: { color: C.blue },
    });
    body(s, pt, 0.75, y, 11.8, 0.75, { size: 13.5 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Statement of the Problem
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Statement of the Problem");
  divider(s, 1.05);

  const problems = [
    ["1", "How can a smartphone reliably detect drowsiness using multiple physiological signals (yawn, head nod, tilt, brake)?"],
    ["2", "How can drowsiness severity be quantified into a 10-level model driving proportional alert responses?"],
    ["3", "How can a low-cost IoT device augment alerts with audio, vibration, and LED patterns per level?"],
    ["4", "How can an emergency pipeline reliably notify a guardian even under intermittent connectivity?"],
    ["5", "To what extent does SnoozeGuard meet ISO/IEC 25010 software quality requirements?"],
  ];

  problems.forEach(([num, text], i) => {
    const y = 1.2 + i * 1.1;
    box(s, 0.5, y, 0.5, 0.5, C.blue, num, C.white, 16);
    body(s, text, 1.15, y, 11.5, 0.7, { size: 13 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Objectives
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Objectives of the Study");
  divider(s, 1.05);
  subheading(s, "General Objective", 1.15);
  body(s, "To design, develop, and evaluate SnoozeGuard — a multi-platform AI-driven real-time drowsiness monitoring system — capable of detecting driver fatigue, delivering graduated alerts, and triggering emergency contact notifications at critical levels.", 0.5, 1.55, 12.33, 0.85, { size: 13 });
  subheading(s, "Specific Objectives", 2.45);

  const objs = [
    "Implement multi-signal detection: yawn (jawOpen blend shape), head nod (pitch/roll), sustained tilt (10s), sudden brake (accelerometer)",
    "Develop a configurable 10-level drowsiness scoring model with administrator-controlled thresholds",
    "Build an ESP32 IoT alert device with MQTT + BLE communication and level-specific audio/vibration/LED patterns",
    "Implement an emergency notification pipeline via Expo Push + PhilSMS SMS to the active emergency contact",
    "Implement an offline-first SQLite architecture with automatic Supabase cloud synchronization",
    "Evaluate the system against ISO/IEC 25010 across 8 quality characteristics",
  ];

  objs.forEach((obj, i) => {
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 2.9 + i * 0.73 + 0.12, w: 0.08, h: 0.08,
      fill: { color: C.accent },
    });
    body(s, obj, 0.75, 2.9 + i * 0.73, 11.8, 0.65, { size: 12.5 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — System Architecture Overview
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "System Architecture Overview");
  divider(s, 1.05);

  const tiers = [
    { label: "Mobile App\n(React Native / Expo SDK 54)", color: C.blue,   x: 0.4,  y: 1.3 },
    { label: "Web Dashboard\n(React + Vite / Firebase)", color: C.navy,   x: 3.4,  y: 1.3 },
    { label: "IoT Alert Device\n(ESP32 + DFPlayer Mini)", color: C.orange, x: 6.4,  y: 1.3 },
    { label: "IoT API + MQTT Bridge\n(Node.js / Hono / Railway)", color: C.green,  x: 9.4,  y: 1.3 },
  ];

  tiers.forEach(t => {
    box(s, t.x, t.y, 2.8, 1.1, t.color, t.label, C.white, 12);
  });

  // Arrow down
  [0.4, 3.4, 6.4, 9.4].forEach(x => {
    s.addShape(pptx.ShapeType.line, {
      x: x + 1.4, y: 2.45, w: 0, h: 0.35,
      line: { color: C.gray, width: 1.5 },
    });
  });

  // Central backend box
  box(s, 1.8, 2.85, 9.73, 0.9, C.navy, "Supabase Cloud Backend  (PostgreSQL · Auth · Realtime · Edge Functions)", C.white, 14);

  // MQTT
  box(s, 0.4, 4.05, 3.8, 0.7, C.accent, "MQTT Broker — HiveMQ Cloud TLS 8883", C.white, 12);
  box(s, 4.5, 4.05, 3.8, 0.7, C.blue, "SMS — PhilSMS via Supabase Edge Function", C.white, 12);
  box(s, 8.6, 4.05, 4.2, 0.7, C.green, "Push Notifications — Expo Push (APNs / FCM)", C.white, 12);

  subheading(s, "Deployment", 5.05);
  const deps = [
    ["Mobile", "Expo EAS (expo.dev)", C.blue],
    ["Web", "Firebase Hosting", C.orange],
    ["API", "Railway", C.green],
    ["Backend", "Supabase", C.navy],
    ["MQTT", "HiveMQ Cloud", C.accent],
    ["SMS", "PhilSMS", C.red],
  ];
  deps.forEach((d, i) => {
    const x = 0.4 + i * 2.1;
    box(s, x, 5.45, 1.6, 0.38, d[2], d[0], C.white, 10);
    body(s, d[1], x, 5.88, 1.6, 0.35, { size: 10, color: C.gray, align: "center" });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Detection Algorithm
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Drowsiness Detection Algorithm");
  divider(s, 1.05);

  subheading(s, "MediaPipe Face Landmarker", 1.15, C.blue);
  body(s, "478 facial landmarks + 52 blend shape coefficients  ·  Mobile: IMAGE mode @ 600ms  ·  Web: VIDEO mode @ 130ms (WASM)", 0.5, 1.55, 12.33, 0.5, { size: 12.5, color: C.gray });

  const signals = [
    { title: "Yawn Detection", detail: "jawOpen blend shape ≥ 0.70 → open\njawOpen ≤ 0.40 → yawn confirmed\nCooldown: 2,000ms", color: C.blue },
    { title: "Head Nodding", detail: "Pitch > 0.35 or Roll > 0.25 rad\nFires on centered→offCenter transition\nCooldown: 500ms", color: C.navy },
    { title: "Sustained Tilt", detail: "Off-center for ≥ 10 seconds\n(4 grace frames allowed)\n→ Independent Level 8 alert modal", color: C.orange },
    { title: "Sudden Brake", detail: "Accelerometer delta > 0.45 g\n2 qualifying events within 3,000ms\n→ Independent brake alert modal", color: C.red },
  ];

  signals.forEach((sig, i) => {
    const x = 0.4 + i * 3.1;
    box(s, x, 2.2, 2.85, 0.5, sig.color, sig.title, C.white, 13);
    body(s, sig.detail, x, 2.75, 2.85, 1.3, { size: 11.5, color: C.dark });
  });

  divider(s, 4.2);
  subheading(s, "Drowsiness Level Computation", 4.3, C.navy);
  box(s, 0.5, 4.72, 12.33, 0.55, C.light, "computeLevelFromAlertMap( yawnAcc, headAcc, alertMap )  →  Level 0–10", C.navy, 14);
  body(s, "For each level 1→10: if yawnAcc ≥ threshold OR headAcc ≥ threshold → set computedLevel. Returns highest matched level. Thresholds are administrator-configurable via Admin Config screen.", 0.5, 5.35, 12.33, 0.65, { size: 12, color: C.gray });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Alert Escalation
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Alert Escalation System");
  divider(s, 1.05);

  const levels = [
    { range: "Levels 1–2", label: "Very Low / Low",     actions: "Voice warning",                                   color: "#22C55E" },
    { range: "Levels 3–4", label: "Mild / Moderate",    actions: "Voice + Vibration",                               color: "#84CC16" },
    { range: "Level 5",    label: "Moderate-High",       actions: "Voice + Vibration + Alarm",                      color: "#EAB308" },
    { range: "Levels 6–8", label: "High / Severe",       actions: "Voice + Vibration + Alarm + IoT Device",         color: "#F97316" },
    { range: "Levels 9–10",label: "Critical / Extreme",  actions: "All above + Emergency Notification (120s timer)", color: C.red },
  ];

  levels.forEach((lv, i) => {
    const y = 1.2 + i * 1.1;
    s.addShape(pptx.ShapeType.rect, {
      x: 0.4, y, w: 2.2, h: 0.85,
      fill: { color: lv.color }, line: { color: lv.color },
    });
    s.addText(lv.range, { x: 0.4, y: y + 0.05, w: 2.2, h: 0.4, fontSize: 13, bold: true, color: C.white, fontFace: "Calibri", align: "center" });
    s.addText(lv.label,  { x: 0.4, y: y + 0.45, w: 2.2, h: 0.35, fontSize: 11, color: C.white, fontFace: "Calibri", align: "center" });
    body(s, lv.actions, 2.75, y + 0.2, 10.2, 0.5, { size: 13 });
  });

  divider(s, 6.8);
  body(s, "Dismiss Guard: dismissedLevelsRef prevents same level re-firing per session  ·  Level 10 re-triggers after 3 more yawns or 10 more head events", 0.5, 6.88, 12.33, 0.4, { size: 11, color: C.gray });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — IoT Alert Device
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "IoT Alert Device — ESP32");
  divider(s, 1.05);

  subheading(s, "Hardware Components", 1.15, C.blue);
  const hw = [
    "ESP32 DevKit — WiFi + BLE + GPIO (240MHz dual-core)",
    "DFPlayer Mini — UART2 (GPIO 16/17) — plays 0001–0005.mp3 from MicroSD",
    "Buzzer (GPIO 26) · LED Primary (GPIO 27) · LED Secondary (GPIO 32) · BLE LED (GPIO 33)",
    "Dismiss Button — GPIO 25, INPUT_PULLUP, 200ms debounce",
  ];
  hw.forEach((h, i) => {
    s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.58 + i * 0.45 + 0.12, w: 0.08, h: 0.08, fill: { color: C.blue } });
    body(s, h, 0.75, 1.55 + i * 0.45, 11.5, 0.42, { size: 12.5 });
  });

  divider(s, 3.55);
  subheading(s, "Alert Behavior by Level", 3.65, C.orange);

  const tblData = [
    ["Level", "MP3 Track", "Vibration Pattern", "LED"],
    ["6", "0001.mp3", "3 short pulses (200ms on / 150ms off)", "Pulsed"],
    ["7", "0002.mp3", "3 medium pulses (400ms on / 150ms off)", "Pulsed"],
    ["8", "0003.mp3", "3 long pulses (600ms on / 150ms off)", "Pulsed"],
    ["9", "0004.mp3", "Continuous buzzer", "Continuous on"],
    ["10", "0005.mp3", "Continuous buzzer", "Flashing (400ms on/off)"],
  ];

  s.addTable(tblData.map((row, ri) => row.map(cell => ({
    text: cell,
    options: {
      bold: ri === 0,
      fontSize: 12,
      fontFace: "Calibri",
      color: ri === 0 ? C.white : C.dark,
      fill: ri === 0 ? C.navy : ri % 2 === 0 ? "EEF4FF" : C.white,
      align: "center",
    },
  }))), { x: 0.5, y: 4.05, w: 12.33, h: 2.8, border: { type: "solid", color: "CCCCCC", pt: 0.5 } });

  body(s, "Dismiss button → MQTT publish snoozeguard/dismiss/{device_id} + BLE NOTIFY {event:dismiss} → server updates iot_alerts.status → Supabase Realtime → mobile dismiss", 0.5, 6.95, 12.33, 0.4, { size: 11, color: C.gray });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Connectivity
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "IoT Connectivity & Communication");
  divider(s, 1.05);

  box(s, 0.4,  1.3, 3.8, 2.5, C.blue,  "Mobile App\n(React Native)", C.white, 14);
  box(s, 4.8,  1.3, 3.8, 2.5, C.navy,  "HiveMQ Cloud\nMQTT TLS :8883", C.white, 14);
  box(s, 9.2,  1.3, 3.8, 2.5, C.orange,"ESP32\nIoT Device", C.white, 14);

  // Arrows primary
  s.addShape(pptx.ShapeType.line, { x: 4.2, y: 2.55, w: 0.6, h: 0, line: { color: C.blue, width: 2 } });
  body(s, "POST /v1/iot/buzz →\nMQTT publish", 4.25, 2.1, 0.5, 0.8, { size: 9, color: C.blue });
  s.addShape(pptx.ShapeType.line, { x: 8.6, y: 2.55, w: 0.6, h: 0, line: { color: C.blue, width: 2 } });
  body(s, "snoozeguard/commands/{id}", 8.1, 1.95, 1.1, 0.4, { size: 9, color: C.blue });

  // BLE fallback arc label
  s.addShape(pptx.ShapeType.line, { x: 4.2, y: 3.3, w: 5.0, h: 0, line: { color: C.accent, width: 1.5, dash: "dash" } });
  body(s, "BLE Fallback (SG-{device_id})  CMD char: beb5483e-...  EVENT char: beb5483f-...", 4.0, 3.38, 5.4, 0.4, { size: 10, color: C.accent });

  divider(s, 4.3);

  subheading(s, "Topic Structure", 4.4, C.navy);
  const topics = [
    ["App → Device", "snoozeguard/commands/{device_id}", "buzz / all_clear JSON command", C.blue],
    ["Device → Server", "snoozeguard/dismiss/{device_id}", "dismiss event from physical button", C.orange],
    ["Device → Server", "snoozeguard/ping/{device_id}", "heartbeat every 5s → updates last_seen", C.green],
  ];
  topics.forEach((t, i) => {
    box(s, 0.4, 4.85 + i * 0.75, 2.2, 0.55, t[3], t[0], C.white, 11);
    body(s, t[1], 2.7, 4.85 + i * 0.75 + 0.08, 4.5, 0.42, { size: 12, bold: true, color: C.dark });
    body(s, t[2], 7.3, 4.85 + i * 0.75 + 0.08, 5.5, 0.42, { size: 11.5, color: C.gray });
  });

  body(s, "Device online if last_seen < 15s  ·  BLE used when WiFi/MQTT unavailable", 0.4, 7.1, 12.33, 0.3, { size: 11, color: C.gray });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 11 — Emergency Notification
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Emergency Notification System");
  divider(s, 1.05);

  const steps = [
    { n: "1", text: "Driver reaches Level 9 or 10 — alert modal opens", color: C.red },
    { n: "2", text: "120-second countdown begins (30s on web)", color: C.orange },
    { n: "3", text: "If driver does NOT dismiss → triggerEmergencyAlert() fires", color: C.orange },
    { n: "4", text: "Driver's GPS location captured → emergency_alert_events row inserted", color: C.blue },
    { n: "5", text: "Expo Push Notification sent to active emergency contact's device", color: C.blue },
    { n: "6", text: "If sms_enabled: POST to Supabase Edge Function → PhilSMS API → SMS delivered", color: C.navy },
    { n: "7", text: "Guardian opens EmergencyAlertMapScreen → sees live location → Accept / Dismiss", color: C.green },
  ];

  steps.forEach((step, i) => {
    const y = 1.2 + i * 0.85;
    box(s, 0.4, y, 0.5, 0.55, step.color, step.n, C.white, 15);
    body(s, step.text, 1.05, y + 0.05, 11.7, 0.5, { size: 13 });
    if (i < steps.length - 1) {
      s.addShape(pptx.ShapeType.line, { x: 0.65, y: y + 0.58, w: 0, h: 0.27, line: { color: C.gray, width: 1 } });
    }
  });

  divider(s, 7.1);
  body(s, "Multi-contact model: driver designates multiple guardians (is_active=1 selects active).  Real-time presence shown in \"I Protect\" tab.", 0.4, 7.18, 12.33, 0.3, { size: 11, color: C.gray });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 12 — Offline-First Architecture
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Offline-First Architecture");
  divider(s, 1.05);

  box(s, 0.4, 1.25, 5.5, 1.0, C.blue, "Local SQLite (expo-sqlite)\nGround Truth — Always Available", C.white, 13);
  s.addShape(pptx.ShapeType.line, { x: 5.9, y: 1.75, w: 1.5, h: 0, line: { color: C.accent, width: 2 } });
  body(s, "Background\nSync", 6.0, 1.5, 1.3, 0.55, { size: 11, color: C.accent, align: "center" });
  box(s, 7.4, 1.25, 5.5, 1.0, C.navy, "Supabase PostgreSQL\nCloud Backup", C.white, 13);

  divider(s, 2.55);
  subheading(s, "Offline-First Pattern", 2.65, C.navy);

  const flow = [
    ["Read SQLite immediately", "Show cached data to user with zero delay", C.blue],
    ["Check connectivity", "isOnline() from sync/flush.ts", C.gray],
    ["If online: fetch Supabase", "Update SQLite cache with fresh data", C.green],
    ["If offline: show banner", "User sees offline warning; cached data still visible", C.orange],
  ];
  flow.forEach((f, i) => {
    box(s, 0.4, 3.1 + i * 0.88, 3.5, 0.65, f[2], f[0], C.white, 12);
    body(s, f[1], 4.1, 3.1 + i * 0.88 + 0.1, 8.7, 0.5, { size: 12.5 });
  });

  divider(s, 6.7);
  subheading(s, "Auth Fallback", 6.8, C.orange);
  body(s, "5-second timeout on session load → reads offline_session from SQLite → user logged in without network", 0.5, 7.1, 12.33, 0.3, { size: 12, color: C.gray });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 13 — Research Methodology
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Research Methodology");
  divider(s, 1.05);

  box(s, 0.4, 1.2, 12.33, 0.6, C.blue, "Iterative Software Development Life Cycle (Iterative SDLC)", C.white, 16);

  const phases = [
    { phase: "Phase 1", name: "Requirements\nAnalysis", date: "Jan 1–15", color: C.blue },
    { phase: "Phase 2", name: "System\nDesign", date: "Jan 16–30", color: C.navy },
    { phase: "Phase 3", name: "Mobile App\nDevelopment", date: "Feb 1–15", color: C.blue },
    { phase: "Phase 4", name: "Web Dashboard", date: "Feb 16–28", color: C.navy },
    { phase: "Phase 5", name: "IoT Firmware", date: "Mar 1–15", color: C.orange },
    { phase: "Phase 6", name: "Integration\nTesting", date: "Mar 16–30", color: C.orange },
    { phase: "Phase 7", name: "Evaluation\n& Survey", date: "Apr 1–15", color: C.green },
    { phase: "Phase 8", name: "Documentation", date: "Apr 16–30", color: C.green },
  ];

  phases.forEach((p, i) => {
    const x = 0.4 + i * 1.55;
    box(s, x, 2.0, 1.4, 0.4, p.color, p.phase, C.white, 10);
    box(s, x, 2.45, 1.4, 0.9, "EEF4FF", p.name, C.dark, 10);
    body(s, p.date, x, 3.4, 1.4, 0.35, { size: 9.5, color: C.gray, align: "center" });
  });

  divider(s, 4.0);
  subheading(s, "Evaluation Framework — ISO/IEC 25010", 4.1, C.navy);

  const chars = ["Functional Suitability", "Performance Efficiency", "Compatibility", "Usability", "Reliability", "Security", "Maintainability", "Portability"];
  const colors = [C.blue, C.blue, C.navy, C.navy, C.orange, C.orange, C.green, C.green];
  chars.forEach((c, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    pill(s, 0.4 + col * 3.1, 4.65 + row * 0.6, c, colors[i]);
  });

  subheading(s, "Respondents", 5.95, C.blue);
  body(s, "Active drivers  ·  Age: 22–35 years old  ·  Purposive sampling  ·  Evaluated using the driving simulator prototype", 0.5, 6.35, 12.33, 0.4, { size: 13 });
  body(s, "Method: 5-point Likert Scale → Weighted Mean → Interpretation (Poor / Fair / Good / Very Good / Excellent)", 0.5, 6.8, 12.33, 0.4, { size: 12, color: C.gray });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 14 — Driving Simulator Prototype
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Driving Simulator Prototype");
  divider(s, 1.05);

  body(s, "To provide a realistic, controlled evaluation environment without requiring road access, the research team constructed a physical driving simulator:", 0.5, 1.15, 12.33, 0.55, { size: 13 });

  const components = [
    ["Car Seat", "Genuine automobile bucket seat on rigid wooden frame — authentic driving posture and camera distance"],
    ["Steering Wheel", "Logitech gaming steering wheel with force feedback at ergonomic height"],
    ["Pedals", "Brake and accelerator pedals at floor level — natural foot position for test participants"],
    ["Smartphone Mount", "Front-facing dash cradle at 60–80 cm — camera captures full face within MediaPipe range"],
    ["Frame", "Dimensional lumber (2×4, 2×6) — structural rigidity and adjustability"],
  ];

  components.forEach((c, i) => {
    const y = 1.8 + i * 0.98;
    box(s, 0.4, y, 2.5, 0.72, C.navy, c[0], C.white, 13);
    body(s, c[1], 3.1, y + 0.1, 9.8, 0.55, { size: 13 });
  });

  box(s, 0.4, 6.75, 12.33, 0.55, C.light, "All respondents interacted with the system through this simulator before completing the ISO/IEC 25010 evaluation questionnaire", C.navy, 13);
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 15 — Results Placeholder
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Results & Discussion — ISO/IEC 25010");
  divider(s, 1.05);

  const chars = [
    { name: "Functional Suitability", score: "—", interp: "Pending" },
    { name: "Performance Efficiency", score: "—", interp: "Pending" },
    { name: "Compatibility",          score: "—", interp: "Pending" },
    { name: "Usability",              score: "—", interp: "Pending" },
    { name: "Reliability",            score: "—", interp: "Pending" },
    { name: "Security",               score: "—", interp: "Pending" },
    { name: "Maintainability",        score: "—", interp: "Pending" },
    { name: "Portability",            score: "—", interp: "Pending" },
  ];

  s.addTable(
    [
      [
        { text: "Quality Characteristic", options: { bold: true, fontSize: 13, color: C.white, fill: C.navy, fontFace: "Calibri" } },
        { text: "Weighted Mean", options: { bold: true, fontSize: 13, color: C.white, fill: C.navy, fontFace: "Calibri", align: "center" } },
        { text: "Interpretation", options: { bold: true, fontSize: 13, color: C.white, fill: C.navy, fontFace: "Calibri", align: "center" } },
      ],
      ...chars.map((c, i) => [
        { text: c.name, options: { fontSize: 12, color: C.dark, fill: i % 2 === 0 ? "EEF4FF" : C.white, fontFace: "Calibri" } },
        { text: c.score, options: { fontSize: 12, color: C.gray, fill: i % 2 === 0 ? "EEF4FF" : C.white, fontFace: "Calibri", align: "center" } },
        { text: c.interp, options: { fontSize: 12, color: C.gray, fill: i % 2 === 0 ? "EEF4FF" : C.white, fontFace: "Calibri", align: "center" } },
      ]),
      [
        { text: "Overall", options: { bold: true, fontSize: 13, color: C.white, fill: C.blue, fontFace: "Calibri" } },
        { text: "—", options: { bold: true, fontSize: 13, color: C.white, fill: C.blue, fontFace: "Calibri", align: "center" } },
        { text: "—", options: { bold: true, fontSize: 13, color: C.white, fill: C.blue, fontFace: "Calibri", align: "center" } },
      ],
    ],
    { x: 0.4, y: 1.2, w: 12.33, h: 5.6, border: { type: "solid", color: "CCCCCC", pt: 0.5 } }
  );

  body(s, "Update scores after survey data collection is complete. Replace '—' with actual weighted mean values.", 0.4, 6.9, 12.33, 0.35, { size: 11, color: C.gray, align: "center" });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 16 — Conclusions
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Conclusions");
  divider(s, 1.05);

  const conclusions = [
    "A smartphone camera + MediaPipe Face Landmarker can reliably detect multi-signal driver drowsiness (yawn, head nod, tilt, brake) in real time without specialized vehicle hardware.",
    "A configurable 10-level drowsiness scoring model provides proportional, escalating alert responses that avoid the false-alarm fatigue of binary threshold systems.",
    "An ESP32 IoT alert device with MQTT + BLE dual-path communication successfully extends alerts beyond the smartphone with level-calibrated audio, vibration, and LED patterns.",
    "A closed-loop emergency pipeline (Expo Push + PhilSMS) delivers timely guardian notification absent from existing smartphone DMS applications.",
    "An offline-first SQLite architecture ensures continuous session recording under intermittent network conditions — critical for Philippine road environments.",
    "SnoozeGuard achieves [pending ISO score] across ISO/IEC 25010 quality characteristics — demonstrating satisfactory software quality as a functional prototype.",
  ];

  conclusions.forEach((c, i) => {
    box(s, 0.4, 1.2 + i * 1.0, 0.5, 0.55, C.blue, String(i + 1), C.white, 15);
    body(s, c, 1.05, 1.2 + i * 1.0 + 0.05, 11.7, 0.6, { size: 12.5 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 17 — Recommendations
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide();
  heading(s, "Recommendations");
  divider(s, 1.05);

  const recs = [
    ["Field Validation", "Evaluate in naturalistic driving conditions across diverse road types, lighting, and driver demographics"],
    ["Eye Closure Integration", "Add PERCLOS as optional supplementary signal when MediaPipe reports high-confidence eye landmark tracking"],
    ["OBD-II Integration", "Incorporate vehicle speed and lane deviation data as additional drowsiness signals"],
    ["Regulatory Certification", "Pursue formal safety analysis and certification pathway for deployment as a certified DMS aid"],
    ["Multi-Language Support", "Add Filipino TTS and localized UI for broader Philippine deployment"],
    ["Fleet Management Dashboard", "Extend cloud backend to aggregate driver drowsiness statistics across commercial vehicle fleets"],
    ["Battery Optimization", "Investigate adaptive sampling and Android NNAPI hardware acceleration to reduce power consumption"],
  ];

  recs.forEach((r, i) => {
    const y = 1.2 + i * 0.85;
    box(s, 0.4, y, 2.8, 0.62, i % 2 === 0 ? C.blue : C.navy, r[0], C.white, 12);
    body(s, r[1], 3.35, y + 0.1, 9.8, 0.5, { size: 12.5 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 18 — Closing
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = addSlide({ dark: true });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: C.navy } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: "100%", fill: { color: C.blue } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.08, fill: { color: C.accent } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 7.42, w: "100%", h: 0.08, fill: { color: C.accent } });

  s.addText("Thank You", {
    x: 0.5, y: 2.2, w: 12.33, h: 1.2,
    fontSize: 60, bold: true, color: C.white,
    fontFace: "Calibri", align: "center",
  });
  s.addText("Questions & Open Discussion", {
    x: 0.5, y: 3.55, w: 12.33, h: 0.6,
    fontSize: 22, color: C.accent,
    fontFace: "Calibri", align: "center",
  });
  s.addShape(pptx.ShapeType.line, { x: 3.5, y: 4.35, w: 6.33, h: 0, line: { color: C.blue, width: 1.5 } });
  s.addText("Cart Jeuiel T. Agno  ·  Aira Mae T. Pilor  ·  Christian Eduard B. Ylagan Jr.", {
    x: 0.5, y: 4.55, w: 12.33, h: 0.4,
    fontSize: 14, color: C.white, fontFace: "Calibri", align: "center",
  });
  s.addText("Adviser: Engr. Jezer E. Ilao  ·  Divine Word College of Calapan  ·  BS Computer Engineering  ·  2025–2026", {
    x: 0.5, y: 5.05, w: 12.33, h: 0.35,
    fontSize: 12, color: C.gray, fontFace: "Calibri", align: "center",
  });
}

// ── Write file ───────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, "thesis_presentation.pptx");
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log("thesis_presentation.pptx written to", outPath);
});
