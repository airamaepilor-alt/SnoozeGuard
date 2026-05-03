/**
 * SnoozeGuard — Device 1 (Alert Box) firmware
 *
 * Primary path:  WiFi → HiveMQ Cloud MQTT → receives buzz / all_clear commands
 * Fallback path: BLE peripheral — mobile/web writes commands directly (no WiFi needed)
 *
 * Alert behaviour by level:
 *   6  → voice (track 1) + 3 × short vibration pulses
 *   7  → voice (track 2) + 3 × medium vibration pulses
 *   8  → voice (track 3) + 3 × long vibration pulses
 *   9  → voice (track 4) + continuous vibration + LED on + buzzer on
 *   10 → voice (track 5) + continuous vibration + LED flashing + buzzer on
 *
 * Dismiss: dome button → HTTP POST /v1/iot/dismiss + BLE notify → all clients dismiss
 *
 * BLE service:
 *   Device name:    SG-{gDeviceId}
 *   Service UUID:   4fafc201-1fb5-459e-8fcc-c5c9c331914b
 *   Command char:   beb5483e-36e1-4688-b7f5-ea07361b26a8  WRITE
 *     buzz:      {"cmd":"buzz","level":9,"alert_id":"<uuid>"}
 *     all_clear: {"cmd":"all_clear"}
 *   Event char:     beb5483f-36e1-4688-b7f5-ea07361b26a8  NOTIFY
 *     dismiss:   {"event":"dismiss"}
 *
 * MP3 files on SD card (FAT32, folder /mp3):
 *   0001.mp3 — Level 6 voice
 *   0002.mp3 — Level 7 voice
 *   0003.mp3 — Level 8 voice
 *   0004.mp3 — Level 9 voice
 *   0005.mp3 — Level 10 voice
 *
 * Copy include/secrets.example.h → include/secrets.h and fill in your values.
 * Flash: pio run -t upload
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <DFRobotDFPlayerMini.h>
#include <Preferences.h>
#include <WebServer.h>
#include <time.h>
#include <cstring> // Ensure strlen is available

#include "secrets.h"
#include "root_ca.h"

// ── Pin / config defaults (override in secrets.h) ─────────────────────────────
// Device ID is generated at runtime — see initDeviceId() below.
static char gDeviceId[32];

#ifndef TELEMETRY_INTERVAL_MS
#define TELEMETRY_INTERVAL_MS 5000
#endif
#ifndef MQTT_PORT
#define MQTT_PORT          8883
#endif
#ifndef DFPLAYER_RX_PIN
#define DFPLAYER_RX_PIN    16
#endif
#ifndef DFPLAYER_TX_PIN
#define DFPLAYER_TX_PIN    17
#endif
#ifndef IOT_BUTTON_PIN
#define IOT_BUTTON_PIN     25
#endif
#ifndef IOT_BUZZER_PIN
#define IOT_BUZZER_PIN     26
#endif
#ifndef IOT_LED_PIN
#define IOT_LED_PIN        27
#endif
#ifndef IOT_LED2_PIN
#define IOT_LED2_PIN       32
#endif
#ifndef IOT_BLE_LED_PIN
#define IOT_BLE_LED_PIN    33
#endif
#ifndef BUTTON_DEBOUNCE_MS
#define BUTTON_DEBOUNCE_MS 200
#endif
#ifndef DFPLAYER_VOLUME
#define DFPLAYER_VOLUME    25
#endif
#ifndef WIFI_CONNECT_TIMEOUT_MS
#define WIFI_CONNECT_TIMEOUT_MS 20000
#endif

// ── BLE UUIDs ─────────────────────────────────────────────────────────────────
#define SG_SERVICE_UUID    "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define SG_CMD_CHAR_UUID   "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define SG_EVENT_CHAR_UUID "beb5483f-36e1-4688-b7f5-ea07361b26a8"

// ── LED pulse patterns for levels 6–8 ────────────────────────────────────────
struct VibPattern { uint8_t pulses; uint16_t onMs; uint16_t offMs; };
static const VibPattern kVib[] = {
  { 0,   0,   0 }, // 0 — unused
  { 0,   0,   0 }, // 1
  { 0,   0,   0 }, // 2
  { 0,   0,   0 }, // 3
  { 0,   0,   0 }, // 4
  { 0,   0,   0 }, // 5
  { 3, 200, 150 }, // 6 — three short pulses
  { 3, 400, 150 }, // 7 — three medium pulses
  { 3, 600, 150 }, // 8 — three long pulses
};

// ── Buzzer beep patterns per level ────────────────────────────────────────────
// Each BuzzStep = one ON phase + one OFF phase that follows it.
// Steps cycle in order; the last step's off-time is the inter-burst gap.
//
//   Level  6 — 2 short beeps, long rest    bip-bip ·········
//   Level  7 — 3 medium beeps, medium rest BEEP-BEEP-BEEP ·····
//   Level  8 — 4 urgent beeps, short rest  BEEEP-BEEEP-BEEEP-BEEEP ··
//   Level  9 — rapid triple burst, repeat  pip-pip-pip···pip-pip-pip
//   Level 10 — frantic continuous          BEEPBEEPBEEPBEEP
struct BuzzStep { uint16_t onMs; uint16_t offMs; };

static const BuzzStep kBuzz6[]  = {{100, 100}, {100, 900}};
static const BuzzStep kBuzz7[]  = {{220, 150}, {220, 150}, {220, 650}};
static const BuzzStep kBuzz8[]  = {{320, 120}, {320, 120}, {320, 120}, {320, 280}};
static const BuzzStep kBuzz9[]  = {{120,  80}, {120,  80}, {120, 450}};
static const BuzzStep kBuzz10[] = {{ 70,  55}};

struct BuzzPattern { const BuzzStep *steps; uint8_t count; };
static const BuzzPattern kBuzzPat[11] = {
  {nullptr, 0}, {nullptr, 0}, {nullptr, 0}, {nullptr, 0}, {nullptr, 0}, {nullptr, 0},
  {kBuzz6,  2}, // 6
  {kBuzz7,  3}, // 7
  {kBuzz8,  4}, // 8
  {kBuzz9,  3}, // 9
  {kBuzz10, 1}, // 10
};

// ── State ─────────────────────────────────────────────────────────────────────
static bool     alertActive        = false;
static int      currentLevel       = 0;
static char     currentAlertId[64] = "";
static bool     bleConnected       = false;

static uint32_t lastPing           = 0;
static uint32_t lastSend           = 0;
static uint32_t lastButton         = 0;

// Vibration pulse state machine (levels 6–8)
static uint8_t  vibLeft            = 0;
static bool     vibOn              = false;
static uint32_t vibTimer           = 0;

// LED flash state (level 10 only)
static bool     ledFlash           = false;
static uint32_t ledFlashTimer      = 0;

// Buzzer pattern state machine (all levels 6–10)
static uint8_t  buzzStep           = 0;
static bool     buzzOn             = false;
static uint32_t buzzTimer          = 0;

// ── Hardware ──────────────────────────────────────────────────────────────────
static HardwareSerial    dfSerial(2);
static DFRobotDFPlayerMini *dfPlayer = nullptr;
static WiFiClientSecure  mqttWifi;
static PubSubClient      mqtt(mqttWifi);
static BLECharacteristic *pEventChar = nullptr;

// ── Alert helpers ─────────────────────────────────────────────────────────────

static void stopAllOutputs() {
  digitalWrite(IOT_BUZZER_PIN,    LOW);
  digitalWrite(IOT_LED_PIN,       LOW);
  digitalWrite(IOT_LED2_PIN,      LOW);
  digitalWrite(IOT_BLE_LED_PIN,   LOW);
  if (dfPlayer) dfPlayer->stop();
  vibLeft  = 0;
  vibOn    = false;
  ledFlash = false;
  buzzStep = 0;
  buzzOn   = false;
}

static void clearAlert() {
  alertActive      = false;
  currentLevel     = 0;
  currentAlertId[0] = '\0';
  stopAllOutputs();
}

static void triggerAlert(int level, const char *alertId) {
  if (level < 6) return;

  // Stop any ongoing alert before starting new one
  stopAllOutputs();

  alertActive  = true;
  currentLevel = level;
  strncpy(currentAlertId, alertId, sizeof(currentAlertId) - 1);
  currentAlertId[sizeof(currentAlertId) - 1] = '\0';

  // Voice: track index = level - 5  (level 6 → track 1, level 10 → track 5)
  if (dfPlayer) dfPlayer->play(level - 5);
  else Serial.println("WARNING: DFPlayer not initialized");

  // Start buzzer pattern state machine for all levels
  buzzStep  = 0;
  buzzOn    = true;
  buzzTimer = millis();
  digitalWrite(IOT_BUZZER_PIN, HIGH); // first ON phase begins immediately

  if (level >= 9) {
    // LEDs on continuously; level 10 also flashes
    digitalWrite(IOT_LED_PIN,  HIGH);
    digitalWrite(IOT_LED2_PIN, HIGH);
    if (level == 10) {
      ledFlash      = true;
      ledFlashTimer = millis();
    }
  } else {
    // LED pulse pattern for levels 6–8
    const VibPattern &p = kVib[level];
    vibLeft  = p.pulses;
    vibOn    = true;
    vibTimer = millis();
    digitalWrite(IOT_LED_PIN,  HIGH);
    digitalWrite(IOT_LED2_PIN, HIGH);
  }

  Serial.printf("Alert: level=%d id=%s\n", level, alertId);
}

// ── Non-blocking loop effects ─────────────────────────────────────────────────

static void handleVibPulse(uint32_t now) {
  if (currentLevel >= 9 || vibLeft == 0) return;
  const VibPattern &p = kVib[currentLevel];
  if (vibOn) {
    if (now - vibTimer >= p.onMs) {
      vibOn = false;
      vibTimer = now;
      vibLeft--;
      digitalWrite(IOT_LED_PIN, LOW);
      digitalWrite(IOT_LED2_PIN, LOW);
    }
  } else if (vibLeft > 0) {
    if (now - vibTimer >= p.offMs) {
      vibOn = true;
      vibTimer = now;
      digitalWrite(IOT_LED_PIN, HIGH);
      digitalWrite(IOT_LED2_PIN, HIGH);
    }
  }
}

static void handleLedFlash(uint32_t now) {
  if (currentLevel != 10 || !alertActive) return;
  if (now - ledFlashTimer >= 400) {
    ledFlashTimer = now;
    ledFlash      = !ledFlash;
    digitalWrite(IOT_LED_PIN, ledFlash ? HIGH : LOW);
  }
}

static void handleBuzzerPattern(uint32_t now) {
  if (!alertActive || currentLevel < 6 || currentLevel > 10) return;
  const BuzzPattern &pat = kBuzzPat[currentLevel];
  if (!pat.steps) return;
  const BuzzStep &s = pat.steps[buzzStep];
  if (buzzOn) {
    if (now - buzzTimer >= s.onMs) {
      digitalWrite(IOT_BUZZER_PIN, LOW);
      buzzOn    = false;
      buzzTimer = now;
    }
  } else {
    if (now - buzzTimer >= s.offMs) {
      buzzStep  = (buzzStep + 1) % pat.count;
      buzzOn    = true;
      buzzTimer = now;
      digitalWrite(IOT_BUZZER_PIN, HIGH);
    }
  }
}

// ── BLE callbacks ─────────────────────────────────────────────────────────────

class SgServerCb : public BLEServerCallbacks {
  void onConnect(BLEServer *s) override {
    bleConnected = true;
    digitalWrite(IOT_BLE_LED_PIN, HIGH);
    Serial.println("BLE: connected");
  }
  void onDisconnect(BLEServer *s) override {
    bleConnected = false;
    digitalWrite(IOT_BLE_LED_PIN, LOW);
    Serial.println("BLE: disconnected — re-advertising");
    s->startAdvertising();
  }
};

class SgCmdCb : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    std::string val = c->getValue();
    if (val.empty()) return;
    JsonDocument doc;
    if (deserializeJson(doc, val.c_str()) != DeserializationError::Ok) {
      Serial.println("ERROR: Failed to parse BLE command JSON");
      return;
    }
    const char *cmd     = doc["cmd"]      | "";
    const char *alertId = doc["alert_id"] | "";
    int         level   = doc["level"]    | 0;
    if (strcmp(cmd, "buzz") == 0) {
      triggerAlert(level, alertId);
    } else if (strcmp(cmd, "all_clear") == 0) {
      clearAlert();
    }
  }
};

// ── Persistent BLE callback instances (avoid memory leaks) ──────────────────
static SgServerCb serverCb;
static SgCmdCb    cmdCb;

static void initBle() {
  char name[48];
  snprintf(name, sizeof(name), "SG-%s", gDeviceId);
  BLEDevice::init(name);

  BLEServer  *pSrv  = BLEDevice::createServer();
  pSrv->setCallbacks(&serverCb);

  BLEService *pSvc  = pSrv->createService(SG_SERVICE_UUID);

  BLECharacteristic *pCmd = pSvc->createCharacteristic(
    SG_CMD_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pCmd->setCallbacks(&cmdCb);

  pEventChar = pSvc->createCharacteristic(
    SG_EVENT_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pEventChar->addDescriptor(new BLE2902());

  pSvc->start();

  BLEAdvertising *pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SG_SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  pAdv->start();

  Serial.printf("BLE: advertising as %s\n", name);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

static void fillIsoUtc(char *buf, size_t len) {
  time_t t; time(&t);
  struct tm *utc = gmtime(&t);
  if (!utc || strftime(buf, len, "%Y-%m-%dT%H:%M:%S.000Z", utc) == 0)
    snprintf(buf, len, "1970-01-01T00:00:00.000Z");
}

static bool httpPost(const char *path, const String &body) {
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.println("\n[HTTP] Starting HTTPS request...");

  WiFiClientSecure client;
  HTTPClient http;

  client.setInsecure();
  client.setTimeout(15000);
  client.setHandshakeTimeout(30);

#ifdef API_USE_HTTPS
  String url = String("https://") + API_HOST + path;
#else
  String url = String("http://") + API_HOST + ":" + API_PORT + path;
#endif

  Serial.printf("[HTTP] URL: %s\n", url.c_str());
  Serial.printf("[HTTP] Body: %s\n", body.c_str());
  http.useHTTP10(true);
  http.setReuse(false);
  http.begin(client, url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-snoozeguard-device-key", IOT_INGEST_SECRET);

  int code = http.POST(body);

  Serial.printf("[HTTP] Response code: %d\n", code);

  if (code < 0) {
    
    Serial.printf("[HTTP] Error: %s\n", http.errorToString(code).c_str());
  }
  IPAddress ip;
  if (WiFi.hostByName(API_HOST, ip)) {
    Serial.print("[DNS] ");
    Serial.println(ip);
  } else {
    Serial.println("[DNS] Failed");
  }
  http.end();
  return code >= 200 && code < 300;
}

static void reconnectMqtt(); // forward declaration

static void postPing() {
  mqtt.loop(); // flush connection state before checking
  if (!mqtt.connected()) {
    Serial.println("[MQTT PING] Not connected — attempting reconnect");
    reconnectMqtt();
    if (!mqtt.connected()) {
      Serial.println("[MQTT PING] Reconnect failed — ping skipped");
      return;
    }
  }

  JsonDocument doc;
  doc["device_id"] = gDeviceId;
  doc["timestamp"] = millis();
  String body; serializeJson(doc, body);

  char topic[192];
  snprintf(topic, sizeof(topic), "snoozeguard/ping/%s", gDeviceId);
  if (strlen(topic) >= sizeof(topic) - 1) {
    Serial.println("ERROR: Ping topic buffer overflow");
    return;
  }
  bool published = mqtt.publish(topic, body.c_str());
  if (!published) {
    Serial.println("[MQTT PING] Publish failed — forcing reconnect");
    mqtt.disconnect();
    reconnectMqtt();
  }
  Serial.printf("[MQTT PING] Topic: %s | Published: %s\n", topic, published ? "YES" : "NO");
}

static void postDismiss(const char *alertId) {
  mqtt.loop(); // flush connection state before checking
  if (!mqtt.connected()) {
    Serial.println("[MQTT DISMISS] Not connected — attempting reconnect");
    reconnectMqtt();
    if (!mqtt.connected()) {
      Serial.println("[MQTT DISMISS] Reconnect failed — dismiss skipped");
      return;
    }
  }

  JsonDocument doc;
  doc["device_id"] = gDeviceId;
  doc["alert_id"]  = alertId;
  doc["timestamp"] = millis();
  String body; serializeJson(doc, body);

  char topic[192];
  snprintf(topic, sizeof(topic), "snoozeguard/dismiss/%s", gDeviceId);
  if (strlen(topic) >= sizeof(topic) - 1) {
    Serial.println("ERROR: Dismiss topic buffer overflow");
    return;
  }
  bool published = mqtt.publish(topic, body.c_str());
  if (!published) {
    Serial.println("[MQTT DISMISS] Publish failed — forcing reconnect");
    mqtt.disconnect();
    reconnectMqtt();
  }
  Serial.printf("[MQTT DISMISS] alert_id=%s | Published: %s\n", alertId, published ? "YES" : "NO");
}

// ── MQTT ──────────────────────────────────────────────────────────────────────

static void onMqttMessage(char *topic, byte *payload, unsigned int len) {
  char buf[256];
  if (len >= sizeof(buf)) {
    Serial.println("ERROR: MQTT message payload too large");
    return;
  }
  memcpy(buf, payload, len);
  buf[len] = '\0';
  JsonDocument doc;
  if (deserializeJson(doc, buf) != DeserializationError::Ok) {
    Serial.println("ERROR: Failed to parse MQTT message JSON");
    return;
  }
  
  const char *cmd     = doc["command"] | "";
  const char *alertId = doc["alert_id"] | "";
  int         level   = doc["level"]   | 0;
  const char *type    = doc["type"]     | "";
  
  // Handle command messages (buzz/all_clear)
  if (strcmp(cmd, "buzz") == 0) {
    triggerAlert(level, alertId);
    Serial.printf("MQTT BUZZ level=%d\n", level);
  } else if (strcmp(cmd, "all_clear") == 0) {
    clearAlert();
    Serial.println("MQTT ALL_CLEAR");
  }
  // Handle ping response
  else if (strcmp(type, "ping_response") == 0) {
    Serial.println("[MQTT] Ping acknowledged by backend");
  }
  // Handle dismiss response
  else if (strcmp(type, "dismiss_response") == 0) {
    Serial.println("[MQTT] Dismiss acknowledged by backend");
  }
}

static void reconnectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) {
    if (mqtt.connected()) Serial.println("[MQTT] Already connected");
    return;
  }

  Serial.printf("[MQTT] Free heap before connect: %u bytes\n", ESP.getFreeHeap());

  // DNS check — rc=-2 with a wrong/unreachable broker shows here first
  IPAddress brokerIp;
  if (!WiFi.hostByName(MQTT_BROKER, brokerIp)) {
    Serial.printf("[MQTT] DNS FAILED for %s — cluster down or hostname wrong\n", MQTT_BROKER);
    return;
  }
  Serial.printf("[MQTT] Broker resolved: %s → %s\n", MQTT_BROKER, brokerIp.toString().c_str());

  Serial.print("[MQTT] Connecting...");
  bool ok;
#if defined(MQTT_USERNAME)
  ok = mqtt.connect(gDeviceId, MQTT_USERNAME, MQTT_PASSWORD);
#else
  ok = mqtt.connect(gDeviceId);
#endif
  if (ok) {
    // Subscribe to command topic (receive buzz/all_clear from backend)
    char cmdTopic[128];
    snprintf(cmdTopic, sizeof(cmdTopic), "snoozeguard/commands/%s", gDeviceId);
    mqtt.subscribe(cmdTopic);
    Serial.printf(" [MQTT] Subscribed to %s\n", cmdTopic);
    
    // Subscribe to ping response topic
    char pingTopic[128];
    snprintf(pingTopic, sizeof(pingTopic), "snoozeguard/ping/response/%s", gDeviceId);
    mqtt.subscribe(pingTopic);
    Serial.printf(" [MQTT] Subscribed to %s\n", pingTopic);
    
    // Subscribe to dismiss response topic
    char dismissTopic[128];
    snprintf(dismissTopic, sizeof(dismissTopic), "snoozeguard/dismiss/response/%s", gDeviceId);
    mqtt.subscribe(dismissTopic);
    Serial.printf(" [MQTT] Subscribed to %s\n", dismissTopic);
  } else {
    Serial.printf(" [MQTT] Connect failed rc=%d\n", mqtt.state());
  }
}

// ── Device ID — auto-generated from MAC, overridable via captive portal ───────

static void initDeviceId() {
  Preferences prefs;
  prefs.begin("wifi", /*readOnly=*/true);
  String saved = prefs.getString("device_id", "");
  prefs.end();

  if (saved.length() > 0) {
    saved.toCharArray(gDeviceId, sizeof(gDeviceId));
  } else {
    // Generate "sg-XXXXXX" from the lower 3 bytes of the ESP32 eFuse MAC.
    // Each chip has a globally unique MAC assigned by Espressif, so this
    // produces a distinct ID per board without any manual configuration.
    uint32_t mac24 = (uint32_t)(ESP.getEfuseMac() & 0xFFFFFF);
    snprintf(gDeviceId, sizeof(gDeviceId), "sg-%06x", mac24);
  }
  Serial.printf("[ID] Device ID: %s\n", gDeviceId);
}

