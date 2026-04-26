# IoT Device Management — Integration Code Reference

Quick reference for where each component is used and how they integrate together.

---

## 📂 Web App Integration Points

### 1. Route Definition (`apps/web/src/App.tsx`)

```tsx
// Line 18: Import the new page
import { IotDevicesPage } from "./pages/IotDevicesPage";

// ... inside AppRoutes() function, around line 45:
<Route path="iot-devices" element={<IotDevicesPage />} />
```

### 2. Top Navigation Bar (`apps/web/src/components/AppShell.tsx`)

```tsx
// Around line 408-415: Inside top nav
<nav className="hidden lg:flex gap-5 xl:gap-6">
  <TopNavLink to="/" label="Dashboard" end />
  <TopNavLink to="/analytics" label="Analytics" />
  <TopNavLink to="/history" label="History" />
  <TopNavLink to="/drive" label="Drive" />
  <TopNavLink to="/iot-devices" label="IoT Devices" />  {/* ← NEW */}
  <TopNavLink to="/simulation" label="Simulation" />
</nav>
```

### 3. Quick Access Button (`apps/web/src/components/AppShell.tsx`)

```tsx
// Around line 422-427: Quick action button in header right section
<Link to="/iot-devices" 
  className="hidden md:flex items-center gap-2 bg-secondary/10 text-secondary px-3 lg:px-4 py-2 rounded-lg font-bold text-xs lg:text-sm hover:bg-secondary/20 transition-all border border-secondary/20 whitespace-nowrap"
  title="Manage IoT devices">
  <span className="material-symbols-outlined text-sm">devices_other</span>
  <span className="hidden lg:inline">IoT</span>
</Link>
```

### 4. Sidebar Menu (`apps/web/src/components/AppShell.tsx`)

```tsx
// Around line 130-131: In SidebarContent navigation section
<SideNavItem to="/iot-devices" icon="devices_other" label="IoT Devices" onNavigate={onNavigate} />
```

### 5. Using Status Component (Optional - in DriveScreen)

```tsx
// Add to apps/web/src/pages/DrivePage.tsx if needed:
import { IotDeviceStatus } from "../components/IotDeviceStatus";

// Inside component render:
<IotDeviceStatus 
  userId={user?.id} 
  compact={false}
  showManageLink={true}
/>
```

---

## 📱 Mobile App Integration Points

### 1. Navigation Types (`apps/mobile/navigation/types.ts`)

```tsx
// Add to MainTabParamList:
export type MainTabParamList = {
  Home: undefined;
  Drive: undefined;
  Alerts: undefined;
  History: undefined;
  Analytics: undefined;
  EmergencyContact: undefined;
  Account: undefined;
  IotDevices: undefined;  // ← NEW
  About: undefined;
  Admin: undefined;
  Terms: undefined;
};
```

### 2. Screen Import (`apps/mobile/App.tsx`)

```tsx
// Around line 24: Add import
import { IotDevicesScreen } from "./screens/IotDevicesScreen";
```

### 3. Drawer Navigation Items (`apps/mobile/App.tsx`)

```tsx
// Around line 219-225: In AppDrawer function
type NavItem = { name: keyof MainTabParamList; icon: string; label: string };
const navItems: NavItem[] = [
  { name: "EmergencyContact", icon: "emergency", label: "Emergency Contact" },
  { name: "Account", icon: "manage-accounts", label: "Account" },
  { name: "IotDevices", icon: "devices-other", label: "IoT Devices" },  // ← NEW
  { name: "About", icon: "info-outline", label: "About SnoozeGuard" },
  { name: "Terms", icon: "gavel", label: "Terms & Privacy" },
  ...(superAdmin ? [{ name: "Admin" as keyof MainTabParamList, icon: "admin-panel-settings", label: "Admin Config" }] : []),
];
```

### 4. Tab Screen Registration (`apps/mobile/App.tsx`)

```tsx
// Around line 741-751: In Tab.Navigator
<Tab.Screen
  name="IotDevices"
  component={IotDevicesScreen}
  options={{ title: "IoT Devices", tabBarItemStyle: { display: "none" } }}
/>
```

---

## 🎯 Component File Structure

### Web IotDevicesPage (`apps/web/src/pages/IotDevicesPage.tsx`)

```tsx
export function IotDevicesPage() {
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [devices, setDevices] = useState<IotDevice[]>([]);
  
  // Load devices from Supabase
  // Subscribe to realtime updates
  // Pair new device
  // Remove device
  
  return (
    <div className="min-h-dvh bg-surface">
      {/* Header */}
      {/* Status messages */}
      {/* Add device form */}
      {/* Devices list */}
      {/* Info section */}
    </div>
  );
}
```

### Web IotDeviceStatus Component (`apps/web/src/components/IotDeviceStatus.tsx`)

```tsx
export function IotDeviceStatus({ userId, compact = false, showManageLink = true }) {
  const [device, setDevice] = useState<IotDevice | null>(null);
  
  // Load current device
  // Subscribe to realtime
  // Check if connected
  
  // Render: status indicator + device ID + manage link
}
```

### Mobile IotDevicesScreen (`apps/mobile/screens/IotDevicesScreen.tsx`)

```tsx
export function IotDevicesScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { user } = useSession();
  const [devices, setDevices] = useState<IotDevice[]>([]);
  
  // Load devices (same as web)
  // Subscribe to realtime (same as web)
  // Pair/remove (same logic as web)
  
  return (
    <View style={styles.container}>
      {/* Header */}
      {/* Form */}
      {/* Device list */}
      {/* Info section */}
    </View>
  );
}
```

