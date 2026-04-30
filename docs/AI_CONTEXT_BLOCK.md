# AI_CONTEXT_BLOCK — SnoozeGuard

**Version:** 2.0 | **Date:** 2026-04-30 | **Format:** Machine-readable compressed context  
**Purpose:** Drop this block into any AI prompt for complete system understanding without re-analyzing the codebase.  
**Updates:** Increment version and update only changed sections; reference unchanged sections by label.

---

## HOW TO USE THIS BLOCK

Copy sections relevant to your task. For full-system changes, include all sections. For feature-specific work, include SYSTEM_MAP + the relevant FEATURE entry + CRITICAL_LOGIC.

---

## SECTION 1 — AI-OPTIMIZED SYSTEM SUMMARY

```
SYSTEM: SnoozeGuard
TYPE: Real-time driver drowsiness detection + alert system
STACK: React Native (Expo SDK 54) + React (Vite) + ESP32 + Supabase + Node.js/Hono
GROUND_TRUTH_PLATFORM: Mobile (apps/mobile/)
ML_ENGINE: MediaPipe Face Landmarker (native on mobile @ 600ms, WASM on web @ 130ms)
STORAGE_TRUTH: Local SQLite (expo-sqlite) → Supabase cloud sync
AUTH: Supabase Auth (Google OAuth + email/password) + 5s timeout fallback to SQLite cache
OFFLINE: Mobile/Web offline-first; IoT requires WiFi (BLE fallback for alerts only)

KEY MODULES (mobile):
  ml/faceDetection.ts               → parseFaceFrame(), yawn/head/tilt detectors, ensureModelPath()
  screens/DriveScreen.tsx           → session lifecycle, alert engine, FaceCamera, IoT integration
  screens/HomeScreen.tsx            → dashboard (7D/30D/90D/All), reads local SQLite
  screens/HistoryScreen.tsx         → session list + DateRangePicker, reads local SQLite
  screens/AnalyticsScreen.tsx       → charts + stability badge (7D/30D/90D), reads local SQLite
  screens/AdminScreen.tsx           → alert map config (super_admin only)
  screens/EmergencyContactScreen.tsx → TWO TABS: "My Guardian" (multi-contact) + "I Protect" (presence)
  screens/AccountScreen.tsx         → account management, sign out, password change
  screens/IotDevicesScreen.tsx      → pair/manage ESP32 IoT devices (NEW)
  screens/AboutScreen.tsx           → app info, detection explanation, thesis context
  screens/TermsScreen.tsx           → Terms of Service & Privacy Policy
  screens/EmergencyAlertMapScreen.tsx → view/respond to emergency alerts + guardian requests
  screens/EmergencyContactSetupModal.tsx → first-time EC setup (writes Supabase + SQLite)
  screens/LoginScreen.tsx           → auth (Google OAuth + email/password), Terms link
  components/DateRangePicker.tsx    → custom calendar date range picker (zero new deps)
  components/InfoModal.tsx          → shared tooltip/info modal
  components/OfflineNotificationModal.tsx → reusable offline warning modal
  packages/shared/src/alertMap.ts   → computeLevelFromAlertMap(), DEFAULT_ALERT_MAP
  db/database.ts                    → SQLite schema + getDatabase() + getPref/setPref + EC helpers
  sessionState.ts                   → module-level refs (drivingSessionActive, endSessionFn)
  lib/supabase.ts                   → Supabase client singleton (SecureStore)
  lib/emergencyNotify.ts            → multi-contact EC CRUD, push token, alert trigger, SMS
  context/ThemeContext.tsx          → ThemeProvider, useTheme(), useThemeToggle(), persisted SQLite
  context/SessionContext.tsx        → SessionProvider, useSession()
  sync/flush.ts                     → flushEndedSessions(), flushPendingTelemetry(), rehydrateSessions()
  navigation/types.ts               → MainTabParamList

ALERT PIPELINE:
  Face frame (600ms) → parseFaceFrame → detectors (yawn/head/tilt)
  → accumulators (yawnAcc, headAcc)
  → tick (1000ms) → computeLevelFromAlertMap → if level≥trigger → show AlertModal
  → playMobileAlertActions(actions[]) → voice/vibration/alarm
  → if iot_buzzer action: INSERT iot_alerts → BLE buzz + HTTP POST /v1/iot/buzz
  → IoT device plays MP3 + vibrates/lights per level pattern
  → IoT dismiss button → MQTT publish → server dismisses iot_alerts → Realtime → mobile dismiss

DROWSINESS LEVELS: 0 (none) → 10 (critical). Thresholds per level in admin_config.
EMERGENCY: Levels 9-10 trigger 120s countdown (mobile) / 30s (web) → push + SMS to active guardian.
SMS: Supabase Edge Function /functions/v1/dynamic-worker (x-snoozeguard-secret: sg-sms-2026)
SMS_TOGGLE: admin_config.sms_enabled (bool) + sms_rate_limit_enabled (max 1/phone/day)
NAVIGATION: Left-side Animated drawer (AppDrawer) + bottom tab navigator.
  Visible tabs: Home · Analytics · Drive · Alerts · History
  Hidden (drawer-only): EmergencyContact · Account · IotDevices · About · Terms · Admin(super_admin)
EC_MODEL: Multi-contact (id UUID PK). One active guardian (is_active=1). Others can be pending/accepted.
ALERT_BADGE: "!" string when active alerts or pending guardian requests exist.
ALERT_DISMISS_GUARD: dismissedLevelsRef (Set<number>) — same level won't re-fire per session.
  Exception: level 10 re-triggers every 3 yawns or 10 head events above baseline.
SCORE_RESET: After level-10 idle for scoreResetMinutes (default 2), all accumulators clear.
BRAKE_ALERT: specialAlertOpen (independent modal) — suppresses main drowsiness popup 10s.
TILT_ALERT: specialAlertOpen after 10s sustained tilt — forces alertLevel=8.
THEME: Dark/light toggle. Persisted to SQLite user_preferences("theme_mode").
  Pattern: useTheme() + useMemo(() => makeStyles(t), [t]) in every screen.
  NEVER use static theme import for screen styles — breaks light mode.
IOT_CONNECTIVITY: Primary=WiFi+MQTT (HiveMQ TLS 8883). Fallback=BLE peripheral (SG-{device_id}).
  Heartbeat: ESP32 pings every 5s → user_iot_devices.last_seen. Online if last_seen < 15s.
SVG_LABELS: Always use Text as SvgText from react-native-svg. RN <Text> inside <Svg> does not render.
PRESENCE: MainApp broadcasts user online status via Supabase Realtime channel. Used by "I Protect" tab.
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
      "fields": ["id (uuid)", "user_id", "remote_id", "started_at", "ended_at", "device_type", "ended_synced (0|1)"],
      "sync": "SQLite → Supabase (background, fire-and-forget)",
      "ground_truth": "SQLite"
    },
    "SessionTelemetry": {
      "table": "session_telemetry",
      "local_table": "session_telemetry_local",
      "fields": [
        "id (AUTOINCREMENT)", "local_session_id (FK)", "recorded_at",
        "drowsiness_level (0-10)", "yawn_count_delta", "head_event_count_delta",
        "head_tilt_delta", "sudden_brake (0|1)", "source TEXT", "remote_synced (0|1)"
      ],
      "sync": "SQLite → Supabase (background)",
      "ground_truth": "SQLite",
      "index": "idx_telemetry_pending ON (remote_synced, local_session_id)"
    },
    "AlertEvent": {
      "table": "alert_events",
      "fields": ["id", "user_id", "session_id", "drowsiness_level", "trigger_level", "alert_label", "source", "created_at"],
      "written_by": "DriveScreen tick handler on every alert fire",
      "local": null
    },
    "IotDevice": {
      "table": "user_iot_devices",
      "fields": ["user_id", "device_id", "last_seen (timestamp)"],
      "online_threshold": "last_seen within 15s",
      "managed_by": "IotDevicesScreen.tsx + POST /v1/iot/ping"
    },
    "IotAlert": {
      "table": "iot_alerts",
      "fields": ["id", "device_id", "user_id", "drowsiness_level", "status (active|dismissed)", "dismissed_by (driver|iot_button)", "dismissed_at"],
      "written_by": "DriveScreen on iot_buzzer action",
      "dismissed_by_device": "POST /v1/iot/dismiss (device-key auth)",
      "realtime": "DriveScreen subscribes to UPDATE events — triggers mobile dismiss"
    },
    "AdminConfig": {
      "table": "admin_config",
      "fields": ["id", "alert_map (jsonb)", "trigger_level (int)", "score_reset_minutes (int, default 2)", "sms_enabled (bool, default false)", "sms_rate_limit_enabled (bool, default true)", "updated_by", "updated_at"],
      "note": "sms_provider/sms_api_key REMOVED — SMS now via Edge Function",
      "structure": "alert_map: { '6': {label, actions[], yawn_count, head_count}, ... '10': {...} }",
      "valid_actions": ["voice", "vibration", "alarm", "iot_led", "iot_buzzer"]
    },
    "EmergencyContact": {
      "table": "emergency_contacts",
      "local_table": "emergency_contacts_local",
      "fields": ["id (uuid PK)", "user_id (driver)", "contact_name", "contact_email", "contact_phone", "contact_user_id", "is_active (bool)", "status (pending|accepted)", "created_at"],
      "local_fields": ["id (TEXT PK)", "user_id", "contact_name", "contact_phone", "contact_email", "my_phone", "is_active (0|1)", "status (pending|accepted)", "pending_sync (0|1)", "updated_at", "created_at"],
      "note": "MULTI-CONTACT model. is_active selects current guardian. status=pending if contact uses SnoozeGuard. Local id PK (not user_id). Helpers: getLocalECList, upsertLocalEC, deleteLocalEC, setActiveLocalEC in db/database.ts"
    },
    "EmergencyAlertEvent": {
      "table": "emergency_alert_events",
      "local_table": "emergency_alert_events_local",
      "fields": ["id", "user_id", "session_id", "location_lat", "location_lng", "status (active|alerted|dismissed)", "created_at", "acknowledged_at", "dismissed_at"],
      "local_fields": ["id (PK)", "user_id", "location_lat", "location_lng", "status", "created_at", "acknowledged_at", "driver_name", "driver_phone", "cached_at", "dismissed_at"],
      "trigger": "level>=9 after 120s countdown (mobile) / 30s (web) → triggerEmergencyAlert()"
    },
    "PushToken": {
      "table": "push_tokens",
      "fields": ["user_id", "expo_push_token", "updated_at"],
      "provider": "Expo Push Notifications"
    },
    "UserPreferences": {
      "local_table": "user_preferences",
      "fields": ["key (PK TEXT)", "value (TEXT)"],
      "used_for": "theme_mode ('dark'|'light')",
      "helpers": "getPref(key), setPref(key, value) in db/database.ts"
    }
  },

  "navigation": {
    "type": "Bottom tab + left drawer",
    "visible_tabs": ["Home", "Analytics", "Drive", "Alerts", "History"],
    "hidden_tabs": ["EmergencyContact", "Account", "IotDevices", "About", "Terms", "Admin"],
    "hidden_tab_style": "tabBarItemStyle: { display: 'none' }",
    "drawer": {
      "component": "AppDrawer in App.tsx",
      "width": 300,
      "animation": "Animated.spring",
      "trigger": "openDrawerRef.current() from headerLeft hamburger",
      "nav_items_order": ["EmergencyContact", "Account", "IotDevices", "About SnoozeGuard", "Terms & Privacy", "Admin (super_admin only)", "Web Dashboard (coming soon, disabled)"],
      "sync_button": "Shows pending session/telemetry count from SQLite; tapping flushes with progress %",
      "share_button": "Icon-only (primary bg) in user header — native Share API with Expo download link"
    },
    "tab_center": "Drive is at position 3 of 5 (center)"
  },

  "apis": {
    "supabase_rpcs": {
      "update_admin_config": "SECURITY DEFINER — super_admin only; params: p_alert_map, p_drowsiness_trigger_level, p_yawn_threshold, p_head_movement_threshold, p_score_reset_minutes, p_sms_enabled, p_sms_rate_limit_enabled, p_updated_by",
      "get_user_id_by_email": "SECURITY DEFINER — looks up user id by email (for EC matching)"
    },
    "iot_ingest_api": {
      "base": "services/api (Node.js, Hono)",
      "endpoints": {
        "POST /v1/iot/telemetry": "auth=device-key; creates session+telemetry rows in Supabase",
        "POST /v1/iot/ping": "auth=device-key; body={device_id}; updates user_iot_devices.last_seen",
        "POST /v1/iot/buzz": "auth=Bearer JWT (app); body={device_id, alert_id, level}; publishes MQTT command to snoozeguard/commands/{device_id}",
        "POST /v1/iot/dismiss": "auth=device-key OR Bearer JWT; body={device_id, alert_id}; updates iot_alerts.status=dismissed; publishes MQTT all_clear",
        "GET /health": "{ ok: true }",
        "GET /health/ready": "checks Supabase connectivity"
      }
    },
    "supabase_realtime": {
      "emergency_alert_events": "EmergencyAlertMapScreen — live badge + map updates",
      "iot_alerts": "DriveScreen — IoT dismiss button triggers mobile alert dismiss",
      "emergency_contacts": "EmergencyAlertMapScreen — EC status changes",
      "user_iot_devices": "IotDevicesScreen — device online/offline status",
      "presence": "MainApp broadcasts; EmergencyContactScreen I-Protect tab reads driver online status"
    },
    "supabase_edge_functions": {
      "dynamic-worker": "SMS dispatch; POST https://{project}.supabase.co/functions/v1/dynamic-worker; header: x-snoozeguard-secret: sg-sms-2026; body: {phone, driverName, location}"
    }
  },

  "features": {
    "face_detection": {
      "library_mobile": "react-native-mediapipe (native Android)",
      "library_web": "@mediapipe/tasks-vision 0.10.17 (WASM)",
      "mode_mobile": "IMAGE snapshot every 600ms (OOM fix — delete file after each call)",
      "mode_web": "VIDEO stream every 130ms",
      "model_file": "face_landmarker.task (~5MB from Google CDN, cached to documentDirectory)",
      "key_landmarks": { "forehead": 10, "chin": 152, "noseBridge": 168, "noseTip": 1 },
      "key_blendshape": "jawOpen (0.0-1.0)"
    },
    "yawn_detection": {
      "open_threshold": 0.7, "close_threshold": 0.4, "cooldown_ms": 2000,
      "suppression": "skip head/tilt when jawOpen >= 0.6"
    },
    "head_movement_detection": {
      "pitch_threshold": 0.35, "roll_threshold_rad": 0.25,
      "fires_on": "centered→offCenter transition only", "cooldown_ms": 500
    },
    "head_tilt_detection": {
      "sustained_ms": 10000, "grace_frames": 4,
      "result": "fires specialAlertOpen (independent modal) at level=8; does NOT go through tick"
    },
    "sudden_brake_detection": {
      "sensor": "Accelerometer at 100ms", "delta_threshold": 0.45,
      "trigger_count": 2, "max_count": 6, "cooldown_ms": 3000,
      "result": "fires specialAlertOpen (independent modal); suppresses drowsiness popup 10s via brakeAlertedAtRef"
    },
    "drowsiness_scoring": {
      "formula": "computeLevelFromAlertMap(yawnAcc, headAcc, brake=false, alertMap)",
      "note": "sudden brake handled separately via specialAlertOpen, NOT via level score",
      "output": "level 0-10",
      "special_override": "sustained tilt → specialAlertOpen level 8 (independent)"
    },
    "alert_system": {
      "trigger": "level>=trigger AND !alertOpen AND !dismissedLevels.has(level) OR isLevelEscalation OR isLevel10Retrigger",
      "cooldown_bypass": "isLevelEscalation or isLevel10Retrigger skip 35s cooldown",
      "actions": {
        "voice": "expo-speech TTS — level-specific message (1-4 repeats by level)",
        "vibration": "Vibration.vibrate([0,500,300,...]) 5 pulses",
        "alarm": "expo-av Audio — system ringtone URI, 8s playback, tracked in currentSoundRef",
        "iot_led": "signal to IoT device via buzz command (LED behavior per level)",
        "iot_buzzer": "INSERT iot_alerts → BLE {cmd:buzz,level,alert_id} + HTTP POST /v1/iot/buzz"
      },
      "iot_dismiss_path": "Supabase Realtime UPDATE on iot_alerts → triggers same dismiss flow as button"
    },
    "iot_alert_behavior": {
      "levels": {
        "6": { "mp3": "0001.mp3", "pattern": "3 short pulses (200ms on / 150ms off)", "led": "pulsed", "buzzer": false },
        "7": { "mp3": "0002.mp3", "pattern": "3 medium pulses (400ms on / 150ms off)", "led": "pulsed", "buzzer": false },
        "8": { "mp3": "0003.mp3", "pattern": "3 long pulses (600ms on / 150ms off)", "led": "pulsed", "buzzer": false },
        "9": { "mp3": "0004.mp3", "pattern": "continuous", "led": "continuous", "buzzer": true },
        "10": { "mp3": "0005.mp3", "pattern": "continuous", "led": "flashing (400ms on/off)", "buzzer": true }
      },
      "dismiss_button": "GPIO 25 INPUT_PULLUP 200ms debounce → publish snoozeguard/dismiss/{id} via MQTT + BLE NOTIFY {event:dismiss} → same logic as mobile/web dismiss (updates iot_alerts.status=dismissed)"
    },
    "iot_connectivity": {
      "primary": "WiFi → MQTT HiveMQ Cloud TLS port 8883; subscribes snoozeguard/commands/{device_id}",
      "fallback": "BLE peripheral SG-{device_id}; CMD char UUID beb5483e-... (WRITE); EVENT char UUID beb5483f-... (NOTIFY)",
      "heartbeat": "ping every 5s to snoozeguard/ping/{device_id} → server updates last_seen",
      "hardware": "ESP32 + DFPlayer Mini (UART2 GPIO16/17) + SD card + button GPIO25 + buzzer GPIO26 + LED1 GPIO27 + LED2 GPIO32 + BLE-LED GPIO33"
    },
    "emergency_contact": {
      "model": "MULTI-CONTACT — id UUID PK, is_active selects active guardian",
      "status_flow": "added → pending (if contact is SG user) OR accepted (if non-SG) → accepted (after contact approves)",
      "screen_tabs": ["My Guardian (add/edit/remove/set-active contacts)", "I Protect (drivers with you as EC, online status via Presence)"],
      "pending_requests": "getPendingRequests() → EmergencyAlertMapScreen Accept/Decline UI",
      "sqlite_helpers": "getLocalECList(userId), upsertLocalEC(ec), deleteLocalEC(id), setActiveLocalEC(userId, id)"
    },
    "analytics": {
      "charts": ["AreaChart (daily avg drowsiness)", "BarChart (sessions per day-of-week)", "BarChart (avg drowsiness per 4h block)", "DonutChart (yawn/head/tilt/brake totals)"],
      "filters": ["7D", "30D", "90D"],
      "stability_badge": "variance of daily drowsiness → STABLE (green) / MODERATE (orange) / VOLATILE (red)",
      "hourly_blocks": "6 blocks × 4h (00-04, 04-08, 08-12, 12-16, 16-20, 20-24)",
      "data_source": "local SQLite only",
      "chart_library": "react-native-svg",
      "label_note": "All SVG text uses SvgText from react-native-svg. Never RN Text inside Svg.",
      "colors": { "session_activity": "#60a5fa", "hourly_fatigue": "#f97316" }
    },
    "home_dashboard": {
      "filters": ["7D", "30D", "90D", "All Time"],
      "kpis": ["Focus Score (max(0, 100 - avg_drowsiness×10))", "Sessions", "Drive Time", "Avg Session Time", "Drowsy Events"],
      "drowsy_events": "SUM(yawn+head+tilt+brake) with emoji breakdown (😮/😴/↗️/🛑)",
      "data_source": "local SQLite only"
    },
    "history": {
      "data_source": "local SQLite only",
      "date_picker": "components/DateRangePicker.tsx — custom calendar, zero new deps",
      "pagination": "20/page, offset-based"
    },
    "theme": {
      "modes": ["dark", "light"],
      "persistence": "user_preferences SQLite key=theme_mode",
      "pattern": "useTheme() + useMemo(() => makeStyles(t), [t]) in every screen",
      "toggle_ui": "headerRight sun/moon icon on all screens"
    },
    "offline_mode": {
      "pattern": "Read SQLite cache immediately → show data → if online: fetch Supabase → update cache",
      "auto_sync": "NetInfo offline→online in App.tsx MainApp: re-fetches EC list + updates cache",
      "auth_fallback": "5s session load timeout → offline_session SQLite key (saved on any auth change)",
      "offline_banner": "isOffline=true in EmergencyContactScreen and EmergencyAlertMapScreen"
    },
    "presence": {
      "broadcast": "MainApp broadcasts user online status via Supabase Realtime channel on mount",
      "consumer": "EmergencyContactScreen I-Protect tab shows drivers with live online indicator",
      "helpers": "getPresenceIds(), subscribePresence() (in EC screen imports)"
    },
    "session_navigation_guard": {
      "refs": "drivingSessionActive.current (bool), endSessionFn.current (fn|null) in sessionState.ts",
      "guard_location": "App.tsx screenListeners tabPress",
      "behavior": "drivingSessionActive + nav away → ConfirmModal → End Session & Leave calls endSessionFn.current()"
    },
    "alert_badge": {
      "value": "\"!\" string when (active_alerts + pending_guardian_requests) > 0",
      "refresh": "every 30s + on Alerts tab focus"
    },
    "web_drive": {
      "ml": "@mediapipe/tasks-vision WASM, 130ms VIDEO mode",
      "ec_countdown_s": 30,
      "alert_component": "DrowsinessAlertOverlay.tsx — level-colored modal, bar chart, EC section, SOS button",
      "offline_db": "Dexie (IndexedDB)"
    }
  },

  "relationships": {
    "User → DrivingSession": "1:many",
    "DrivingSession → SessionTelemetry": "1:many (local_session_id FK)",
    "DrivingSession → AlertEvent": "1:many (session_id FK)",
    "DrivingSession → EmergencyAlertEvent": "1:many",
    "User → EmergencyContact": "1:many (driver has multiple; one is_active at a time)",
    "EmergencyContact → User": "contact_user_id links to contact's profile (set by trigger)",
    "User → IotDevice": "1:many (user can pair multiple devices)",
    "IotAlert → IotDevice": "many:1 (device_id FK)",
    "User → PushToken": "1:1"
  },

  "dependencies": {
    "mobile": [
      "expo SDK 54", "react-native 0.81.5",
      "react-native-mediapipe ^0.6.0", "react-native-vision-camera v4",
      "@supabase/supabase-js", "expo-sqlite ~16.0.10",
      "expo-av (Audio)", "expo-location", "expo-sensors (Accelerometer)",
      "expo-speech", "expo-notifications", "expo-secure-store",
      "@react-native-community/netinfo 11.4.1",
      "@react-navigation/bottom-tabs + native",
      "react-native-maps", "react-native-svg ^15.15.4",
      "@expo/vector-icons (MaterialIcons)"
    ],
    "web": ["React + Vite", "@mediapipe/tasks-vision 0.10.17 (WASM)", "Dexie", "@supabase/supabase-js"],
    "iot": ["ESP32", "DFPlayer Mini", "SD card (FAT32, /mp3/)", "Arduino/ESP-IDF", "MQTT (PubSubClient)", "ArduinoJson", "BLE (ESP32 BLE library)"],
    "backend": ["Supabase (managed Postgres + Auth + Realtime + Edge Functions)", "Node.js / Hono (IoT ingest API)", "MQTT broker (HiveMQ Cloud TLS 8883)"],
    "shared": "packages/shared/src/alertMap.ts — computeLevelFromAlertMap(), DEFAULT_ALERT_MAP, parseAlertMap(), alertConfigForDrowsinessLevel(), shouldAlertForLevel()"
  }
}
```

