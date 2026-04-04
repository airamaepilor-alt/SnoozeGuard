#pragma once

#define WIFI_SSID "your-ssid"
#define WIFI_PASS "your-password"

/** API host without scheme (HTTP). For HTTPS use WiFiClientSecure + different client in main.cpp */
#define API_HOST "192.168.1.50"
#define API_PORT "4000"

/** Same value as IOT_INGEST_SECRET on SnoozeGuard API */
#define IOT_INGEST_SECRET "dev-secret-change-me-16chars"

/** Stable per-trip id so samples land in one driving_sessions row */
#define SESSION_EXTERNAL_ID "esp32-trip-001"
