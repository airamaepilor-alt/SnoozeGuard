# AI_CONTEXT_BLOCK — SnoozeGuard

**Version:** 1.4 | **Date:** 2026-04-18 | **Format:** Machine-readable compressed context  
**Purpose:** Drop this block into any AI prompt to provide complete system understanding without re-analyzing the codebase.  
**Updates:** Increment version and update only changed sections; reference unchanged sections by label.

---

## HOW TO USE THIS BLOCK

Copy sections relevant to your task. For full-system changes, include all sections. For feature-specific work, include SYSTEM_MAP + the relevant FEATURE entry + CRITICAL_LOGIC.

---

## SECTION 1 — AI-OPTIMIZED SYSTEM SUMMARY

```
SYSTEM: SnoozeGuard
TYPE: Real-time driver drowsiness detection + alert system
STACK: React Native (Expo SDK 54) + React (Vite) + ESP32-CAM + Supabase + Node.js/Hono
GROUND_TRUTH_PLATFORM: Mobile (apps/mobile/)
ML_ENGINE: MediaPipe Face Landmarker (native on mobile, WASM on web)
STORAGE_TRUTH: Local SQLite (expo-sqlite) → Supabase cloud sync
AUTH: Supabase Auth (Google OAuth + email/password)
OFFLINE: Mobile/Web are offline-first; IoT requires WiFi

KEY MODULES (mobile):
  ml/faceDetection.ts               → parseFaceFrame(), yawn/head/tilt detectors
  screens/DriveScreen.tsx           → session lifecycle, alert engine, FaceCamera
  screens/HomeScreen.tsx            → dashboard, reads local SQLite
  screens/HistoryScreen.tsx         → session list + DateRangePicker, reads local SQLite
  screens/AnalyticsScreen.tsx       → charts (area/bar/donut), reads local SQLite
  screens/AdminScreen.tsx           → alert map config (super_admin only)
  screens/EmergencyContactScreen.tsx → EC management, offline-first (SQLite cache)
  screens/AccountScreen.tsx         → account management, sign out
  screens/AboutScreen.tsx           → app info, detection explanation, thesis context
  screens/TermsScreen.tsx           → Terms of Service & Privacy Policy
  screens/EmergencyAlertMapScreen.tsx → view/respond to emergency alerts, offline-first
  screens/EmergencyContactSetupModal.tsx → first-time EC setup (writes Supabase + SQLite)
  screens/LoginScreen.tsx           → auth (Google OAuth + email/password), Terms link
  components/DateRangePicker.tsx    → custom calendar date range picker (zero new deps)
  components/InfoModal.tsx          → shared tooltip/info modal
  components/OfflineNotificationModal.tsx → reusable offline warning modal (themed, animated fade)
  lib/alertMap.ts (packages/shared) → computeLevelFromAlertMap(), default thresholds
  db/database.ts                    → SQLite schema + getDatabase() + getPref/setPref
  sessionState.ts                   → module-level refs (drivingSessionActive, endSessionFn)
  lib/supabase.ts                   → Supabase client singleton
  lib/emergencyNotify.ts            → push token registration, EC lookup/upsert
  context/ThemeContext.tsx          → ThemeProvider, useTheme(), useThemeToggle(), persisted to SQLite
  context/SessionContext.tsx        → React context for current Supabase session
  navigation/types.ts               → MainTabParamList

ALERT PIPELINE:
  Face frame (600ms) → parseFaceFrame → detectors (yawn/head/tilt)
  → accumulators (yawnAcc, headAcc, brakeFlag)
  → tick (1000ms) → computeLevelFromAlertMap → if level≥trigger → show alert modal
  → playMobileAlertActions(actions[]) → voice/vibration/alarm/iot_led/iot_buzzer

DROWSINESS LEVELS: 0 (none) → 10 (critical). Threshold per level in admin_config.
EMERGENCY: Levels 9-10 trigger push notification + auto-SMS + location to emergency contact.
SMS_PROVIDERS: Semaphore (PH, free 10), Twilio (trial $15), TextBelt (1/day free fallback).
NAVIGATION: Left-side Animated drawer (AppDrawer) + bottom tab navigator.
  Visible tabs: Home · Analytics · Drive · Alerts · History
  Hidden (drawer-only): EmergencyContact · Account · About · Terms · Admin(super_admin)
ALERT_BADGE: "!" string (not a count number) when active alerts or pending EC requests exist.
ALERT_DISMISS_GUARD: dismissedLevelsRef (Set<number>) — once a level is dismissed it won't re-fire.
  Exception: level 10 re-triggers every 3 yawns or 10 head events after dismiss (isLevel10Retrigger).
SCORE_RESET: After level-10 idle for scoreResetMinutes (default 2), all accumulators + dismissedLevels clear.
TILT/BRAKE_VOICE: Both tilt (10s sustained) and sudden brake directly speak TTS before showing alert modal.
THEME: Dark/light toggle via ThemeProvider. Persisted to SQLite user_preferences("theme_mode").
  All screens: useTheme() + const styles = useMemo(() => makeStyles(t), [t])
  Pattern: makeStyles = (t: Theme) => StyleSheet.create({...})
  NEVER use static theme import for screen styles — breaks light mode.
OFFLINE_EC: EC data cached in emergency_contacts_local SQLite table.
  Written by: EmergencyContactSetupModal (after save), EmergencyContactScreen (load/save),
              App.tsx startup effect, App.tsx NetInfo reconnect listener.
SVG_LABELS: Always use Text as SvgText from react-native-svg. RN <Text> inside <Svg> does not render.
OTA: User-initiated only: cd apps/mobile && eas update --branch preview --message "..."
     EAS account: airamaepilor. Installed APK is on preview channel.
```

---

## SECTION 2 — STRUCTURED SYSTEM MAP

