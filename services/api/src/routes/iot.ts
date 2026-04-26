import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { iotBodySchema } from "@snoozeguard/shared";
import type { Env } from "../env.js";
import { ingestIotTelemetry } from "../services/iotIngest.js";
import { updateDeviceHeartbeat, signalIotBuzz, dismissIotAlert } from "../services/iotCommands.js";
import type { createServiceClient } from "../supabase.js";

type Supabase = ReturnType<typeof createServiceClient>;

const pingBodySchema = z.object({ device_id: z.string().min(1).max(128) });
const buzzBodySchema = z.object({
  device_id: z.string().min(1).max(128),
  alert_id: z.string().uuid(),
  level: z.number().int().min(9).max(10),
});
const dismissBodySchema = z.object({
  device_id: z.string().min(1).max(128),
  alert_id: z.string().uuid(),
});

export function iotRoutes(env: Env, supabase: Supabase): FastifyPluginAsync {
  return async (app) => {
    // ── Existing: telemetry ingest (ESP32 → server) ──────────────────────────
    app.post("/v1/iot/telemetry", async (req, reply) => {
      const key = req.headers["x-snoozeguard-device-key"] as string | undefined;
      if (!key || key !== env.IOT_INGEST_SECRET) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const parsed = iotBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      }

      const result = await ingestIotTelemetry(env, supabase, parsed.data);
      if (!result.ok) {
        return reply.code(result.status).send({
          error: result.error,
          ...(result.message ? { message: result.message } : {}),
        });
      }

      return { ok: true, session_id: result.session_id };
    });

    // ── Heartbeat: ESP32 → server every 5s to update last_seen ──────────────
    app.post("/v1/iot/ping", async (req, reply) => {
      const key = req.headers["x-snoozeguard-device-key"] as string | undefined;
      if (!key || key !== env.IOT_INGEST_SECRET) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const parsed = pingBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body" });
      }

      await updateDeviceHeartbeat(supabase, parsed.data.device_id);
      return { ok: true };
    });

    // ── Buzz: app → server → MQTT → ESP32 activates buzzer + LED ────────────
    // Authenticated with user's Supabase JWT so the secret stays server-side.
    app.post("/v1/iot/buzz", async (req, reply) => {
      const token = (req.headers.authorization as string | undefined)?.replace("Bearer ", "");
      if (!token) return reply.code(401).send({ error: "unauthorized" });
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return reply.code(401).send({ error: "unauthorized" });

      const parsed = buzzBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body" });
      }

      const published = signalIotBuzz(parsed.data.device_id, parsed.data.alert_id, parsed.data.level);
      return { ok: true, mqtt_published: published };
    });

    // ── Dismiss: ESP32 button OR app driver dismiss
    // Accepts either x-snoozeguard-device-key (ESP32) or Authorization: Bearer JWT (app)
    app.post("/v1/iot/dismiss", async (req, reply) => {
      const key = req.headers["x-snoozeguard-device-key"] as string | undefined;
      const token = (req.headers.authorization as string | undefined)?.replace("Bearer ", "");

      let dismissedBy: "driver" | "iot_button";
      if (key && key === env.IOT_INGEST_SECRET) {
        dismissedBy = "iot_button";
      } else if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) return reply.code(401).send({ error: "unauthorized" });
        dismissedBy = "driver";
      } else {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const parsed = dismissBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body" });
      }

      await dismissIotAlert(supabase, parsed.data.alert_id, dismissedBy);
      return { ok: true };
    });
  };
}