// ── WiFi provisioning (AP / captive-portal mode) ──────────────────────────────

static const char PROV_STYLE[] =
  "<!DOCTYPE html><html><head>"
  "<meta name='viewport' content='width=device-width,initial-scale=1'>"
  "<title>SnoozeGuard WiFi Setup</title>"
  "<style>"
  "body{font-family:sans-serif;max-width:420px;margin:48px auto;padding:0 20px;"
        "background:#0f172a;color:#e2e8f0}"
  "h1{font-size:1.4rem;margin-bottom:4px}"
  "p{color:#94a3b8;font-size:.88rem;margin-bottom:20px}"
  "label{display:block;font-size:.85rem;font-weight:600;margin-bottom:4px}"
  "input{width:100%;box-sizing:border-box;padding:10px 12px;background:#1e293b;"
         "border:1px solid #334155;border-radius:8px;color:#e2e8f0;"
         "font-size:.95rem;margin-bottom:16px;font-family:monospace}"
  "button{width:100%;padding:12px;background:#00a8e8;border:none;border-radius:8px;"
          "color:#fff;font-size:1rem;font-weight:700;cursor:pointer}"
  ".hint{font-size:.75rem;color:#64748b;margin-top:-12px;margin-bottom:16px}"
  "</style></head><body>"
  "<h1>SnoozeGuard WiFi Setup</h1>"
  "<p>Connect this device to your WiFi network and optionally give it a custom ID.</p>"
  "<form method='POST' action='/save'>"
  "<label>Account Email</label>"
  "<input name='email' type='email' placeholder='your@email.com' required>"
  "<p class='hint'>The email you use to log in to the SnoozeGuard app.</p>"
  "<label>WiFi Network (SSID)</label>"
  "<input name='ssid' type='text' placeholder='Your network name' required>"
  "<label>Password</label>"
  "<input name='pass' type='password' placeholder='Your network password'>"
  "<label>Device ID</label>"
  "<input name='device_id' type='text' value='";