```json
{
  "entities": {
    "User": {
      "table": "profiles",
      "fields": ["id (uuid, FK auth.users)", "role (driver|super_admin)", "full_name", "phone", "created_at"],
      "local": null
    },
    "DrivingSession": {
      "table": "driving_sessions",
      "local_table": "driving_sessions_local",
      "fields": ["id (uuid)", "user_id", "started_at", "ended_at", "device_type", "ended_synced"],
      "sync": "SQLite → Supabase (background, fire-and-forget)",
      "ground_truth": "SQLite"
    },
    "SessionTelemetry": {
      "table": "session_telemetry",
      "local_table": "session_telemetry_local",
      "fields": [
        "id", "local_session_id (FK driving_sessions_local.id)",
        "supabase_session_id", "user_id", "recorded_at",
        "drowsiness_level (0-10)", "yawn_count_delta", "head_event_count_delta",
        "head_tilt_delta", "sudden_brake", "alert_triggered", "alert_level", "alert_actions (json)"
      ],
      "sync": "SQLite → Supabase (background)",
      "ground_truth": "SQLite"
    },
    "AdminConfig": {
      "table": "admin_config",
      "fields": ["id", "alert_map (jsonb)", "trigger_level (int)", "score_reset_minutes (int, default 2)", "sms_provider (text)", "sms_api_key (text)", "updated_by", "updated_at"],
      "structure": "alert_map: { '6': {label, actions[], yawn_count, head_count}, ... '10': {...} }",
      "valid_actions": ["voice", "vibration", "alarm", "iot_led", "iot_buzzer"],
      "sms_providers": { "semaphore": "PH gateway, apikey only", "twilio": "apiKey=SID:TOKEN:FROM", "textbelt": "1 free/day, no key needed" }
    },
    "EmergencyContact": {
      "table": "emergency_contacts",
      "local_table": "emergency_contacts_local",
      "fields": ["id", "user_id (driver)", "contact_name", "contact_email", "contact_phone", "contact_user_id", "status (pending|accepted|declined)"],
      "local_fields": ["user_id (PK)", "contact_name", "contact_phone", "contact_email", "my_phone", "pending_sync (0|1)", "updated_at"],
      "note": "contact_user_id set by trigger when contact signs up; status=pending until accepted. Local cache written by 3 places: Setup modal, EC screen save/load, App.tsx startup+reconnect."
    },
    "EmergencyAlertEvent": {
      "table": "emergency_alert_events",
      "local_table": "emergency_alert_events_local",
      "fields": ["id", "user_id", "session_id", "location_lat", "location_lng", "status (active|alerted|dismissed)", "created_at", "acknowledged_at"],
      "local_fields": ["id (PK)", "user_id", "location_lat", "location_lng", "status", "created_at", "acknowledged_at", "driver_name", "driver_phone", "cached_at"],
      "trigger": "level >= 9 after 2-minute countdown (ecTimerRef) → triggerEmergencyAlert() → push + SMS"
    },
    "PushToken": {
      "table": "push_tokens",
      "fields": ["user_id", "token", "updated_at"],
      "provider": "Expo Push Notifications"
    },
    "UserPreferences": {
      "table": null,
      "local_table": "user_preferences",
      "fields": ["key (PK TEXT)", "value (TEXT)"],
      "used_for": "theme_mode ('dark'|'light')",
      "helpers": "getPref(key) and setPref(key, value) exported from db/database.ts"
    }
  },

  "navigation": {
    "type": "Bottom tab + left drawer",
    "visible_tabs": ["Home", "Analytics", "Drive", "Alerts", "History"],
    "hidden_tabs": ["EmergencyContact", "Account", "About", "Terms", "Admin"],
    "hidden_tab_style": "tabBarItemStyle: { display: 'none' }",
    "drawer": {
      "component": "AppDrawer in App.tsx",
      "width": 300,
      "animation": "Animated.spring",
      "trigger": "openDrawerRef.current() from headerLeft hamburger",
      "nav_items_order": ["EmergencyContact", "Account", "About SnoozeGuard", "Terms & Privacy", "Admin (super_admin only)", "Web Dashboard (coming soon, disabled)"],
      "share_button": "Icon-only button (primary bg) in drawer user section header — native Share API with Expo download link"
    },
    "tab_center": "Drive is at position 3 of 5 (center)"
  },

  "apis": {
    "supabase_rpcs": {
      "user_dashboard_metrics": "Returns total_sessions, avg_drowsiness, total_yawns, total_head_events for user",
      "user_driving_history": "Paginated session list with aggregated telemetry",
      "update_admin_config": "SECURITY DEFINER — super_admin only; sig includes score_reset_minutes, sms_provider, sms_api_key",
      "get_user_id_by_email": "SECURITY DEFINER — looks up user id by email (for EC matching)"
    },
    "iot_ingest_api": {
      "base": "services/api (Node.js, Hono framework)",
      "endpoint": "POST /v1/iot/telemetry",
      "auth": "x-snoozeguard-device-key header",
      "payload": "{ device_id, user_id, session_id, drowsiness_level, yawn_count, head_events, alert_triggered, alert_actions[], timestamp }",
      "response": "{ ok: true, actions: string[] } — actions list tells device what to activate"
    },
    "supabase_realtime": {
      "channel": "emergency_alert_events",
      "used_by": "EmergencyAlertMapScreen — live badge count, map pin updates (supplemented by 15s polling)"
    }
  },

  "features": {
    "face_detection": {
      "library": "react-native-mediapipe v0.6.0",
      "mode": "IMAGE (snapshot, not video stream)",
      "interval_ms": 600,
      "model_file": "face_landmarker.task",
      "model_location": "expo FileSystem documentDirectory",
      "key_landmarks": { "forehead": 10, "chin": 152, "noseBridge": 168, "noseTip": 1 },
      "key_blendshape": "jawOpen (0.0-1.0)"
    },
    "yawn_detection": {
      "open_threshold": 0.7,
      "close_threshold": 0.4,
      "cooldown_ms": 2000,
      "suppression": "skip head/tilt detectors when jawOpen >= 0.6"
    },
    "head_movement_detection": {
      "pitch_threshold": 0.35,
      "roll_threshold_rad": 0.25,
      "fires_on": "transition: centered→offCenter only",
      "cooldown_ms": 500
    },
    "head_tilt_detection": {
      "sustained_ms": 10000,
      "grace_frames": 4,
      "grace_window_ms": 2400,
      "result": "forces alert level=8 directly (bypasses scoring formula)"
    },
    "sudden_brake_detection": {
      "sensor": "Accelerometer at 100ms",
      "delta_threshold": 0.45,
      "trigger_count": 2,
      "max_count": 6,
      "cooldown_ms": 3000,
      "result": "sets suddenBrakeRef=true, consumed on next tick → level jumps to 9"
    },
    "drowsiness_scoring": {
      "formula": "computeLevelFromAlertMap(yawnAcc, headAcc, brakeFlag, alertMap)",
      "input": "session-total yawn count, session-total head events, brake boolean",
      "output": "level 0-10",
      "override": "sudden brake → immediate level 9; sustained tilt → immediate level 8"
    },
    "alert_system": {
      "trigger": "level >= adminConfig.trigger_level AND alertOpenRef.current=false AND cooldown passed",
      "actions": {
        "voice": "expo-speech TTS — reads alert message",
        "vibration": "Vibration.vibrate([0,500,300,500,300,500,300,500,300,500], false) — 5 pulses",
        "alarm": "expo-av Audio — tries alarm_alert URI then ringtone URI, fallback vibration",
        "iot_led": "HTTP to IoT device — flash LEDs",
        "iot_buzzer": "HTTP to IoT device — sound buzzer"
      },
      "suppression": "alertOpenRef=true blocks face processing while modal open"
    },
    "analytics": {
      "charts": ["AreaChart (fatigue fluctuations)", "BarChart (session activity)", "BarChart (hourly fatigue)", "DonutChart (detection breakdown)"],
      "filters": ["7D", "30D", "90D"],
      "data_source": "local SQLite only",
      "chart_library": "react-native-svg",
      "label_note": "All text inside SVG uses SvgText from react-native-svg. Never RN Text inside Svg.",
      "colors": { "session_activity": "#60a5fa", "hourly_fatigue": "#f97316" },
      "tooltips": "InfoModal component on all chart cards"
    },
    "history": {
      "data_source": "local SQLite only",
      "date_picker": "Custom DateRangePicker calendar component (components/DateRangePicker.tsx)",
      "date_picker_note": "Zero new dependencies. Pure JS/RN, works OTA. Tap start date → tap end date → Apply.",
      "pagination": "20/page, offset-based, Load more button"
    },
    "theme": {
      "modes": ["dark", "light"],
      "persistence": "user_preferences SQLite table, key='theme_mode'",
      "context": "ThemeContext.tsx — ThemeProvider, useTheme(), useThemeToggle()",
      "pattern": "useTheme() + useMemo(() => makeStyles(t), [t]) in every screen",
      "toggle_ui": "headerRight button (sun/moon icon) on all screens"
    },
    "offline_mode": {
      "ec_cache": "emergency_contacts_local SQLite table",
      "alert_cache": "emergency_alert_events_local SQLite table",
      "pattern": "Read cache immediately → show data → fetch Supabase if online → update cache",
      "auto_sync": "NetInfo listener in App.tsx MainApp: offline→online transition re-fetches EC and updates cache",
      "offline_banner": "Shown when isOffline=true in EmergencyContactScreen and EmergencyAlertMapScreen"
    },
    "terms_privacy": {
      "screen": "screens/TermsScreen.tsx",
      "access_points": ["Login screen footer link (slide-up Modal)", "Drawer nav item (hidden tab)"],
      "content": "11 sections covering camera use, location, data storage, EC notifications, user rights, liability"
    },
    "session_navigation_guard": {
      "mechanism": "module-level refs in sessionState.ts",
      "refs": "drivingSessionActive.current (bool), endSessionFn.current (fn|null)",
      "guard_location": "App.tsx screenListeners tabPress",
      "behavior": "if drivingSessionActive && navigating away → ConfirmModal (themed) → End Session & Leave calls endSessionFn.current()"
    },
    "emergency_notification": {
      "trigger": "alert level >= 9",
      "method": "Expo Push Notifications to contact's push token",
      "data": "driver name, location (lat/lng), session_id",
      "event_table": "emergency_alert_events (status: active → alerted → dismissed)"
    },
    "alert_badge": {
      "type": "string | number | undefined",
      "value_when_active": "\"!\" (exclamation, not count number)",
      "refresh": "every 30s + on Alerts tab focus"
    },
    "offline_sync": {
      "mobile": "SQLite WAL mode, FK constraints. Flush: flushEndedSessions() + flushPendingTelemetry() called fire-and-forget",
      "web": "Dexie (IndexedDB)",
      "iot": "No offline — requires WiFi, HTTP POST every 5s"
    }
  },

  "relationships": {
    "User → DrivingSession": "1:many (user_id FK)",
    "DrivingSession → SessionTelemetry": "1:many (local_session_id FK)",
    "User → EmergencyContact": "1:1 (driver has one contact)",
    "EmergencyContact → User": "contact_user_id links to contact's profile",
    "User → PushToken": "1:1 (upserted on app start)",
    "DrivingSession → EmergencyAlertEvent": "1:many (session_id FK)"
  },

  "dependencies": {
    "mobile": [
      "expo SDK 54",
      "react-native 0.81.5",
      "react-native-mediapipe ^0.6.0",
      "react-native-vision-camera v4",
      "@supabase/supabase-js",
      "expo-sqlite ~16.0.10",
      "expo-av (Audio)",
      "expo-location",
      "expo-sensors (Accelerometer)",
      "expo-speech",
      "expo-notifications",
      "@react-native-community/netinfo 11.4.1",
      "@react-navigation/bottom-tabs + native",
      "react-native-maps",
      "react-native-svg ^15.15.4",
      "@expo/vector-icons (MaterialIcons)"
    ],
    "web": ["React + Vite", "@mediapipe/tasks-vision (WASM)", "Dexie", "@supabase/supabase-js"],
    "iot": ["ESP32-CAM AI Thinker", "OV2640 camera", "Arduino/ESP-IDF", "HTTP client"],
    "backend": ["Supabase (managed Postgres + Auth + Realtime)", "Node.js / Hono (IoT ingest API)"],
    "shared_package": "packages/shared/src/alertMap.ts — computeLevelFromAlertMap(), DEFAULT_ALERT_MAP"
  }
}
```

