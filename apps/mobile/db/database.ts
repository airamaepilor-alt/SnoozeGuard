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
  }
  return db;
}