---

## 🔄 Data Flow

### Pairing Flow
```
User enters Device ID
  ↓
handleAddDevice() called
  ↓
Validate (not empty, not duplicate)
  ↓
supabase.from("user_iot_devices").upsert({
  user_id: user.id,
  device_id: trimmedId,
  last_seen: now()
})
  ↓
Realtime fires
  ↓
setDevices() updates state
  ↓
Device appears in list
```

### Remove Flow
```
User taps [Remove]
  ↓
handleRemoveDevice() called
  ↓
supabase.from("user_iot_devices").delete()
  .eq("user_id", user.id)
  .eq("device_id", deviceId)
  ↓
Realtime fires
  ↓
setDevices() updates state
  ↓
Device disappears from list
```

### Real-time Subscription
```tsx
const channel = supabase
  .channel(`iot-devices-${user.id}`)
  .on("postgres_changes",
    {
      event: "*",  // INSERT, UPDATE, DELETE
      schema: "public",
      table: "user_iot_devices",
      filter: `user_id=eq.${user.id}`,
    },
    (payload) => {
      if (payload.eventType === "DELETE") {
        setDevices(prev => prev.filter(d => d.device_id !== payload.old.device_id));
      } else if (payload.eventType === "INSERT") {
        setDevices(prev => [...prev, payload.new]);
      } else if (payload.eventType === "UPDATE") {
        setDevices(prev => prev.map(d => 
          d.device_id === payload.new.device_id ? payload.new : d
        ));
      }
    }
  )
  .subscribe();
```

---

## 🎨 Styling Reference

### Web - Tailwind Classes
```tsx
// Status indicator (online)
className="w-3 h-3 rounded-full bg-success animate-pulse"

// Status indicator (offline)
className="w-3 h-3 rounded-full bg-outline-variant"

// Device card
className="bg-surface-container rounded-xl border border-outline-variant/20 p-4"

// Primary button
className="w-full bg-primary text-on-primary py-3 rounded-lg font-headline font-bold"

// Quick access button
className="hidden md:flex items-center gap-2 bg-secondary/10 text-secondary ... whitespace-nowrap"
```

### Mobile - StyleSheet
```tsx
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.surface },
  deviceCard: {
    backgroundColor: t.colors.surfaceContainer,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.outlineVariant + "40",
    padding: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: online ? "#10b981" : "#cbd5e1",
  },
  // ... more styles
});
```

---

## 🧪 Testing Integration

### Test Web Navigation
```bash
# Check top nav link exists
navigate to / → look for "IoT Devices" in nav bar

# Check sidebar
look for "IoT Devices" after "Emergency Contact"

# Check quick button
look for device icon in top right header

# Check page loads
click any IoT Devices link → page should load
```

### Test Mobile Navigation
```bash
# Check drawer item
tap hamburger menu → look for "IoT Devices"

# Check screen loads
tap "IoT Devices" → should navigate to IotDevicesScreen

# Check functionality
try pairing device, check realtime updates
```

### Test Realtime
```bash
# Open in 2 tabs (web)
Tab 1: IoT Devices page
Tab 2: IoT Devices page

# In Tab 1: Pair device "TEST-001"
Tab 2: Should see device appear instantly (no refresh needed)

# In Tab 1: Remove device
Tab 2: Device should disappear instantly
```

---

## 📌 Key Dependencies

### Web
- React Router for routing
- Supabase JS client
- Tailwind CSS
- React hooks (useState, useEffect, useCallback)

### Mobile
- React Native Navigation
- React Native safe area
- Supabase JS client (works in RN)
- Theme context + styles

---

## 🔗 Related Integration Points (For Future)

When implementing the full buzz/dismiss flow:

1. **DrivePage.tsx** — Add `IotDeviceStatus` component
   ```tsx
   <IotDeviceStatus userId={user?.id} compact={false} />
   ```

2. **DriveScreen.tsx** (mobile) — Add similar component
   ```tsx
   <IotDevicePanel userId={user?.id} />
   ```

3. **API Routes** (`services/api/src/routes/iot.ts`)
   - POST /v1/iot/ping
   - POST /v1/iot/buzz
   - POST /v1/iot/dismiss

4. **MQTT Integration** (`services/api/src/mqtt.ts`)
   - Expose `publishMqttCommand()`

5. **Firmware** (`iot/firmware/src/main.cpp`)
   - MQTT subscribe
   - GPIO control
   - Button handler

---

## ✅ Integration Checklist

- [x] Web: Route created
- [x] Web: Top nav link added
- [x] Web: Sidebar menu added
- [x] Web: Quick access button added
- [x] Web: IotDevicesPage component created
- [x] Web: IotDeviceStatus component created
- [x] Mobile: Navigation type updated
- [x] Mobile: Screen import added
- [x] Mobile: Drawer nav item added
- [x] Mobile: Tab screen registered
- [x] Mobile: IotDevicesScreen created
- [ ] Database: Ensure `user_iot_devices` table exists
- [ ] Database: Ensure RLS policies are correct
- [ ] Test: All navigation shortcuts work
- [ ] Test: Pairing/removing works
- [ ] Test: Real-time updates work offline
- [ ] Test: Responsive design works on all screens