---

## SECTION 3 — FEATURE-TO-CODE MAPPING

```yaml
feature: "Driving Session Lifecycle"
  entry_point: apps/mobile/screens/DriveScreen.tsx
  start_fn: startSession() [useCallback]
  end_fn: endSession() [useCallback, synchronous]
  state_refs:
    - sessionIdRef: current local SQLite session UUID
    - sessionActiveRef: guards tick/camera loops
    - drivingSessionActive: module-level (sessionState.ts) for nav guard
    - endSessionFn: module-level (sessionState.ts) for App.tsx to call
  db_ops:
    start: "INSERT INTO driving_sessions_local (id, user_id, started_at)"
    end: "UPDATE driving_sessions_local SET ended_at=? WHERE id=?"
    tick: "INSERT INTO session_telemetry_local (...)"
  cloud_ops:
    sync: "sync/flush.ts — flushEndedSessions(), flushPendingTelemetry()"
    config: "supabase.from('admin_config').select() on session start"
  ui: DriveScreen.tsx — FaceCamera, alert modal overlay, level meter

feature: "Face Detection Pipeline"
  files:
    - apps/mobile/ml/faceDetection.ts [parseFaceFrame, detectors]
    - apps/mobile/screens/DriveScreen.tsx [FaceCamera component, snapshot loop]
  landmarks_declaration_order: "CRITICAL — forehead/chin/noseBridge/noseTip declared TOGETHER before roll calc"
  roll_formula: "Math.atan2(forehead.x - chin.x, chin.y - forehead.y)"
  pitch_formula: "derived from noseBridge/noseTip landmark ratios"
  snapshot_loop: "takeSnapshot({quality:40}) → temp file → faceLandmarkDetectionOnImage → parseFaceFrame → delete file"
  constants:
    TILT_DURATION_MS: 10000
    TILT_MAX_MISSES: 4
    YAWN_OPEN_THRESH: 0.7
    YAWN_CLOSE_THRESH: 0.4
    YAWN_COOLDOWN_MS: 2000
    HEAD_PITCH_THRESH: 0.35
    HEAD_ROLL_THRESH_RAD: 0.25
    HEAD_COOLDOWN_MS: 500
    BRAKE_DELTA_THRESH: 0.45
    BRAKE_TRIGGER_COUNT: 2
    BRAKE_COOLDOWN_MS: 3000

feature: "Alert Engine"
  files:
    - packages/shared/src/alertMap.ts [computeLevelFromAlertMap, DEFAULT_ALERT_MAP]
    - apps/mobile/screens/DriveScreen.tsx [tick handler, playMobileAlertActions]
  level_map_default:
    "6": "Mild — voice only"
    "7": "Moderate — voice + vibration"
    "8": "Severe — alarm + vibration"
    "9": "Severe pull-over — alarm + iot_led"
    "10": "Critical stop — alarm + iot_led + iot_buzzer"
  removed_actions: ["flashlight"]
  trigger_level: "loaded from admin_config.trigger_level (default: 4)"
  alert_modal: "AlertModal component in DriveScreen — shows level, title, action buttons"

feature: "Home Dashboard"
  file: apps/mobile/screens/HomeScreen.tsx
  data_source: "LOCAL SQLite only (NOT Supabase)"
  kpis: ["Focus Score (0-100)", "Sessions (last 40)", "Drive Time", "Drowsy Events (yawns+nods+tilts)", "Alerts fired"]
  drowsy_events_formula: "SUM(yawn_sum + head_sum + tilt_count) across all sessions"
  tooltips: "InfoModal on each KPI card (ⓘ button in card header)"
  start_driving: "Button navigates to Drive tab (Tab.navigate('Drive'))"

feature: "Analytics"
  file: apps/mobile/screens/AnalyticsScreen.tsx
  data_source: "LOCAL SQLite only"
  charts:
    fatigue_fluctuations: "AreaChart — avg drowsiness per day, smooth cubic bezier, primary color gradient"
    session_activity: "BarChart — sessions per day of week (Sun-Sat), color #60a5fa"
    hourly_fatigue: "BarChart — avg drowsiness by hour driven, color #f97316"
    detection_breakdown: "DonutChart — yawns/head/tilts/brakes totals + legend"
  filter_pills: "[7D, 30D, 90D]"
  svg_note: "All labels use SvgText (react-native-svg). Y-axis: textAnchor=end. X-axis: textAnchor=middle."
  date_label_format: "M/D (e.g., 4/18) — no newlines"
  label_step: "Math.max(1, Math.ceil(points.length / 7)) — auto-sparse for large datasets"
  tooltips: "InfoModal on each chart card"

feature: "History"
  file: apps/mobile/screens/HistoryScreen.tsx
  data_source: "LOCAL SQLite only"
  date_picker: "components/DateRangePicker.tsx — custom calendar, zero new deps"
  date_picker_props: "visible, fromDate (YYYY-MM-DD), toDate (YYYY-MM-DD), onApply(from,to), onClose"
  date_range_display: "Friendly format: 'Apr 1 – Apr 18, 2026'"
  pagination: "PAGE=20, offset-based"
  session_card: "Date, device type, sample count, avg drowsiness badge (color-coded), emoji event chips"

feature: "Emergency Contact Management"
  files:
    - apps/mobile/screens/EmergencyContactScreen.tsx [drawer-only tab]
    - apps/mobile/screens/EmergencyContactSetupModal.tsx [first-time setup modal]
    - apps/mobile/screens/EmergencyAlertMapScreen.tsx [monitor alerts — Alerts tab]
    - apps/mobile/lib/emergencyNotify.ts [captureLocation, triggerEmergencyAlert, sendAutoSms]
  ec_screen_props: "No props — uses useSession() internally. Call as <EmergencyContactScreen />"
  offline_flow:
    load: "readFromCache() → setFields → isOnline() → if online: fetch Supabase → writeToCache()"
    save: "writeToCache(pending=true) → isOnline() → if online: upsertEmergencyContact → writeToCache(pending=false)"
    auto_sync: "NetInfo listener in App.tsx MainApp detects offline→online → re-fetches EC → updates cache"
    startup: "App.tsx startup effect: getEmergencyContact() → if ec: runSync INSERT OR REPLACE INTO emergency_contacts_local"
  setup_modal_offline: "If offline when modal shown: display OfflineNotificationModal instead of EC form. Form blocked until user reconnects or dismisses."
  setup_modal_sqlite: "After successful Supabase save: INSERT OR REPLACE INTO emergency_contacts_local"
  alert_map_screen:
    polling: "15s setInterval + Supabase Realtime channel"
    offline: "readAlertsFromCache() from emergency_alert_events_local on load"
    call_sms_ui: "Side-by-side Call + SMS buttons (contactRow style)"
    sms_uri_fix: "SMS URI scheme uses ?body= not &body= (correct: sms:${phone}?body=Got your SnoozeGuard alert — are you okay?)"

feature: "Theme System"
  file: apps/mobile/context/ThemeContext.tsx
  provider: "ThemeProvider wraps entire app in App.tsx"
  hooks: "useTheme() → Theme object; useThemeToggle() → { isDark, toggleTheme }"
  persistence: "getPref('theme_mode') on init (lazy useState); setPref('theme_mode') on toggle"
  themes: "darkTheme, lightTheme in theme.ts"
  pattern_in_every_screen: |
    const t = useTheme();
    const styles = useMemo(() => makeStyles(t), [t]);
    const makeStyles = (t: Theme) => StyleSheet.create({...})
  toggle_ui: "headerRight Pressable with MaterialIcons sun/moon icon"
  status_bar: "ThemedStatusBar component in App.tsx reads isDark → StatusBar style='light'|'dark'"

feature: "Admin Config"
  screens:
    mobile: apps/mobile/screens/AdminScreen.tsx [super_admin only]
    web: apps/web/src/pages/AdminPage.tsx [super_admin only]
  valid_actions: ["voice", "vibration", "alarm", "iot_led", "iot_buzzer"]
  rpc: update_admin_config (SECURITY DEFINER — enforces super_admin check)
  alert_map_structure: "Record<string, { label, actions: string[], yawn_count: number, head_count: number }>"
  extra_fields:
    score_reset_minutes: "int, 1-60 — idle time after level-10 dismiss before score resets"
    sms_provider: "semaphore | twilio | textbelt"
    sms_api_key: "string — empty = TextBelt free; Semaphore: api key; Twilio: SID:TOKEN:FROM"

feature: "Terms & Privacy Policy"
  file: apps/mobile/screens/TermsScreen.tsx
  access:
    login: "Footer link → Modal (slide) with close button; uses <TermsScreen /> inside Modal"
    drawer: "Nav item 'Terms & Privacy' (gavel icon) → hidden tab navigation"
  content: "11 sections: acceptance, purpose, camera, location, data stored, EC notifications, storage/security, user rights, liability, changes, contact"

feature: "DateRangePicker"
  file: apps/mobile/components/DateRangePicker.tsx
  props: "visible, fromDate (YYYY-MM-DD), toDate (YYYY-MM-DD), onApply(from,to), onClose"
  ux_flow: "FROM/TO chips at top → tap start date → tap end date → Apply"
  range_visual: "Strip background between dates; filled primary circle for start/end; today gets border ring"
  deps: "Zero new — pure RN + react-native-svg (already installed)"
  init: "useEffect on visible=true: sets state from fromDate/toDate props, navigates to start month"
```

