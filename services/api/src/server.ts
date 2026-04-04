import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadEnv } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import { iotRoutes } from "./routes/iot.js";
import { startMqttIngestIfConfigured } from "./mqtt.js";
import { createServiceClient } from "./supabase.js";

const env = loadEnv();
const supabase = createServiceClient(env);
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(healthRoutes(supabase));
await app.register(iotRoutes(env, supabase));

startMqttIngestIfConfigured(env, supabase, app.log);

const port = env.PORT;
await app.listen({ port, host: "0.0.0.0" });
