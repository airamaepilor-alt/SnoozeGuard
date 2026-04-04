import Dexie, { type Table } from "dexie";

export type LocalDrivingSession = {
  id: string;
  userId: string;
  remoteId?: string;
  startedAt: string;
  endedAt?: string;
  deviceType: "web";
  endedSynced: number;
};

export type LocalTelemetry = {
  id?: number;
  localSessionId: string;
  recordedAt: string;
  drowsinessLevel: number;
  yawnCountDelta: number;
  headEventCountDelta: number;
  suddenBrake: number;
  source: string;
  remoteSynced: number;
};

class SnoozeGuardWebDB extends Dexie {
  drivingSessionsLocal!: Table<LocalDrivingSession, string>;
  sessionTelemetryLocal!: Table<LocalTelemetry, number>;

  constructor() {
    super("snoozeguard_web");
    this.version(1).stores({
      drivingSessionsLocal: "id, userId, remoteId, endedAt, endedSynced",
      sessionTelemetryLocal: "++id, localSessionId, remoteSynced",
    });
  }
}

export const offlineDb = new SnoozeGuardWebDB();

export async function getOpenLocalSession(userId: string): Promise<LocalDrivingSession | undefined> {
  const rows = await offlineDb.drivingSessionsLocal.where("userId").equals(userId).toArray();
  return rows.find((r) => !r.endedAt);
}

export async function countPendingTelemetryForUser(userId: string): Promise<number> {
  const pending = await offlineDb.sessionTelemetryLocal.filter((t) => t.remoteSynced === 0).toArray();
  let n = 0;
  for (const t of pending) {
    const s = await offlineDb.drivingSessionsLocal.get(t.localSessionId);
    if (s?.userId === userId) n += 1;
  }
  return n;
}
