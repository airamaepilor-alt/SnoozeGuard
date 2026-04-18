# SnoozeGuard — Business Requirements Document & Technical Alignment Document
**Version:** 1.2  
**Date:** 2026-04-17  
**Status:** Living Document — Source of Truth  
**Audience:** Mobile Engineers · Web Developers · IoT Engineers · Backend Engineers · AI Systems

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Current Mobile Implementation (Source of Truth)](#3-current-mobile-implementation)
   - 3.1 Features
   - 3.2 UI/UX Behavior
   - 3.3 Data Model
   - 3.4 APIs & Supabase Operations
   - 3.5 Business Logic
4. [System Architecture](#4-system-architecture)
5. [Web Platform Requirements](#5-web-platform-requirements)
6. [IoT Integration Requirements](#6-iot-integration-requirements)
7. [Cross-Platform Consistency Rules](#7-cross-platform-consistency-rules)
8. [AI-Readable System Context](#8-ai-readable-system-context)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Risks & Gaps](#10-risks--gaps)

---

## 1. EXECUTIVE SUMMARY

### What the System Does

SnoozeGuard is a real-time driver drowsiness detection and alert system. It continuously monitors the driver's face using a camera, detects signs of fatigue (yawning, head movement, head tilt), and triggers progressive alerts — from voice warnings to emergency contact notifications — before a microsleep event can cause an accident.

### Core Value Proposition

| Problem | Solution |
|---------|----------|
| Drivers fall asleep at the wheel without warning | Continuous ML-based face monitoring detects drowsiness precursors |
| Single-device solutions are rigid | Works on mobile phones (front camera), web browsers, and dedicated IoT hardware |
| Fatigue data is lost after a trip | All sessions stored locally first (offline-safe), then synced to cloud |
| Emergency help arrives too late | Automatic emergency contact notification with GPS location at critical levels |

### Target Users

| Role | Description |
|------|-------------|
| **Driver** | Primary user; monitors their own drowsiness during trips |
| **Super Admin** | Configures system-wide alert thresholds and actions |
| **Emergency Contact** | Registered person notified when driver reaches critical level |

---

## 2. PRODUCT OVERVIEW

### 2.1 Core Features

| Feature | Mobile | Web | IoT |
|---------|--------|-----|-----|
| Real-time face detection (camera) | ✅ MediaPipe native | ✅ MediaPipe WASM | ✅ OV2640 + ESP32-CAM |
| Drowsiness level scoring (0–10) | ✅ | ✅ | ✅ |
| Yawn detection | ✅ jawOpen blendshape | ✅ jawOpen blendshape | 🔲 Planned |
| Head movement detection | ✅ pitch/roll landmarks | ✅ Euler angles | 🔲 Planned |
| Sudden brake detection | ✅ Accelerometer | ✅ Demo only | 🔲 Planned (vibration sensor) |
| Progressive alert actions | ✅ voice/vibration/alarm | ✅ web notifications | ✅ LED / buzzer |
| Emergency contact notify | ✅ Push + SMS | ✅ Push only | ❌ Not applicable |
| Session history & analytics | ✅ SQLite + Supabase | ✅ IndexedDB + Supabase | ✅ Server-side only |
| Offline-first operation | ✅ SQLite | ✅ IndexedDB | ❌ Requires WiFi |
| Admin config UI | ✅ | ✅ | ❌ Web-only config |

### 2.2 Platform Scope

```
┌─────────────────────────────────────────────────────────┐
│                     SNOOZEGUARD                         │
├─────────────┬────────────────┬──────────────────────────┤
│   MOBILE    │      WEB       │          IoT             │
│  (React     │   (React +     │     (ESP32-CAM +         │
│   Native /  │   Vite /       │      OV2640 camera +     │
│   Expo)     │   TypeScript)  │      LEDs + Buzzer)      │
├─────────────┴────────────────┴──────────────────────────┤
│                   SUPABASE BACKEND                       │
│  Auth · Postgres · Realtime · Storage · Edge Functions  │
├─────────────────────────────────────────────────────────┤
│               IoT INGEST API (Node.js / Hono)           │
│           POST /v1/iot/telemetry  ←  ESP32 device       │
└─────────────────────────────────────────────────────────┘
```

### 2.3 High-Level Architecture

```
DRIVER
  │
  ├── Mobile App (Expo SDK 54 / React Native 0.81.5)
  │     ├── Front camera → MediaPipe (native, IMAGE mode, 600ms snapshots)
  │     ├── SQLite (expo-sqlite) — local-first storage
  │     ├── Supabase client — auth + cloud sync
  │     └── Expo Updates — OTA JS bundle delivery
  │
  ├── Web App (React + Vite, Supabase JS)
  │     ├── Browser camera → MediaPipe WASM
  │     ├── Dexie (IndexedDB) — offline-first storage
  │     └── Supabase client — auth + cloud sync
  │
  └── IoT Device (ESP32-CAM AI Thinker)
        ├── OV2640 camera — on-device capture
        ├── HTTP POST every 5s → IoT Ingest API
        └── LED + Buzzer — physical alert actions

SUPABASE (PostgreSQL + Auth + Realtime)
  ├── Tables: profiles, driving_sessions, session_telemetry,
  │           admin_config, alert_events, emergency_contacts,
  │           emergency_alert_events, push_tokens
  ├── RPCs: user_dashboard_metrics, user_driving_history,
  │         update_admin_config, get_user_id_by_email
  └── RLS policies on all tables

IoT INGEST API (services/api, Node.js / Hono framework)
  ├── POST /v1/iot/telemetry — validates + persists IoT data
  └── Auth: x-snoozeguard-device-key header
```

---

## 3. CURRENT MOBILE IMPLEMENTATION

> This section is the **canonical reference** for all platform implementations.

### 3.1 Features

---

#### FEATURE: User Authentication

**Description:** Users sign in with Google OAuth or email/password via Supabase Auth. A profile row is automatically created on first sign-in.

**User Flow:**
1. App launches → `supabase.auth.getSession()` checked
2. If no session → `LoginScreen` displayed
3. User taps "Continue with Google" OR enters email/password
4. **Google path:** `signInWithOAuth({ provider: 'google', redirectTo: 'snoozeguard://auth/callback' })` → browser opens → redirect back → URL parsed for `code` (PKCE) or `#access_token` (implicit) → `exchangeCodeForSession()` or `setSession()`
5. **Email path:** `signInWithPassword()` or `signUp()` directly
6. On success → `onAuthStateChange` fires → `MainApp` mounts
7. `handle_new_user()` database trigger creates `profiles` row with `role='driver'`

**Screens involved:** LoginScreen, App (root)

**Edge cases:**
- No `code` or `access_token` in redirect URL → error displayed
- Auth state change fires after app returns from background → session refreshed transparently
- Email not confirmed → Supabase returns error message displayed inline

---

#### FEATURE: Driving Session — Real-Time Monitoring

**Description:** The core feature. Opens camera, runs MediaPipe face detection, accumulates drowsiness signals, computes a drowsiness level every second, and triggers alerts when thresholds are crossed.

**User Flow:**
1. User taps "Start Driving"
2. `ensureModelPath()` checks for MediaPipe model in `documentDirectory`; downloads if absent
3. `loadAdminConfig()` fetches current thresholds from `admin_config` (Supabase)
4. Local session row inserted into `driving_sessions_local` with UUID + `started_at`
5. `sessionActiveRef.current = true`, `drivingSessionActive.current = true`
6. `FaceCamera` component activates (front camera, snapshot loop every 600ms):
   - `takeSnapshot({ quality: 40 })` → temp file
   - `faceLandmarkDetectionOnImage()` → `MPResultsBundle`
   - `parseFaceFrame()` → `{ jawOpen, pitch, roll }`
   - Detectors run: yawn, head movement, tilt
   - Snapshot file deleted after detection
7. Accelerometer runs (100ms interval) — detects sudden braking
8. Tick interval runs every 1000ms:
   - Computes `level` via `computeLevelFromAlertMap(yawnAcc, headAcc, brakeFlag, alertMap)`
   - Inserts `session_telemetry_local` row
   - Flushes pending telemetry to Supabase (async, fire-and-forget)
   - If `level ≥ triggerLevel` AND no alert open AND cooldown passed → show alert modal
9. User taps "End Session" → `endSession()`:
   - Stops tick, stops camera, resets refs
   - Updates `ended_at` in SQLite immediately
   - Clears UI (session ID set to null)
   - Background flush of ended session + telemetry to Supabase

**Screens involved:** DriveScreen (modal alert is in-screen overlay)

**Edge cases:**
- Camera permission not granted → permission request screen shown
- MediaPipe model not downloaded → status message; Start button disabled
- Face not detected in frame → detectors receive `null`; wasOpen/tilt reset gracefully
- Alert already open → `alertOpenRef.current = true` suppresses new alerts and face processing
- App goes offline mid-session → telemetry queues in SQLite; flush resumes on reconnect
- Navigation away during session → alert shown; "End Session & Leave" calls `endSessionFn.current()`

---

#### FEATURE: Yawn Detection

**Description:** Detects a discrete yawn event when the jaw opens wide and then closes.

**Detection Logic:**
- MediaPipe blendshape `jawOpen` score (0.0–1.0) extracted each frame
- **Open threshold:** `jawOpen ≥ 0.7` → set `wasOpen = true`
- **Close threshold:** `jawOpen ≤ 0.4` AND `wasOpen = true` → fire `onYawn()`
- **Cooldown:** 2000ms between yawns (prevents double-counting)
- **Suppression:** When `jawOpen ≥ 0.6`, head movement and tilt detectors are skipped (yawning naturally tilts head)
- Each `onYawn()` callback increments `yawnAccRef.current` (session accumulator)

---

#### FEATURE: Head Movement Detection

**Description:** Detects discrete head turns / nods (off-center then back).

**Detection Logic:**
- `pitch` = estimated from nose/eye/chin landmark ratios; threshold `|pitch| > 0.35`
- `roll` = atan2 of forehead(#10)→chin(#152) axis from vertical; threshold `|roll| > 0.25 rad`
- `offCenter` = `|pitch| > 0.35 OR |roll| > 0.25`
- Fires `onHeadEvent()` on TRANSITION: centered → off-center (not while staying off-center)
- **Cooldown:** 500ms between events
- Each `onHeadEvent()` increments `headAccRef.current`

---

#### FEATURE: Sustained Head Tilt Detection (Level 8 Alert)

**Description:** If head stays tilted (off-center) for 10 continuous seconds, fires a Level 8 alert independently of the drowsiness scoring formula.

**Detection Logic:**
- Same `offCenter` condition as head movement detector
- If `isTilted` for first time → `tiltStartAt = now`
- If `!fired AND now - tiltStartAt ≥ 10000ms` → fire `onSustainedTilt()`
- Grace: up to 4 consecutive missed frames (~2.4s) tolerated before resetting timer
- On `onSustainedTilt()`: directly set alert level=8, title="Head tilted for 10 s", open modal
- `tiltDetectorRef.reset()` called on session start and end

---

#### FEATURE: Sudden Brake Detection

**Description:** Detects abrupt deceleration events (hard braking) via accelerometer.

**Detection Logic:**
- Accelerometer at 100ms interval
- `delta = |currentMagnitude - prevMagnitude|`
- If `delta > 0.45`: increment `highDeltaCount` (max 6)
- Else: decrement `highDeltaCount` (min 0)
- If `highDeltaCount ≥ 2`: brake event detected
- **Cooldown:** 3000ms
- Sets `suddenBrakeRef.current = true` (consumed on next tick)
- `computeLevelFromAlertMap()` with brake=true → returns level 9 immediately

---

#### FEATURE: Drowsiness Level Scoring

**Description:** Aggregates yawn and head movement counts against configured thresholds to produce a 0–10 drowsiness level.

**Scoring Logic (computeLevelFromAlertMap):**
```
Input: yawnCount (session total), headCount (session total),
       suddenBrake (boolean), alertMap (from admin_config)

If suddenBrake → return 9

For each level L in alertMap (ascending):
  If yawnCount ≥ alertMap[L].yawn_count OR headCount ≥ alertMap[L].head_count:
    result = L

Return highest matching L, or 0 if no threshold met
```

**Default thresholds (DEFAULT_ALERT_MAP):**
| Level | Label | Yawn Count | Head Count | Actions |
|-------|-------|-----------|-----------|---------|
| 6 | Mild fatigue | ≥3 | ≥20 | voice |
| 7 | Moderate fatigue | ≥5 | ≥35 | voice, vibration |
| 8 | High fatigue | ≥8 | ≥55 | alarm, vibration |
| 9 | Severe — pull over | ≥12 | ≥80 | alarm, iot_led |
| 10 | Critical — stop now | ≥18 | ≥110 | alarm, iot_led, iot_buzzer |

**Alternative formula (packages/shared/src/drowsinessScore.ts — not used on mobile by default):**
```
yRatio = min(2, yawnCount / yawnThreshold)
hRatio = min(2, headCount / headThreshold)
score = 1 + 2.2 * yRatio + 2.2 * hRatio   [+ 2 if brake]
If motionProxy available: blend = 0.55 * score + 0.45 * motionProxy
Return clamp(result, 0, 10)
```

---

#### FEATURE: Alert System (Progressive Alerts)

**Description:** When drowsiness level reaches the configured trigger level, a full-screen alert modal appears and alert actions are executed.

**Alert Trigger Conditions:**
- `level ≥ triggerLevel` (default: 6) — from admin_config
- No alert currently open (`alertOpenRef.current = false`)
- Cooldown: 35,000ms since last alert of same level OR new level > previous level

**Alert Modal Contents:**
- "DROWSINESS ALERT" kicker
- Level number (large)
- Alert label (e.g., "Mild fatigue")
- "Pull over when safe" hint
- Emergency contact section (if level ≥ 9)
- "I'm alert — dismiss" button

**Alert Actions (playMobileAlertActions):**
| Action | Behavior |
|--------|---------|
| `voice` | `Speech.speak("Warning: drowsiness detected. Please pull over and rest.")` |
| `vibration` | `Vibration.vibrate([0,500,300,500,300,500,300,500,300,500])` (5 pulses) |
| `alarm` | `Audio.Sound.createAsync({ uri: "content://settings/system/alarm_alert" })` for 8s; fallback: ringtone URI; fallback: vibration |
| `iot_led` | Handled server-side — ESP32 device receives action via `alert_events` table |
| `iot_buzzer` | Handled server-side — ESP32 device activates buzzer |

**Dismiss:** User taps "I'm alert" → alert closed, emergency countdown stopped, `acknowledgeEmergencyAlert()` called if alert was L9+

---

#### FEATURE: Emergency Contact & L9 Notification

**Description:** At Level 9+ a 120-second countdown begins. If not dismissed, the emergency contact is automatically notified with the driver's GPS location.

**Emergency Contact Setup:**
- Driver enters: contact name, phone number, email
- System looks up email via RPC `get_user_id_by_email`
- If contact is registered user → status='pending' (they must accept)
- If not registered → status='accepted' (direct notification only)
- Pending requests visible in contact's "Alerts" tab

**L9 Alert Flow:**
1. Alert level ≥ 9 → `startEcCountdown()` called
2. 120s countdown displayed on modal
3. Driver can manually tap "Notify Now" to skip countdown
4. On expire (or manual trigger) → `fireEmergencyContact()`:
   - `captureLocation()` (high accuracy foreground GPS)
   - INSERT `emergency_alert_events` with `status='active'`, lat/lng
   - Push notification to contact (Expo push token, if registered)
   - SMS via TextBelt API (if contact phone set)
5. Emergency contact sees alert in "Alerts" tab with map link + Call/SMS buttons
6. Contact taps "Mark resolved" → UPDATE `status='dismissed'`

**Dismiss → acknowledge:** When driver dismisses L9 alert, `acknowledgeEmergencyAlert(alertId)` → UPDATE `status='alerted'`, set `acknowledged_at`

---

#### FEATURE: Session History

**Description:** Paginated list of past driving sessions with aggregated statistics.

**User Flow:**
1. User taps "History" tab
2. Screen focuses → `loadPage(true)` (reset)
3. SQLite query: JOIN `driving_sessions_local` + `session_telemetry_local`
4. Returns per-session: count, avg drowsiness, yawn sum, head sum, brake count
5. Displayed as cards: date, device type, sample count, avg drowsiness
6. Chips: YAWN +N · HEAD +N · BRAKE ×N (brake hidden if 0)
7. "Load more" button for pagination (offset-based, 20/page)

**Data Source:** LOCAL SQLite only — not Supabase (ground truth)

---

#### FEATURE: Home Dashboard

**Description:** Overview of historical metrics computed from local SQLite data.

**Metrics Displayed:**
- Focus Score: `max(0, round(100 - avgDrowsiness × 10))` — color coded
- Total sessions (last 40)
- Total drive time (sum of ended_at - started_at)
- Total yawns detected
- Alerts fired (sessions with avg drowsiness ≥ 6, ≥ 7, ≥ 8)

**Data Source:** LOCAL SQLite (same source as History — consistent)

---

#### FEATURE: Admin Configuration

**Description:** Super-admin-only screen to configure system-wide alert thresholds and actions. Changes take effect on ALL sessions (fetched on session start + reconnect).

**Configurable Fields:**
- `drowsiness_trigger_level` (1–10): minimum level to show alert
- Per-level alert map (L6–L10):
  - Label (text)
  - `yawn_count` threshold
  - `head_event_count` threshold
  - Actions: multi-select from [voice, vibration, alarm, iot_led, iot_buzzer]

**Save Flow:**
- RPC `update_admin_config(yawn_threshold, head_movement_threshold, trigger_level, alert_map JSONB, updated_by UUID)`
- SECURITY DEFINER function — verifies `profiles.role = 'super_admin'` inside
- Raises exception if not authorized

---

### 3.2 UI/UX Behavior

#### Navigation Structure (Mobile)

```
App Root
└── MainApp (authenticated)
    ├── Bottom Tab Navigator
    │   ├── [Tab] Home        → HomeScreen
    │   ├── [Tab] Drive       → DriveScreen
    │   ├── [Tab] History     → HistoryScreen
    │   └── [Tab] Alerts      → EmergencyAlertMapScreen
    │                            (badge: pending + active alerts)
    └── Hidden Tabs (burger menu)
        ├── Profile           → ProfileScreen
        └── Admin             → AdminScreen (super_admin only)
```

#### Key UI States

| Screen | Loading | Empty | Error |
|--------|---------|-------|-------|
| Home | "…" in stat tiles | "No data yet" / "Start a session" | metrics stay null (no crash) |
| History | ActivityIndicator | "No sessions yet." | stays empty |
| Drive | "Preparing face detection model…" | — | status text below buttons |
| Alerts | implicit | No cards shown | inline |
| Admin | implicit | — | Alert.alert with code + hint |

#### Session Guard (Tab Navigation)

- `drivingSessionActive` module-level ref shared between DriveScreen and App.tsx
- On tab press (non-Drive tab): `Alert.alert("Session Active", "Do you want to leave?")` with options:
  - "Keep Driving" → cancel (do nothing)
  - "End Session & Leave" → calls `endSessionFn.current()` then navigates

#### Header Menu (Burger)

- "Profile & Emergency Contact" → navigates to Profile tab
- "Admin Config" → navigates to Admin tab (only shown if `role = 'super_admin'`)
- "Sign out" → `supabase.auth.signOut()`

#### Alert Modal

- Full-screen modal (non-dismissible by back button while L9 countdown active)
- Red bars top and bottom when `alertFlash = true` (level ≥ 8)
- Emergency section only shown at level ≥ 9
- Countdown timer updates every second

---

### 3.3 Data Model

#### Table: `profiles`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, FK auth.users | Supabase auth user ID |
| full_name | TEXT | nullable | User's display name |
| role | TEXT | DEFAULT 'driver' | 'driver' or 'super_admin' |
| created_at | TIMESTAMPTZ | DEFAULT now() | Row creation time |

#### Table: `driving_sessions`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() | Session identifier |
| user_id | UUID | FK auth.users, NOT NULL | Owner |
| external_session_id | TEXT | nullable | Client-side UUID (from mobile/web/IoT) |
| started_at | TIMESTAMPTZ | NOT NULL | Session start |
| ended_at | TIMESTAMPTZ | nullable | Session end (null if still active) |
| device_type | TEXT | DEFAULT 'mobile' | 'mobile', 'web', 'iot' |
| sync_status | TEXT | DEFAULT 'local' | 'local' or 'synced' |

#### Table: `session_telemetry`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK IDENTITY | Row ID |
| session_id | UUID | FK driving_sessions, NOT NULL | Parent session |
| recorded_at | TIMESTAMPTZ | NOT NULL | Sample timestamp |
| drowsiness_level | NUMERIC(4,2) | CHECK 0–10 | Computed level |
| yawn_count_delta | INT | DEFAULT 0 | Yawns since last sample |
| head_event_count_delta | INT | DEFAULT 0 | Head events since last sample |
| sudden_brake | BOOLEAN | DEFAULT false | Hard brake in this interval |
| source | TEXT | NOT NULL | 'mobile_mediapipe', 'web_mediapipe', 'iot_device' |

#### Table: `admin_config`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, CHECK id=1 | Singleton row |
| yawn_threshold | INT | NOT NULL | Session yawn count baseline |
| head_movement_threshold | INT | NOT NULL | Session head events baseline |
| drowsiness_trigger_level | INT | NOT NULL | Minimum level to show alert |
| alert_map | JSONB | nullable | Per-level config (L6–L10) |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Last save time |
| updated_by | UUID | FK auth.users, nullable | Who saved |

#### Table: `alert_events`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PK IDENTITY | Event ID |
| user_id | UUID | FK auth.users, CASCADE DELETE | Driver |
| driving_session_id | UUID | FK, SET NULL ON DELETE | Session reference |
| local_session_hint | TEXT | nullable | Client-side session UUID hint |
| drowsiness_level | NUMERIC | NOT NULL | Level that triggered alert |
| trigger_level | INT | NOT NULL | Configured trigger at time of alert |
| alert_label | TEXT | nullable | e.g. "Mild fatigue" |
| source | TEXT | nullable | 'mobile_drive', 'web_drive', 'iot' |
| created_at | TIMESTAMPTZ | DEFAULT now() | Alert timestamp |

#### Table: `emergency_contacts`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() | Row ID |
| user_id | UUID | FK auth.users, NOT NULL | Driver who has this contact |
| contact_name | TEXT | NOT NULL | Contact's display name |
| contact_phone | TEXT | nullable | Phone number for call/SMS |
| contact_email | TEXT | nullable | Email (used for lookup) |
| contact_user_id | UUID | FK auth.users, nullable | If contact is registered user |
| status | TEXT | DEFAULT 'pending' | 'pending', 'accepted', 'declined' |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

#### Table: `emergency_alert_events`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK DEFAULT gen_random_uuid() | Alert ID |
| user_id | UUID | FK auth.users, NOT NULL | Driver who triggered |
| driving_session_id | UUID | FK, nullable | Active session at time |
| status | TEXT | DEFAULT 'active' | 'active', 'alerted', 'dismissed' |
| latitude | DOUBLE PRECISION | nullable | Driver GPS lat |
| longitude | DOUBLE PRECISION | nullable | Driver GPS lng |
| acknowledged_at | TIMESTAMPTZ | nullable | When driver dismissed modal |
| dismissed_at | TIMESTAMPTZ | nullable | When contact marked resolved |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

#### Table: `push_tokens`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | |
| user_id | UUID | FK auth.users, UNIQUE | One token per user |
| token | TEXT | NOT NULL | Expo push token |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

#### Local SQLite: `driving_sessions_local`
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | PK — same UUID as Supabase row after sync |
| user_id | TEXT | Supabase auth user ID |
| remote_id | TEXT | Supabase driving_sessions.id (null until synced) |
| started_at | TEXT | ISO 8601 string |
| ended_at | TEXT | nullable |
| device_type | TEXT | DEFAULT 'mobile' |
| ended_synced | INTEGER | 0=unsynced, 1=synced |

#### Local SQLite: `session_telemetry_local`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK AUTOINCREMENT |
| local_session_id | TEXT | FK driving_sessions_local.id |
| recorded_at | TEXT | ISO 8601 string |
| drowsiness_level | REAL | 0.0–10.0 |
| yawn_count_delta | INTEGER | DEFAULT 0 |
| head_event_count_delta | INTEGER | DEFAULT 0 |
| sudden_brake | INTEGER | 0 or 1 (boolean) |
| source | TEXT | e.g. 'mobile_mediapipe' |
| remote_synced | INTEGER | 0 or 1 |

---

### 3.4 APIs & Supabase Operations

#### Authentication

| Operation | Method | Details |
|-----------|--------|---------|
| Google OAuth | `supabase.auth.signInWithOAuth({ provider:'google', redirectTo })` | Mobile: `snoozeguard://auth/callback`; Web: `window.location.origin/` |
| Email sign-in | `supabase.auth.signInWithPassword({ email, password })` | |
| Email sign-up | `supabase.auth.signUp({ email, password })` | Triggers `handle_new_user` DB function |
| Sign out | `supabase.auth.signOut()` | Clears session and token |
| Session check | `supabase.auth.getSession()` | Called on app mount |
| Token exchange | `supabase.auth.exchangeCodeForSession(code)` | PKCE flow; called after OAuth redirect |
| Session refresh | Automatic (Supabase client) | Interval-based background refresh |

#### Driving Sessions

| Operation | Table | Method | Filter | Notes |
|-----------|-------|--------|--------|-------|
| Insert session | `driving_sessions` | INSERT | — | On sync from local |
| Update ended_at | `driving_sessions` | UPDATE | id = local row's remote_id | After session ends |
| Fetch for dashboard | `driving_sessions` | SELECT | user_id = me, ORDER started_at DESC, LIMIT 40 | Web fallback only |

#### Telemetry

| Operation | Table | Method | Filter | Notes |
|-----------|-------|--------|--------|-------|
| Bulk insert | `session_telemetry` | INSERT (batch) | — | Unsynced local rows |
| Fetch samples | `session_telemetry` | SELECT | session_id IN (session_ids) | Web fallback only |

#### Admin Config

| Operation | Method | Details |
|-----------|--------|---------|
| Read config | `supabase.from('admin_config').select('*').eq('id', 1).maybeSingle()` | All authenticated users |
| Save config | `supabase.rpc('update_admin_config', payload)` | Super admin only (checked in DB) |

**RPC: `update_admin_config` payload:**
```typescript
{
  p_yawn_threshold: number,
  p_head_movement_threshold: number,
  p_drowsiness_trigger_level: number,
  p_alert_map: object,   // JSONB
  p_updated_by: string   // UUID
}
```

#### Emergency Contact System

| Operation | Table / RPC | Method | Details |
|-----------|------------|--------|---------|
| Get contact | `emergency_contacts` | SELECT | WHERE user_id = me |
| Upsert contact | `emergency_contacts` | UPSERT | user_id + contact fields |
| Lookup by email | RPC `get_user_id_by_email` | CALL | Returns UUID or null |
| Get pending | `emergency_contacts` | SELECT | WHERE contact_user_id = me AND status = 'pending' |
| Accept request | `emergency_contacts` | UPDATE | SET status='accepted' |
| Decline request | `emergency_contacts` | UPDATE | SET status='declined' (or DELETE) |
| Register push token | `push_tokens` | UPSERT | user_id + expo token |

#### Emergency Alert Events

| Operation | Table | Method | Filter | Notes |
|-----------|-------|--------|--------|-------|
| Create alert | `emergency_alert_events` | INSERT | — | With lat/lng, status='active' |
| Acknowledge | `emergency_alert_events` | UPDATE | id = alertId | status='alerted', acknowledged_at=now() |
| Dismiss | `emergency_alert_events` | UPDATE | id = alertId | status='dismissed', dismissed_at=now() |
| Read as contact | `emergency_alert_events` | SELECT | user_id IN (accepted driver IDs) | Polling every 30s |

#### Alert Events

| Operation | Table | Method | Notes |
|-----------|-------|--------|-------|
| Log alert fired | `alert_events` | INSERT | Fire-and-forget from DriveScreen tick |

#### Server-Side Aggregation RPCs

| RPC | Parameters | Returns |
|-----|-----------|---------|
| `user_dashboard_metrics` | `p_session_limit INT`, `p_tz_offset_minutes INT` | JSONB: focus_score, avg_drowsiness, level counts, peak/safest hour, histogram[24], drive_seconds |
| `user_driving_history` | `p_session_limit INT`, `p_tz_offset_minutes INT`, `p_cursor_started_at TIMESTAMPTZ`, `p_latest_samples_limit INT` | JSONB: sessions[], weekly_trend[], latest_samples[], has_more |

#### IoT Ingest API (services/api)

| Endpoint | Method | Auth Header | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/v1/iot/telemetry` | POST | `x-snoozeguard-device-key: <secret>` | IotTelemetryPayload | `{ ok: true, session_id: string }` or error |

**Request Body Schema:**
```typescript
{
  device_id: string,           // required, 1-128 chars
  session_external_id?: string, // optional stable trip ID, 1-256 chars
  recorded_at: string,          // ISO 8601 — flexible parser accepts minor deviations
  drowsiness_level: number,     // 0.0–10.0
  yawn_count?: number,          // integer ≥ 0
  head_movement_events?: number,// integer ≥ 0
  sudden_brake?: boolean,
  metadata?: object             // free-form additional data
}
```

**Error cases:**
- Missing/invalid auth header → 401
- Schema validation failure → 400 with field details
- `device_id` not registered → [ASSUMPTION: 403 or auto-register; currently logs to default user]
- Supabase write failure → 500

---

### 3.5 Business Logic

#### Drowsiness Level Computation

```
RULE: computeLevelFromAlertMap(yawnCount, headCount, suddenBrake, alertMap)
  IF suddenBrake → RETURN 9 (immediate, overrides all)
  FOR each level L in ascending order:
    IF yawnCount ≥ alertMap[L].yawn_count OR headCount ≥ alertMap[L].head_count:
      result = L
  RETURN highest matching L, or 0
```

#### Alert Trigger Gate

```
RULE: Alert fires when ALL of:
  1. level ≥ adminConfig.drowsiness_trigger_level
  2. alertOpen = false
  3. now - lastAlertAt > 35,000ms
     OR level > lastAlertLevel
```

#### Focus Score

```
RULE: focusScore = max(0, round(100 - avgDrowsinessLevel × 10))
  avgDrowsinessLevel = mean of all avg_drowsiness values across last 40 sessions
  Range: 0 (avg level 10) to 100 (avg level 0)
  Color: ≥75 → green, ≥50 → orange, <50 → red
```

#### Emergency Contact Status Rules

```
RULE: contact status assignment on upsert
  IF contact email matches a registered Supabase user:
    status = 'pending'  → awaits their acceptance in Alerts tab
    → Send push notification to contact
  ELSE:
    status = 'accepted'  → direct notification (not an app user)

RULE: contact can only view driver alerts after accepting request
```

#### Tilt Alert Rule

```
RULE: L8 tilt alert fires when:
  |pitch| > 0.35 OR |roll| > 0.25 (same as head movement threshold)
  AND these conditions persist for ≥ 10,000ms
  AND ≤ 4 consecutive frames (≈ 2.4s) of non-tilt are tolerated (grace window)
  AND alert has not already fired this tilt episode (fired = false)
```

#### Admin Config Validation (Server-side, inside RPC)

```
RULE: update_admin_config requires role = 'super_admin' in profiles
  IF NOT: raise exception 'Access denied: super_admin role required'
  yawn_threshold: integer > 0
  head_movement_threshold: integer > 0
  drowsiness_trigger_level: integer 1–10
  alert_map: valid JSONB (no client-side schema validation in RPC)
```

#### Sync Rules

```
RULE: Local-first sync
  All writes go to SQLite first
  Flush attempted: on session end, on NetInfo reconnect, inside every tick (telemetry)
  Flush is fire-and-forget — never blocks UI

RULE: Session association
  Telemetry rows cannot sync without a remote session ID
  ensureRemoteSession() must succeed before telemetry flush proceeds
  If remote session create fails → telemetry stays queued

RULE: Idempotency
  Sessions use client-generated UUIDs (external_session_id) to prevent duplicates on retry
  Telemetry is INSERTED in bulk — no upsert → duplicates possible if flush retried mid-batch
  [RISK: See Section 10]
```

---

## 4. SYSTEM ARCHITECTURE

### 4.1 Backend Structure

```
Supabase Project
├── Auth (GoTrue)
│   ├── Google OAuth provider
│   ├── Email/password
│   └── JWT-based session tokens
├── Database (PostgreSQL 15)
│   ├── public schema
│   │   ├── profiles
│   │   ├── driving_sessions
│   │   ├── session_telemetry
│   │   ├── admin_config (singleton)
│   │   ├── alert_events
│   │   ├── emergency_contacts
│   │   ├── emergency_alert_events
│   │   └── push_tokens
│   └── RPCs (SECURITY DEFINER where needed)
│       ├── user_dashboard_metrics(limit, tz_offset)
│       ├── user_driving_history(limit, tz, cursor, sample_limit)
│       ├── update_admin_config(...)
│       └── get_user_id_by_email(email)
├── RLS Policies
│   ├── profiles: self-only
│   ├── driving_sessions: self-only
│   ├── session_telemetry: via session ownership
│   ├── admin_config: SELECT=all auth, UPDATE=via RPC only
│   ├── emergency_contacts: self or as contact
│   └── emergency_alert_events: as driver or accepted contact
└── Edge Functions (potential future)
    └── [ASSUMPTION: TextBelt SMS currently called from mobile client directly]

IoT Ingest API (services/api)
├── Runtime: Node.js (Hono framework assumed based on structure)
├── Endpoint: POST /v1/iot/telemetry
├── Validation: Zod schema (packages/shared/src/iotPayloadSchema.ts)
├── Auth: x-snoozeguard-device-key header (shared secret)
├── DB: Supabase service role key (bypasses RLS)
└── User association: IOT_DEFAULT_USER_ID env var (default driver for all IoT events)
```

### 4.2 Authentication Flow

```
MOBILE / WEB:
User → App → supabase.auth.signInWithOAuth() / signInWithPassword()
           ↓
     Supabase Auth (JWT issued)
           ↓
     Session stored (SecureStore / localStorage)
           ↓
     All subsequent requests include Bearer JWT
           ↓
     RLS policies: auth.uid() resolves to user's UUID

IOT:
Device → IoT Ingest API → x-snoozeguard-device-key header
                         ↓
                  Key compared to IOT_INGEST_SECRET env var
                         ↓
                  If match: use supabase service role key to write
                  (IoT data attributed to IOT_DEFAULT_USER_ID or device-mapped user)
```

### 4.3 Data Flow Diagram

```
MOBILE DRIVING SESSION
  ─────────────────────────────────────────────────────────────
  Camera (600ms)  →  MediaPipe FLD  →  parseFaceFrame()
                                              │
                                    ┌─────────┼──────────┐
                              YawnDetector  HeadDetector  TiltDetector
                                    └─────────┼──────────┘
                                              │
                                       yawnAcc / headAcc
                                              │
                          ┌───────────────────▼─────────────────────┐
                          │         1000ms TICK                      │
                          │  computeLevelFromAlertMap()              │
                          │  INSERT session_telemetry_local          │
                          │  flushPendingTelemetry() [async]         │
                          │  shouldAlert? → show modal               │
                          └──────────────────────────────────────────┘

SYNC
  session_telemetry_local [unsynced]
            │
            │  (on tick, reconnect, session end)
            ▼
  ensureRemoteSession()  →  driving_sessions [Supabase]
            │
            ▼
  INSERT session_telemetry [Supabase]  →  mark remote_synced=1

ALERT → INSERT alert_events [Supabase]  (fire-and-forget)

L9 → INSERT emergency_alert_events → push/SMS → contact app
```

---

## 5. WEB PLATFORM REQUIREMENTS

### 5.1 What Should Be Identical to Mobile

| Rule | Detail |
|------|--------|
| Alert thresholds | Same `DEFAULT_ALERT_MAP` and `admin_config` from Supabase |
| Drowsiness scoring | Use `computeLevelFromAlertMap()` from `packages/shared` |
| Alert trigger logic | Same 35s cooldown, level-comparison gate |
| Focus score formula | `max(0, round(100 - avgDrowsiness × 10))` |
| Session data model | Same Supabase tables, same column names |
| Emergency contact status rules | Same pending/accepted logic |
| Admin config save | Same RPC `update_admin_config` |
| Session history pagination | Same keyset + RPC `user_driving_history` |

### 5.2 What Should Be Adapted for Web

| Aspect | Mobile | Web |
|--------|--------|-----|
| Local storage | SQLite (expo-sqlite) | IndexedDB (Dexie) |
| Camera API | react-native-vision-camera | WebRTC getUserMedia |
| ML library | react-native-mediapipe (native) | MediaPipe WASM (browser) |
| Authentication redirect | `snoozeguard://auth/callback` | `window.location.origin/` |
| Push notifications | Expo push service | Web Push API (future) |
| Emergency SMS | TextBelt from client | TextBelt from server (recommended) |
| Alert UI | Full-screen modal | Page overlay or notification |
| Offline support | SQLite WAL, automatic | Dexie, manual flush |
| Navigation | React Navigation bottom tabs | React Router SPA |

### 5.3 What Should NOT Be Included on Web

| Feature | Reason |
|---------|--------|
| Accelerometer / brake detection | Not reliably available in browser |
| Expo push tokens | Mobile-only |
| MediaPipe native performance | Web WASM is slower — degrade gracefully |
| Physical flashlight | Not applicable |
| Voice alerts via Speech API | Web Speech API inconsistent — use browser notifications instead |

### 5.4 Page Mapping (Mobile Screen → Web Page)

| Mobile Screen | Web Page | URL | Notes |
|---------------|---------|-----|-------|
| LoginScreen | LoginPage | `/login` | Same auth flow, web redirects |
| HomeScreen | DashboardPage | `/` or `/dashboard` | Uses server RPC + client fallback |
| DriveScreen | DrivePage | `/drive` | Slower ML, manual demo buttons included |
| HistoryScreen | HistoryPage | `/history` | Server RPC pagination, sparklines added |
| AdminScreen | AdminPage | `/admin` | Identical config editor |
| ProfileScreen | (missing — to be built) | `/profile` | Emergency contact management |
| EmergencyAlertMapScreen | (missing — to be built) | `/alerts` | Contact requests + active alerts |

### 5.5 Web-Specific UX Considerations

- **Desktop layout:** Stats grid can use 3–4 columns vs 2 on mobile
- **Camera preview:** Should be a smaller inset panel; not full-screen
- **Session guard:** Warn on page unload (`window.onbeforeunload`) when session active
- **No hamburger menu:** Use top nav bar or sidebar for Profile/Admin links
- **Admin badge:** Show "Admin" link in nav only for `super_admin` role

---

## 6. IoT INTEGRATION REQUIREMENTS

### 6.1 Supported Device Types

| Device | Status | Camera | Alert Output |
|--------|--------|--------|-------------|
| ESP32-CAM (AI Thinker) | ✅ Current | OV2640 | 4× LED + passive buzzer |
| Generic ESP32 + camera module | 🔲 Planned | Via ribbon cable | Same |
| Raspberry Pi based | 🔲 Future | USB / CSI | TBD |

### 6.2 Communication Protocol

| Property | Value |
|----------|-------|
| Protocol | HTTP/1.1 (not HTTPS in current firmware — **RISK**) |
| Direction | Device → Server only (unidirectional push) |
| Frequency | Every 5,000ms per firmware default (configurable) |
| Auth | Shared secret header: `x-snoozeguard-device-key` |
| Format | JSON body |
| Endpoint | `POST /v1/iot/telemetry` |

### 6.3 Data Sync Behavior

| Behavior | Detail |
|----------|--------|
| Real-time vs batch | Real-time (each sample sent immediately, no batching) |
| Offline handling | Device does not queue — sends are fire-and-forget; offline samples lost |
| Session continuity | `session_external_id` field used to group samples into a session |
| Alert actions | `iot_led` and `iot_buzzer` actions defined in admin_config but currently NOT pushed back to device |

> **ASSUMPTION:** IoT device does not currently receive commands from server. Alert actions `iot_led` / `iot_buzzer` in the admin config are intended for future bidirectional communication (MQTT or WebSocket). Currently, the device operates independently.

### 6.4 Device Lifecycle

```
1. PROVISION
   - Flash firmware with: WIFI_SSID, WIFI_PASS, API_HOST, IOT_INGEST_SECRET, SESSION_EXTERNAL_ID
   - Register device_id in server (ASSUMPTION: currently manual or auto-registered on first POST)

2. BOOT
   - Connect to WiFi (20s timeout, restart on failure)
   - Sync NTP time (pool.ntp.org, time.nist.gov)
   - Begin telemetry loop

3. OPERATING
   - POST /v1/iot/telemetry every 5s
   - Include recorded_at from NTP-synced clock
   - Placeholder: drowsiness_level = 3.0 (real ML inference = future)
   - Log HTTP status to Serial monitor

4. RECONNECT
   - WiFi drop: [ASSUMPTION: Firmware does not currently handle reconnect; restart required]

5. SHUTDOWN
   - No graceful shutdown — power off stops telemetry; session_external_id resume on restart
```

### 6.5 Future: Bidirectional Control (Recommended)

To support `iot_led` and `iot_buzzer` alert actions, add MQTT or a polling endpoint:

```
OPTION A — MQTT (recommended for IoT):
  Device subscribes to: snoozeguard/device/{device_id}/actions
  Server publishes: { "action": "led_on", "duration_ms": 5000 }
  Broker: EMQX or HiveMQ (hosted)

OPTION B — Long-poll HTTP:
  Device polls: GET /v1/iot/commands/{device_id}
  Server returns: { "pending_actions": ["iot_led", "iot_buzzer"] }
  Device executes then ACKs: POST /v1/iot/commands/{device_id}/ack
```

### 6.6 Security Considerations

| Risk | Current State | Recommendation |
|------|--------------|----------------|
| HTTP not HTTPS | Firmware uses plain HTTP | **Use HTTPS.** Add TLS certificate or use HTTPS endpoint with certificate pinning |
| Shared secret | Single `IOT_INGEST_SECRET` for all devices | Per-device API keys stored in `devices` table |
| No device registry | IoT_DEFAULT_USER_ID maps all devices to one user | Add `iot_devices` table (device_id, user_id, api_key_hash) |
| NTP not authenticated | Pool NTP is unauthenticated | Acceptable for this use case; not safety-critical |
| Telemetry not encrypted | Data in transit is plaintext | Resolved by HTTPS enforcement |

---

## 7. CROSS-PLATFORM CONSISTENCY RULES

### 7.1 Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Database tables | snake_case, plural | `driving_sessions`, `session_telemetry` |
| Database columns | snake_case | `drowsiness_level`, `yawn_count_delta` |
| TypeScript types | PascalCase | `DrivingSession`, `AlertLevelConfig` |
| TypeScript fields | camelCase | `drowsinessLevel`, `yawnCount` |
| React components | PascalCase | `DriveScreen`, `HomeScreen` |
| API endpoints | `/v1/resource/action` | `/v1/iot/telemetry` |
| Alert levels | String keys "6"–"10" in alertMap | `alertMap["8"].actions` |
| Device type identifiers | lowercase string | `"mobile"`, `"web"`, `"iot"` |
| Session source strings | `{platform}_{method}` | `"mobile_mediapipe"`, `"web_mediapipe"`, `"iot_device"` |

### 7.2 API Contracts

All platforms must submit telemetry with the following required fields:

```typescript
{
  drowsiness_level: number,    // 0.0–10.0, two decimal places
  recorded_at: string,         // ISO 8601 UTC: "2026-04-13T10:30:00.000Z"
  source: string,              // "mobile_mediapipe" | "web_mediapipe" | "iot_device"
  yawn_count_delta: number,    // integer ≥ 0
  head_event_count_delta: number, // integer ≥ 0
  sudden_brake: boolean
}
```

### 7.3 Data Format Standards

| Field | Format | Example |
|-------|--------|---------|
| Timestamps | ISO 8601 UTC | `"2026-04-13T10:30:00.000Z"` |
| UUIDs | RFC 4122 v4 lowercase | `"7bd0ff01-1234-..."` |
| Drowsiness level | float, 0–10, max 2 decimal places | `6.75` |
| Counts (yawn, head) | non-negative integer | `3` |
| Boolean | `true` / `false` | `false` |
| Device type | enum string | `"mobile"` |

### 7.4 Timezone Handling

| Platform | Approach |
|----------|---------|
| All | Store all timestamps in UTC in database |
| Mobile | `new Date().toISOString()` always UTC |
| Web | `new Date().toISOString()` always UTC; pass `tz_offset = -new Date().getTimezoneOffset()` to RPCs |
| IoT | NTP-synced UTC; `recorded_at` in UTC |
| Display | Convert to local time at display layer only |
| RPC params | `p_tz_offset_minutes`: minutes east of UTC (e.g. UTC+8 → 480, UTC-5 → -300) |

### 7.5 Drowsiness Level Scale (Universal)

| Level | Meaning | Color | Status Label |
|-------|---------|-------|-------------|
| 0–3 | No fatigue | Green | Optimal |
| 4–5 | Minimal fatigue | Green | Stable |
| 6–7 | Mild–Moderate fatigue | Amber | Elevated |
| 8–10 | High–Critical | Red | Critical attention |

---

## 8. AI-READABLE SYSTEM CONTEXT

### 8.1 System Summary

```json
{
  "system_name": "SnoozeGuard",
  "purpose": "Real-time driver drowsiness detection and alert system",
  "platforms": ["mobile", "web", "iot"],
  "primary_language": "TypeScript",
  "backend": "Supabase (PostgreSQL + Auth + Realtime)",
  "mobile_framework": "Expo SDK 54 / React Native 0.81.5",
  "web_framework": "React + Vite",
  "iot_hardware": "ESP32-CAM (AI Thinker)",
  "ml_library": "MediaPipe Face Landmarker",
  "offline_first": true,
  "auth_provider": "Supabase Auth (Google OAuth + email/password)",
  "current_status": "Mobile near-complete, Web mostly implemented, IoT firmware basic"
}
```

### 8.2 Entities and Relationships

```json
{
  "entities": {
    "User": {
      "source": "auth.users (Supabase)",
      "extended_by": "profiles",
      "fields": ["id (UUID)", "email", "full_name", "role"],
      "roles": ["driver", "super_admin"]
    },
    "DrivingSession": {
      "table": "driving_sessions",
      "local_table": "driving_sessions_local",
      "fields": ["id", "user_id", "started_at", "ended_at", "device_type", "sync_status"],
      "device_types": ["mobile", "web", "iot"],
      "relationships": {
        "belongs_to": "User",
        "has_many": ["SessionTelemetry", "AlertEvent"]
      }
    },
    "SessionTelemetry": {
      "table": "session_telemetry",
      "local_table": "session_telemetry_local",
      "fields": ["id", "session_id", "recorded_at", "drowsiness_level", "yawn_count_delta", "head_event_count_delta", "sudden_brake", "source"],
      "relationships": {
        "belongs_to": "DrivingSession"
      },
      "write_frequency": "every 1000ms during active session"
    },
    "AdminConfig": {
      "table": "admin_config",
      "singleton": true,
      "id": 1,
      "fields": ["yawn_threshold", "head_movement_threshold", "drowsiness_trigger_level", "alert_map (JSONB)"],
      "write_access": "super_admin only via RPC"
    },
    "AlertEvent": {
      "table": "alert_events",
      "fields": ["id", "user_id", "driving_session_id", "drowsiness_level", "trigger_level", "alert_label", "source"],
      "created_when": "each time alert modal is shown to driver"
    },
    "EmergencyContact": {
      "table": "emergency_contacts",
      "fields": ["id", "user_id (driver)", "contact_name", "contact_phone", "contact_email", "contact_user_id", "status"],
      "statuses": ["pending", "accepted", "declined"],
      "relationships": {
        "driver": "User (user_id)",
        "contact": "User (contact_user_id, nullable)"
      }
    },
    "EmergencyAlertEvent": {
      "table": "emergency_alert_events",
      "fields": ["id", "user_id", "driving_session_id", "status", "latitude", "longitude", "acknowledged_at", "dismissed_at"],
      "statuses": ["active", "alerted", "dismissed"],
      "created_when": "driver reaches L9 and countdown expires or manual trigger"
    }
  }
}
```

### 8.3 Key Workflows (Step-by-Step Logic)

#### Workflow: Start and Monitor Driving Session

```
PRECONDITIONS:
  - User is authenticated
  - Camera permission granted
  - MediaPipe model downloaded to documentDirectory

STEPS:
  1. User taps "Start Driving"
  2. loadAdminConfig() → fetch admin_config from Supabase (or use cached)
  3. Generate UUID → INSERT driving_sessions_local (user_id, started_at, device_type='mobile')
  4. sessionActiveRef = true, drivingSessionActive = true
  5. FaceCamera activates → snapshot loop every 600ms
     FOR EACH FRAME:
       a. takeSnapshot(quality=40) → temp file path
       b. faceLandmarkDetectionOnImage(path, modelPath) → landmarks + blendshapes
       c. parseFaceFrame(result) → { jawOpen, pitch, roll } or null
       d. IF jawOpen >= 0.6: skip head/tilt detectors (yawn in progress)
       e. yawnDetector.process(frame, now)
       f. headDetector.process(frame, now)
       g. tiltDetector.process(frame, now)
       h. delete temp snapshot file
  6. Accelerometer listener (100ms) → suddenBrakeRef if delta > 0.45 for 2 frames
  7. Tick interval (1000ms):
       a. level = computeLevelFromAlertMap(yawnAcc, headAcc, brakeFlag, alertMap)
       b. INSERT session_telemetry_local (level, yawnDelta, headDelta, brake)
       c. flushPendingTelemetry() [async, fire-and-forget]
       d. IF level >= triggerLevel AND !alertOpen AND cooldown passed:
            → setAlertOpen(true), playMobileAlertActions(actions)
  8. User taps "End Session":
       a. stopTick(), sessionActiveRef=false, drivingSessionActive=false
       b. UPDATE driving_sessions_local SET ended_at=now()
       c. setLocalSessionId(null) → UI clears immediately
       d. [background] flushEndedSessions() + flushPendingTelemetry()
```

#### Workflow: Emergency Alert at Level 9

```
TRIGGER: level >= 9 AND alertOpen = true

STEPS:
  1. setAlertLevel(9), setAlertOpen(true)
  2. useEffect detects alertLevel >= 9 → startEcCountdown()
  3. setEcCountdown(120), interval ticks down every 1s
  4. Display countdown: "Auto-notifying emergency contact in {N}s"
  5. At 0s OR user taps "Notify Now":
       a. captureLocation() → { latitude, longitude }
       b. INSERT emergency_alert_events (status='active', lat, lng)
       c. IF contact has push token → Expo push notification
       d. IF contact has phone → TextBelt SMS: "Driver is experiencing drowsiness. Location: ..."
       e. activeAlertIdRef.current = alertId
  6. Driver taps "I'm alert — dismiss":
       a. stopEcTimer()
       b. acknowledgeEmergencyAlert(alertId) → status='alerted', acknowledged_at=now()
       c. setAlertOpen(false)
  7. Emergency contact sees alert in Alerts tab:
       a. Polls emergency_alert_events every 30s
       b. Shows driver name, timestamp, location (Google Maps link)
       c. Call / SMS buttons
       d. "Mark as resolved" → status='dismissed', dismissed_at=now()
```

#### Workflow: Admin Config Update

```
PRECONDITIONS: user.role = 'super_admin'

STEPS:
  1. AdminScreen mounts → fetch admin_config (id=1) from Supabase
  2. Admin edits: trigger level, per-level labels/thresholds/actions
  3. Taps "Save":
       a. Build payload: { p_yawn_threshold, p_head_movement_threshold, p_drowsiness_trigger_level, p_alert_map, p_updated_by }
       b. supabase.rpc('update_admin_config', payload)
       c. RPC (SECURITY DEFINER):
            i.  Checks profiles.role = 'super_admin' for auth.uid()
            ii. IF NOT → raise exception
            iii. UPDATE admin_config SET ... WHERE id=1
       d. On success: green message "Configuration saved"
       e. On error: red message with error.code + error.hint
  4. All connected sessions pick up new config on next NetInfo reconnect or session start
```

#### Workflow: IoT Telemetry Ingest

```
STEPS (on device, every 5000ms):
  1. Build JSON payload:
       { device_id, session_external_id, recorded_at (NTP UTC), drowsiness_level, yawn_count, head_movement_events, sudden_brake }
  2. HTTP POST /v1/iot/telemetry
       Header: x-snoozeguard-device-key: <secret>
  3. Server (IoT Ingest API):
       a. Validate header → 401 if missing/wrong
       b. Parse JSON → Zod schema validation → 400 if invalid
       c. Lookup or create driving_session via session_external_id
       d. INSERT session_telemetry with source='iot_device'
       e. Return { ok: true, session_id }
  4. Device logs response to Serial monitor
```

### 8.4 Glossary

| Term | Definition |
|------|-----------|
| `drowsiness_level` | Integer 0–10 representing fatigue severity (0=alert, 10=critical) |
| `trigger_level` | Admin-configured minimum level to show alert modal |
| `alertMap` | JSONB config mapping levels 6–10 to labels, thresholds, and actions |
| `yawnAccRef` | Running session total of detected yawn events (resets each session) |
| `headAccRef` | Running session total of head movement events |
| `yawnDelta` / `headDelta` | Count of events in the last tick interval (1s) |
| `session_external_id` | Client-generated UUID linking IoT samples to a logical session |
| `device_type` | Platform string: "mobile" | "web" | "iot" |
| `source` | Telemetry origin: "mobile_mediapipe" | "web_mediapipe" | "iot_device" |
| `ended_synced` | SQLite column (0/1): whether session end was pushed to Supabase |
| `remote_synced` | SQLite column (0/1): whether telemetry row was pushed to Supabase |
| `jawOpen` | MediaPipe face blendshape score (0.0–1.0) indicating jaw opening |
| `pitch` | Estimated head rotation up/down (from landmark ratios, not matrix) |
| `roll` | Estimated head tilt left/right (from forehead→chin axis angle) |
| `super_admin` | User role with access to AdminScreen; can save admin_config |
| `focus_score` | Computed score 0–100 inversely proportional to average drowsiness |
| `SECURITY DEFINER` | PostgreSQL function attribute: runs with definer's privileges, not caller's |
| `IOT_DEFAULT_USER_ID` | Server env var: Supabase user UUID that owns IoT session/telemetry rows |
| `IOT_INGEST_SECRET` | Server env var / firmware constant: shared secret for IoT API auth |

---

## 9. NON-FUNCTIONAL REQUIREMENTS

### 9.1 Performance

| Requirement | Target | Current State |
|-------------|--------|--------------|
| Face detection frame rate | 1 frame/600ms (mobile) | ✅ Achieved via snapshot loop |
| Alert response latency | < 2s from level crossing | ✅ 1s tick + immediate modal |
| App cold start | < 3s to Start Driving ready (model cached) | Model download ~5s first run |
| History pagination | < 500ms per page | ✅ Local SQLite query |
| Telemetry sync latency | < 10s from session end | ✅ Fire-and-forget async |
| IoT POST latency | < 2s round-trip | Dependent on WiFi quality |
| Dashboard load | < 1.5s | Dependent on RPC response time |

### 9.2 Scalability

| Aspect | Current | Recommendation |
|--------|---------|---------------|
| Telemetry volume | 1 row/sec/session → 3,600/hour/device | Partition `session_telemetry` by month |
| Session history | Last 40 for metrics | RPC handles aggregation server-side |
| Admin config | Singleton table (id=1) | Add versioning if multi-org needed |
| IoT device fleet | 1 device, 1 shared user | Per-device user mapping table |
| Concurrent sessions | Each session is independent | No shared state; scales linearly |

### 9.3 Security

| Area | Requirement | Current State |
|------|-------------|--------------|
| Authentication | Supabase JWT on all requests | ✅ |
| Data isolation | RLS: users see only own data | ✅ |
| Admin functions | SECURITY DEFINER RPC with role check | ✅ |
| IoT auth | Shared secret header | ⚠️ Use per-device keys |
| IoT transport | Should be HTTPS | ⚠️ Currently HTTP |
| Token storage | expo-secure-store (mobile), Supabase default (web) | ✅ |
| Emergency contact access | Only accepted contacts see driver alerts | ✅ |
| Personal data | GPS stored only in emergency_alert_events | ✅ |

### 9.4 Offline Behavior

| Platform | Offline Detection | Local Storage | Sync Trigger |
|----------|-------------------|---------------|-------------|
| Mobile | NetInfo.addEventListener | SQLite WAL | NetInfo reconnect + session end |
| Web | navigator.onLine (assumed) | IndexedDB (Dexie) | Manual flush or online event |
| IoT | None | None (samples lost) | N/A — always-on required |

### 9.5 Logging & Monitoring

| Component | What to Log | Current State |
|-----------|------------|--------------|
| DriveScreen | Admin config fetch, session start/end, model download | ✅ console.error |
| AdminScreen | Save payload, RPC result, role check | ✅ console.log |
| Flush | Telemetry push counts | ⚠️ Not currently logged |
| IoT Ingest API | HTTP status, validation errors, DB write result | ✅ Serial.println on device |
| Face Detection | Frame errors silently dropped | ✅ Intentional skip |
| Emergency Alert | Alert creation, push send result | ⚠️ Partial |

**Recommendation:** Add structured logging (JSON) to Supabase Edge Functions or a dedicated logging table (`system_logs`) for production monitoring.

---

## 10. RISKS & GAPS

### 10.1 Known Gaps in Current Implementation

| # | Gap | Impact | Recommended Fix |
|---|-----|--------|----------------|
| G1 | IoT device does not receive alert actions (iot_led, iot_buzzer currently one-way) | LED/buzzer alerts don't work from server config | Implement MQTT subscribe or polling endpoint on device |
| G2 | IoT uses HTTP not HTTPS | Security risk — telemetry interceptable | Add TLS; use HTTPS endpoint |
| G3 | Single IOT_DEFAULT_USER_ID for all devices | All IoT sessions belong to one account | Add `iot_devices` table with per-device user mapping |
| G4 | Telemetry flush has no idempotency key | Retry on flush error could insert duplicates | Add client-generated row UUIDs + upsert |
| G5 | Web ProfilePage and AlertsPage not yet built | Web users cannot manage emergency contacts | Build these pages (defined in page mapping) |
| G6 | SMS API key stored in admin_config (DB) and loaded to client | Key readable in memory; acceptable for thesis scope | Move to Supabase Edge Function for production |
| G7 | IoT firmware ML is placeholder (hardcoded level=3.0) | Device sends fake data | Implement on-device inference (TensorFlow Lite ESP) |
| G8 | No device registration table | Cannot identify which device belongs to which user | Create `iot_devices` table |
| G9 | WiFi reconnect not handled in firmware | Session interrupted by WiFi drop | Add WiFi reconnect logic with back-off |
| G10 | Web DrivePage uses manual demo buttons | Not production-ready for real ML | MediaPipe WASM integration is present but not fully wired |

### 10.2 Potential Inconsistencies

| # | Issue | Detail |
|---|-------|--------|
| I1 | `focus_score` formula differs on mobile vs web | Mobile: `100 - avg × 10`; Web RPC: `100 - avg × 9` | Standardize to `× 10` (clearer scale) |
| I2 | `user_dashboard_metrics` uses Supabase telemetry; mobile dashboard uses local SQLite | Session counts will differ when sync is delayed | Document this expected lag; add last-synced indicator |
| I3 | `yawn_threshold` and `head_movement_threshold` in admin_config are not used by mobile scoring | Mobile uses per-level thresholds from alert_map; legacy flat thresholds exist | Deprecate flat thresholds or clarify their use |
| I4 | `alert_map` defaults missing levels below 6 | computeLevelFromAlertMap returns 0 for levels 1–5 which is correct, but UI shows "no config" | Not a bug; document expected behavior |
| I5 | `session_telemetry.sudden_brake` is BOOLEAN in Supabase but INTEGER (0/1) in SQLite | Type coercion required during sync | Add explicit cast in flush.ts |

### 10.3 Scaling Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `session_telemetry` table grows unboundedly (1 row/sec/session) | High (long-term) | Query slowness | Add time-based partitioning + archival policy |
| Admin config singleton race condition (concurrent saves) | Low | Config corruption | Add optimistic locking (updated_at check in RPC) |
| Emergency push notification delivery failure (Expo service) | Medium | Driver not notified | Log failures; add fallback (SMS already exists) |
| MediaPipe model CDN unavailability | Low | New users cannot start sessions | Bundle model in app binary or host internally |
| OTA update breaks binary-incompatible native code | Medium | Silent crash on update | Pin native module versions; test before OTA push |

### 10.4 Assumptions Made in This Document

| # | Assumption | Basis |
|---|-----------|-------|
| A1 | SMS provider config (sms_provider, sms_api_key) stored in admin_config and fetched at session start | Semaphore (PH), Twilio, or TextBelt selectable in AdminScreen. For PH numbers use Semaphore. |
| A2 | IoT Ingest API uses Hono framework | Directory structure + common pattern for this stack |
| A3 | Device auto-registers on first POST (no pre-registration step) | No devices table found in migrations |
| A4 | admin_config.yawn_threshold / head_movement_threshold are legacy fields (not used in mobile alert scoring) | Mobile uses alertMap per-level thresholds via computeLevelFromAlertMap |
| A5 | WiFi reconnect not handled — requires power cycle | Firmware main.cpp reviewed; no reconnect loop found |
| A6 | `get_user_id_by_email` RPC returns null if email not found | Standard pattern; not directly tested |
| A7 | Focus score uses base-10 multiplier (10 per level) on mobile | Confirmed in HomeScreen.tsx: `100 - avgDrowsiness * 10` |

---

### 10.5 Change History (v1.1–1.2)

| Date | Change | Files |
|------|--------|-------|
| 2026-04-17 | Left navigation drawer replaces burger menu | App.tsx — AppDrawer, createNavigationContainerRef |
| 2026-04-17 | Alert level dismiss guard (dismissedLevelsRef) | DriveScreen.tsx — prevents re-trigger at same level |
| 2026-04-17 | Level 10 re-trigger logic | DriveScreen.tsx — LEVEL10_YAWN/HEAD_RETRIGGER constants |
| 2026-04-17 | Configurable score reset timer | DriveScreen.tsx + admin_config.score_reset_minutes |
| 2026-04-17 | TTS voice for tilt + brake alerts | DriveScreen.tsx — Speech.speak before modal |
| 2026-04-17 | Multi-provider SMS (Semaphore/Twilio/TextBelt) | emergencyNotify.ts — sendAutoSms with SmsConfig |
| 2026-04-17 | SMS config in AdminScreen | AdminScreen.tsx + admin_config sms_provider/sms_api_key |
| 2026-04-17 | Inline errors + spinner in LoginScreen | LoginScreen.tsx — replaced all Alert.alert |
| 2026-04-17 | Sign-out removed from HomeScreen | HomeScreen.tsx — sign out via drawer only |
| 2026-04-17 | Mount confirmation before session start | DriveScreen.tsx — showMountModal bottom sheet |

*End of Document — SnoozeGuard BRD & Technical Alignment v1.2*  
*Update this document whenever a breaking change is made to the data model, API contract, or core business logic.*
