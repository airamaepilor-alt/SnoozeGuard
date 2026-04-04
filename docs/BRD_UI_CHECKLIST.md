# Sleep Detection System — BRD ↔ UI ↔ Implementation Checklist

**BRD:** Version 1.0 (2026-04-02, Draft)  
**Purpose:** Trace requirements to **static prototypes** (`UI/*.html`) and **production code** (`apps/*`, `services/*`, `supabase/*`, `iot/*`).

### Legend

| Symbol | Meaning |
|--------|--------|
| ✅ | Largely meets BRD for that column |
| 🟡 | Partial, stub, heuristic, or parity gap |
| ❌ | Not implemented or not aligned |
| 📄 | Static HTML reference file |

---

## 1. Executive summary & scope (Sections 1, 6)

| Topic | 📄 UI / prototype | Production (`apps/web`, `apps/mobile`, API, IoT) | Notes |
|--------|-------------------|--------------------------------------------------|--------|
| Multi-platform (mobile / web / IoT / Supabase) | 📄 Full flow spread across `login` → `dashboard` → `monitoring` → `history` / `admin_config` | ✅ Monorepo: Vite web, Expo mobile, Fastify API, Supabase schema, ESP32 sketch, MQTT | IoT alert **hardware** (buzzer/LED) is firmware-side, not in repo UI |
| Offline-first | 📄 Copy mentions sync (earlier iterations); no real storage in HTML | 🟡 Mobile: SQLite + sync. Web: IndexedDB (Dexie) + sync. | BRD text says SQLite; web uses IndexedDB (browser equivalent) |
| Configurable alerts & thresholds | 📄 `admin_config.html` | ✅ Web `AdminPage`: sliders for thresholds + **alert_map** editor (levels 6–8); persisted to `admin_config` | Shared `@snoozeguard/shared` `alertMap` helpers used by web + mobile |

---

## 2. Functional requirements (Section 7)

| ID | Requirement | 📄 UI alignment | Production | Gap / next step |
|----|-------------|-----------------|------------|-----------------|
| **FR-1** | Supabase Auth | 📄 `login.html` — email/password + Google CTA | 🟡 Web: glass-style **`LoginPage`** + Google OAuth + **trust footer** copy; mobile email flow | Step-by-step: **`docs/SUPABASE_GOOGLE_AUTH.md`**; optional mobile OAuth |
| **FR-2** | Yawning (ML) | 📄 `monitoring.html` — Yawning tile | 🟡 **Web:** MediaPipe **Face Landmarker** (`jawOpen` proxy) when camera + **Browser ML** on `DrivePage`. **Mobile:** `yawnCountDelta` = 0 until a native vision plugin is added | Tune thresholds; optional dedicated yawn classifier |
| **FR-3** | Head movement (ML) | 📄 `monitoring.html` — Head movement | 🟡 **Web:** head pose from Face Landmarker transformation matrix + euler deltas. **Mobile:** accel variance + **gyro spike** (`HeuristicDrowsinessEstimator.pushGyro`) | Vision-camera frame ML Kit / deeper fusion TBD |
| **FR-4** | Sudden braking | 📄 `monitoring.html` — Sudden braking row | 🟡 **Mobile:** accel **jerk** threshold (~2.2). **Web:** manual “flag brake” + IoT/API path. | Vehicle CAN fusion TBD |
| **FR-5** | Drowsiness level from thresholds | 📄 `admin_config.html` — trigger + level bands | 🟡 Shared **`computeDrowsinessLevelFromSignals`** (`packages/shared`): web Drive uses it from yaw/head/brake + thresholds; mobile blends accel heuristic as `motionProxyLevel`. Optional **manual override** on web for QA | Replace weights / inputs when ML lands |
| **FR-6** | Alerts by level | 📄 `popup_alert.html` — full-screen L8-style | ✅ Web: `DrowsinessAlertOverlay` + `playWebAlert` (beep / vibrate / flash bars). Mobile: full-screen `Modal` + `expo-haptics` / `Vibration` driven by `alert_map` | IoT buzzer/LED still device-side |
| **FR-7** | Configurable thresholds (admin UI) | 📄 `admin_config.html` — sliders + save | ✅ Web `AdminPage` — range sliders + save | Copy/visual polish vs 📄 optional |
| **FR-8** | Alert actions per level | 📄 `admin_config.html` — table 6/7/8 + action chips | ✅ Editor for labels + action toggles (`sound`, `voice`, `vibration`, `flashlight`, `alarm`, `iot_led`); saved to `alert_map` | — |
| **FR-9** | Local session storage (offline) | 📄 Implied by flow; HTML is static | ✅ Mobile SQLite; Web IndexedDB | — |
| **FR-10** | Sync when online | 📄 N/A | ✅ Mobile `flush.ts`; web `lib/offline/sync.ts` + shell flush | — |
| **FR-11** | Dashboard analytics | 📄 `dashboard.html` — stats + “Start Driving” | ✅ / 🟡 Web: **`user_dashboard_metrics`** RPC (migration `20260404120000`) for server aggregates + **safe hours / caution / drive-time** narrative bento; **UTC** histogram; falls back to client if RPC missing | Further SQL materialized views / caching at very large scale |
| **FR-12** | IoT via API | 📄 N/A (IoT is device) | ✅ `POST /v1/iot/telemetry`, MQTT optional, ESP32 firmware | — |