---

## SECTION 4 — CRITICAL LOGIC (IF/THEN RULES)

```
── YAWN DETECTION ──────────────────────────────────────────────
IF jawOpen >= 0.7 THEN wasOpen = true
IF jawOpen <= 0.4 AND wasOpen = true AND cooldown_elapsed THEN
  fire onYawn(); wasOpen = false; start cooldown(2000ms)
IF jawOpen >= 0.6 THEN skip head/tilt detectors (yawning suppression)

── HEAD MOVEMENT DETECTION ────────────────────────────────────
offCenter = (|pitch| > 0.35 OR |roll| > 0.25)
IF NOT wasOffCenter AND offCenter AND cooldown_elapsed THEN
  fire onHeadEvent(); start cooldown(500ms)
wasOffCenter = offCenter  [updated every frame]

── HEAD TILT DETECTION ────────────────────────────────────────
IF offCenter AND tiltStartAt is null THEN tiltStartAt = now()
IF NOT offCenter THEN
  consecutiveMisses++
  IF consecutiveMisses > 4 THEN reset(tiltStartAt=null, consecutiveMisses=0, fired=false)
IF offCenter THEN consecutiveMisses = 0
IF NOT fired AND (now - tiltStartAt) >= 10000 THEN
  fired = true; force alertLevel=8; open modal

── SUDDEN BRAKE DETECTION ─────────────────────────────────────
delta = |currentMagnitude - prevMagnitude|
IF delta > 0.45 THEN highDeltaCount = min(highDeltaCount+1, 6)
ELSE highDeltaCount = max(highDeltaCount-1, 0)
IF highDeltaCount >= 2 AND cooldown_elapsed THEN
  suddenBrakeRef = true; start cooldown(3000ms)

── DROWSINESS SCORING ─────────────────────────────────────────
FOR each level L in alertMap (ascending 1→10):
  IF yawnAcc >= alertMap[L].yawn_count OR headAcc >= alertMap[L].head_count THEN
    computedLevel = L
IF suddenBrakeRef = true THEN computedLevel = max(computedLevel, 9)
RETURN computedLevel

── ALERT TRIGGERING ───────────────────────────────────────────
dismissedLevelsRef (Set<number>) persists per session — tracks acknowledged levels.
canAlert = (level≥trigger AND !alertOpen AND !dismissedLevels.has(level))
         OR isLevelEscalation (level > alertLevelRef.current AND alertOpen)
         OR isLevel10Retrigger (level≥10, delta≥LEVEL10_YAWN_RETRIGGER or LEVEL10_HEAD_RETRIGGER)

IF canAlert AND (bypassCooldown OR cooldown elapsed OR level escalates) THEN
  stop current audio (Speech.stop, Vibration.cancel, sound.stopAsync)
  IF isLevel10Retrigger: update baseline refs + startScoreResetTimer()
  open AlertModal → playMobileAlertActions(actions, level, soundRef)

ON DISMISS (all alert types including tilt and brake):
  dismissedLevelsRef.add(alertLevelRef.current)
  stopAlertAudio(); stopEcTimer()  ← stopAlertAudio() called for ALL dismiss paths (button + onRequestClose)
  IF level >= 10: startScoreResetTimer()
  acknowledgeEmergencyAlert()

SCORE RESET (after level-10 idle):
  startScoreResetTimer() → setTimeout(resetDrowsinessScore, scoreResetMinutes*60000)
  resetDrowsinessScore() clears: yawnAcc, headAcc, dismissedLevels, level10BaseRefs, UI state

TILT ALERT (direct, not via tick):
  Speech.speak("Alert, alert. Head is tilted...") → setAlertLevel(8) → modal

BRAKE ALERT (direct, not via tick):
  Speech.speak("Alert, alert. Sudden brake...") → suddenBrakeRef=true → setAlertLevel(9) → modal

VOICE PER LEVEL:
  6: "Warning. Level 6..." x1   7: "Warning, warning..." x2
  8: "High alert, high alert..." x3   9: "Critical alert..." x4
  10: "Emergency, emergency..." x4

── SESSION END ─────────────────────────────────────────────────
endSession() is SYNCHRONOUS (not async):
  1. endSessionFn.current = null  [prevent double-call]
  2. drivingSessionActive.current = false
  3. sessionActiveRef.current = false  [stops tick + camera]
  4. UPDATE driving_sessions_local SET ended_at=now WHERE id=sessionId [SQLite, immediate]
  5. setSessionId(null)  [clears UI — session over]
  6. fire-and-forget background IIFE: flushEndedSessions() + flushPendingTelemetry() [async, no await]

── NAVIGATION GUARD ───────────────────────────────────────────
ON tabPress in App.tsx screenListeners:
  IF route.name != "Drive" AND drivingSessionActive.current = true THEN
    preventDefault()
    showSessionGuard(navFn) → ConfirmModal (themed, NOT Alert.alert):
      "Keep Driving" → cancel
      "End Session & Leave" → endSessionFn.current?.() + navFn()

── NAVIGATION DRAWER ──────────────────────────────────────────
AppDrawer: left slide-in (Animated.spring, DRAWER_WIDTH=300)
  Triggered by headerLeft hamburger button via openDrawerRef.current()
  Module-level: navigationRef (createNavigationContainerRef), openDrawerRef
  Content: user avatar/name/email/phone + share button (right side), online/offline+sync button, nav items (EC→Account→About→Terms→Admin), divider, web dashboard link (disabled), sign out (with inline confirm sheet)
  Nav: guardedNav() → checks drivingSessionActive → shows ConfirmModal if needed

── EC OFFLINE SYNC ────────────────────────────────────────────
ON APP STARTUP (MainApp startup useEffect):
  1. getEmergencyContact(supabase, userId) → ec
  2. IF ec: INSERT OR REPLACE INTO emergency_contacts_local (pending_sync=0)
  3. IF !ec: setShowEcSetup(true) → EmergencyContactSetupModal

ON NETINFO RECONNECT (MainApp NetInfo useEffect):
  wasOnline tracks previous state
  IF isNowOnline AND wasOnline === false:
    getEmergencyContact(supabase, userId) → INSERT OR REPLACE INTO emergency_contacts_local

ON EC SCREEN LOAD (EmergencyContactScreen.load):
  1. readFromCache() → show immediately
  2. isOnline() → if online: fetch Supabase + profiles.phone → writeToCache(pending=false)

ON EC SCREEN SAVE (EmergencyContactScreen.save):
  1. writeToCache(pending=true) → always works offline
  2. if online: upsertEmergencyContact + profiles.update → writeToCache(pending=false)

ON SETUP MODAL OPEN (EmergencyContactSetupModal):
  IF offline: show OfflineNotificationModal instead of EC form (form not rendered while offline)

ON SETUP MODAL SAVE (EmergencyContactSetupModal.save):
  1. upsertEmergencyContact(supabase)
  2. IF success: INSERT OR REPLACE INTO emergency_contacts_local (pending_sync=0)

── SUPABASE SYNC STRATEGY ────────────────────────────────────
IF session.ended_at IS NOT NULL AND synced_at IS NULL THEN eligible for flush
Flush order: sessions first, then telemetry (FK dependency)
On flush success: UPDATE synced_at = now in local table
On flush failure: silently retry next tick (no user-visible error)

── ADMIN CONFIG LOADING ───────────────────────────────────────
On session start: fetch admin_config from Supabase
IF fetch fails THEN use DEFAULT_ALERT_MAP from packages/shared/src/alertMap.ts
admin_config.trigger_level controls minimum level to show alert modal
super_admin role required for write access (enforced in SECURITY DEFINER RPC)

── CAMERA BEHAVIOR ────────────────────────────────────────────
Camera: front-facing ONLY (face detection). No back camera usage.
torch prop on front camera = no-op (no physical LED on front).
Flashlight feature: REMOVED entirely from system (2026-04-13).
Vision Camera renders on native surface; opacity:0 does NOT hide it.
Use conditional rendering (width:0, height:0) to hide Camera component.

── DATA SOURCE RULES ──────────────────────────────────────────
HomeScreen counts/aggregates: READ from LOCAL SQLite ONLY
HistoryScreen list: READ from LOCAL SQLite ONLY
AnalyticsScreen charts: READ from LOCAL SQLite ONLY
Supabase driving_sessions: cloud backup only, NOT used for UI display
IF Supabase count != SQLite count: SQLite is authoritative

── UI RULES ────────────────────────────────────────────────────
NEVER use Alert.alert() — use inline error Text or ConfirmModal component
NEVER use React Native <Text> inside <Svg> — use SvgText from react-native-svg
ALL screens must use useTheme() + makeStyles(t: Theme) + useMemo pattern
Alert badge: "!" string (not count number) when alertBadge > 0
```

