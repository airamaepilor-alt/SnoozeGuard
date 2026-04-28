import type { FastifyPluginAsync } from "fastify";
import type { createServiceClient } from "../supabase.js";

type Supabase = ReturnType<typeof createServiceClient>;

export function healthRoutes(supabase: Supabase): FastifyPluginAsync {
  return async (app) => {
    app.get("/health", async () => {
      console.log("[HEALTH CHECK] Basic ping received");
      return { ok: true };
    });

    /** Verifies service role can reach Postgres (admin_config row). Use for k8s/orchestrator readiness. */
    app.get("/health/ready", async (_req, reply) => {
      console.log("[HEALTH READY] Checking database connectivity...");
      const { data, error } = await supabase.from("admin_config").select("id").eq("id", 1).maybeSingle();
      if (error) {
        console.error("[HEALTH READY FAILED] Supabase error:", error.message);
        return reply.code(503).send({ ok: false, supabase: false, detail: error.message });
      }
      console.log("[HEALTH READY SUCCESS] Database connection verified");
      return { ok: true, supabase: true };
    });
  };
}