---

## SECTION 3 — FEATURE-TO-CODE MAPPING

```yaml
feature: "Driving Session Lifecycle"
  entry_point: apps/mobile/screens/DriveScreen.tsx
  start_fn: startSession() [useCallback]
  end_fn: endSession() [useCallback, SYNCHRONOUS]
  state_refs:
    - sessionIdRef: current local SQLite session UUID
    - sessionActiveRef: guards tick/camera loops
    - drivingSessionActive: module-level (sessionState.ts) for nav guard
    - endSessionFn: module-level (sessionState.ts) for App.tsx to call
  db_ops:
    start: "INSERT INTO driving_sessions_local (id, user_id, started_at, device_type)"
    end: "UPDATE driving_sessions_local SET ended_at=? WHERE id=?"
    tick: "INSERT INTO session_telemetry_local (drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake, source, recorded_at, local_session_id)"
  cloud_ops:
    alert_fire: "INSERT INTO alert_events (user_id, session_id, drowsiness_level, trigger_level, alert_label, source)"
    sync: "sync/flush.ts — flushEndedSessions(), flushPendingTelemetry()"
    config: "supabase.from('admin_config').select() on session start"

feature: "Alert Engine + IoT Integration"
  files:
    - packages/shared/src/alertMap.ts [computeLevelFromAlertMap, alertConfigForDrowsinessLevel]
    - apps/mobile/screens/DriveScreen.tsx [tick handler, playMobileAlertActions, IoT paths]
  level_defaults:
    "6": "Mild — voice only (yawn≥3 or head≥20)"
    "7": "Moderate — voice + vibration (yawn≥5 or head≥35)"
    "8": "High — vibration + voice (yawn≥8 or head≥55)"
    "9": "Severe — voice + vibration + iot_led + iot_buzzer (yawn≥12 or head≥80)"
    "10": "Critical — voice + vibration + iot_led + iot_buzzer (yawn≥18 or head≥110)"
  trigger_level: "admin_config.trigger_level (default 6)"
  iot_buzz_flow: |
    IF iot_buzzer IN actions:
      1. INSERT iot_alerts (device_id, user_id, drowsiness_level) → get alert_id
      2. BLE: write {cmd:"buzz",level,alert_id} to SG_CMD_CHAR_UUID
      3. HTTP: POST ${IOT_API_URL}/v1/iot/buzz {device_id, alert_id, level}
         Header: Authorization: Bearer ${session.access_token}
  iot_dismiss_flow: |
    Supabase Realtime: iot_alerts UPDATE WHERE id=iotAlertIdRef
    → triggers same dismiss as button: dismissedLevelsRef.add(level), stopAlertAudio()
  special_alerts:
    tilt: "createTiltDetector → onSustainedTilt → Speech.speak → setSpecialAlertOpen(true) at level 8"
    brake: "Accelerometer delta > 0.45 × 2 events → Speech.speak → setSpecialAlertOpen(true); brakeAlertedAtRef=now (suppresses drowsiness popup 10s)"

feature: "Emergency Contact (Multi-contact)"
  files:
    - apps/mobile/screens/EmergencyContactScreen.tsx [2 tabs: My Guardian + I Protect]
    - apps/mobile/screens/EmergencyAlertMapScreen.tsx [alert monitor + pending requests]
    - apps/mobile/screens/EmergencyContactSetupModal.tsx [first-time setup]
    - apps/mobile/lib/emergencyNotify.ts [all EC CRUD + alert functions]
    - apps/mobile/db/database.ts [getLocalECList, upsertLocalEC, deleteLocalEC, setActiveLocalEC]
  supabase_fns:
    - "listEmergencyContacts(supabase, userId) → EmergencyContactEntry[]"
    - "addEmergencyContact(supabase, userId, {name,phone,email}) → {error, id, status}"
    - "updateEmergencyContact(supabase, contactId, userId, {name,phone,email}) → {error, status}"
    - "removeEmergencyContactById(supabase, contactId, userId) → {error}"
    - "setActiveEmergencyContact(supabase, userId, contactId) → {error}"
    - "getPendingRequests(supabase, contactUserId, contactEmail?) → PendingRequest[]"
    - "acceptContactRequest(supabase, requestId) → void"
    - "declineContactRequest(supabase, requestId) → void"
    - "triggerEmergencyAlert(supabase, userId, driverName, sessionId, smsEnabled?) → {alertId, location}"
    - "acknowledgeEmergencyAlert(supabase, alertId) → void"
    - "dismissEmergencyAlert(supabase, alertId) → void"
  offline_flow:
    load: "getLocalECList() → show → if online: listEmergencyContacts Supabase → upsertLocalEC for each"
    save: "upsertLocalEC(pending=1) → if online: addEmergencyContact Supabase → upsertLocalEC(pending=0)"
    startup: "App.tsx: listEmergencyContacts → upsertLocalEC for each (pending=0)"
    reconnect: "NetInfo offline→online → re-fetch + upsertLocalEC"

feature: "IoT Device Management"
  file: apps/mobile/screens/IotDevicesScreen.tsx
  table: user_iot_devices
  realtime: "subscribes to user_iot_devices changes for live last_seen updates"
  online_threshold: "last_seen < 15s"
  pair_flow: "Enter device_id → UPSERT user_iot_devices → device appears in list"

feature: "Face Detection Pipeline"
  files:
    - apps/mobile/ml/faceDetection.ts [parseFaceFrame, detector factories, ensureModelPath]
    - apps/mobile/screens/DriveScreen.tsx [FaceCamera snapshot loop]
  snapshot_loop: "takeSnapshot({quality:40}) → temp file → faceLandmarkDetectionOnImage → parseFaceFrame → delete file"
  detector_factories:
    - "createYawnDetector(onYawn) → {process(frame, now)}"
    - "createHeadDetector(onHeadEvent) → {process(frame, now)}"
    - "createTiltDetector(onSustainedTilt) → {process(frame, now), reset()}"
  constants:
    JAW_OPEN_THRESHOLD: 0.7
    JAW_CLOSE_THRESHOLD: 0.4
    YAWN_COOLDOWN_MS: 2000
    HEAD_ROLL_THRESHOLD: 0.25
    HEAD_PITCH_THRESHOLD: 0.35
    HEAD_COOLDOWN_MS: 500
    TILT_DURATION_MS: 10000
    TILT_MAX_MISSES: 4
    SHAKE_DELTA_THRESHOLD: 0.45
    SHAKE_COOLDOWN: 3000

feature: "Home Dashboard"
  file: apps/mobile/screens/HomeScreen.tsx
  filters: "[7D, 30D, 90D, All Time]"
  kpis: ["Focus Score", "Sessions", "Drive Time", "Avg Session Time", "Drowsy Events (😮😴↗️🛑)"]
  focus_score: "max(0, round(100 - avg_drowsiness × 10))"
  data_source: "LOCAL SQLite only"

feature: "Analytics"
  file: apps/mobile/screens/AnalyticsScreen.tsx
  stability_badge: "variance of daily avg drowsiness → STABLE/MODERATE/VOLATILE"
  hourly_chart: "6 blocks × 4h (00-04 through 20-24)"
  filter_pills: "[7D, 30D, 90D]"
  data_source: "LOCAL SQLite only"

feature: "Admin Config"
  screens:
    mobile: apps/mobile/screens/AdminScreen.tsx [super_admin]
    web: apps/web/src/pages/AdminPage.tsx [super_admin]
  rpc: "update_admin_config (SECURITY DEFINER)"
  rpc_params: "p_alert_map, p_drowsiness_trigger_level, p_yawn_threshold, p_head_movement_threshold, p_score_reset_minutes, p_sms_enabled, p_sms_rate_limit_enabled, p_updated_by"
  toggles: "sms_enabled (default false), sms_rate_limit_enabled (default true, max 1/phone/day)"

feature: "Theme System"
  file: apps/mobile/context/ThemeContext.tsx
  hooks: "useTheme() → Theme; useThemeToggle() → {isDark, toggleTheme}"
  persistence: "getPref/setPref('theme_mode')"
  pattern: "const t = useTheme(); const styles = useMemo(() => makeStyles(t), [t]);"

feature: "DateRangePicker"
  file: apps/mobile/components/DateRangePicker.tsx
  props: "visible, fromDate (YYYY-MM-DD), toDate (YYYY-MM-DD), onApply(from,to), onClose"
  deps: "Zero new — pure RN + react-native-svg (already installed)"
```