// Appended after gDeviceId is inserted as input value
static const char PROV_STYLE_POST[] =
  "' maxlength='31' required>"
  "<p class='hint'>Auto-generated from chip MAC. Change to a friendly name if you like.</p>"
  "<button type='submit'>Save &amp; Restart</button>"
  "</form></body></html>";

static const char PROV_SAVED_HTML[] =
  "<!DOCTYPE html><html><head>"
  "<meta name='viewport' content='width=device-width,initial-scale=1'>"
  "<title>Saved</title>"
  "<style>body{font-family:sans-serif;max-width:420px;margin:48px auto;padding:0 20px;"
  "background:#0f172a;color:#e2e8f0;text-align:center}"
  "h1{color:#10b981}</style></head><body>"
  "<h1>&#10003; Credentials Saved</h1>"
  "<p>The device is restarting and will connect to your WiFi.<br>"
  "You can reconnect your phone to your normal network.</p>"
  "</body></html>";

// Loads saved WiFi credentials from NVS into out buffers.
// Returns true if saved credentials exist, false if falling back to secrets.h.
static bool loadWifiCredentials(char *ssidBuf, size_t ssidLen,
                                 char *passBuf, size_t passLen) {
  Preferences prefs;
  prefs.begin("wifi", /*readOnly=*/true);
  String s = prefs.getString("ssid", "");
  String p = prefs.getString("pass", "");
  prefs.end();

  if (s.length() == 0) {
    strncpy(ssidBuf, WIFI_SSID, ssidLen - 1); ssidBuf[ssidLen - 1] = '\0';
    strncpy(passBuf, WIFI_PASS, passLen - 1); passBuf[passLen - 1] = '\0';
    return false;
  }
  s.toCharArray(ssidBuf, ssidLen);
  p.toCharArray(passBuf, passLen);
  return true;
}

