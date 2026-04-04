import type { FastifyPluginAsync } from "fastify";
import { iotBodySchema } from "@snoozeguard/shared";
import type { Env } from "../env.js";
import { ingestIotTelemetry } from "../services/iotIngest.js";
import type { createServiceClient } from "../supabase.js";

type Supabase = ReturnType<typeof createServiceClient>;

export function iotRoutes(env: Env, supabase: Supabase): FastifyPluginAsync {
  return async (app) => {
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
  };
}