---

## SECTION 4 — CRITICAL LOGIC (IF/THEN RULES)

```
── YAWN DETECTION ──────────────────────────────────────────────
IF jawOpen >= 0.7 THEN wasOpen = true
IF jawOpen <= 0.4 AND wasOpen AND cooldown_elapsed THEN
  fire onYawn(); wasOpen = false; start cooldown(2000ms)
IF jawOpen >= 0.6 THEN skip head/tilt detectors (yawn suppression)

── HEAD MOVEMENT DETECTION ────────────────────────────────────
offCenter = (|pitch| > 0.35 OR |roll| > 0.25)
IF NOT wasOffCenter AND offCenter AND cooldown_elapsed THEN
  fire onHeadEvent(); start cooldown(500ms)
wasOffCenter = offCenter  [every frame]

── HEAD TILT DETECTION ────────────────────────────────────────
IF offCenter AND tiltStartAt null THEN tiltStartAt = now()
IF NOT offCenter THEN consecutiveMisses++
  IF consecutiveMisses > 4 THEN reset(tiltStartAt=null, misses=0, fired=false)
IF offCenter THEN consecutiveMisses = 0
IF NOT fired AND (now - tiltStartAt) >= 10000 THEN
  fired = true
  Speech.speak("Alert, alert. Head is tilted...")
  setSpecialAlertOpen(true) with title/message for level 8
  [does NOT go through drowsiness tick scoring]

── SUDDEN BRAKE DETECTION ─────────────────────────────────────
delta = |currentMagnitude - prevMagnitude|
IF delta > 0.45 THEN highDeltaCount = min(highDeltaCount+1, 6)
ELSE highDeltaCount = max(highDeltaCount-1, 0)
IF highDeltaCount >= 2 AND cooldown_elapsed THEN
  brakeAlertedAtRef = now  [suppresses drowsiness popup 10s]
  Speech.speak("Alert, alert. Sudden brake...")
  setSpecialAlertOpen(true) with brake message
  start cooldown(3000ms)
  [does NOT set suddenBrakeRef for scoring — brake is now fully independent]

── DROWSINESS SCORING ─────────────────────────────────────────
FOR each level L in alertMap ascending 1→10:
  IF yawnAcc >= alertMap[L].yawn_count OR headAcc >= alertMap[L].head_count THEN
    computedLevel = L
RETURN computedLevel
[sudden brake no longer affects computedLevel — handled by specialAlertOpen]

── ALERT TRIGGERING (TICK HANDLER) ───────────────────────────
recentBrake = brakeAlertedAtRef && (now - brakeAlertedAtRef) < 10000
isLevel10Retrigger = level>=10 AND level10BaseYawn set AND !alertOpen AND
  (yawnAcc - level10BaseYawn >= 3 OR headAcc - level10BaseHead >= 10)
isLevelEscalation = !recentBrake AND level > alertLevelRef AND alertOpen AND !dismissedLevels.has(level)
canAlert = (!recentBrake AND shouldAlertForLevel(level,trigger) AND !alertOpen AND !dismissedLevels.has(level))
         OR isLevelEscalation OR isLevel10Retrigger

bypassCooldown = isLevelEscalation OR isLevel10Retrigger
IF canAlert AND (bypassCooldown OR cooldown>=35s OR level>lastLevel) THEN
  stop current audio (Speech.stop, Vibration.cancel, sound.stopAsync on currentSoundRef)
  IF isLevel10Retrigger: update level10Base* = current accumulators
  setAlertLevel(level); setAlertTitle(label); setAlertOpen(true)
  INSERT alert_events (user_id, session_id, drowsiness_level, trigger_level, alert_label, source)
  playMobileAlertActions(actions, level, currentSoundRef)
  IF iot_buzzer IN actions AND iotDeviceId:
    INSERT iot_alerts → iotAlertIdRef = returned id
    BLE write: {cmd:"buzz",level,alert_id}
    HTTP POST /v1/iot/buzz {device_id, alert_id, level, Bearer token}

ON DISMISS (button or onRequestClose):
  dismissedLevelsRef.add(alertLevelRef.current)
  stopAlertAudio(currentSoundRef); stopEcTimer()
  IF level >= 10: startScoreResetTimer()
  acknowledgeEmergencyAlert(alertId)
  IF iotAlertIdRef: POST /v1/iot/dismiss {device_id, alert_id}

IOT DISMISS PATH (Supabase Realtime):
  iot_alerts UPDATE WHERE id = iotAlertIdRef AND status = "dismissed"
  → triggers same dismiss cleanup (no modal interaction needed)

── SPECIAL ALERT DISMISS ──────────────────────────────────────
specialAlertOpen (tilt or brake modal):
  ON DISMISS: setSpecialAlertOpen(false); stopAlertAudio(); brakeAlertedAtRef = null (if brake)
  [NO dismissedLevelsRef update — specialAlert is not in the scoring system]

── EC ALERT COUNTDOWN ─────────────────────────────────────────
IF alertOpen AND alertLevel >= 9 AND !ecAutoFiredRef THEN
  start ecTimerRef: countdown from 120s (mobile) / 30s (web)
  ON reach 0: fireEmergencyAlert() → triggerEmergencyAlert(supabase, userId, driverName, sessionId, smsEnabled)
  → INSERT emergency_alert_events (status=active)
  → if accepted guardian has push token: send Expo push notification
  → if smsEnabled and guardian has phone: POST dynamic-worker Edge Function

── SESSION END ─────────────────────────────────────────────────
endSession() is SYNCHRONOUS:
  1. endSessionFn.current = null
  2. drivingSessionActive.current = false; sessionActiveRef.current = false
  3. UPDATE driving_sessions_local SET ended_at=now WHERE id=sessionId [SQLite]
  4. setSessionId(null)
  5. fire-and-forget IIFE: flushEndedSessions() + flushPendingTelemetry()

── SCORE RESET ─────────────────────────────────────────────────
startScoreResetTimer() → setTimeout(resetDrowsinessScore, scoreResetMinutes*60000)
resetDrowsinessScore() clears: yawnAcc, headAcc, dismissedLevels, level10BaseRefs, UI metrics

── EC OFFLINE SYNC (multi-contact) ────────────────────────────
ON APP STARTUP (MainApp useEffect):
  1. listEmergencyContacts(supabase, userId) → contacts[]
  2. FOR each: upsertLocalEC(ec, pending=0)
  3. IF contacts.length == 0: setShowEcSetup(true) → EmergencyContactSetupModal

ON NETINFO RECONNECT:
  IF isNowOnline AND wasOnline===false:
    listEmergencyContacts → upsertLocalEC for each

ON EC SCREEN LOAD (My Guardian tab):
  1. getLocalECList(userId) → show immediately
  2. if online: listEmergencyContacts Supabase → upsertLocalEC for each

ON EC SCREEN SAVE (add/edit/remove/setActive):
  1. upsertLocalEC(pending=1) — works offline
  2. if online: call Supabase fn → upsertLocalEC(pending=0)

── NAVIGATION GUARD ───────────────────────────────────────────
ON tabPress: IF route!="Drive" AND drivingSessionActive.current THEN
  preventDefault() → ConfirmModal: "Keep Driving" | "End Session & Leave"
  "End Session & Leave" → endSessionFn.current?.() + navigate

── DATA SOURCE RULES ──────────────────────────────────────────
HomeScreen / HistoryScreen / AnalyticsScreen: LOCAL SQLite ONLY
Supabase driving_sessions / session_telemetry: cloud backup only, NOT for UI display
SQLite is authoritative if counts differ

── SUPABASE SYNC ───────────────────────────────────────────────
rehydrateSessions() on login: pulls last 90 days remote sessions + telemetry into SQLite
flushEndedSessions(): syncs ended_at for sessions where ended_synced=0
flushPendingTelemetry(): syncs session_telemetry rows where remote_synced=0
  ensureRemoteSession() called first (creates remote session if needed, FK dependency)
Flush order: sessions first, then telemetry

── ADMIN CONFIG LOADING ───────────────────────────────────────
On session start: fetch admin_config from Supabase (trigger, map, scoreResetMinutes, smsEnabled, smsRateLimit)
IF fetch fails: use DEFAULT_ALERT_MAP from packages/shared/src/alertMap.ts
Write: ONLY via update_admin_config() SECURITY DEFINER RPC — never direct table UPDATE

── UI RULES ────────────────────────────────────────────────────
NEVER use Alert.alert() — use inline error Text or ConfirmModal
NEVER use RN <Text> inside <Svg> — use SvgText from react-native-svg
ALL screens: useTheme() + makeStyles(t: Theme) + useMemo pattern
Alert badge: "!" string when alertBadge > 0
```

