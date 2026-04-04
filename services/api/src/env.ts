import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  IOT_INGEST_SECRET: z.string().min(16),
  /** Optional: link IoT samples to this user when device is not user-bound */
  IOT_DEFAULT_USER_ID: z.string().uuid().optional(),
  /** When set with MQTT_TOPIC, API subscribes and ingests JSON payloads (same shape as REST). */
  MQTT_BROKER_URL: z.string().optional(),
  MQTT_TOPIC: z.string().min(1).optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables for API");
  }
  return parsed.data;
}
