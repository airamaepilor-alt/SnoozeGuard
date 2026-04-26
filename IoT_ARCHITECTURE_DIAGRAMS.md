# IoT Device Management — Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                            │
├──────────────────────────────┬──────────────────────────────────────────┤
│                              │                                          │
│     WEB APP                  │         MOBILE APP                       │
│  (React + Vite)              │    (React Native + Expo)                 │
│                              │                                          │
│  Top Nav Links               │   Drawer Menu                            │
│  ├─ IoT Devices              │   ├─ IoT Devices                         │
│  └─ Others...                │   └─ Others...                           │
│                              │                                          │
│  Sidebar Menu                │   Hidden Tab                             │
│  ├─ IoT Devices  ← (click)   │   └─ IotDevicesScreen                    │
│  └─ Others...                │                                          │
│                              │                                          │
│  Quick Button (header)       │   (Same functionality as web)            │
│  └─ IoT Devices  ← (click)   │                                          │
│                              │                                          │
└──────────────────────────────┴──────────────────────────────────────────┘
                                         ↓
                 ┌───────────────────────────────────────┐
                 │    SHARED LOGIC LAYER                 │
                 │                                       │
                 │  Both web & mobile use:               │
                 │  • Supabase JS client                 │
                 │  • Same API calls                     │
                 │  • Same data model                    │
                 │  • Real-time subscriptions            │
                 │                                       │
                 └───────────────────────────────────────┘
                                         ↓
                 ┌───────────────────────────────────────┐
                 │      SUPABASE BACKEND                 │
                 │                                       │
                 │  PostgreSQL Database                  │
                 │  ┌─────────────────────────────────┐  │
                 │  │ user_iot_devices table          │  │
                 │  │ ├─ user_id (PK)                 │  │
                 │  │ ├─ device_id                    │  │
                 │  │ ├─ last_seen (heartbeat)        │  │
                 │  │ └─ created_at                   │  │
                 │  └─────────────────────────────────┘  │
                 │                                       │
                 │  Realtime Engine                      │
                 │  └─ Broadcasts changes to clients     │
                 │                                       │
                 │  Row Level Security (RLS)             │
                 │  └─ Users only see own devices        │
                 │                                       │
                 └───────────────────────────────────────┘
                                         ↓
                    ┌────────────────────────────────────┐
                    │    FUTURE: ESP32 IoT Device        │
                    │                                    │
                    │  ┌──────────────────────────────┐  │
                    │  │ WiFi Module                  │  │
                    │  │ Sends heartbeat every 5s     │  │
                    │  │ POST /v1/iot/ping            │  │
                    │  └──────────────────────────────┘  │
                    │                                    │
                    │  ┌──────────────────────────────┐  │
                    │  │ MQTT Subscriber              │  │
                    │  │ Listen for buzz commands     │  │
                    │  └──────────────────────────────┘  │
                    │                                    │
                    │  ┌──────────────────────────────┐  │
                    │  │ GPIO Control                 │  │
                    │  │ Buzzer + LED pins            │  │
                    │  └──────────────────────────────┘  │
                    │                                    │
                    │  ┌──────────────────────────────┐  │
                    │  │ Button Handler               │  │
                    │  │ Dismiss from physical button │  │
                    │  └──────────────────────────────┘  │
                    │                                    │
                    └────────────────────────────────────┘
```

---

## Data Flow Diagram

### Add Device Flow
```
User Input (Device ID)
    ↓
IotDevicesPage/Screen
    ↓
handleAddDevice()
    ↓
Validate (not empty, not duplicate)
    ↓
supabase.from("user_iot_devices").upsert({
  user_id: user.id,
  device_id: trimmedId,
  last_seen: now()
})
    ↓
Database Updates
    ↓
Realtime Notification Fired
    ↓
All subscribed clients get notified
    ↓
Device appears in list (Status: Offline)
    ↓
ESP32 sends heartbeat (future phase)
    ↓
last_seen updates
    ↓
