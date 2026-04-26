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
 *   Device name:    SG-{IOT_DEVICE_ID}
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
 * Simulate (Wokwi, BLE disabled): pio run -e sg_sim
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <DFRobotDFPlayerMini.h>
#include <SPIFFS.h>
#include <time.h>

#ifndef NO_BLE
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#endif

#include "secrets.h"

// ── File logger (writes to /log.txt on SPIFFS) ────────────────────────────────
static File logFile;
static void logInit() {
  if (SPIFFS.begin(true)) {
    logFile = SPIFFS.open("/log.txt", FILE_WRITE);
  }
}
static void LOG(const char *msg) {
  Serial.println(msg);
  Serial.flush();
  if (logFile) { logFile.println(msg); logFile.flush(); }
}
static void logDump() {
  File f = SPIFFS.open("/log.txt", FILE_READ);
  if (!f) return;
  Serial.println("=== /log.txt ===");
  while (f.available()) Serial.write(f.read());
  Serial.println("=== END ===");
  f.close();
}

// ── Pin / config defaults (override in secrets.h) ─────────────────────────────
#ifndef IOT_DEVICE_ID
#define IOT_DEVICE_ID      "sg-alert-001"
#endif
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
#ifndef IOT_VIBRATION_PIN
#define IOT_VIBRATION_PIN  25
#endif
#ifndef IOT_BUZZER_PIN
#define IOT_BUZZER_PIN     26
#endif
#ifndef IOT_LED_PIN
#define IOT_LED_PIN        27
#endif
#ifndef IOT_BUTTON_PIN
#define IOT_BUTTON_PIN     32
#endif
#ifndef IOT_BLE_LED_PIN
#define IOT_BLE_LED_PIN    33
#endif

// ── BLE UUIDs ─────────────────────────────────────────────────────────────────
#define SG_SERVICE_UUID    "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define SG_CMD_CHAR_UUID   "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define SG_EVENT_CHAR_UUID "beb5483f-36e1-4688-b7f5-ea07361b26a8"

// ── Vibration pulse patterns for levels 6–8 ───────────────────────────────────
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
static bool     dfPlayerReady      = false;

// ── Hardware ──────────────────────────────────────────────────────────────────
static HardwareSerial      dfSerial(2);
static DFRobotDFPlayerMini dfPlayer;
static WiFiClientSecure    mqttWifi;
static PubSubClient        mqtt(mqttWifi);

#ifndef NO_BLE
static BLECharacteristic  *pEventChar = nullptr;
#endif

// ── Alert helpers ─────────────────────────────────────────────────────────────

static void stopAllOutputs() {
  digitalWrite(IOT_BUZZER_PIN,    LOW);
  digitalWrite(IOT_LED_PIN,       LOW);
  digitalWrite(IOT_VIBRATION_PIN, LOW);
  if (dfPlayerReady) dfPlayer.stop();
  vibLeft  = 0;
  vibOn    = false;
  ledFlash = false;
}

static void clearAlert() {
  alertActive       = false;
  currentLevel      = 0;
  currentAlertId[0] = '\0';
  stopAllOutputs();
}