---

## SECTION 5 — STATE & FLOW DIAGRAMS

```
SESSION STATE MACHINE:
  IDLE
    │ startSession()
    ▼
  LOADING_MODEL
    │ model ready + camera permission
    ▼
  ACTIVE ──────────────────────────────────────────────┐
    │ (tick every 1s, face detection every 600ms)      │
    │ level < triggerLevel: continue                   │
    │ level >= triggerLevel: open AlertModal ──────────┤
    │                                                  │ alertOpenRef=true
    │                                     ┌────────────┘
    │                              ALERT_MODAL_OPEN
    │                                  │ user dismisses
    │                                  └──── alertOpenRef=false → ACTIVE
    │
    │ endSession() [or nav guard "End Session & Leave"]
    ▼
  IDLE (SQLite updated immediately, cloud sync background)

TELEMETRY ROW (per tick):
  { drowsiness_level, yawn_count_delta, head_event_count_delta,
    head_tilt_delta, sudden_brake, alert_triggered, alert_level, alert_actions }
  → yawn_count_delta = yawnAcc - prevYawnAcc (delta since last tick)
  → head_event_count_delta = headAcc - prevHeadAcc

ALERT BADGE REFRESH (App.tsx):
  EVERY 30s + on Alerts tab focus:
    query emergency_contacts WHERE contact_user_id=me AND status=accepted → get driver IDs
    query emergency_alert_events WHERE user_id IN drivers AND status=active → activeCount
    query emergency_contacts WHERE contact_user_id=me AND status=pending → pendingCount
    badge = (activeCount + pendingCount) > 0 ? "!" : undefined

THEME INITIALIZATION:
  App() → ThemeProvider → loadSavedTheme() [synchronous SQLite read via getFirstSync]
         → useState(() => loadSavedTheme()) [lazy initializer, true=dark, false=light]
         → ThemeContext.isDark controls active theme object

EC OFFLINE FLOW:
  App start → getEmergencyContact(Supabase) → cache to SQLite
  EC Screen open → readFromCache() → show instantly → isOnline() → refresh from Supabase
  EC Screen save → writeToCache(pending=true) → isOnline() → upsertSupabase → writeToCache(pending=false)
  NetInfo offline→online → getEmergencyContact(Supabase) → update cache silently
```

