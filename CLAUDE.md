# SnoozeGuard — Claude Code Instructions

> Read this file at the start of every session. These rules override all defaults.
> For deep system context, read `docs/AI_CONTEXT_BLOCK.md` (compressed, machine-readable).
> For full BRD and data model, read `docs/BRD_TECHNICAL_ALIGNMENT.md`.

---

## PROJECT OVERVIEW

SnoozeGuard is a real-time driver drowsiness detection system.
- **Mobile** (Expo SDK 54 / React Native 0.81.5) — source of truth, nearly complete
- **Web** (React + Vite) — next target after mobile
- **IoT** (ESP32-CAM) — after web
- **Backend** — Supabase (Postgres + Auth + Realtime)

Current active work: **mobile only** (`apps/mobile/`).

---

## CRITICAL DO NOT DO

- **Never run `eas update` automatically.** OTA pushes must be user-initiated. Give the user the exact command instead:
  ```
  cd apps/mobile && eas update --branch preview --message "..."
  ```
- **Never use `Alert.alert()`** anywhere in the mobile app. Use inline error text or the `ConfirmModal` component in `App.tsx`.
- **Never render React Native `<Text>` inside `<Svg>`.** Always use `import { Text as SvgText } from "react-native-svg"` for any text inside an SVG element.
- **Never write data directly to Supabase `admin_config` table.** Always use the `update_admin_config` SECURITY DEFINER RPC.
- **Never run EAS Build** unless the user explicitly asks. OTA is sufficient for all JS-only changes.

---

## MOBILE CONVENTIONS (ENFORCE THESE)

### Theme Pattern (every screen and component must follow this)
```tsx
import { useTheme } from "../context/ThemeContext";
import type { Theme } from "../theme";

export function MyScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  // ...
}

const makeStyles = (t: Theme) => StyleSheet.create({ ... });
```
- **Never** import the static `theme` object for screen styles. It breaks light mode.
- The static `import { theme } from "../theme"` is only kept for the `NAV_DARK_THEME` object in `App.tsx`.

### Theme Toggle Persistence
- Theme preference stored in SQLite `user_preferences` table via `getPref("theme_mode")` / `setPref("theme_mode", value)`.
- `ThemeContext.tsx` uses a lazy `useState(() => loadSavedTheme())` initializer.

### Navigation Structure (Tab Navigator)
```
Visible tabs (in order):    Home · Analytics · Drive · Alerts · History
Hidden (drawer-only tabs):  EmergencyContact · Account · About · Terms · Admin (super_admin only)
```
Hidden tabs use: `tabBarItemStyle: { display: "none" }`

### Drawer Navigation
- `AppDrawer` is a left slide-in `Animated` modal (DRAWER_WIDTH=300).
- Triggered via `openDrawerRef.current()` from the hamburger `headerLeft` button.
- Nav items: EmergencyContact, Account, Admin (conditional), About, Terms, Web Dashboard (coming soon).
- Uses `navigationRef` (createNavigationContainerRef) for external navigation.

### SQLite is Ground Truth
- `HomeScreen` and `HistoryScreen` MUST query local SQLite, NOT Supabase.
- Supabase may have more sessions than local SQLite (legacy cloud records).
- All new tables: see `db/database.ts`.

### SQLite Tables (as of 2026-04-18)
- `driving_sessions_local` — session rows
- `session_telemetry_local` — telemetry samples (1/sec during session)
- `emergency_contacts_local` — offline EC cache (user_id PK, contact_name, contact_phone, contact_email, my_phone, pending_sync, updated_at)
- `emergency_alert_events_local` — offline alert events cache
- `user_preferences` — key/value store (key PK, value TEXT)

### Offline-First Pattern
1. Read SQLite immediately (show cached data, set loading=false)
2. Check `isOnline()` from `sync/flush.ts`
3. If online: fetch from Supabase, update SQLite cache
4. Show offline banner when `isOffline === true`

### EC (Emergency Contact) Rules
- `EmergencyContactScreen` uses `useSession()` internally — call it with no props: `<EmergencyContactScreen />`
- EC is written to SQLite in three places: `EmergencyContactScreen.save()`, `EmergencyContactSetupModal.save()`, and `App.tsx` startup effect + NetInfo reconnect listener.
- Always write `pending_sync=0` after a successful Supabase save, `pending_sync=1` for offline-only saves.

### Alert Badge
- Type: `string | number | undefined`
- Set to `"!"` when alerts > 0 (not a count).
- Refreshed every 30s and on Alerts tab focus.

