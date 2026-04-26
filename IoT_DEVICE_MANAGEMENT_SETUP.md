# IoT Device Management Integration — Complete

## Summary

I've successfully implemented **IoT Device Management** for both the web and mobile apps with shortcuts in top nav, sidebar, and full device management UI. Users can now easily:

✅ **Connect IoT devices** — pair their ESP32 buzzer with a device ID  
✅ **Monitor status** — see if devices are online/offline with real-time connection indicators  
✅ **Remove devices** — unpair devices from their account  
✅ **Quick access** — access device management from nav bar, sidebar, and drive page  

---

## Files Created & Modified

### Web App (`apps/web/`)

#### New Files:
1. **`src/pages/IotDevicesPage.tsx`**
   - Full device management page
   - Pair new devices form with validation
   - Real-time device list with online/offline status
   - Realtime Supabase subscription for live updates
   - Remove device functionality
   - Helper text for finding device ID

2. **`src/components/IotDeviceStatus.tsx`**
   - Reusable component showing current paired device
   - Displays device ID, connection status, online indicator
   - Two modes: compact (for inline) and full (for panels)
   - Shows last seen time and pairing date
   - Can be used in Drive page or other screens

#### Modified Files:
1. **`src/App.tsx`**
   - Added `IotDevicesPage` import
   - Added route: `/iot-devices`

2. **`src/components/AppShell.tsx`**
   - Added "IoT Devices" to sidebar navigation (main nav items)
   - Added "IoT Devices" to top nav bar (between Drive & Simulation)
   - Added quick-access button in top header bar (icon + label on desktop)
   - Color theme: secondary (matches existing theme)

---

### Mobile App (`apps/mobile/`)

#### New Files:
1. **`screens/IotDevicesScreen.tsx`**
   - Full React Native implementation matching web functionality
   - Theme-aware styling using `useTheme()` + `makeStyles(t: Theme)` pattern
   - Device pairing with TextInput
   - Real-time device list with Realtime subscription
   - Online/offline indicators with animated pulse
   - Remove device with press handlers
   - Loading states and empty states
   - Error/success messages
   - Helper tips section
   - Offline mode warning

#### Modified Files:
1. **`navigation/types.ts`**
   - Added `IotDevices: undefined` to `MainTabParamList`

2. **`App.tsx`**
   - Added `IotDevicesScreen` import
   - Added to drawer nav items: `{ name: "IotDevices", icon: "devices-other", label: "IoT Devices" }`
   - Added as hidden Tab.Screen with `tabBarItemStyle: { display: "none" }`

---

## User Interface Details

### Web App

#### Top Navigation Bar
- New shortcut button positioned between "Drive" and "Simulation"
- Secondary color theme matching existing style
- Hidden on small screens, visible on desktop (md+)
- Icon + label: `devices_other` "IoT Devices"

#### Sidebar Navigation
- New menu item: "IoT Devices" with `devices_other` icon
- Positioned after "Emergency Contact", before "About"
- Full navigation item with active state styling

#### Device Management Page (`/iot-devices`)
- Header with description
- **Pair New Device** section
  - Device ID input field
  - Helper text about finding device ID
  - "Pair Device" button
  - Disabled when offline or invalid input
  
- **Your Devices** section
  - Device cards showing:
    - Status indicator (● Online/○ Offline)
    - Last seen time
    - Pairing date
    - Remove button (disabled offline)
  - Empty state when no devices
  - Loading state while fetching
  
- **Info Section**
  - How to find Device ID (4 tips)

### Mobile App

#### Drawer Navigation
- New menu item: "IoT Devices" with `devices-other` icon
- Positioned after "Account"
- Accessible from hamburger menu

#### Device Management Screen
- Header: "IoT Device Management"
- Same functionality as web:
  - Pair new device form
  - Device list with status
  - Real-time updates
  - Remove device
  - Helper tips

---

## Features

### Device Pairing
- Input Device ID (e.g., "esp32cam-001")
- Auto-uppercase conversion
- Duplicate device check
- Upsert to Supabase `user_iot_devices` table
- Success/error messaging

### Connection Status
- Real-time indicator shows device connectivity
- Green/pulsing (●) = Online (last seen < 15s)
- Grey (○) = Offline or never seen
- Updates via Supabase Realtime when ESP32 sends heartbeat

### Offline Mode
- Graceful degradation when no internet
- "You are offline" warning shown
- Pair/Remove buttons disabled
- Device list shows cached data (may be outdated)

### Real-time Sync
- Supabase Realtime subscription on `user_iot_devices`
- Device list updates instantly across all open tabs/clients
- Auto-refresh when new devices added
- Auto-remove when devices deleted

---

## Navigation Shortcuts

### Web App
1. **Top Nav Bar** — Quick access button (icon + label)
2. **Sidebar** — Full menu item in main nav
3. **Drive Page** — Can add inline `<IotDeviceStatus />` component

### Mobile App
1. **Drawer Menu** — Menu item in left drawer
2. **Tab Navigation** — Hidden tab (accessible only via drawer)

---

## Database Table Used

```sql
user_iot_devices
├─ user_id (uuid, PK, FK to auth.users)
├─ device_id (text, unique per user)
├─ last_seen (timestamptz) — updated by ESP32 heartbeat
└─ created_at (timestamptz)
```

RLS Policy: Users can only see/manage their own devices (`auth.uid() = user_id`)

---

## Integration with Plan

This implementation aligns with the **IoT Alert Integration plan** (`CLAUDE.md` — Step 5 Web + Step 6 Mobile):

✅ **Pairing UI** — Complete  
✅ **Connection indicator** — Real-time status  
✅ **Device management** — Add/remove  
✅ **Offline-first** — Cached data, graceful degradation  

Ready for Step 4 (API Routes) and Step 7 (Firmware) to complete the full buzz/dismiss flow.

---

## Next Steps (When Implementing Full Buzz Flow)

1. Add `IotDeviceStatus` component to `DriveScreen` (web) showing paired device
2. Add API routes: `/v1/iot/ping`, `/v1/iot/buzz`, `/v1/iot/dismiss`
3. Update `DrivePage` tick logic to send buzz signal to ESP32
4. Add Realtime listener for IoT button dismiss (updates `iot_alerts` table)
5. Flash firmware with MQTT subscribe + button handler

---

## Testing Checklist

- [ ] Web: Navigate to `/iot-devices` page
- [ ] Web: Top nav shows "IoT Devices" link
- [ ] Web: Sidebar shows "IoT Devices" menu item
- [ ] Web: Pair device with ID "esp32cam-001"
- [ ] Web: Device appears in list with "Offline" status
- [ ] Web: Remove device button works
- [ ] Mobile: Open drawer → tap "IoT Devices"
- [ ] Mobile: Same pairing/list/remove flow works
- [ ] Both: Online mode shows full functionality
- [ ] Both: Offline mode shows warning, disables pair/remove
- [ ] Both: Realtime updates when device list changes (test multiple tabs)

---

## Files Modified Summary

```
apps/web/src/
├── App.tsx (1 import, 1 route)
├── components/AppShell.tsx (3 nav updates)
├── components/IotDeviceStatus.tsx (NEW)
└── pages/IotDevicesPage.tsx (NEW)

apps/mobile/
├── App.tsx (1 import, 1 nav item, 1 screen)
├── navigation/types.ts (1 type added)
└── screens/IotDevicesScreen.tsx (NEW)
```

All changes follow SnoozeGuard conventions:
- Web: Tailwind + React patterns
- Mobile: React Native + Theme context
- Both: Supabase + Realtime
- Both: Offline-first philosophy