---

## SECTION 6 — FILE STRUCTURE REFERENCE

```
c:\Thesis\SnoozeGuard\
├── CLAUDE.md                            # ← Claude Code instructions (read first)
├── apps/
│   ├── mobile/                          # React Native (Expo SDK 54, bare workflow)
│   │   ├── App.tsx                      # Root: ThemeProvider+StatusBar, auth gate, MainApp
│   │   │                                # Contains: ConfirmModal, AppDrawer, MainApp, ThemedStatusBar, AppInner
│   │   ├── sessionState.ts              # Module-level refs: drivingSessionActive, endSessionFn
│   │   ├── theme.ts                     # darkTheme, lightTheme (Design tokens)
│   │   ├── ml/
│   │   │   └── faceDetection.ts         # parseFaceFrame, yawn/head/tilt detectors, TILT_*
│   │   ├── screens/
│   │   │   ├── DriveScreen.tsx          # Core session screen (FaceCamera, alert modal, tick)
│   │   │   ├── HomeScreen.tsx           # Dashboard — reads local SQLite, KPI tooltips
│   │   │   ├── AnalyticsScreen.tsx      # Charts (area/bar/donut), InfoModal tooltips, 7D/30D/90D
│   │   │   ├── HistoryScreen.tsx        # Session list + DateRangePicker — reads local SQLite
│   │   │   ├── AdminScreen.tsx          # Alert config (super_admin) — light/dark support
│   │   │   ├── EmergencyContactScreen.tsx   # EC management, offline-first, no props
│   │   │   ├── AccountScreen.tsx        # Account management, sign out
│   │   │   ├── AboutScreen.tsx          # App info, detection explanation, website btn (coming soon)
│   │   │   ├── TermsScreen.tsx          # Terms of Service & Privacy Policy
│   │   │   ├── EmergencyAlertMapScreen.tsx  # Monitor/resolve alerts, 15s poll, offline cache
│   │   │   ├── EmergencyContactSetupModal.tsx  # First-time EC setup, writes Supabase+SQLite
│   │   │   └── LoginScreen.tsx          # Auth, theme-aware, Terms link in footer
│   │   ├── components/
│   │   │   ├── DateRangePicker.tsx      # Calendar date range picker (custom, zero new deps)
│   │   │   ├── InfoModal.tsx            # Shared tooltip/info modal
│   │   │   └── OfflineNotificationModal.tsx  # Reusable offline warning modal (themed, animated)
│   │   ├── context/
│   │   │   ├── ThemeContext.tsx         # ThemeProvider, useTheme(), useThemeToggle()
│   │   │   └── SessionContext.tsx       # SessionProvider, useSession()
│   │   ├── db/
│   │   │   └── database.ts              # SQLite schema, getDatabase(), getPref(), setPref()
│   │   ├── navigation/
│   │   │   └── types.ts                 # MainTabParamList type
│   │   ├── lib/
│   │   │   ├── supabase.ts              # Supabase client singleton
│   │   │   └── emergencyNotify.ts       # getEmergencyContact, upsertEmergencyContact, registerPushToken
│   │   └── sync/
│   │       └── flush.ts                 # flushEndedSessions, flushPendingTelemetry, isOnline()
│   └── web/                             # React + Vite (NEXT target after mobile)
│       └── src/pages/
│           └── AdminPage.tsx            # Web admin config — ACTION_OPTIONS[]
├── packages/
│   └── shared/
│       └── src/
│           └── alertMap.ts              # computeLevelFromAlertMap, DEFAULT_ALERT_MAP
├── services/
│   └── api/                             # Node.js / Hono — IoT ingest API
│       └── src/routes/iot.ts            # POST /v1/iot/telemetry
├── iot/
│   └── enclosure/
│       ├── snoozeguard_enclosure.scad   # OpenSCAD parametric 3D model
│       └── PRINT_GUIDE.md
└── docs/
    ├── BRD_TECHNICAL_ALIGNMENT.md       # Full BRD (living document, updated each milestone)
    └── AI_CONTEXT_BLOCK.md             # This file
```

