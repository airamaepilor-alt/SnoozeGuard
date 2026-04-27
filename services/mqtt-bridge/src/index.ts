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
  console.log(`[mqtt-bridge] ✅ Connected to MQTT broker`);
  console.log(`[mqtt-bridge] Subscribing to topics...`);
  
  // Subscribe to device commands (buzz/all_clear)
  client.subscribe(env.MQTT_TOPIC, (err) => {
    if (err) console.error("[mqtt-bridge] ❌ subscribe error:", err);
    else console.log(`[mqtt-bridge] ✅ subscribed to ${env.MQTT_TOPIC}`);
  });
  
  // Subscribe to ping topics (all devices)
  client.subscribe("snoozeguard/ping/+", (err) => {
    if (err) console.error("[mqtt-bridge] ❌ ping subscribe error:", err);
    else console.log("[mqtt-bridge] ✅ subscribed to snoozeguard/ping/+");
  });
  
  // Subscribe to dismiss topics (all devices)
  client.subscribe("snoozeguard/dismiss/+", (err) => {
    if (err) console.error("[mqtt-bridge] ❌ dismiss subscribe error:", err);
    else console.log("[mqtt-bridge] ✅ subscribed to snoozeguard/dismiss/+");
  });
});

client.on("error", (err) => {
  console.error("[mqtt-bridge] ❌ MQTT error:", err);
});

client.on("offline", () => {
  console.log("[mqtt-bridge] ⚠️ MQTT offline");
});

client.on("reconnect", () => {
  console.log("[mqtt-bridge] 🔄 MQTT reconnecting...");
});

client.on("message", async (topic, payload) => {
  console.log(`[mqtt-bridge] 📥 Received on topic: ${topic}`);
  console.log(`[mqtt-bridge] 📦 Payload: ${payload.toString()}`);
  
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
    console.log(`[mqtt-bridge] 📌 Handling ping from device: ${deviceId}`);
    
    // Forward to API
    const url = new URL("/v1/iot/ping", env.SNOOZEGUARD_API_URL).toString();
    console.log(`[mqtt-bridge] 📤 Forwarding to: ${url}`);
    console.log(`[mqtt-bridge] 📤 Body:`, JSON.stringify(json));
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-snoozeguard-device-key": env.IOT_INGEST_SECRET,
        },
        body: JSON.stringify(json),
      });
      
      console.log(`[mqtt-bridge] 📥 API Response status: ${res.status}`);
      const responseText = await res.text();
      console.log(`[mqtt-bridge] 📥 API Response body: ${responseText}`);
      
      // Send response acknowledgment
      const responseTopic = `snoozeguard/ping/response/${deviceId}`;
      const response = { type: "ping_response", success: res.ok };
      client.publish(responseTopic, JSON.stringify(response));
      console.log(`[mqtt-bridge] ✅ Published ping response to ${responseTopic}`);
    } catch (e) {
      console.error("[mqtt-bridge] ❌ API call failed:", e);
    }
    return;
  }
  
  // Handle dismiss messages
  if (topic.startsWith("snoozeguard/dismiss/")) {
    const deviceId = topic.split("/")[2];
    console.log(`[mqtt-bridge] 📌 Handling dismiss from device: ${deviceId}`);
    
    // Forward to API
    const url = new URL("/v1/iot/dismiss", env.SNOOZEGUARD_API_URL).toString();
    console.log(`[mqtt-bridge] 📤 Forwarding to: ${url}`);
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-snoozeguard-device-key": env.IOT_INGEST_SECRET,
        },
        body: JSON.stringify(json),
      });
      
      console.log(`[mqtt-bridge] 📥 API Response status: ${res.status}`);
      
      // Send response acknowledgment
      const responseTopic = `snoozeguard/dismiss/response/${deviceId}`;
      const response = { type: "dismiss_response", success: res.ok };
      client.publish(responseTopic, JSON.stringify(response));
      console.log(`[mqtt-bridge] ✅ Published dismiss response to ${responseTopic}`);
    } catch (e) {
      console.error("[mqtt-bridge] ❌ API call failed:", e);
    }
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