### Charts (react-native-svg)
- Import: `import Svg, { ..., Text as SvgText, G } from "react-native-svg";`
- Use `<SvgText x={} y={} fontSize="9" fill={color} textAnchor="middle">` for labels.
- Use `<G>` to group bar + label pairs.
- **Never** use `<Svg><Text style={...}>` (React Native Text inside SVG) — it does not render.

---

## KEY FILE LOCATIONS

| What | Where |
|------|-------|
| Root navigator + drawer + auth gate | `apps/mobile/App.tsx` |
| Theme tokens + light/dark | `apps/mobile/theme.ts` |
| Theme context (toggle, persist) | `apps/mobile/context/ThemeContext.tsx` |
| Session context | `apps/mobile/context/SessionContext.tsx` |
| SQLite schema + helpers | `apps/mobile/db/database.ts` |
| Navigation types | `apps/mobile/navigation/types.ts` |
| Supabase client | `apps/mobile/lib/supabase.ts` |
| EC helpers | `apps/mobile/lib/emergencyNotify.ts` |
| Sync/flush | `apps/mobile/sync/flush.ts` |
| Session state refs | `apps/mobile/sessionState.ts` |
| Drowsiness scoring | `packages/shared/src/alertMap.ts` |
| Shared date range picker | `apps/mobile/components/DateRangePicker.tsx` |
| Shared info tooltip modal | `apps/mobile/components/InfoModal.tsx` |

---

## SCREEN INVENTORY (mobile)

| Screen | Tab/Drawer | File |
|--------|-----------|------|
| Home | Visible tab 1 | `screens/HomeScreen.tsx` |
| Analytics | Visible tab 2 | `screens/AnalyticsScreen.tsx` |
| Drive | Visible tab 3 (center) | `screens/DriveScreen.tsx` |
| Alerts | Visible tab 4 | `screens/EmergencyAlertMapScreen.tsx` |
| History | Visible tab 5 | `screens/HistoryScreen.tsx` |
| Emergency Contact | Drawer (hidden tab) | `screens/EmergencyContactScreen.tsx` |
| Account | Drawer (hidden tab) | `screens/AccountScreen.tsx` |
| About | Drawer (hidden tab) | `screens/AboutScreen.tsx` |
| Terms & Privacy | Drawer (hidden tab) | `screens/TermsScreen.tsx` |
| Admin Config | Drawer (hidden tab, super_admin) | `screens/AdminScreen.tsx` |
| EC Setup Modal | First-time modal | `screens/EmergencyContactSetupModal.tsx` |
| Login | Pre-auth | `screens/LoginScreen.tsx` |

---

## COMPONENT INVENTORY (mobile)

| Component | File | Purpose |
|-----------|------|---------|
| DateRangePicker | `components/DateRangePicker.tsx` | Calendar date range picker (no new deps) |
| InfoModal | `components/InfoModal.tsx` | Tooltip/info modal |
| ConfirmModal | in `App.tsx` | Themed yes/no confirmation |
| AppDrawer | in `App.tsx` | Left slide-in navigation drawer |

---

## HOW TO ADD A NEW SCREEN

1. Add screen name and params to `navigation/types.ts` (`MainTabParamList`)
2. Create `screens/MyScreen.tsx` using `useTheme()` + `makeStyles(t: Theme)` pattern
3. Import in `App.tsx`
4. Add as `<Tab.Screen>` in the Tab.Navigator (visible or hidden)
5. If drawer-accessible: add to `navItems` array in `AppDrawer`

---

## SUPABASE PATTERNS

- **Read config:** `supabase.from('admin_config').select('*').eq('id', 1).maybeSingle()`
- **Save config:** `supabase.rpc('update_admin_config', payload)` — never direct UPDATE
- **EC lookup:** `getEmergencyContact(supabase, userId)` from `lib/emergencyNotify.ts`
- **EC upsert:** `upsertEmergencyContact(supabase, userId, data)` from `lib/emergencyNotify.ts`

---

## DOCUMENTATION MAINTENANCE

After any significant mobile change, update:
1. `docs/AI_CONTEXT_BLOCK.md` — increment version, update changed sections, add to CHANGE LOG
2. `docs/BRD_TECHNICAL_ALIGNMENT.md` — update relevant sections + change history table

After any web or IoT change:
- Update the same docs, focusing on the relevant platform sections.

---

## OTA UPDATE (user must run this manually)

```bash
cd apps/mobile && eas update --branch preview --message "describe what changed"
```

EAS account: airamaepilor. Installed APK is on the **preview** channel.
