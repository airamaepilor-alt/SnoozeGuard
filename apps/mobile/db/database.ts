import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export type LocalEC = {
  id: string;
  user_id: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  my_phone: string;
  is_active: number; // 0 or 1
  status: "pending" | "accepted"; // Contact request status
  pending_sync: number; // 0 or 1
  updated_at: string;
};

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

    // Additive migration: deduplicate telemetry rows and add unique index.
    // Without this, rehydrateSessions inserts duplicate rows on every app restart
    // because INSERT OR IGNORE never fires on an auto-increment PK.
    try {
      db.execSync(`
        DELETE FROM session_telemetry_local
        WHERE id NOT IN (
          SELECT MIN(id) FROM session_telemetry_local
          GROUP BY local_session_id, recorded_at
        );
      `);
      db.execSync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_unique_key
        ON session_telemetry_local (local_session_id, recorded_at);
      `);
    } catch { /* index already exists — safe to ignore */ }

    // Key-value preferences store (created early so EC migration can use it)
    db.execSync("CREATE TABLE IF NOT EXISTS user_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)");

    // Emergency contacts — new multi-contact schema (id PK, not user_id)
    db.execSync(`
      CREATE TABLE IF NOT EXISTS emergency_contacts_local (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        contact_name TEXT NOT NULL DEFAULT '',
        contact_phone TEXT NOT NULL DEFAULT '',
        contact_email TEXT NOT NULL DEFAULT '',
        my_phone TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'accepted',
        pending_sync INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: detect old schema (user_id was PK, no id column)
    {
      type OldRow = {
        user_id: string; contact_name: string; contact_phone: string;
        contact_email: string; my_phone: string; pending_sync: number; updated_at: string;
      };
      const cols = db.getAllSync<{ name: string }>("PRAGMA table_info(emergency_contacts_local)");
      const hasId = cols.some((c) => c.name === "id");
      const hasIsActive = cols.some((c) => c.name === "is_active");

      if (!hasId) {
        // Old table had user_id TEXT PRIMARY KEY — recreate with new schema
        const oldRows = db.getAllSync<OldRow>("SELECT * FROM emergency_contacts_local");
        db.execSync("DROP TABLE emergency_contacts_local");
        db.execSync(`
          CREATE TABLE emergency_contacts_local (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            contact_name TEXT NOT NULL DEFAULT '',
            contact_phone TEXT NOT NULL DEFAULT '',
            contact_email TEXT NOT NULL DEFAULT '',
            my_phone TEXT NOT NULL DEFAULT '',
            is_active INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'accepted',
            pending_sync INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        for (const row of oldRows) {
          if (!row.contact_name) continue;
          db.runSync(
            `INSERT INTO emergency_contacts_local
             (id, user_id, contact_name, contact_phone, contact_email, my_phone, is_active, pending_sync, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            `ec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            row.user_id, row.contact_name, row.contact_phone, row.contact_email,
            row.my_phone, row.pending_sync, row.updated_at || new Date().toISOString(),
          );
        }
      } else if (!hasIsActive) {
        try {
          db.execSync("ALTER TABLE emergency_contacts_local ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0");
        } catch { /* already exists */ }
      }
    }

    // Alert events cache
    db.execSync(`
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
    // Additive migration: add dismissed_at to alert events cache
    try {
      db.execSync("ALTER TABLE emergency_alert_events_local ADD COLUMN dismissed_at TEXT");
    } catch { /* column already exists */ }
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

// ─── Emergency contact local helpers ─────────────────────────────────────────

export function getLocalECList(userId: string): LocalEC[] {
  try {
    const result = getDatabase().getAllSync<LocalEC>(
      "SELECT * FROM emergency_contacts_local WHERE user_id = ? ORDER BY is_active DESC, updated_at ASC",
      userId,
    );
    console.log("[DB] getLocalECList for", userId, "returned", result.length, "contacts");
    return result;
  } catch (e) { 
    console.error("[DB] getLocalECList error:", e);
    return []; 
  }
}

export function upsertLocalEC(ec: LocalEC): void {
  try {
    getDatabase().runSync(
      `INSERT OR REPLACE INTO emergency_contacts_local
       (id, user_id, contact_name, contact_phone, contact_email, my_phone, is_active, status, pending_sync, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ec.id, ec.user_id, ec.contact_name, ec.contact_phone, ec.contact_email,
      ec.my_phone, ec.is_active, ec.status, ec.pending_sync, ec.updated_at,
    );
  } catch { /* ignore */ }
}

export function deleteLocalEC(id: string): void {
  try {
    getDatabase().runSync("DELETE FROM emergency_contacts_local WHERE id = ?", id);
  } catch { /* ignore */ }
}

export function setActiveLocalEC(userId: string, id: string): void {
  try {
    const database = getDatabase();
    database.runSync("UPDATE emergency_contacts_local SET is_active = 0 WHERE user_id = ?", userId);
    database.runSync("UPDATE emergency_contacts_local SET is_active = 1 WHERE id = ?", id);
  } catch { /* ignore */ }
}