// initDeviceId() is defined above — loads from NVS or auto-generates from MAC.

// Enters AP mode and serves the WiFi config page.
// Blocks indefinitely — device restarts after credentials are saved.
static void runProvisioningMode() {
  stopAllOutputs();

  char apName[48];
  snprintf(apName, sizeof(apName), "SG-%s", gDeviceId);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName);
  Serial.printf("[PROV] AP started: %s  IP: %s\n",
                apName, WiFi.softAPIP().toString().c_str());

  // Blink the BLE LED to indicate provisioning mode
  bool ledState = false;
  uint32_t ledTimer = millis();

  WebServer server(80);

  server.on("/", HTTP_GET, [&]() {
    String page = String(PROV_STYLE) + gDeviceId + PROV_STYLE_POST;
    server.send(200, "text/html", page);
  });

  server.on("/save", HTTP_POST, [&]() {
    String email    = server.arg("email");
    String ssid     = server.arg("ssid");
    String pass     = server.arg("pass");
    String deviceId = server.arg("device_id");
    if (email.length() == 0 || ssid.length() == 0) {
      server.send(400, "text/plain", "Email and SSID are required");
      return;
    }
    if (deviceId.length() == 0) deviceId = String(gDeviceId);

    Preferences prefs;
    prefs.begin("wifi", /*readOnly=*/false);
    prefs.putString("email",     email);
    prefs.putString("ssid",      ssid);
    prefs.putString("pass",      pass);
    prefs.putString("device_id", deviceId);
    prefs.end();

    Serial.printf("[PROV] Saved SSID: %s  Device ID: %s — restarting\n",
                  ssid.c_str(), deviceId.c_str());
    server.send(200, "text/html", PROV_SAVED_HTML);
    delay(2000);
    ESP.restart();
  });

  // Redirect any other path to the config page (captive portal behaviour)
  server.onNotFound([&]() {
    server.sendHeader("Location", "/", /*first=*/true);
    server.send(302, "text/plain", "");
  });

  server.begin();

  while (true) {
    server.handleClient();
    // Blink BLE LED at 500 ms to signal provisioning mode
    if (millis() - ledTimer >= 500) {
      ledTimer = millis();
      ledState = !ledState;
      digitalWrite(IOT_BLE_LED_PIN, ledState ? HIGH : LOW);
    }
    delay(5);
  }
}