---

## SECTION 7 — KNOWN CONSTRAINTS & GOTCHAS

```
CONSTRAINT: Front camera has no torch/LED. react-native-vision-camera torch prop on front
  camera is a no-op. Flashlight feature removed entirely (2026-04-13).

CONSTRAINT: Vision Camera renders on native surface layer. Setting opacity:0 or hiding
  with RN layout does NOT hide camera preview. Use conditional rendering with
  width:0, height:0 to hide, or unmount the component.

CONSTRAINT: MediaPipe in IMAGE mode requires deleting snapshot file after each frame.
  File accumulation causes storage bloat and detection lag.

CONSTRAINT: expo-av Audio — static import required. Dynamic import (`await import("expo-av")`)
  is unreliable for alarm playback. Always import at file top.

CONSTRAINT: endSession() MUST be synchronous. If async with network awaits, app spinner
  can freeze indefinitely on poor connectivity. Network sync is fire-and-forget.

CONSTRAINT: `chin` landmark (lms[152]) MUST be declared before use in roll calculation.
  `const` is NOT hoisted. Declare all landmarks (forehead, chin, noseBridge, noseTip)
  together at the top of parseFaceFrame before any trigonometric calculations.

CONSTRAINT: HomeScreen, HistoryScreen, and AnalyticsScreen MUST all query local SQLite,
  not Supabase. Local SQLite is ground truth for display.

CONSTRAINT: Admin config write uses SECURITY DEFINER RPC — never write directly to
  admin_config table from client. Always use update_admin_config() RPC.

CONSTRAINT: EAS Build — DO NOT run unless explicitly instructed. OTA updates (eas update)
  are sufficient for JS-only changes. EAS account: airamaepilor.

CONSTRAINT: OTA push — NEVER run automatically. Always give the user the exact command:
  cd apps/mobile && eas update --branch preview --message "..."
  The installed APK is on the preview channel.

CONSTRAINT: IoT device has no on-device UI. Configuration is web-only. Device executes
  actions returned by server response to POST /v1/iot/telemetry.

CONSTRAINT: Supabase RPCs use SECURITY DEFINER — they bypass RLS. Only safe because
  they implement their own authorization checks internally.

CONSTRAINT: Never use Alert.alert() anywhere in the mobile app. All alerts/confirmations
  use inline error Text elements or the ConfirmModal component.

CONSTRAINT: All text inside react-native-svg <Svg> must use SvgText (imported as
  Text as SvgText from "react-native-svg"). React Native <Text> inside <Svg> does not render.

CONSTRAINT: EmergencyContactScreen uses useSession() internally. Call it with no props:
  <EmergencyContactScreen />  — never pass session as a prop.

CONSTRAINT: theme.ts exports both darkTheme and lightTheme. The static `import { theme }`
  refers to darkTheme and is ONLY used for NAV_DARK_THEME in App.tsx. All screen styles
  must use useTheme() + makeStyles(t: Theme) pattern to support light/dark mode.

CONSTRAINT: DateRangePicker is a zero-dependency custom calendar. Do NOT add
  @react-native-community/datetimepicker or any date picker library. The custom
  component works OTA without a native build.
```

