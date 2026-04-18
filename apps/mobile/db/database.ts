import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("snoozeguard.db");
    db.execSync("PRAGMA journal_mode = WAL;");
    db.execSync("PRAGMA foreign_keys = ON;");
    db.execSync(`
      CREATE TABLE IF NOT EXISTS driving_sessions_local (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        remote_id TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        device_type TEXT NOT NULL DEFAULT 'mobile',
        ended_synced INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS session_telemetry_local (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_session_id TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        drowsiness_level REAL NOT NULL,
        yawn_count_delta INTEGER NOT NULL DEFAULT 0,
        head_event_count_delta INTEGER NOT NULL DEFAULT 0,
        sudden_brake INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL,
        remote_synced INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (local_session_id) REFERENCES driving_sessions_local(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_telemetry_pending ON session_telemetry_local (remote_synced, local_session_id);
    `);
    // Additive migration: add head_tilt_delta if not present
    try {
      db.execSync("ALTER TABLE session_telemetry_local ADD COLUMN head_tilt_delta INTEGER NOT NULL DEFAULT 0");
    } catch { /* column already exists */ }
    // Offline cache tables
    db.execSync(`
      CREATE TABLE IF NOT EXISTS emergency_contacts_local (
        user_id TEXT PRIMARY KEY,
        contact_name TEXT NOT NULL DEFAULT '',
        contact_phone TEXT NOT NULL DEFAULT '',
        contact_email TEXT NOT NULL DEFAULT '',
        my_phone TEXT NOT NULL DEFAULT '',
        pending_sync INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS emergency_alert_events_local (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        location_lat REAL,
        location_lng REAL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        acknowledged_at TEXT,
        driver_name TEXT NOT NULL DEFAULT 'Driver',
        driver_phone TEXT,
        cached_at TEXT NOT NULL
      );
    `);
    // Key-value preferences store
    db.execSync("CREATE TABLE IF NOT EXISTS user_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  }
  return db;
}

export function getPref(key: string): string | null {
  try {
    const row = getDatabase().getFirstSync<{ value: string }>(
      "SELECT value FROM user_preferences WHERE key = ?", key,
    );
    return row?.value ?? null;
  } catch { return null; }
}

export function setPref(key: string, value: string): void {
  try {
    getDatabase().runSync(
      "INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?, ?)", key, value,
    );
  } catch { /* ignore */ }
}
