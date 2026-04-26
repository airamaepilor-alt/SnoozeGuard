# IoT Device Management — Navigation Guide

## 🌐 Web App Navigation Shortcuts

### 1. Top Navigation Bar (Desktop)
```
Dashboard | Analytics | History | Drive | [IoT Devices] | Simulation
                                          ^^^^^^^^^^^^^^
                                   New shortcut appears here
```
- Location: Top header, between "Drive" and "Simulation"
- Label: "IoT Devices" 
- Icon: `devices_other` (Material Symbols)
- Color: Secondary theme (grey-blue)
- Visible on: Desktop (md+)

### 2. Sidebar Navigation (Left Panel)
```
📊 Dashboard
📈 Driver Analytics
📜 Fatigue Logs
👤 Account
🛡️ Emergency Contact
📱 IoT Devices          ← NEW
ℹ️ About
⚖️ Terms & Privacy
🔒 Safety Protocol
🚗 Drive Simulation
```
- Position: After "Emergency Contact", before "About"
- Icon: `devices_other`
- Active state: Bold + blue highlight

### 3. Quick Access Button (Header)
```
[Safety Protocol] [IoT 🔌]  [🌙] [🔔] [👤]
```
- Location: Top right of header (after Safety Protocol button)
- Shows on: Medium screens and larger (md+)
- Icon with label on desktop, icon-only on tablets

---

## 📱 Mobile App Navigation Shortcuts

### 1. Drawer Menu (Left Slide-Out)
```
Logo & Info
├─ Dashboard
├─ Driver Analytics
├─ Fatigue Logs
├─ Drive Session
├─ History
├─ Alerts Map
├─ Emergency Contact
├─ Account
├─ IoT Devices          ← NEW
├─ About
├─ Terms & Privacy
├─ [Admin Config] (if super_admin)
└─ Sync & Settings
```
- Position: After "Account"
- Icon: `devices-other` (Material Icons)
- Label: "IoT Devices"
- Tap to navigate to `IotDevicesScreen`

---

## 🎯 Device Management Pages

### Web: `/iot-devices`
Route accessible via:
1. Top nav link
2. Sidebar menu item
3. Quick action button
4. Direct URL: `https://snoozeguard.app/iot-devices`

### Mobile: `IotDevicesScreen`
Route accessible via:
1. Drawer menu tap
2. Programmatic: `navigationRef.navigate('IotDevices')`

---

## 📋 Page Layout

### Web Page Structure
```
┌─────────────────────────────────────────────────┐
│ 🏠 Dashboard  📈 Analytics  📜 History  📱 [IoT] 🎭 │ ← Top Nav
├─────────────────────────────────────────────────┤
│                                                 │
│  IoT Device Management                          │
│  Connect and manage your SnoozeGuard devices    │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Pair New Device                         │   │
│  │ ┌──────────────────────────────────────┐│   │
│  │ │ Device ID: [esp32cam-001          ] ││   │
│  │ │ Enter the unique device ID...      ││   │
│  │ │                [Pair Device]        ││   │
│  │ └──────────────────────────────────────┘│   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Your Devices                                   │
│  ┌─────────────────────────────────────────┐   │
│  │ ● Online  ESP32CAM-001      [Remove]   │   │
│  │ Last seen: 14:32:15                    │   │
│  │ Paired: April 18, 2026                 │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  How to find your Device ID                    │
│  • Check the physical label                    │
│  • Look at LED display                         │
│  ...                                           │
└─────────────────────────────────────────────────┘
```

### Mobile Screen Structure
```
┌─────────────────────────────┐
│ IoT Device Management   [☰] │ ← Header with drawer toggle
├─────────────────────────────┤
│                             │
│ Pair New Device             │
│ ┌──────────────────────────┐│
│ │Device ID:              ││
│ │[esp32cam-001...      ] ││
│ │                        ││
│ │    [Pair Device]       ││
│ └──────────────────────────┘│
│                             │
│ Your Devices                │
│ ┌──────────────────────────┐│
│ │ ● Online                ││
│ │ ESP32CAM-001       [x]  ││
│ │ Last: 14:32            ││
│ │ Paired: Apr 18, 2026   ││
│ └──────────────────────────┘│
│                             │
│ How to find Device ID...    │
└─────────────────────────────┘
```

---

## 🎨 Visual Indicators

### Connection Status
- **● Online (Pulsing Green)** — Device seen in last 15 seconds
- **○ Offline (Grey)** — Device never seen or >15s ago
- Indicator updates in real-time via Supabase Realtime

### States
| State | Appearance | Interaction |
|-------|-----------|-------------|
| Loading | Spinner | Disabled |
| Online | Green pulse | Full access |
| Offline | Grey dot | Read-only |
| Empty | "No devices" message | Can pair |
| Error | Red banner | Show error message |

---

## 🔄 Realtime Updates

When you have the IoT Devices page/screen open:
- ✅ Device added in another tab → appears instantly
- ✅ Device status changes → indicator updates instantly
- ✅ Device removed → disappears instantly
- ✅ Last seen time updates → refreshes in real-time

---

## 🌐 Responsive Behavior

### Web
| Screen | Top Nav | Sidebar | Quick Btn | Show |
|--------|---------|---------|-----------|------|
| Mobile | Hidden | Drawer (menu icon) | Hidden | Hamburger only |
| Tablet | Visible | Visible | Icon only | Icon + label on hover |
| Desktop | Visible | Visible | Icon + label | Full "IoT Devices" |

### Mobile
- Full width page
- Drawer toggle in header
- All controls full-size for touch

---

## 🚀 How to Use

### First Time Setup
1. Open app → Tap "IoT Devices" (web sidebar/mobile drawer)
2. Enter your device ID (e.g., "esp32cam-001")
3. Tap "Pair Device"
4. Wait for ESP32 to send first heartbeat (5 sec)
5. Status changes from "Offline" to "● Online"

### Managing Devices
- **Add:** Enter ID + tap Pair
- **Monitor:** Green dot = online, Grey dot = offline
- **Remove:** Tap [Remove] button on device card

### When Offline
- Can still see cached device list
- Cannot add or remove devices
- "You are offline" warning shown
- Updates will sync when reconnected

---

## 📊 Database Flow

```
User → App (web/mobile)
  ↓
  Submits device ID
  ↓
  Writes to Supabase:
  user_iot_devices {
    user_id: "abc-123",
    device_id: "esp32cam-001",
    last_seen: null,
    created_at: now()
  }
  ↓
  Realtime subscription fires
  ↓
  Device appears in list
  ↓
  ESP32 sends heartbeat (POST /v1/iot/ping)
  ↓
  API updates: last_seen = now()
  ↓
  Realtime fires again
  ↓
  Status: ● Online (pulsing)
```

---

## ✅ You're All Set!

IoT Device Management is now fully integrated:
- ✅ Shortcuts in nav (web & mobile)
- ✅ Device pairing & management
- ✅ Real-time status monitoring
- ✅ Offline support
- ✅ Ready for buzzer/dismiss flow integration
