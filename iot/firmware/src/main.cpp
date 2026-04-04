/**
 * SnoozeGuard ESP32 → SnoozeGuard API (HTTP JSON)
 *
 * Copy include/secrets.example.h → include/secrets.h
 * pio run -t upload
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

#include "secrets.h"

#ifndef IOT_DEVICE_ID
#define IOT_DEVICE_ID "esp32cam-001"
#endif

#ifndef TELEMETRY_INTERVAL_MS
#define TELEMETRY_INTERVAL_MS 5000
#endif

static const char *kTelemetryPath = "/v1/iot/telemetry";
static uint32_t lastSend = 0;

static void fillIsoUtc(char *buf, size_t len) {
  time_t now_sec;
  time(&now_sec);
  struct tm *utc = gmtime(&now_sec);
  if (!utc || strftime(buf, len, "%Y-%m-%dT%H:%M:%S.000Z", utc) == 0) {
    snprintf(buf, len, "1970-01-01T00:00:00.000Z");
  }
}

static bool postTelemetry(float level, int yawns, int headEvents, bool brake) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return false;
  }

  WiFiClient client;
  HTTPClient http;
  String url = String("http://") + API_HOST + ":" + API_PORT + kTelemetryPath;

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-snoozeguard-device-key", IOT_INGEST_SECRET);

  JsonDocument doc;
  doc["device_id"] = IOT_DEVICE_ID;
  doc["session_external_id"] = SESSION_EXTERNAL_ID;

  char iso[40];
  fillIsoUtc(iso, sizeof(iso));
  doc["recorded_at"] = iso;

  doc["drowsiness_level"] = level;
  doc["yawn_count"] = yawns;
  doc["head_movement_events"] = headEvents;
  doc["sudden_brake"] = brake;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("POST %s → %d\n", url.c_str(), code);
  if (code < 0) {
    Serial.println(http.errorToString(code));
  } else {
    Serial.println(http.getString());
  }
  http.end();
  return code >= 200 && code < 300;
}

void setup() {
  Serial.begin(115200);
  delay(500);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  }

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

void loop() {
  uint32_t now = millis();
  if (now - lastSend < TELEMETRY_INTERVAL_MS) {
    delay(50);
    return;
  }
  lastSend = now;

  // Replace with on-device inference + GPIO brake signal
  float level = 3.0f;
  int yawns = 0;
  int head = 0;
  bool brake = false;

  postTelemetry(level, yawns, head, brake);
}