---

## SECTION 8 — CHANGE LOG

| Date | Version | Changed | Reason |
|------|---------|---------|--------|
| 2026-04-13 | 1.0 | Created | Initial AI context block generation |
| 2026-04-13 | 1.0 | Flashlight removed from system | Front camera has no LED; back camera caused preview bleed-through |
| 2026-04-13 | 1.0 | endSession made synchronous | Async network awaits caused infinite loading spinner on poor connectivity |
| 2026-04-13 | 1.0 | HomeScreen data source changed to SQLite | Was querying Supabase (33 sessions) vs local SQLite (3 sessions) — mismatch |
| 2026-04-13 | 1.0 | sessionState.ts module-level refs added | Share session state between DriveScreen and App.tsx without prop drilling |
| 2026-04-13 | 1.0 | IoT enclosure 3D model created | Physical housing for ESP32-CAM + LEDs + buzzer |
| 2026-04-17 | 1.1 | Left navigation drawer added | Replaces burger menu; uses Animated slide + createNavigationContainerRef |
| 2026-04-17 | 1.1 | Level-dismiss guard added | dismissedLevelsRef prevents re-trigger at same level; cleared on score reset |
| 2026-04-17 | 1.1 | Level 10 re-trigger + score reset | LEVEL10_YAWN_RETRIGGER=3/LEVEL10_HEAD_RETRIGGER=10; scoreResetMinutes configurable |
| 2026-04-17 | 1.1 | Voice alerts for tilt + brake | Speech.speak fires immediately before modal; level-specific repeats |
| 2026-04-17 | 1.2 | Multi-provider auto-SMS | sendAutoSms supports Semaphore (PH) / Twilio / TextBelt |
| 2026-04-17 | 1.2 | LoginScreen theme support + labels + eye toggle | Replaced static theme; separate showPassword/showConfirm; labels above fields |
| 2026-04-17 | 1.2 | AdminScreen light/dark mode | Replaced static theme with useTheme() + makeStyles pattern |
| 2026-04-17 | 1.2 | DriveScreen light/dark mode | Replaced static theme with useTheme() + makeStyles pattern |
| 2026-04-18 | 1.3 | ProfileScreen removed; split into EmergencyContactScreen + AccountScreen | Cleaner separation of concerns |
| 2026-04-18 | 1.3 | AnalyticsScreen added | New tab: area chart, 2 bar charts, donut chart; 7D/30D/90D filter; InfoModal tooltips |
| 2026-04-18 | 1.3 | AboutScreen + TermsScreen added | About (info + detection explanation); Terms (11-section legal/privacy) |
| 2026-04-18 | 1.3 | Tab order finalized: Home·Analytics·Drive·Alerts·History | Drive at center (pos 3 of 5) |
| 2026-04-18 | 1.3 | Hidden tabs for drawer-only screens | EmergencyContact, Account, About, Terms, Admin use tabBarItemStyle: {display:'none'} |
| 2026-04-18 | 1.3 | ThemeContext with SQLite persistence | Dark/light toggle saved to user_preferences SQLite table |
| 2026-04-18 | 1.3 | Alert badge changed to "!" string | Was a count number; "!" is cleaner UX |
| 2026-04-18 | 1.3 | Home KPI: DAYS ACTIVE → DROWSY EVENTS | More meaningful metric; sum of yawns+nods+tilts |
| 2026-04-18 | 1.3 | InfoModal tooltips on all Home KPIs | ⓘ button in each card header |
| 2026-04-18 | 1.3 | SVG chart labels fixed | Replaced <Svg><Text> (broken) with SvgText from react-native-svg |
| 2026-04-18 | 1.3 | DateRangePicker custom calendar | Replaced text-input date hack in HistoryScreen; zero new deps |
| 2026-04-18 | 1.3 | EC offline-first with SQLite cache | emergency_contacts_local table; written in 3 places; auto-sync on reconnect |
| 2026-04-18 | 1.3 | emergency_alert_events_local SQLite table | Offline cache for alert events in EmergencyAlertMapScreen |
| 2026-04-18 | 1.3 | user_preferences SQLite table | Key/value store for theme_mode and future prefs |
| 2026-04-18 | 1.3 | EmergencyAlertMapScreen: 15s polling + Call/SMS side-by-side | Replaced app-restart dependency; compact contact buttons |
| 2026-04-18 | 1.3 | AppDrawer: Terms + Web Dashboard items added | Terms nav item; Web Dashboard placeholder (coming soon) |
| 2026-04-18 | 1.3 | Analytics chart colors: #60a5fa + #f97316 | Replaced theme colors that appeared black in dark mode |
| 2026-04-18 | 1.3 | EmergencyContactSetupModal writes SQLite | After Supabase save, caches to emergency_contacts_local |
| 2026-04-18 | 1.4 | OfflineNotificationModal component added | Reusable themed modal: ⚠️ warning + 3 info bullets + custom message/title/button props |
| 2026-04-18 | 1.4 | EC setup modal shows offline modal when offline | Prevents EC form from loading while offline; shows OfflineNotificationModal with EC-specific message instead |
| 2026-04-18 | 1.4 | AppDrawer: Share button added | Native Share API button in user header section (icon-only, primary bg); shares Expo APK download link |
| 2026-04-18 | 1.4 | Drawer nav item order updated | New order: EmergencyContact → Account → About → Terms → Admin (super_admin) |
| 2026-04-18 | 1.4 | SMS URI fix in EmergencyAlertMapScreen | sms:${phone}&body= → sms:${phone}?body= (correct URI scheme for SMS deep link) |
| 2026-04-18 | 1.4 | stopAlertAudio() called on all alert dismissals | Tilt and brake alert audio now stops on dismiss (button + back button); was only working for L6-10 before |

---

*End of AI_CONTEXT_BLOCK. Reference this file instead of re-analyzing the codebase.*