---

## SECTION 5 — STATE & FLOW DIAGRAMS

```
SESSION STATE MACHINE:
  IDLE
    │ startSession() — INSERT driving_sessions_local, fetch admin_config
    ▼
  ACTIVE ──────────────────────────────────────────────────────┐
    │ tick 1s: compute level → if canAlert → AlertModal        │
    │ face 600ms: yawn/head/tilt detectors                     │
    │ accel 100ms: brake detector → specialAlertOpen if brake  │
    │                                                          │
    │ AlertModal open ─────────────────────────────────────────┤
    │   if iot_buzzer: iot_alerts INSERT + BLE + HTTP buzz     │
    │   if level>=9: start ecTimer (120s) → auto-notify        │
    │   on dismiss: dismissedLevels.add; stopAudio; iot dismiss │
    │   if level>=10: startScoreResetTimer                      │
    │                                                          │
    │ specialAlertOpen (tilt/brake) — independent, no scoring   │
    │                                                          │
    │ endSession() [sync or nav guard]                          │
    ▼
  IDLE (SQLite updated immediately; cloud sync background)

IOT ALERT STATE MACHINE:
  Mobile tick fires level with iot_buzzer
    │ INSERT iot_alerts (status=active)
    │ BLE: {cmd:buzz,level,alert_id}
    │ HTTP POST /v1/iot/buzz → MQTT → ESP32
    ▼
  ESP32 alertActive=true
    │ plays MP3 track (level - 5)
    │ runs vibration pattern / LED / buzzer per level
    │
    ├── Button pressed → postDismiss MQTT + BLE NOTIFY {event:dismiss}
    │     → POST /v1/iot/dismiss → iot_alerts.status=dismissed
    │     → Supabase Realtime → DriveScreen dismiss flow
    │
    └── Mobile dismiss → POST /v1/iot/dismiss → MQTT all_clear → ESP32 clearAlert()

EC MULTI-CONTACT FLOW:
  App start → listEmergencyContacts(Supabase) → upsertLocalEC for each
  EC Screen open → getLocalECList(SQLite) → show instantly
  EC Screen add/edit → upsertLocalEC(pending=1) → if online: Supabase fn → pending=0
  Pending request (other user added you) → EmergencyAlertMapScreen Accept/Decline
  Set active guardian → setActiveLocalEC(userId, id) + setActiveEmergencyContact(Supabase)

ALERT BADGE REFRESH (App.tsx every 30s + Alerts tab focus):
  query emergency_contacts WHERE contact_user_id=me → get driver IDs
  query emergency_alert_events WHERE user_id IN drivers AND status=active → activeCount
  query emergency_contacts WHERE contact_user_id=me AND status=pending → pendingCount
  + query getPendingRequests (drivers who added user as EC)
  badge = (activeCount + pendingCount) > 0 ? "!" : undefined

AUTH INITIALIZATION (AppInner):
  Promise.race([getSession(), timeout(5000)])
  IF timeout: load offline_session from SQLite (key="offline_session")
  onAuthStateChange: save session to SQLite + update state
```

