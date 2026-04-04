import type { FastifyPluginAsync } from "fastify";
import type { createServiceClient } from "../supabase.js";

type Supabase = ReturnType<typeof createServiceClient>;

export function healthRoutes(supabase: Supabase): FastifyPluginAsync {
  return async (app) => {
    app.get("/health", async () => ({ ok: true }));

    /** Verifies service role can reach Postgres (admin_config row). Use for k8s/orchestrator readiness. */
    app.get("/health/ready", async (_req, reply) => {
      const { error } = await supabase.from("admin_config").select("id").eq("id", 1).maybeSingle();
      if (error) {
        return reply.code(503).send({ ok: false, supabase: false, detail: error.message });
      }
      return { ok: true, supabase: true };
    });
  };
}