Status changes to ● Online
```

### Remove Device Flow
```
User clicks [Remove]
    ↓
handleRemoveDevice()
    ↓
supabase.from("user_iot_devices").delete()
    ↓
Database Updates (row deleted)
    ↓
Realtime Notification Fired
    ↓
All subscribed clients get notified
    ↓
Device disappears from list
```

### Real-time Sync Flow (Multi-Tab)
```
Tab 1: Opens IoT Devices page
    ↓
Supabase Realtime subscription created
    ↓
Watches user_iot_devices table for changes
    ↓
---
Tab 2: Opens IoT Devices page
    ↓
Another Supabase Realtime subscription created
    ↓
---
Tab 1: User pairs device "esp32cam-001"
    ↓
Write to database
    ↓
Realtime event fired
    ↓
Tab 1 updates state → device appears
Tab 2 updates state → device appears (NO REFRESH!)
    ↓
Both tabs always in sync
```

---

## Component Hierarchy (Web)

```
App.tsx
├── Route: /iot-devices
│   └── IotDevicesPage
│       ├── Header
│       ├── Status Messages (error/success)
│       ├── Pair New Device Form
│       │   ├── TextInput (device ID)
│       │   └── Button (Pair Device)
│       └── Device List
│           └── DeviceCard (repeated)
│               ├── Status Indicator
│               ├── Device Info
│               └── Remove Button
│
└── AppShell.tsx
    ├── Header
    │   ├── Search
    │   ├── Top Nav
    │   │   └── Link to /iot-devices ← NEW
    │   └── Quick Actions
    │       └── IoT Devices Button ← NEW
    │
    └── Sidebar
        ├── Logo
        ├── Nav Items
        │   └── IoT Devices ← NEW
        └── Bottom Section
```

---

## Component Hierarchy (Mobile)

```
App.tsx
├── Tab.Navigator
│   ├── Visible Tabs
│   │   ├── Home
│   │   ├── Drive
│   │   ├── Alerts
│   │   ├── History
│   │   └── Analytics
│   │
│   └── Hidden Tabs (Drawer-only)
│       ├── EmergencyContact
│       ├── Account
│       ├── IotDevices ← NEW
│       ├── About
│       ├── Terms
│       └── Admin (if super_admin)
│
└── AppDrawer.tsx
    ├── User Info
    ├── Nav Items
    │   └── IotDevices ← NEW
    └── Actions
```

---

## State Management Flow

### Web (React Hooks)
```
IotDevicesPage Component
├── useState
│   ├── devices[] ..................... List of paired devices
│   ├── loading ...................... Fetch in progress
│   ├── newDeviceId .................. Input field value
│   ├── adding ....................... Pairing in progress
│   ├── error ........................ Error message
│   └── message ...................... Success message
│
├── useEffect (mount)
│   ├── Load devices from Supabase
│   └── Subscribe to Realtime changes
│
└── useEffect (unmount)
    └── Unsubscribe from Realtime
```

### Mobile (React Hooks + Theme)
```
IotDevicesScreen Component
├── useState
│   ├── devices[] ..................... List of paired devices
│   ├── loading ...................... Fetch in progress
│   ├── newDeviceId .................. Input field value
│   ├── adding ....................... Pairing in progress
│   ├── error ........................ Error message
│   └── message ...................... Success message
│
├── useTheme()
│   └── Get theme colors for styling
│
├── useEffect (mount)
│   ├── Load devices from Supabase
│   └── Subscribe to Realtime changes
│
└── useEffect (unmount)
    └── Unsubscribe from Realtime
