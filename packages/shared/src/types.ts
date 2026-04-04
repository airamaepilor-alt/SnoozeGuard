export type UserRole = "driver" | "super_admin";

export interface DrivingSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  device_type: "mobile" | "web" | "iot";
  sync_status: "local" | "synced";
}

export interface SessionTelemetryEvent {
  session_id: string;
  recorded_at: string;
  drowsiness_level: number;
  yawn_count_delta?: number;
  head_event_count_delta?: number;
  sudden_brake?: boolean;
  source?: string;
}

export interface AdminConfigRow {
  id: string;
  yawn_threshold: number;
  head_movement_threshold: number;
  drowsiness_trigger_level: number;
  updated_at: string;
  updated_by: string | null;
}

export interface IotTelemetryPayload {
  device_id: string;
  session_external_id?: string;
  recorded_at: string;
  drowsiness_level: number;
  yawn_count?: number;
  head_movement_events?: number;
  sudden_brake?: boolean;
  metadata?: Record<string, unknown>;
}