---

## SECTION 6 — FILE STRUCTURE REFERENCE

```
c:\Thesis\SnoozeGuard\
├── CLAUDE.md
├── apps/
│   ├── mobile/                          # React Native (Expo SDK 54)
│   │   ├── App.tsx                      # Root: ThemeProvider, auth gate (5s timeout + SQLite cache),
│   │   │                                # AppDrawer (sync btn, share btn), MainApp, ConfirmModal
│   │   ├── sessionState.ts              # drivingSessionActive, endSessionFn (module-level refs)
│   │   ├── theme.ts                     # darkTheme, lightTheme, Theme type
│   │   ├── ml/
│   │   │   └── faceDetection.ts         # parseFaceFrame, createYawnDetector, createHeadDetector,
│   │   │                                # createTiltDetector, ensureModelPath, exported constants
│   │   ├── screens/
│   │   │   ├── DriveScreen.tsx          # Session, face detection, tick, alert engine, IoT (BLE+HTTP)
│   │   │   ├── HomeScreen.tsx           # Dashboard (7D/30D/90D/All), SQLite, drowsy event badges
│   │   │   ├── AnalyticsScreen.tsx      # Charts, stability badge, 4h blocks, SQLite
│   │   │   ├── HistoryScreen.tsx        # Session list + DateRangePicker, SQLite, pagination
│   │   │   ├── AdminScreen.tsx          # Alert map config, sms_enabled toggle, super_admin only
│   │   │   ├── EmergencyContactScreen.tsx   # 2 tabs: My Guardian (multi-contact) + I Protect (presence)
│   │   │   ├── AccountScreen.tsx        # Name/password change, provider detection, sign out
│   │   │   ├── IotDevicesScreen.tsx     # Pair/manage ESP32 devices, last_seen online status (NEW)
│   │   │   ├── AboutScreen.tsx          # App info, detection explanation
│   │   │   ├── TermsScreen.tsx          # Terms of Service & Privacy Policy (11 sections)
│   │   │   ├── EmergencyAlertMapScreen.tsx  # Alert monitor (15s poll + realtime) + Accept/Decline requests
│   │   │   ├── EmergencyContactSetupModal.tsx  # First-time EC setup (multi-contact aware)
│   │   │   └── LoginScreen.tsx          # Auth, theme-aware, Terms link
│   │   ├── components/
│   │   │   ├── DateRangePicker.tsx      # Custom calendar (zero new deps)
│   │   │   ├── InfoModal.tsx            # Tooltip/info modal
│   │   │   └── OfflineNotificationModal.tsx  # Reusable offline warning modal
│   │   ├── context/
│   │   │   ├── ThemeContext.tsx         # ThemeProvider, useTheme(), useThemeToggle()
│   │   │   └── SessionContext.tsx       # SessionProvider, useSession()
│   │   ├── db/
│   │   │   └── database.ts              # SQLite schema + migrations, getDatabase(), getPref(), setPref(),
│   │   │                                # getLocalECList(), upsertLocalEC(), deleteLocalEC(), setActiveLocalEC()
│   │   ├── navigation/
│   │   │   └── types.ts                 # MainTabParamList (Home|Analytics|Drive|Alerts|History|
│   │   │                                # EmergencyContact|Account|IotDevices|About|Terms|Admin)
│   │   ├── lib/
│   │   │   ├── supabase.ts              # Supabase client (SecureStore adapter)
│   │   │   └── emergencyNotify.ts       # listEmergencyContacts, addEmergencyContact, updateEmergencyContact,
│   │   │                                # removeEmergencyContactById, setActiveEmergencyContact,
│   │   │                                # getPendingRequests, acceptContactRequest, declineContactRequest,
│   │   │                                # triggerEmergencyAlert, acknowledgeEmergencyAlert, dismissEmergencyAlert,
│   │   │                                # registerPushToken, captureLocation, sendAutoSms (via Edge Fn)
│   │   └── sync/
│   │       └── flush.ts                 # isOnline(), flushEndedSessions(), flushPendingTelemetry(),
│   │                                    # rehydrateSessions(), ensureRemoteSession()
│   └── web/                             # React + Vite
│       └── src/
│           ├── pages/
│           │   ├── DashboardPage.tsx    # Metrics, session activity chart
│           │   ├── DrivePage.tsx        # Web drive (MediaPipe WASM, 30s EC countdown, IoT status)
│           │   ├── AdminPage.tsx        # Alert map config + sms toggles (super_admin)
│           │   ├── AnalyticsPage.tsx    # Trending charts (daily/hourly/DOW)
│           │   ├── HistoryPage.tsx      # Session list
│           │   ├── SessionDetailPage.tsx # Session deep-dive
│           │   ├── EmergencyContactPage.tsx # EC invite/accept
│           │   ├── IotDevicesPage.tsx   # IoT pairing
│           │   ├── SimulationPage.tsx   # Drive test harness
│           │   ├── AlertsPage.tsx       # Active alerts view
│           │   ├── AccountPage.tsx      # Profile mgmt
│           │   ├── AboutPage.tsx        # Static info
│           │   ├── TermsPage.tsx        # Static legal
│           │   └── LoginPage.tsx        # Supabase auth
│           ├── components/
│           │   ├── AppShell.tsx         # Sidebar nav, header, notifications panel (15s poll + realtime)
│           │   ├── DrowsinessAlertOverlay.tsx  # Level-colored alert modal, bar chart, 30s EC countdown
│           │   └── IotDeviceStatus.tsx  # Compact online/offline badge
│           ├── context/
│           │   ├── AuthContext.tsx      # session, user, profile, signOut
│           │   └── ThemeContext.tsx     # dark/light, localStorage persistence
│           ├── hooks/
│           │   ├── useAdminConfig.ts    # Loads admin_config row
│           │   ├── useOnlineStatus.ts   # Navigator.onLine + events
│           │   └── useWebFaceLandmarker.ts  # MediaPipe WASM, 130ms VIDEO mode
│           └── lib/
│               ├── faceDetectors.ts     # Web yawn/head/tilt detector factories
│               ├── faceMetrics.ts       # eulerDegreesFromMatrix, parseFaceLandmarkerResult
│               ├── playWebAlert.ts      # playWebAlert(actions[], level?), stopWebAlert()
│               ├── emergencyNotify.ts   # Web version of EC/alert helpers
│               ├── db.ts               # Dexie (IndexedDB) offline session storage
│               ├── sync.ts             # flushOutbox, flushPendingTelemetry, ensureRemoteSession
│               ├── logger.ts           # In-memory + localStorage log (window.__sgLog.download())
│               └── supabase.ts         # Supabase client (VITE_SUPABASE_URL/ANON_KEY)
├── packages/
│   └── shared/src/
│       └── alertMap.ts                  # computeLevelFromAlertMap, DEFAULT_ALERT_MAP, parseAlertMap,
│                                        # alertConfigForDrowsinessLevel, shouldAlertForLevel
├── services/
│   └── api/src/
│       ├── routes/
│       │   └── iot.ts                   # POST /v1/iot/telemetry, /buzz, /dismiss, /ping
│       └── lib/
│           ├── iotCommands.ts           # signalIotBuzz (MQTT), dismissIotAlert, updateDeviceHeartbeat
│           └── iotIngest.ts             # ingestIotTelemetry (creates session + telemetry rows)
└── iot/
    └── firmware/src/
        └── main.cpp                     # ESP32 firmware: DFPlayer MP3, MQTT+BLE, alert patterns,
                                         # dismiss button, heartbeat ping
```