static void triggerAlert(int level, const char *alertId) {
  if (level < 6) return;

  stopAllOutputs();

  alertActive  = true;
  currentLevel = level;
  strncpy(currentAlertId, alertId, sizeof(currentAlertId) - 1);
  currentAlertId[sizeof(currentAlertId) - 1] = '\0';

  if (dfPlayerReady) dfPlayer.play(level - 5);

  if (level >= 9) {
    digitalWrite(IOT_BUZZER_PIN,    HIGH);
    digitalWrite(IOT_VIBRATION_PIN, HIGH);
    if (level == 10) {
      ledFlash      = true;
      ledFlashTimer = millis();
      digitalWrite(IOT_LED_PIN, HIGH);
    } else {
      digitalWrite(IOT_LED_PIN, HIGH);
    }
  } else {
    const VibPattern &p = kVib[level];
    vibLeft  = p.pulses;
    vibOn    = true;
    vibTimer = millis();
    digitalWrite(IOT_VIBRATION_PIN, HIGH);
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
      digitalWrite(IOT_VIBRATION_PIN, LOW);
    }
  } else if (vibLeft > 0) {
    if (now - vibTimer >= p.offMs) {
      vibOn = true;
      vibTimer = now;
      digitalWrite(IOT_VIBRATION_PIN, HIGH);
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

// ── BLE callbacks ─────────────────────────────────────────────────────────────

#ifndef NO_BLE
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
    if (deserializeJson(doc, val.c_str()) != DeserializationError::Ok) return;
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

static void initBle() {
  char name[48];
  snprintf(name, sizeof(name), "SG-%s", IOT_DEVICE_ID);
  BLEDevice::init(name);

  BLEServer  *pSrv = BLEDevice::createServer();
  pSrv->setCallbacks(new SgServerCb());

  BLEService *pSvc = pSrv->createService(SG_SERVICE_UUID);

  BLECharacteristic *pCmd = pSvc->createCharacteristic(
    SG_CMD_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pCmd->setCallbacks(new SgCmdCb());

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
#endif // NO_BLE

// ── HTTP helpers ──────────────────────────────────────────────────────────────

static void fillIsoUtc(char *buf, size_t len) {
  time_t t; time(&t);
  struct tm *utc = gmtime(&t);
  if (!utc || strftime(buf, len, "%Y-%m-%dT%H:%M:%S.000Z", utc) == 0)
    snprintf(buf, len, "1970-01-01T00:00:00.000Z");
}

static bool httpPost(const char *path, const String &body) {
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClient client;
  HTTPClient http;
  String url = String("http://") + API_HOST + ":" + API_PORT + path;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-snoozeguard-device-key", IOT_INGEST_SECRET);
  int code = http.POST(body);
  Serial.printf("POST %s → %d\n", path, code);
  http.end();
  return code >= 200 && code < 300;
}

static void postPing() {
  JsonDocument doc;
  doc["device_id"] = IOT_DEVICE_ID;
  String body; serializeJson(doc, body);
  httpPost("/v1/iot/ping", body);
}

static void postDismiss(const char *alertId) {
  JsonDocument doc;
  doc["device_id"] = IOT_DEVICE_ID;
  doc["alert_id"]  = alertId;
  String body; serializeJson(doc, body);
  httpPost("/v1/iot/dismiss", body);
}

// ── MQTT ──────────────────────────────────────────────────────────────────────

static void onMqttMessage(char *topic, byte *payload, unsigned int len) {
  char buf[256];
  if (len >= sizeof(buf)) return;
  memcpy(buf, payload, len);
  buf[len] = '\0';
  JsonDocument doc;
  if (deserializeJson(doc, buf) != DeserializationError::Ok) return;
  const char *cmd     = doc["command"] | "";
  const char *alertId = doc["alert_id"] | "";
  int         level   = doc["level"]   | 0;
  if (strcmp(cmd, "buzz") == 0) {
    triggerAlert(level, alertId);
    Serial.printf("MQTT BUZZ level=%d\n", level);
  } else if (strcmp(cmd, "all_clear") == 0) {
    clearAlert();
    Serial.println("MQTT ALL_CLEAR");
  }
}

static void reconnectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) return;
  Serial.print("MQTT connecting...");
  bool ok;
#if defined(MQTT_USERNAME)
  ok = mqtt.connect(IOT_DEVICE_ID, MQTT_USERNAME, MQTT_PASSWORD);
#else
  ok = mqtt.connect(IOT_DEVICE_ID);
#endif
  if (ok) {
    char t[128];
    snprintf(t, sizeof(t), "snoozeguard/commands/%s", IOT_DEVICE_ID);
    mqtt.subscribe(t);
    Serial.printf("OK → %s\n", t);
  } else {
    Serial.printf("failed rc=%d\n", mqtt.state());
  }
}

// ── Arduino lifecycle ─────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("BOOT TEST");
   delay(5000);
  logInit();
  LOG("\n\n===== SG BOOT START =====");

  LOG("[1] GPIO init...");
  pinMode(IOT_BUZZER_PIN,    OUTPUT);
  pinMode(IOT_LED_PIN,       OUTPUT);
  pinMode(IOT_VIBRATION_PIN, OUTPUT);
  pinMode(IOT_BLE_LED_PIN,   OUTPUT);
  pinMode(IOT_BUTTON_PIN,    INPUT_PULLUP);
  stopAllOutputs();
  digitalWrite(IOT_BLE_LED_PIN, LOW);
  LOG("[1] GPIO OK");

#ifdef NO_BLE
  LOG("[SIM] BLE disabled — simulation mode");
#endif

  LOG("[2] DFPlayer init...");
  dfSerial.begin(9600, SERIAL_8N1, DFPLAYER_RX_PIN, DFPLAYER_TX_PIN);
  delay(1000);
  if (!dfPlayer.begin(dfSerial, /*isACK=*/true, /*doReset=*/true)) {
    LOG("[2] DFPlayer FAILED (no SD card in sim — OK)");
  } else {
    dfPlayerReady = true;
    dfPlayer.volume(25);
    LOG("[2] DFPlayer ready");
  }

  LOG("[3] WiFi connecting...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS, WIFI_CHANNEL);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    delay(500); Serial.print("."); Serial.flush();
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    char ipMsg[64];
    snprintf(ipMsg, sizeof(ipMsg), "[3] WiFi OK — IP: %s", WiFi.localIP().toString().c_str());
    LOG(ipMsg);
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    LOG("[4] MQTT setup...");
    mqttWifi.setInsecure();
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setCallback(onMqttMessage);
    reconnectMqtt();
  } else {
    LOG("[3] WiFi FAILED — BLE-only mode");
  }

#ifndef NO_BLE
  LOG("[5] BLE init...");
  initBle();
#endif

  LOG("===== SG BOOT DONE =====");
  logDump();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) reconnectMqtt();
    mqtt.loop();
  }

  uint32_t now = millis();

  if (WiFi.status() == WL_CONNECTED && now - lastPing >= 5000) {
    lastPing = now;
    postPing();
  }

  handleVibPulse(now);
  handleLedFlash(now);

  if (alertActive && digitalRead(IOT_BUTTON_PIN) == LOW && now - lastButton > 300) {
    lastButton = now;
    Serial.println("Button — dismiss");
#ifndef NO_BLE
    if (bleConnected && pEventChar) {
      String ev = "{\"event\":\"dismiss\"}";
      pEventChar->setValue(ev.c_str());
      pEventChar->notify();
    }
#endif
    postDismiss(currentAlertId);
    clearAlert();
  }

  delay(20);
}