// Publishes a link request so the backend can create a pending pairing entry
// for the user whose email was entered during WiFi setup.
static void postLinkRequest() {
  Preferences prefs;
  prefs.begin("wifi", /*readOnly=*/true);
  String email = prefs.getString("email", "");
  prefs.end();

  if (email.length() == 0) {
    Serial.println("[LINK] No email saved — skipping link request");
    return;
  }

  JsonDocument doc;
  doc["device_id"] = gDeviceId;
  doc["email"]     = email;
  String body;
  serializeJson(doc, body);

  char topic[192];
  snprintf(topic, sizeof(topic), "snoozeguard/link-request/%s", gDeviceId);
  bool published = mqtt.publish(topic, body.c_str(), /*retained=*/true);
  Serial.printf("[LINK] Request: email=%s | Published: %s\n",
                email.c_str(), published ? "YES" : "NO");
}

// ── Arduino lifecycle ─────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);

  // Resolve device ID first — everything else (BLE name, MQTT client ID,
  // MQTT topics) depends on it.
  initDeviceId();

  // GPIO
  pinMode(IOT_BUZZER_PIN,    OUTPUT);
  pinMode(IOT_LED_PIN,       OUTPUT);
  pinMode(IOT_LED2_PIN,      OUTPUT);
  pinMode(IOT_BLE_LED_PIN,   OUTPUT);
  pinMode(IOT_BUTTON_PIN,    INPUT_PULLUP);
  stopAllOutputs();
  digitalWrite(IOT_BLE_LED_PIN, LOW);

  // DFPlayer Mini (UART2)
  dfSerial.begin(9600, SERIAL_8N1, DFPLAYER_RX_PIN, DFPLAYER_TX_PIN);
  delay(1000); // DFPlayer needs time to boot
  dfPlayer = new DFRobotDFPlayerMini();
  if (!dfPlayer->begin(dfSerial, /*isACK=*/true, /*doReset=*/true)) {
    Serial.println("DFPlayer init failed — check SD card and wiring");
    delete dfPlayer;
    dfPlayer = nullptr;  // Prevent dangling pointer
  } else {
    dfPlayer->volume(DFPLAYER_VOLUME);
    Serial.printf("DFPlayer ready (volume=%d)\n", DFPLAYER_VOLUME);
  }

  // WiFi — hold button at boot for 3 s to clear saved credentials and re-provision
  {
    uint32_t holdStart = millis();
    bool held = false;
    Serial.print("Hold button now to reset WiFi");
    while (millis() - holdStart < 3000) {
      if (digitalRead(IOT_BUTTON_PIN) == LOW) { held = true; }
      delay(100); Serial.print(".");
    }
    Serial.println();
    if (held) {
      Serial.println("[PROV] Button held — clearing saved WiFi credentials");
      Preferences prefs;
      prefs.begin("wifi", false);
      prefs.clear();
      prefs.end();
      runProvisioningMode(); // never returns
    }
  }

  // Load WiFi credentials (NVS → fallback to secrets.h)
  char wifiSsid[64], wifiPass[64];
  bool fromNvs = loadWifiCredentials(wifiSsid, sizeof(wifiSsid),
                                      wifiPass, sizeof(wifiPass));
  Serial.printf("WiFi source: %s  SSID: %s\n",
                fromNvs ? "NVS" : "secrets.h", wifiSsid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid, wifiPass);
  Serial.print("Connecting WiFi");
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < WIFI_CONNECT_TIMEOUT_MS) {
    delay(500); Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    mqttWifi.setInsecure();
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setCallback(onMqttMessage);
    mqtt.setBufferSize(512);
    mqtt.setKeepAlive(30);
    mqtt.setSocketTimeout(10);
    Serial.println("Attempting MQTT connection...");
    reconnectMqtt();
    if (mqtt.connected()) {
      Serial.println("MQTT connected!");
      postLinkRequest(); // notify backend of pairing intent on every boot
    } else {
      Serial.println("MQTT connection failed.");
    }
  } else {
    Serial.println("WiFi failed — entering provisioning mode");
    runProvisioningMode(); // never returns
  }

  // BLE always starts (fallback path)
  initBle();
}

void loop() {
  // MQTT keepalive
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) reconnectMqtt();
    mqtt.loop();
  }

  uint32_t now = millis();

  // Heartbeat ping every 5 s (connection indicator in app)
  if (WiFi.status() == WL_CONNECTED && now - lastPing >= 5000) {
    lastPing = now;
    postPing();
  }

  // Non-blocking alert effects
  handleVibPulse(now);
  handleLedFlash(now);
  handleBuzzerPattern(now);

  // Dome button: dismiss active alert
  if (alertActive && digitalRead(IOT_BUTTON_PIN) == LOW && now - lastButton > BUTTON_DEBOUNCE_MS) {
    lastButton = now;
    Serial.println("Button — dismiss");
    // Notify connected BLE client so the app dismisses too
    if (bleConnected && pEventChar) {
      String ev = "{\"event\":\"dismiss\"}";
      pEventChar->setValue(ev.c_str());
      pEventChar->notify();
    }
    // Tell API so Supabase Realtime propagates dismiss to web + mobile
    postDismiss(currentAlertId);
    clearAlert();
  }

  delay(20);
}
