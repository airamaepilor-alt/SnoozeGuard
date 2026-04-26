#pragma once

#define WIFI_SSID "your-ssid"
#define WIFI_PASS "your-password"

/** API host without scheme — your computer's local IP (run `ipconfig`) */
#define API_HOST "192.168.1.50"
#define API_PORT "4000"

/** Same value as IOT_INGEST_SECRET in services/api/.env */
#define IOT_INGEST_SECRET "dev-secret-change-me"

/** Stable per-trip ID so telemetry rows land in one session */
#define SESSION_EXTERNAL_ID "sg-alert-trip-001"

/** Must match exactly what is entered in the app pairing UI */
#define IOT_DEVICE_ID "sg-alert-001"

/**
 * HiveMQ Cloud (free tier)
 * Get host/credentials from your HiveMQ dashboard → Cluster → Connect
 */
#define MQTT_BROKER   "your-cluster.s1.eu.hivemq.cloud"
#define MQTT_PORT     8883
#define MQTT_USERNAME "your-hivemq-username"
#define MQTT_PASSWORD "your-hivemq-password"

/**
 * GPIO pins — ESP32 DevKit V1 (WROOM-32)
 *   GPIO 16 ← DFPlayer TX  (UART2 RX)
 *   GPIO 17 → DFPlayer RX  (UART2 TX, via 1kΩ resistor)
 *   GPIO 25 → Vibration motor module SIG
 *   GPIO 26 → Active buzzer (+)
 *   GPIO 27 → Alert LED red (via 220Ω)  — steady level 9, flashing level 10
 *   GPIO 32 → Dome dismiss button (other leg to GND, uses INPUT_PULLUP)
 *   GPIO 33 → BLE status LED (via 220Ω) — on when BLE client connected
 */
#define DFPLAYER_RX_PIN   16
#define DFPLAYER_TX_PIN   17
#define IOT_VIBRATION_PIN 25
#define IOT_BUZZER_PIN    26
#define IOT_LED_PIN       27
#define IOT_BUTTON_PIN    32
#define IOT_BLE_LED_PIN   33