---

## SECTION 7 — KNOWN CONSTRAINTS & GOTCHAS

```
CONSTRAINT: Front camera has no torch/LED. Flashlight feature removed entirely (2026-04-13).

CONSTRAINT: Vision Camera renders on native surface. opacity:0 does NOT hide it.
  Use width:0/height:0 conditional rendering to hide camera component.

CONSTRAINT: MediaPipe IMAGE mode — delete snapshot file after each call.
  File accumulation causes storage bloat and detection lag.

CONSTRAINT: expo-av Audio — static import required at file top.
  Dynamic import is unreliable for alarm playback.

CONSTRAINT: endSession() MUST be synchronous. Async network awaits freeze spinner on poor connectivity.

CONSTRAINT: `chin` landmark (lms[152]) MUST be declared before roll calculation.
  Declare forehead/chin/noseBridge/noseTip together at top of parseFaceFrame.

CONSTRAINT: HomeScreen, HistoryScreen, AnalyticsScreen query LOCAL SQLite ONLY — never Supabase.

CONSTRAINT: Admin config write: ONLY via update_admin_config() SECURITY DEFINER RPC.
  Never write directly to admin_config table. RPC enforces super_admin check.

CONSTRAINT: EAS Build — DO NOT run unless explicitly instructed. OTA sufficient for JS-only changes.

CONSTRAINT: OTA — NEVER run automatically. Give user the command:
  cd apps/mobile && eas update --branch preview --message "..."

CONSTRAINT: SMS now via Supabase Edge Function (dynamic-worker). The old sms_provider / sms_api_key
  fields in admin_config are REMOVED. sms_enabled + sms_rate_limit_enabled are the new toggles.

CONSTRAINT: Emergency contact model is MULTI-CONTACT (id UUID PK, is_active selects active guardian).
  The old single-contact schema (user_id PK, my_phone in local table) is replaced.
  emergency_contacts_local now has: id (PK), is_active (0|1), status, created_at.
  DB helpers: getLocalECList / upsertLocalEC / deleteLocalEC / setActiveLocalEC.
  Supabase helpers: listEmergencyContacts, addEmergencyContact, etc. in lib/emergencyNotify.ts.

CONSTRAINT: IoT device alerts use TWO paths simultaneously — BLE (offline fallback) AND HTTP/MQTT
  (online). Both are attempted when iot_buzzer action fires. BLE is primary for dismiss events.

CONSTRAINT: IoT dismiss button (GPIO 25) publishes MQTT AND BLE NOTIFY simultaneously.
  Server receives MQTT dismiss → updates iot_alerts.status → Supabase Realtime → mobile dismiss.
  BLE NOTIFY used when app is directly connected to device.

CONSTRAINT: EC countdown differs by platform: mobile=120s, web=30s.

CONSTRAINT: Alert.alert() is BANNED. Use ConfirmModal (App.tsx) or inline error Text.

CONSTRAINT: All text inside <Svg> must use SvgText from react-native-svg.

CONSTRAINT: EmergencyContactScreen uses useSession() internally. Call with no props.

CONSTRAINT: theme.ts static import (darkTheme) ONLY for NAV_DARK_THEME in App.tsx.
  All other screen styles: useTheme() + makeStyles(t: Theme).

CONSTRAINT: DateRangePicker has zero new deps. Do NOT add datetimepicker libraries.

CONSTRAINT: Supabase RPCs with SECURITY DEFINER bypass RLS — safe only because they
  implement their own auth checks internally.
```