```

---

## Database Schema

```
public.user_iot_devices
├── Columns:
│   ├── user_id (uuid)
│   │   ├── PK: true
│   │   ├── FK: auth.users(id)
│   │   └── ON DELETE: CASCADE
│   │
│   ├── device_id (text)
│   │   ├── Unique: true (per user)
│   │   └── Example: "ESP32CAM-001"
│   │
│   ├── last_seen (timestamptz)
│   │   └── Updated by: /v1/iot/ping endpoint
│   │
│   └── created_at (timestamptz)
│       └── Default: now()
│
├── Indexes:
│   ├── PK on user_id
│   └── FK on auth.users(id)
│
├── Row Level Security:
│   ├── Policy: "iot_devices_own"
│   ├── For: all (SELECT, INSERT, UPDATE, DELETE)
│   └── Using: auth.uid() = user_id
│
└── Realtime:
    └── Enabled: yes (for subscriptions)
```

---

## File Organization

```
SnoozeGuard/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── App.tsx ............................ +1 import, +1 route
│   │   │   ├── pages/
│   │   │   │   └── IotDevicesPage.tsx ............ NEW
│   │   │   └── components/
│   │   │       ├── AppShell.tsx .................. +3 nav updates
│   │   │       └── IotDeviceStatus.tsx ........... NEW
│   │   └── ...
│   │
│   └── mobile/
│       ├── App.tsx ............................. +1 import, +1 nav, +1 screen
│       ├── navigation/
│       │   └── types.ts ........................ +1 type
│       ├── screens/
│       │   └── IotDevicesScreen.tsx ............ NEW
│       └── ...
│
├── docs/
│   ├── (existing docs)
│   └── ...
│
└── [Documentation files]
    ├── IoT_DEVICE_MANAGEMENT_SETUP.md
    ├── IoT_NAVIGATION_GUIDE.md
    ├── IoT_INTEGRATION_CODE_REFERENCE.md
    ├── IoT_QUICK_START.md
    ├── IOT_IMPLEMENTATION_SUMMARY.md
    └── IoT_DEVICE_MANAGEMENT_DOCS_INDEX.md
```

---

## Navigation Tree

### Web App
```
/ (root)
├── / (Dashboard)
├── /analytics
├── /drive
├── /iot-devices ................... ← NEW
├── /history
├── /history/:sessionId
├── /account
├── /guardians (EC)
├── /safety-protocol
├── /admin (super_admin only)
├── /about
├── /terms
└── /simulation
```

### Mobile App
```
Tab Screens (visible)
├── Home
├── Drive
├── Alerts
├── History
└── Analytics

Hidden Screens (drawer only)
├── EmergencyContact
├── Account
├── IotDevices .................... ← NEW
├── About
├── Terms
└── Admin (super_admin only)
```

---

## Integration Points

```
Current (Phase 1 - COMPLETE)
├── ✅ Device Management UI
├── ✅ Pairing & Removal
├── ✅ Real-time Status
├── ✅ Navigation Shortcuts
└── ✅ Offline Support

Future (Phase 2)
├── API Routes (/v1/iot/*)
├── MQTT Integration
├── Buzzer Signaling
├── Dismiss Synchronization
└── Firmware Integration
```

---

## Technology Stack

```
Frontend Layer:
├── Web: React + TypeScript + Tailwind CSS + Vite
├── Mobile: React Native + TypeScript + Expo
└── Both: Supabase JS Client (same library!)

Backend Layer:
├── Database: PostgreSQL (via Supabase)
├── Auth: Supabase Auth
├── Real-time: Supabase Realtime (via WebSocket)
└── API: Supabase Functions/REST (for future phases)

Future (IoT):
├── Protocol: MQTT (Mosquitto)
├── Device: ESP32-CAM
├── Firmware: Arduino (C++)
└── Communication: WiFi + HTTPS
```

---

## Summary

```
┌────────────────────────────────────────────────────────┐
│          IoT Device Management Architecture            │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Two Independent UIs (Web & Mobile)                   │
│  ↓                                                    │
│  Single Shared Backend (Supabase)                     │
│  ↓                                                    │
│  Real-time Synchronization                           │
│  ↓                                                    │
│  Future: ESP32 Integration                           │
│                                                        │
│  Result: Seamless multi-platform device management   │
│                                                        │
└────────────────────────────────────────────────────────┘
```
