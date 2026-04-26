# IoT Device Management — Quick Start

## 🎯 What's Been Added

You can now manage IoT devices (ESP32 buzzers) directly from the app with easy shortcuts:

✅ **Web** — Top nav link + Sidebar menu + Quick button  
✅ **Mobile** — Drawer menu + Full screen  
✅ **Real-time** — See devices online/offline instantly  
✅ **Offline-first** — Works even without internet  

---

## 🚀 Access the Feature

### Web App
1. **Top Nav Bar** — Look for "IoT Devices" link (desktop)
2. **Sidebar** — Click "IoT Devices" in left menu
3. **Header Button** — Click device icon (md+ screens)
4. **Direct URL** — `https://yourapp.com/iot-devices`

### Mobile App
1. **Drawer** — Tap hamburger menu → "IoT Devices"
2. **Full Screen** — Dedicated management page

---

## 📝 How to Use (First Time)

### Step 1: Open IoT Devices Page
- Web: Click any "IoT Devices" shortcut
- Mobile: Tap hamburger → "IoT Devices"

### Step 2: Pair Your Device
1. Find your device ID (on the device label or LED display)
2. Enter it in the "Device ID" field (e.g., `esp32cam-001`)
3. Tap "Pair Device"
4. Success! Device appears in list

### Step 3: Check Status
- **● Online (pulsing green)** = Connected & ready
- **○ Offline (grey)** = Device disconnected
- Status updates in real-time

### Step 4: Manage
- **Add more** — Repeat steps 1-3
- **Remove** — Tap [Remove] on any device
- **Multiple tabs** — Changes sync instantly across all open tabs

---

## 🛠️ What's Behind the Scenes

### Web Files
```
✅ apps/web/src/pages/IotDevicesPage.tsx .............. Full management page
✅ apps/web/src/components/IotDeviceStatus.tsx ....... Reusable status widget
✅ apps/web/src/components/AppShell.tsx .............. Navigation shortcuts
✅ apps/web/src/App.tsx ............................. New route setup
```

### Mobile Files
```
✅ apps/mobile/screens/IotDevicesScreen.tsx .......... React Native version
✅ apps/mobile/App.tsx ............................. Screen registration
✅ apps/mobile/navigation/types.ts ................. Type definitions
```

### Key Database
```
user_iot_devices table
├─ user_id .................... Who owns it
├─ device_id .................. Device identifier
├─ last_seen .................. Last heartbeat (for status)
└─ created_at ................. When paired
```

---

## 📋 Features Included

### Pairing
- ✅ Easy text input for device ID
- ✅ Auto-uppercase conversion
- ✅ Duplicate prevention
- ✅ Success/error messages

### Monitoring
- ✅ Real-time online/offline status
- ✅ Last seen time
- ✅ Pairing date
- ✅ Auto-refresh every 5 seconds

### Management
- ✅ Add multiple devices
- ✅ Remove devices
- ✅ Empty state message
- ✅ Loading states

### Offline Support
- ✅ Cache device list
- ✅ Show warning when offline
- ✅ Disable pair/remove when offline
- ✅ Auto-sync when online again

### Real-time Updates
- ✅ Changes sync across tabs instantly
- ✅ Supabase Realtime subscription
- ✅ Auto-refresh on device list changes
- ✅ Live status updates

---

## 🔍 Navigation Visuals

### Web Top Navigation
```
Dashboard  Analytics  History  Drive  [IoT Devices]  Simulation
                                      ^^^^^^^^^^^^^^
                                      NEW link here!
```

### Web Sidebar
```
📊 Dashboard
📈 Driver Analytics  
📜 Fatigue Logs
👤 Account
🛡️ Emergency Contact
📱 IoT Devices  ← NEW
ℹ️ About
⚖️ Terms & Privacy
```

### Mobile Drawer
```
Logo
├─ Dashboard
├─ Analytics
├─ History
├─ Emergency Contact
├─ Account
├─ 📱 IoT Devices  ← NEW
├─ About
└─ Terms & Privacy
```

---

## 🎮 Try It Out

### Quick Test (Web)
1. Open browser → `http://localhost:5173` (or your URL)
2. Login if needed
3. Click "IoT Devices" in sidebar
4. Enter `test-device-001`
5. Click "Pair Device"
6. Device appears in list (status: Offline initially)
7. Try removing it

### Quick Test (Mobile)
1. Open app
2. Tap hamburger ☰ menu
3. Tap "IoT Devices"
4. Same test as web

### Real-time Test
1. Open device page in 2 browser tabs
2. In Tab 1: Pair device `tab2-test`
3. In Tab 2: Watch it appear automatically (no refresh!)
4. In Tab 1: Remove device
5. In Tab 2: Watch it disappear (no refresh!)

---

## 📱 Responsive Design

### Web
- **Mobile** — Full width, hidden top nav
- **Tablet** — Sidebar visible, top nav with icons
- **Desktop** — Everything visible, full controls

### Mobile
- **Phone** — Full screen, touch-friendly buttons
- **Tablet** — Same responsive layout

---

## ⚠️ Important Notes

### Offline Mode
- You can still **see** your devices
- You **cannot add or remove** while offline
- Changes will sync when you reconnect
- Warning banner shows when offline

### Device Status
- Device is "Online" if heartbeat received in last 15 seconds
- Status updates in real-time via Supabase
- ESP32 needs to send `/v1/iot/ping` every 5 seconds

### Multiple Devices
- Currently: **One device per user**
- Database: User ID = Primary Key (1:1 relationship)
- Future: Can be modified to support multiple devices

---

## 🔧 What's Coming Next

After this foundation is complete:

1. **Buzz Signal** — App sends alert to ESP32 → triggers buzzer
2. **Dismiss Sync** — Dismissing from app stops device immediately
3. **Button Handler** — Pressing device button dismisses alert everywhere
4. **Monitoring** — Dashboard shows all connected devices
5. **Analytics** — Track device response times

---

## 🐛 Troubleshooting

### Device won't pair
- Check Device ID format (should be alphanumeric)
- Make sure you're online
- Device ID might already be paired

### Device shows "Offline"
- ESP32 hasn't sent first heartbeat yet (wait 5-10 sec)
- ESP32 not powered on
- Network connection issues
- Check ESP32 WiFi settings

### Changes not syncing across tabs
- Refresh the page
- Check internet connection
- Check Supabase Realtime is working

### Page won't load
- Check you're logged in
- Verify `/iot-devices` route exists
- Check browser console for errors

---

## 📞 Support

For issues or questions:
1. Check the logs: `console.error()` outputs
2. Verify Supabase connection
3. Check table permissions (RLS policies)
4. See integration docs: `IoT_INTEGRATION_CODE_REFERENCE.md`

---

## ✅ You're Ready!

The IoT Device Management system is fully integrated and ready to use.

**Next Step:** Run the app and try pairing your first device!

```bash
# Web
npm run dev

# Mobile
expo start
```

**Questions?** Check the detailed docs:
- `IoT_DEVICE_MANAGEMENT_SETUP.md` — Full setup details
- `IoT_NAVIGATION_GUIDE.md` — Visual navigation reference
- `IoT_INTEGRATION_CODE_REFERENCE.md` — Code integration details
