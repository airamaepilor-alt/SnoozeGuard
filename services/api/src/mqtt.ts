import type { FastifyBaseLogger } from "fastify";
import mqtt from "mqtt";
import { iotBodySchema } from "@snoozeguard/shared";
import type { Env } from "./env.js";
import { ingestIotTelemetry } from "./services/iotIngest.js";
import { updateDeviceHeartbeat, dismissIotAlert, requestDeviceLink } from "./services/iotCommands.js";
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
    log.info({ topic }, "MQTT connected");

    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) log.error({ err }, "MQTT subscribe failed (telemetry)");
      else log.info({ topic }, "MQTT subscribed: telemetry");
    });

    client.subscribe("snoozeguard/ping/+", { qos: 1 }, (err) => {
      if (err) log.error({ err }, "MQTT subscribe failed (ping)");
      else log.info("MQTT subscribed: snoozeguard/ping/+");
    });

    client.subscribe("snoozeguard/dismiss/+", { qos: 1 }, (err) => {
      if (err) log.error({ err }, "MQTT subscribe failed (dismiss)");
      else log.info("MQTT subscribed: snoozeguard/dismiss/+");
    });

    client.subscribe("snoozeguard/link-request/+", { qos: 1 }, (err) => {
      if (err) log.error({ err }, "MQTT subscribe failed (link-request)");
      else log.info("MQTT subscribed: snoozeguard/link-request/+");
    });
  });

  client.on("message", async (t, payload) => {
    let json: unknown;
    try {
      json = JSON.parse(payload.toString("utf8"));
    } catch {
      log.warn({ topic: t }, "MQTT message ignored: invalid JSON");
      return;
    }

    if (t.startsWith("snoozeguard/ping/")) {
      const deviceId = t.split("/")[2];
      if (!deviceId) return;
      log.info({ deviceId }, "MQTT ping received");
      try {
        await updateDeviceHeartbeat(supabase, deviceId);
        log.info({ deviceId }, "MQTT ping: heartbeat updated");
      } catch (err) {
        log.error({ err, deviceId }, "MQTT ping: heartbeat update failed");
      }
      return;
    }

    if (t.startsWith("snoozeguard/link-request/")) {
      const deviceId = t.split("/")[2];
      if (!deviceId) return;
      const body = json as Record<string, unknown>;
      const email = typeof body?.email === "string" ? body.email : null;
      if (!email) {
        log.warn({ topic: t }, "MQTT link-request ignored: missing email");
        return;
      }
      log.info({ deviceId, email }, "MQTT link-request received");
      try {
        await requestDeviceLink(supabase, deviceId, email);
      } catch (err) {
        log.error({ err, deviceId }, "MQTT link-request: failed");
      }
      return;
    }

    if (t.startsWith("snoozeguard/dismiss/")) {
      const body = json as Record<string, unknown>;
      const alertId = typeof body?.alert_id === "string" ? body.alert_id : null;
      if (!alertId) {
        log.warn({ topic: t, body }, "MQTT dismiss ignored: missing alert_id");
        return;
      }
      log.info({ alertId }, "MQTT dismiss received");
      try {
        await dismissIotAlert(supabase, alertId, "iot_button");
        log.info({ alertId }, "MQTT dismiss: alert dismissed");
      } catch (err) {
        log.error({ err, alertId }, "MQTT dismiss: failed");
      }
      return;
    }

    if (t !== topic) return;
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