---

## 3. User stories (Section 8)

| Story | Acceptance (BRD) | 📄 Primary UI | Production | Status |
|-------|-------------------|---------------|------------|--------|
| **US-1** | Camera on; detection starts | 📄 `monitoring.html` | 🟡 Mobile camera + motion loop; web `DrivePage` — camera + optional **Browser ML** (MediaPipe), session timer, gauge, bento, HUD | GPU/CPU delegate & CDN model load = environment-dependent |
| **US-2** | Alerts by thresholds | 📄 `popup_alert.html` | ✅ Web overlay + mobile modal when `drowsiness_level >= drowsiness_trigger_level`, actions from `alert_map` | Throttle ~35s unless level rises |
| **US-3** | History / session stats | 📄 `dashboard.html`, `driving_history.html` | 🟡 Web `HistoryPage`: sessions + **7-day average drowsiness SVG**; chips + sparklines; `DashboardPage` §12 + extras | Further polish vs 📄 optional |
| **US-4** | Admin thresholds | 📄 `admin_config.html` | ✅ Web `AdminPage` sliders | — |
| **US-5** | Alert mapping per level | 📄 `admin_config.html` table | ✅ React editor + validation via shared `parseAlertMap` | — |

---

## 4. Non-functional requirements (Section 10)

| NFR | Target | Production reality | 📄 UI note |
|-----|--------|--------------------|------------|
| **Performance** | &lt;1s detection latency | 🟡 Mobile ~1s tick; web Face Landmarker ~7–8 FPS (throttled) | Benchmark jaw/head thresholds under real driving lighting |
| **Offline** | Works without internet | ✅ Mobile + web queues | HTML mocks are online-only assets |
| **Security** | Supabase auth | ✅ RLS + roles | 📄 `login.html` — Google requires dashboard setup |
| **Scalability** | Many devices | 🟡 API + Supabase; dashboard metrics **in-database** via RPC (not full-table fetch to browser) | Rate limits / device registry still TBD |
| **Reliability** | Alerts consistent | 🟡 Throttle + **`alert_events`** table (migration `20260404130000`) when alert UI fires; optional FK to `driving_sessions` | 📄 `popup_alert.html` as UX contract |
| **Usability** | Minimal driver interaction | 🟡 Web: **fixed bottom nav** (Dashboard / Drive / History / Admin) + top sign-out | 📄 Bottom nav pattern aligned with 📄 `monitoring.html` |

---

## 5. BRD §12 Dashboard metrics — coverage

| Metric (BRD) | 📄 `dashboard.html` / `driving_history.html` | Production web |
|--------------|-----------------------------------------------|----------------|
| Total driving sessions | 🟡 Implied / stats cards | ✅ Count via Supabase on dashboard |
| Average drowsiness level | 🟡 History chart flavor | 🟡 Mean over telemetry in latest **40** sessions (+ History 7-day line chart) |
| Yawn count per session | 🟡 Session chips in history mock | 🟡 Per-session sums on `HistoryPage` |
| Head movement frequency | 🟡 “SWAYS” / HEAD chips | 🟡 Per-session sums on `HistoryPage` |
| Alert frequency by level | 🟡 | 🟡 **`alert_events`** 7-day count on dashboard + L6–L8 sample proxy (true level bands need session-linked analytics) |
| Time-of-day fatigue trends | 🟡 Chart in `driving_history.html` | 🟡 Hour histogram on dashboard + **7-day daily avg** spark on History |

