#!/usr/bin/env node
/**
 * POST a sample IoT payload to the local API (uses services/api/.env via cwd).
 *
 * Usage (from repo root):
 *   node services/api/scripts/demo-iot-post.mjs
 *
 * Or from services/api:
 *   node scripts/demo-iot-post.mjs
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const base = process.env.DEMO_API_URL || "http://127.0.0.1:4000";
const secret = process.env.IOT_INGEST_SECRET;

if (!secret || secret.length < 16) {
  console.error("Set IOT_INGEST_SECRET in services/api/.env (min 16 chars).");
  process.exit(1);
}

const body = {
  device_id: "demo-cli",
  session_external_id: `demo-${Date.now()}`,
  recorded_at: new Date().toISOString(),
  drowsiness_level: 4,
  yawn_count: 0,
  head_movement_events: 1,
  sudden_brake: false,
};

const url = new URL("/v1/iot/telemetry", base).toString();
const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-snoozeguard-device-key": secret,
  },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(res.status, text);
process.exit(res.ok ? 0 : 1);
