import type { FastifyBaseLogger } from "fastify";
import mqtt from "mqtt";
import { iotBodySchema } from "@snoozeguard/shared";
import type { Env } from "./env.js";
import { ingestIotTelemetry } from "./services/iotIngest.js";
import type { createServiceClient } from "./supabase.js";

type Supabase = ReturnType<typeof createServiceClient>;

let _mqttClient: mqtt.MqttClient | null = null;

export function publishMqttCommand(topic: string, payload: object): boolean {
  if (!_mqttClient?.connected) return false;
  _mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
  return true;
}

export function startMqttIngestIfConfigured(env: Env, supabase: Supabase, log: FastifyBaseLogger): void {
  const url = env.MQTT_BROKER_URL;
  const topic = env.MQTT_TOPIC;
  if (!url || !topic) {
    log.info("MQTT ingest disabled (set MQTT_BROKER_URL and MQTT_TOPIC to enable).");
    return;
  }

  let client: mqtt.MqttClient;
  try {
    client = mqtt.connect(url, {
      username: env.MQTT_USERNAME,
      password: env.MQTT_PASSWORD,
      reconnectPeriod: 5000,
    });
  } catch (err) {
    log.error({ err }, "MQTT connect failed");
    return;
  }

  _mqttClient = client;

  client.on("connect", () => {
    log.info({ topic }, "MQTT connected; subscribing");
    client.subscribe(topic, (err) => {
      if (err) log.error({ err }, "MQTT subscribe failed");
    });
  });

  client.on("message", async (t, payload) => {
    if (t !== topic) return;
    let json: unknown;
    try {
      json = JSON.parse(payload.toString("utf8"));
    } catch {
      log.warn("MQTT message ignored: invalid JSON");
      return;
    }
    const parsed = iotBodySchema.safeParse(json);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.flatten() }, "MQTT message ignored: schema");
      return;
    }
    const result = await ingestIotTelemetry(env, supabase, parsed.data);
    if (!result.ok) {
      log.error({ result }, "MQTT ingest failed");
    }
  });

  client.on("error", (err) => log.error({ err }, "MQTT error"));
  client.on("reconnect", () => log.warn("MQTT reconnecting"));
}
