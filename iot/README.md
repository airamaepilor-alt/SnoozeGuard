# SnoozeGuard — ESP32, MQTT, REST

## REST ingest (implemented)

`POST /v1/iot/telemetry` on `services/api`

Headers:

- `x-snoozeguard-device-key: <IOT_INGEST_SECRET>`

JSON body:

```json
{
  "device_id": "esp32-cam-001",
  "session_external_id": "optional-stable-id",
  "recorded_at": "2026-04-04T12:00:00.000Z",
  "drowsiness_level": 5,
  "yawn_count": 0,
  "head_movement_events": 0,
  "sudden_brake": false
}
```

Set `IOT_DEFAULT_USER_ID` in `services/api/.env` to the Supabase user UUID that should own IoT-created sessions.

`recorded_at` may be any string `Date.parse` accepts (ISO with `Z`, offset, or a space between date and time); the API normalizes to UTC ISO-8601 before insert.

## ESP32 firmware (PlatformIO)

See `firmware/`:

1. `cp include/secrets.example.h include/secrets.h` and set WiFi + API host/port + `IOT_INGEST_SECRET` + `SESSION_EXTERNAL_ID`.
2. Point `API_HOST` at the machine running `services/api` (LAN IP for HTTP).
3. `cd iot/firmware && pio run -t upload && pio device monitor`

The sketch posts JSON every `TELEMETRY_INTERVAL_MS` (default 5s). Replace the placeholder `drowsiness_level` with on-device CV / IMU fusion.

## MQTT

**Option A — embedded in API:** set `MQTT_BROKER_URL` and `MQTT_TOPIC` in `services/api/.env`. The API subscribes and ingests the **same JSON** as REST (no device key required on MQTT; protect the broker).

**Option B — standalone bridge:** run `services/mqtt-bridge` (see `services/mqtt-bridge/.env.example`). It subscribes to MQTT and `fetch`es `POST /v1/iot/telemetry` with `x-snoozeguard-device-key`.

Use a topic pattern like `snoozeguard/+/telemetry`; the bridge accepts any concrete topic under the subscription.

## On-device ML (ESP32)

- **TensorFlow Lite for Micro** / **ESP-DL** for lightweight models, or stream frames to a backend (higher latency).
- Map outputs to `drowsiness_level` (0–10) per your `admin_config` thresholds in Supabase.