---

## 6. BRD §13 Admin configuration — coverage

| Config (BRD example) | 📄 `admin_config.html` | Production |
|----------------------|------------------------|------------|
| Yawn threshold = 3 | ✅ Slider + value | ✅ Slider + `admin_config.yawn_threshold` |
| Head movement threshold = 20 | ✅ Slider | ✅ Slider |
| Drowsiness trigger = 6 | ✅ Slider | ✅ Slider |
| Level 6/7/8 alert table | ✅ Table + action chips | ✅ Per-level cards + chip toggles + save to `alert_map` |

---

## 7. Screen-by-screen: static HTML ↔ React app mapping

Use this when **porting visuals** or **acceptance-testing** parity.

| 📄 File | Role in BRD flow | Production counterpart | Parity checklist |
|---------|------------------|-------------------------|------------------|
| **`login.html`** | FR-1 | `apps/web` `LoginPage.tsx` | [x] Google CTA (wire Supabase provider); [x] trust footer copy; [x] Dark / glass styling (approximation of 📄) |
| **`dashboard.html`** | US-3, FR-11 | `apps/web` `DashboardPage.tsx` | [x] RPC metrics + UTC histogram; [x] Safe / caution / drive-time narrative bento; [x] “Start driving”; [ ] Exact 📄 visual bento grid |
| **`driving_history.html`** | US-3, §12 trends | `apps/web` `HistoryPage.tsx` | [x] Session rows + chips + sparkline; [x] 7-day daily average trend (SVG) |
| **`monitoring.html`** | US-1, FR-2–4 | `apps/mobile` `DriveScreen.tsx` + web `DrivePage.tsx` | [x] Live camera (mobile); [x] Web MediaPipe path (optional); [x] Mobile gyro + accel; [x] Tiles + gauge |
| **`popup_alert.html`** | US-2, FR-6 | `DrowsinessAlertOverlay.tsx` + mobile `Modal` in `DriveScreen.tsx` | [x] Full-screen overlay; [x] L6–L8 copy from `alert_map`; [x] Dismiss; [x] Peripheral flash bars when configured |
| **`admin_config.html`** | US-4, US-5, FR-7–8 | `apps/web` `AdminPage.tsx` | [x] Sliders; [x] Level mapping; [x] Alert actions; [x] Save |

---

## 8. IoT & architecture (BRD §5 IoT flow, §11)

| Item | BRD | Implementation | 📄 UI |
|------|-----|----------------|-------|
| REST telemetry | ✅ | `services/api` + ESP32 `iot/firmware` | N/A |
| MQTT | ✅ | API optional subscriber + `mqtt-bridge` | N/A |
| Local IoT inference | Assumed | Firmware placeholder values | N/A |
| Sound / LED / vibration | ✅ | Documented in `iot/README.md`; not simulated in HTML | N/A |

---

## 9. Suggested execution order (thesis / sprint)

1. ~~**Alert pipeline (FR-5, FR-6, US-2)**~~ — Done for web + mobile clients using `admin_config` + shared `alertMap`.
2. ~~**Admin parity (FR-7, FR-8, US-5)**~~ — Sliders + `alert_map` editor shipped.
3. ~~**Dashboard §12 (FR-11)**~~ — Extended to 40-session window + extra cards; History 7-day trend added.
4. **Real ML (FR-2–4)** — replace heuristics; keep the same telemetry row shape.
5. ~~**Web camera + MediaPipe (US-1, FR-2–3)**~~ — Face Landmarker path on `DrivePage` when enabled.
6. **Mobile vision yawn** — frame processor / ML Kit if FR-2 must be on-device without web.

---

## 10. Quick “definition of done” per column

- **📄 UI:** Stakeholder sign-off on static HTML as visual/UX spec.
- **Production:** Feature works end-to-end with Supabase + auth + (where relevant) offline sync.
- **BRD:** Requirement ID satisfied in testable form (manual or automated).

---

*Generated for SnoozeGuard monorepo. Update this file when BRD or screens change.*
