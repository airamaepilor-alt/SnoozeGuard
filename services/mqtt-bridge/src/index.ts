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

console.log("[mqtt-bridge] Starting with config:");
console.log("  MQTT_BROKER_URL:", env.MQTT_BROKER_URL);
console.log("  MQTT_TOPIC:", env.MQTT_TOPIC);
console.log("  SNOOZEGUARD_API_URL:", env.SNOOZEGUARD_API_URL);
console.log("  IOT_INGEST_SECRET:", env.IOT_INGEST_SECRET?.slice(0, 8) + "...");

const client = mqtt.connect(env.MQTT_BROKER_URL, {
  username: env.MQTT_USERNAME,
  password: env.MQTT_PASSWORD,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
});

client.on("connect", () => {
  console.log(`[MQTT BRIDGE CONNECTED] Connected to MQTT broker at ${env.MQTT_BROKER_URL}`);
  console.log(`[MQTT BRIDGE] Subscribing to topics...`);
  
  // Subscribe to device commands (buzz/all_clear)
  client.subscribe(env.MQTT_TOPIC, (err) => {
    if (err) console.error(`[MQTT BRIDGE SUBSCRIBE ERROR] ${env.MQTT_TOPIC}:`, err);
    else console.log(`[MQTT BRIDGE SUBSCRIBED] Topic: ${env.MQTT_TOPIC}`);
  });
  
  // Subscribe to ping topics (all devices)
  client.subscribe("snoozeguard/ping/+", (err) => {
    if (err) console.error("[MQTT BRIDGE SUBSCRIBE ERROR] snoozeguard/ping/+:", err);
    else console.log("[MQTT BRIDGE SUBSCRIBED] Topic: snoozeguard/ping/+");
  });
  
  // Subscribe to dismiss topics (all devices)
  client.subscribe("snoozeguard/dismiss/+", (err) => {
    if (err) console.error("[MQTT BRIDGE SUBSCRIBE ERROR] snoozeguard/dismiss/+:", err);
    else console.log("[MQTT BRIDGE SUBSCRIBED] Topic: snoozeguard/dismiss/+");
  });
});

client.on("error", (err) => {
  console.error("[MQTT BRIDGE ERROR]", err);
});

client.on("offline", () => {
  console.log("[MQTT BRIDGE OFFLINE] Connection lost");
});

client.on("reconnect", () => {
  console.log("[MQTT BRIDGE RECONNECTING]");
});

client.on("message", async (topic, payload) => {
  console.log(`[MQTT MESSAGE RECEIVED] Topic: ${topic}`);
  console.log(`[MQTT MESSAGE RECEIVED] Payload (${payload.length} bytes):`, payload.toString());
  
  let json: unknown;
  try {
    json = JSON.parse(payload.toString("utf8"));
  } catch (e) {
    console.warn("[mqtt-bridge] ⚠️ skip: invalid JSON", e);
    return;
  }
  
  // Handle ping messages
  if (topic.startsWith("snoozeguard/ping/")) {
    const deviceId = topic.split("/")[2];
    console.log(`[MQTT PING RECEIVED] Topic: ${topic}`);
    console.log(`[MQTT PING RECEIVED] Device ID: ${deviceId}`);
    console.log(`[MQTT PING RECEIVED] Payload:`, JSON.stringify(json));
    
    // Forward to API
    const url = new URL("/v1/iot/ping", env.SNOOZEGUARD_API_URL).toString();
    console.log(`[MQTT PING FORWARD] URL: ${url}`);
    console.log(`[MQTT PING FORWARD] Body:`, JSON.stringify(json));
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-snoozeguard-device-key": env.IOT_INGEST_SECRET,
        },
        body: JSON.stringify(json),
      });
      
      const responseText = await res.text();
      console.log(`[MQTT PING API RESPONSE] Status: ${res.status}`);
      console.log(`[MQTT PING API RESPONSE] Body: ${responseText}`);
      
      if (res.ok) {
        console.log(`[MQTT PING SUCCESS] Device ${deviceId} ping accepted by API`);
      } else {
        console.error(`[MQTT PING FAILED] API returned ${res.status}: ${responseText}`);
      }
      
      // Send response acknowledgment
      const responseTopic = `snoozeguard/ping/response/${deviceId}`;
      const response = { type: "ping_response", success: res.ok };
      client.publish(responseTopic, JSON.stringify(response));
      console.log(`[MQTT PING RESPONSE PUBLISHED] Topic: ${responseTopic}`);
    } catch (e) {
      console.error(`[MQTT PING ERROR] Failed to forward ping for device ${deviceId}:`, e);
    }
    return;
  }
  
  // Handle dismiss messages
  if (topic.startsWith("snoozeguard/dismiss/")) {
    const deviceId = topic.split("/")[2];
    console.log(`[MQTT DISMISS RECEIVED] Device ID: ${deviceId}`);
    console.log(`[MQTT DISMISS RECEIVED] Payload:`, JSON.stringify(json));
    
    // Forward to API
    const url = new URL("/v1/iot/dismiss", env.SNOOZEGUARD_API_URL).toString();
    console.log(`[MQTT DISMISS FORWARD] URL: ${url}`);
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-snoozeguard-device-key": env.IOT_INGEST_SECRET,
        },
        body: JSON.stringify(json),
      });
      
      const responseText = await res.text();
      console.log(`[MQTT DISMISS API RESPONSE] Status: ${res.status} | Body: ${responseText}`);
      
      if (res.ok) {
        console.log(`[MQTT DISMISS SUCCESS] Device ${deviceId} dismiss accepted by API`);
      } else {
        console.error(`[MQTT DISMISS FAILED] API returned ${res.status}`);
      }
      
      // Send response acknowledgment
      const responseTopic = `snoozeguard/dismiss/response/${deviceId}`;
      const response = { type: "dismiss_response", success: res.ok };
      client.publish(responseTopic, JSON.stringify(response));
      console.log(`[MQTT DISMISS RESPONSE PUBLISHED] Topic: ${responseTopic}`);
    } catch (e) {
      console.error(`[MQTT DISMISS ERROR] Failed to forward dismiss for device ${deviceId}:`, e);
    }
    return;
  }
  
  // Handle command messages (buzz/all_clear) - existing telemetry logic
  console.log(`[MQTT TELEMETRY RECEIVED] Attempting to parse as telemetry...`);
  const parsed = iotBodySchema.safeParse(json);
  if (!parsed.success) {
    console.warn(`[TELEMETRY PARSE ERROR] Schema validation failed:`, parsed.error.flatten());
    return;
  }
  const url = new URL("/v1/iot/telemetry", env.SNOOZEGUARD_API_URL).toString();
  console.log(`[MQTT TELEMETRY FORWARD] URL: ${url} | Device: ${parsed.data.device_id}`);
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
    console.error(`[MQTT TELEMETRY FAILED] Status: ${res.status} | Body: ${text}`);
  } else {
    console.log(`[MQTT TELEMETRY SUCCESS] Device: ${parsed.data.device_id} | Status: ${res.status}`);
  }
});

client.on("error", (err) => console.error("[MQTT BRIDGE FATAL ERROR]", err));
