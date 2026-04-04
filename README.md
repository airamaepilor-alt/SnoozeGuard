# SnoozeGuard

Monorepo for the **Sleep Detection System**: React web app, Expo (React Native) mobile app, Node.js API for IoT ingest + optional MQTT, and Supabase (Auth + Postgres + RLS).

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- For **mobile camera / native modules:** Android Studio or Xcode, then **Expo dev client** (not Expo Go)

## 1. Supabase

1. Create a project and apply the SQL migrations in `supabase/migrations/` in filename order (SQL editor or [Supabase CLI](https://supabase.com/docs/guides/cli)). Notable files: `20260404000000_initial.sql` (schema); `20260404120000_user_dashboard_metrics.sql` (**`user_dashboard_metrics`** RPC); `20260404130000_alert_events.sql` (**`alert_events`** table for alert analytics + web/mobile logging).
2. Copy **Project URL** and **anon** + **service_role** keys from Project Settings → API.
3. **Google sign-in (web):** follow [`docs/SUPABASE_GOOGLE_AUTH.md`](docs/SUPABASE_GOOGLE_AUTH.md).

**First super admin:** after your first user signs up, set their role in SQL:

```sql
update public.profiles set role = 'super_admin' where id = '<user-uuid>';
```

Never expose `service_role` to clients; it is only for `services/api`.

## 2. Environment

- `apps/web/.env` — see `apps/web/.env.example` (`VITE_SUPABASE_*`).
- `apps/mobile/.env` — see `apps/mobile/.env.example` (`EXPO_PUBLIC_SUPABASE_*`).
- `services/api/.env` — see `services/api/.env.example` (`SUPABASE_*`, `IOT_*`, optional `MQTT_*`).
- `services/mqtt-bridge/.env` — optional; see `services/mqtt-bridge/.env.example`.

## 3. Install & run

```bash
npm install
npm run build -w @snoozeguard/shared
npm run dev -w @snoozeguard/web       # http://localhost:5173
npm run dev -w @snoozeguard/api       # http://localhost:4000
npm run dev:mqtt-bridge               # optional MQTT → REST bridge
npm run verify                        # build shared + api + mqtt-bridge + web + mobile tsc
```

**Smoke checks**

- API liveness: `GET http://localhost:4000/health`
- API readiness (DB): `GET http://localhost:4000/health/ready` (needs valid `SUPABASE_*` in `services/api/.env`)
- IoT ingest (with API running): `npm run demo:iot -w @snoozeguard/api`

### Web offline queue

The **Drive** page writes **sessions + telemetry to IndexedDB (Dexie)** first, then **syncs to Supabase** when the browser is online. **Dashboard** and the signed-in shell call `flushOutbox` on reconnect to drain pending telemetry.

### Mobile (dev client + camera)

Expo Go cannot load `react-native-vision-camera`. Use a **development build**:

```bash
cd apps/mobile
npx expo prebuild
npm run android    # or npm run ios on macOS
npm run start      # expo start --dev-client
```

**EAS Build (cloud):** install [EAS CLI](https://docs.expo.dev/build/setup/), run `eas login` and `eas init` in `apps/mobile`, set `EAS_PROJECT_ID` in `.env` (or let `eas init` write `extra.eas.projectId`), then:

```bash
cd apps/mobile
eas build --profile development --platform android
```

Profiles are defined in `apps/mobile/eas.json` (`development`, `preview`, `production`).

Flow: **SQLite first** for `driving_sessions_local` / `session_telemetry_local`, then **sync to Supabase** when the network is available. The **Drive** screen runs a **motion loop** (`HeuristicDrowsinessEstimator`: accelerometer + **gyro** → head/brake proxies; **yawn** stays 0 until you add a native face/vision plugin). **Web Drive** can run **MediaPipe Face Landmarker** in-browser (optional **Browser ML** toggle) for jaw-open / head-pose signals—see `apps/web/src/hooks/useWebFaceLandmarker.ts`.

## Layout

| Path | Role |
|------|------|
| `apps/web` | Driver + admin UI (Vite + React + Tailwind v3) |
| `apps/mobile` | Expo RN — auth, SQLite offline queue, Vision Camera, heuristic ML pipeline |
| `services/api` | Fastify — health, REST IoT ingest, **optional MQTT subscriber** |
| `services/mqtt-bridge` | Standalone MQTT → `POST /v1/iot/telemetry` forwarder |
| `packages/shared` | Shared TypeScript types/constants |
| `supabase/migrations` | Schema + RLS |
| `iot/firmware` | PlatformIO ESP32 HTTP client → API |
| `UI/` | Legacy static HTML mocks (visual / UX reference) |
| `docs/BRD_UI_CHECKLIST.md` | BRD ↔ `UI/*.html` ↔ production app traceability |

## IoT & MQTT

- **ESP32:** `iot/firmware` (PlatformIO) — see `iot/README.md`.
- **MQTT:** either enable `MQTT_*` on the API or run `services/mqtt-bridge`.
