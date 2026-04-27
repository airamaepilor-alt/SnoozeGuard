import "dotenv/config";
import mqtt from "mqtt";
import { z } from "zod";
import { iotBodySchema } from "@snoozeguard/shared";

const envSchema = z.object({
  MQTT_BROKER_URL: z.string().min(1),
  MQTT_TOPIC: z.string().min(1),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  SNOOZEGUARD_API_URL: z.string().url(),
  IOT_INGEST_SECRET: z.string().min(16),
});

const env = envSchema.parse(process.env);

const client = mqtt.connect(env.MQTT_BROKER_URL, {
  username: env.MQTT_USERNAME,
  password: env.MQTT_PASSWORD,
  reconnectPeriod: 5000,
});

client.on("connect", () => {
  console.log(`[mqtt-bridge] connected; subscribing to topics`);
  
  // Subscribe to device commands (buzz/all_clear)
  client.subscribe(env.MQTT_TOPIC, (err) => {
    if (err) console.error("[mqtt-bridge] subscribe error", err);
    else console.log(`[mqtt-bridge] subscribed to ${env.MQTT_TOPIC}`);
  });
  
  // Subscribe to ping topics (all devices)
  client.subscribe("snoozeguard/ping/+", (err) => {
    if (err) console.error("[mqtt-bridge] ping subscribe error", err);
    else console.log("[mqtt-bridge] subscribed to snoozeguard/ping/+");
  });
  
  // Subscribe to dismiss topics (all devices)
  client.subscribe("snoozeguard/dismiss/+", (err) => {
    if (err) console.error("[mqtt-bridge] dismiss subscribe error", err);
    else console.log("[mqtt-bridge] subscribed to snoozeguard/dismiss/+");
  });
});

client.on("message", async (topic, payload) => {
  let json: unknown;
  try {
    json = JSON.parse(payload.toString("utf8"));
  } catch {
    console.warn("[mqtt-bridge] skip: invalid JSON");
    return;
  }
  
  // Handle ping messages
  if (topic.startsWith("snoozeguard/ping/")) {
    const deviceId = topic.split("/")[2];
    console.log(`[mqtt-bridge] ping from ${deviceId}`);
    
    // Forward to API
    const url = new URL("/v1/iot/ping", env.SNOOZEGUARD_API_URL).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-snoozeguard-device-key": env.IOT_INGEST_SECRET,
      },
      body: JSON.stringify(json),
    });
    
    // Send response acknowledgment
    const responseTopic = `snoozeguard/ping/response/${deviceId}`;
    const response = { type: "ping_response", success: res.ok };
    client.publish(responseTopic, JSON.stringify(response));
    console.log(`[mqtt-bridge] published ping response to ${responseTopic}`);
    return;
  }
  
  // Handle dismiss messages
  if (topic.startsWith("snoozeguard/dismiss/")) {
    const deviceId = topic.split("/")[2];
    console.log(`[mqtt-bridge] dismiss from ${deviceId}`);
    
    // Forward to API
    const url = new URL("/v1/iot/dismiss", env.SNOOZEGUARD_API_URL).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-snoozeguard-device-key": env.IOT_INGEST_SECRET,
      },
      body: JSON.stringify(json),
    });
    
    // Send response acknowledgment
    const responseTopic = `snoozeguard/dismiss/response/${deviceId}`;
    const response = { type: "dismiss_response", success: res.ok };
    client.publish(responseTopic, JSON.stringify(response));
    console.log(`[mqtt-bridge] published dismiss response to ${responseTopic}`);
    return;
  }
  
  // Handle command messages (buzz/all_clear) - existing telemetry logic
  const parsed = iotBodySchema.safeParse(json);
  if (!parsed.success) {
    console.warn("[mqtt-bridge] skip: schema", parsed.error.flatten());
    return;
  }
  const url = new URL("/v1/iot/telemetry", env.SNOOZEGUARD_API_URL).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-snoozeguard-device-key": env.IOT_INGEST_SECRET,
    },
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[mqtt-bridge] forward failed", res.status, text);
  } else {
    console.log("[mqtt-bridge] forwarded", parsed.data.device_id);
  }
});

client.on("error", (err) => console.error("[mqtt-bridge] mqtt error", err));