---

## SECTION 8 — CHANGE LOG

| Date | Version | Changed | Reason |
|------|---------|---------|--------|
| 2026-04-13 | 1.0 | Created | Initial AI context block |
| 2026-04-13 | 1.0 | Flashlight removed | Front camera has no LED |
| 2026-04-13 | 1.0 | endSession made synchronous | Async awaits caused infinite spinner |
| 2026-04-13 | 1.0 | HomeScreen data source → SQLite | Supabase count mismatch |
| 2026-04-13 | 1.0 | sessionState.ts module refs | Share session state without prop drilling |
| 2026-04-17 | 1.1 | Left navigation drawer | Animated slide, createNavigationContainerRef |
| 2026-04-17 | 1.1 | Level-dismiss guard | dismissedLevelsRef prevents re-trigger at same level |
| 2026-04-17 | 1.1 | Level 10 re-trigger + score reset | LEVEL10_YAWN_RETRIGGER=3 / HEAD=10; scoreResetMinutes configurable |
| 2026-04-17 | 1.2 | Multi-provider auto-SMS | sendAutoSms supports Semaphore/Twilio/TextBelt |
| 2026-04-17 | 1.2 | LoginScreen / AdminScreen / DriveScreen light mode | useTheme() + makeStyles pattern |
| 2026-04-18 | 1.3 | ProfileScreen → EmergencyContactScreen + AccountScreen | Cleaner separation |
| 2026-04-18 | 1.3 | AnalyticsScreen added | Area/bar/donut charts; 7D/30D/90D filter |
| 2026-04-18 | 1.3 | AboutScreen + TermsScreen | Static info + 11-section legal |
| 2026-04-18 | 1.3 | Tab order finalized: Home·Analytics·Drive·Alerts·History | Drive at center |
| 2026-04-18 | 1.3 | ThemeContext SQLite persistence | theme_mode in user_preferences |
| 2026-04-18 | 1.3 | Alert badge → "!" string | Cleaner UX |
| 2026-04-18 | 1.3 | SVG labels fixed → SvgText | RN Text inside Svg does not render |
| 2026-04-18 | 1.3 | DateRangePicker custom calendar | Zero new deps; OTA-safe |
| 2026-04-18 | 1.3 | EC offline-first SQLite cache | emergency_contacts_local + 3 write points |
| 2026-04-18 | 1.3 | emergency_alert_events_local | Offline cache for alerts map screen |
| 2026-04-18 | 1.4 | OfflineNotificationModal component | Reusable offline warning |
| 2026-04-18 | 1.4 | EC setup modal shows offline modal | Blocks EC form until online |
| 2026-04-18 | 1.4 | AppDrawer Share button | Native Share API in user header |
| 2026-04-18 | 1.4 | SMS URI fix | sms:${phone}?body= (not &body=) |
| 2026-04-18 | 1.4 | stopAlertAudio() on all dismiss paths | Tilt/brake audio now stops on all dismiss types |
| 2026-04-30 | 2.0 | EC → multi-contact model | id UUID PK, is_active, status; My Guardian + I Protect tabs |
| 2026-04-30 | 2.0 | emergency_contacts_local schema redesigned | id PK (not user_id); added is_active, status, created_at |
| 2026-04-30 | 2.0 | New SQLite helpers | getLocalECList, upsertLocalEC, deleteLocalEC, setActiveLocalEC in db/database.ts |
| 2026-04-30 | 2.0 | New Supabase EC helpers | listEmergencyContacts, addEmergencyContact, updateEmergencyContact, removeEmergencyContactById, setActiveEmergencyContact, getPendingRequests, acceptContactRequest, declineContactRequest |
| 2026-04-30 | 2.0 | IotDevicesScreen added | Pair/manage ESP32 devices; user_iot_devices table; hidden tab |
| 2026-04-30 | 2.0 | New Supabase tables: iot_alerts, alert_events, user_iot_devices | IoT command tracking, alert event log, device registry |
| 2026-04-30 | 2.0 | IoT firmware fully implemented | DFPlayer MP3 (5 tracks), MQTT HiveMQ TLS 8883, BLE fallback, dismiss button, level 6-10 patterns |
| 2026-04-30 | 2.0 | IoT alert levels 6-10 patterns | L6: 3 short pulses. L7: 3 medium. L8: 3 long. L9: continuous. L10: continuous + flashing LED |
| 2026-04-30 | 2.0 | IoT dismiss button | GPIO 25, 200ms debounce; MQTT publish + BLE NOTIFY; same dismiss logic as mobile |
| 2026-04-30 | 2.0 | New API endpoints: /v1/iot/buzz, /v1/iot/dismiss, /v1/iot/ping | MQTT bridge + heartbeat tracking |
| 2026-04-30 | 2.0 | IoT buzz dual-path | BLE write + HTTP POST /v1/iot/buzz simultaneously on iot_buzzer action |
| 2026-04-30 | 2.0 | Admin config: sms_enabled + sms_rate_limit_enabled | Replaced sms_provider/sms_api_key |
| 2026-04-30 | 2.0 | SMS via Edge Function | dynamic-worker (x-snoozeguard-secret: sg-sms-2026) replaces provider-based approach |
| 2026-04-30 | 2.0 | specialAlertOpen for brake + tilt | Independent modal; brake suppresses drowsiness popup 10s via brakeAlertedAtRef |
| 2026-04-30 | 2.0 | sudden brake no longer affects drowsiness score | Fully independent via specialAlertOpen |
| 2026-04-30 | 2.0 | currentSoundRef for alarm cancel | Tracks expo-av Sound object for clean dismiss |
| 2026-04-30 | 2.0 | HomeScreen filter pills | 7D / 30D / 90D / All Time (was undocumented) |
| 2026-04-30 | 2.0 | AnalyticsScreen stability badge | variance → STABLE/MODERATE/VOLATILE |
| 2026-04-30 | 2.0 | Analytics hourly → 4h blocks | 6 blocks of 4 hours instead of 24 individual hours |
| 2026-04-30 | 2.0 | Auth 5s timeout + SQLite offline cache | offline_session key; graceful offline login |
| 2026-04-30 | 2.0 | AppDrawer sync button | Shows pending counts; progress % on tap |
| 2026-04-30 | 2.0 | Presence system | MainApp broadcasts online status; I Protect tab reads driver presence |
| 2026-04-30 | 2.0 | session_telemetry_local head_tilt_delta column | Additive migration |
| 2026-04-30 | 2.0 | emergency_alert_events_local dismissed_at column | Additive migration |
| 2026-04-30 | 2.0 | Web DrowsinessAlertOverlay | 30s EC countdown (vs 120s mobile); bar chart; SOS button |
| 2026-04-30 | 2.0 | Web pages: Simulation, IotDevices, Alerts | New/expanded web pages implemented |
| 2026-04-30 | 2.0 | rehydrateSessions() in sync/flush.ts | Pulls last 90 days remote sessions on login |

---

*End of AI_CONTEXT_BLOCK. Reference this file instead of re-analyzing the codebase.*
