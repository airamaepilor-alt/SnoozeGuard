-- SnoozeGuard Sample Data: High Night Drowsiness (Fixed Timestamps)
-- Purpose: Demonstrate Predictive Risk Assessment alert firing (+127% risk)
-- Pattern: Night drowsiness 8.2 (20:00-04:00), Day drowsiness 3.6 (08:00-16:00)
-- User: 4cf8f2c8-443c-4cac-b826-04ea7429cd9f (test user)
-- Expected result: risk_pct = +127%, alert displays

INSERT INTO driving_sessions (id, user_id, started_at, ended_at, device_type, platform, app_version) OVERRIDING SYSTEM VALUE
VALUES
  -- Night sessions (20:00-04:00, drowsiness 8.2)
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, '4cf8f2c8-443c-4cac-b826-04ea7429cd9f'::uuid, '2026-04-13T20:00:00+00:00', '2026-04-14T04:00:00+00:00', 'mobile', 'ios', '1.0.0'),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, '4cf8f2c8-443c-4cac-b826-04ea7429cd9f'::uuid, '2026-04-14T20:00:00+00:00', '2026-04-15T04:00:00+00:00', 'mobile', 'ios', '1.0.0'),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, '4cf8f2c8-443c-4cac-b826-04ea7429cd9f'::uuid, '2026-04-15T20:00:00+00:00', '2026-04-16T04:00:00+00:00', 'mobile', 'ios', '1.0.0'),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, '4cf8f2c8-443c-4cac-b826-04ea7429cd9f'::uuid, '2026-04-16T20:00:00+00:00', '2026-04-17T04:00:00+00:00', 'mobile', 'ios', '1.0.0'),
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, '4cf8f2c8-443c-4cac-b826-04ea7429cd9f'::uuid, '2026-04-17T20:00:00+00:00', '2026-04-18T04:00:00+00:00', 'mobile', 'ios', '1.0.0'),
  
  -- Day sessions (08:00-16:00, drowsiness 3.6)
  ('550e8400-e29b-41d4-a716-446655440006'::uuid, '4cf8f2c8-443c-4cac-b826-04ea7429cd9f'::uuid, '2026-04-13T08:00:00+00:00', '2026-04-13T16:00:00+00:00', 'mobile', 'ios', '1.0.0'),
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, '4cf8f2c8-443c-4cac-b826-04ea7429cd9f'::uuid, '2026-04-14T08:00:00+00:00', '2026-04-14T16:00:00+00:00', 'mobile', 'ios', '1.0.0'),
  ('550e8400-e29b-41d4-a716-446655440008'::uuid, '4cf8f2c8-443c-4cac-b826-04ea7429cd9f'::uuid, '2026-04-15T08:00:00+00:00', '2026-04-15T16:00:00+00:00', 'mobile', 'ios', '1.0.0'),
  ('550e8400-e29b-41d4-a716-446655440009'::uuid, '4cf8f2c8-443c-4cac-b826-04ea7429cd9f'::uuid, '2026-04-16T08:00:00+00:00', '2026-04-16T16:00:00+00:00', 'mobile', 'ios', '1.0.0'),
  ('550e8400-e29b-41d4-a716-446655440010'::uuid, '4cf8f2c8-443c-4cac-b826-04ea7429cd9f'::uuid, '2026-04-17T08:00:00+00:00', '2026-04-17T16:00:00+00:00', 'mobile', 'ios', '1.0.0');

-- Night session 1 telemetry (2026-04-13 20:00 to 2026-04-14 04:00, drowsiness 8.2)
INSERT INTO session_telemetry (session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, '2026-04-13T20:00:00+00:00', 8.2, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, '2026-04-13T21:00:00+00:00', 8.2, 2, 1, 0, false),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, '2026-04-13T22:00:00+00:00', 8.2, 1, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, '2026-04-13T23:00:00+00:00', 8.2, 2, 1, 0, false),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, '2026-04-14T00:00:00+00:00', 8.2, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, '2026-04-14T01:00:00+00:00', 8.2, 2, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, '2026-04-14T02:00:00+00:00', 8.2, 1, 1, 0, false);

-- Night session 2 telemetry (2026-04-14 20:00 to 2026-04-15 04:00, drowsiness 8.2)
INSERT INTO session_telemetry (session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake)
VALUES
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, '2026-04-14T20:00:00+00:00', 8.2, 1, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, '2026-04-14T21:00:00+00:00', 8.2, 2, 1, 0, false),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, '2026-04-14T22:00:00+00:00', 8.2, 1, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, '2026-04-14T23:00:00+00:00', 8.2, 2, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, '2026-04-15T00:00:00+00:00', 8.2, 1, 1, 0, false),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, '2026-04-15T01:00:00+00:00', 8.2, 2, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, '2026-04-15T02:00:00+00:00', 8.2, 1, 0, 0, false);

-- Night session 3 telemetry (2026-04-15 20:00 to 2026-04-16 04:00, drowsiness 8.2)
INSERT INTO session_telemetry (session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake)
VALUES
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, '2026-04-15T20:00:00+00:00', 8.2, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, '2026-04-15T21:00:00+00:00', 8.2, 2, 1, 1, false),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, '2026-04-15T22:00:00+00:00', 8.2, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, '2026-04-15T23:00:00+00:00', 8.2, 2, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, '2026-04-16T00:00:00+00:00', 8.2, 1, 1, 0, false),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, '2026-04-16T01:00:00+00:00', 8.2, 2, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, '2026-04-16T02:00:00+00:00', 8.2, 1, 0, 0, false);

-- Night session 4 telemetry (2026-04-16 20:00 to 2026-04-17 04:00, drowsiness 8.2)
INSERT INTO session_telemetry (session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake)
VALUES
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, '2026-04-16T20:00:00+00:00', 8.2, 2, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, '2026-04-16T21:00:00+00:00', 8.2, 1, 1, 0, false),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, '2026-04-16T22:00:00+00:00', 8.2, 2, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, '2026-04-16T23:00:00+00:00', 8.2, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, '2026-04-17T00:00:00+00:00', 8.2, 2, 1, 1, false),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, '2026-04-17T01:00:00+00:00', 8.2, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, '2026-04-17T02:00:00+00:00', 8.2, 2, 0, 1, false);

-- Night session 5 telemetry (2026-04-17 20:00 to 2026-04-18 04:00, drowsiness 8.2)
INSERT INTO session_telemetry (session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake)
VALUES
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, '2026-04-17T20:00:00+00:00', 8.2, 1, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, '2026-04-17T21:00:00+00:00', 8.2, 2, 1, 0, false),
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, '2026-04-17T22:00:00+00:00', 8.2, 1, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, '2026-04-17T23:00:00+00:00', 8.2, 2, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, '2026-04-18T00:00:00+00:00', 8.2, 1, 1, 1, false),
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, '2026-04-18T01:00:00+00:00', 8.2, 2, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440005'::uuid, '2026-04-18T02:00:00+00:00', 8.2, 1, 0, 1, false);

-- Day session 1 telemetry (2026-04-13 08:00 to 2026-04-13 16:00, drowsiness 3.6)
INSERT INTO session_telemetry (session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake)
VALUES
  ('550e8400-e29b-41d4-a716-446655440006'::uuid, '2026-04-13T08:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440006'::uuid, '2026-04-13T09:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440006'::uuid, '2026-04-13T10:00:00+00:00', 3.6, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440006'::uuid, '2026-04-13T11:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440006'::uuid, '2026-04-13T12:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440006'::uuid, '2026-04-13T13:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440006'::uuid, '2026-04-13T14:00:00+00:00', 3.6, 0, 0, 0, false);

-- Day session 2 telemetry (2026-04-14 08:00 to 2026-04-14 16:00, drowsiness 3.6)
INSERT INTO session_telemetry (session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake)
VALUES
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, '2026-04-14T08:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, '2026-04-14T09:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, '2026-04-14T10:00:00+00:00', 3.6, 0, 1, 0, false),
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, '2026-04-14T11:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, '2026-04-14T12:00:00+00:00', 3.6, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, '2026-04-14T13:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440007'::uuid, '2026-04-14T14:00:00+00:00', 3.6, 0, 0, 0, false);

-- Day session 3 telemetry (2026-04-15 08:00 to 2026-04-15 16:00, drowsiness 3.6)
INSERT INTO session_telemetry (session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake)
VALUES
  ('550e8400-e29b-41d4-a716-446655440008'::uuid, '2026-04-15T08:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440008'::uuid, '2026-04-15T09:00:00+00:00', 3.6, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440008'::uuid, '2026-04-15T10:00:00+00:00', 3.6, 0, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440008'::uuid, '2026-04-15T11:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440008'::uuid, '2026-04-15T12:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440008'::uuid, '2026-04-15T13:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440008'::uuid, '2026-04-15T14:00:00+00:00', 3.6, 0, 0, 0, false);

-- Day session 4 telemetry (2026-04-16 08:00 to 2026-04-16 16:00, drowsiness 3.6)
INSERT INTO session_telemetry (session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake)
VALUES
  ('550e8400-e29b-41d4-a716-446655440009'::uuid, '2026-04-16T08:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440009'::uuid, '2026-04-16T09:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440009'::uuid, '2026-04-16T10:00:00+00:00', 3.6, 0, 1, 0, false),
  ('550e8400-e29b-41d4-a716-446655440009'::uuid, '2026-04-16T11:00:00+00:00', 3.6, 0, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440009'::uuid, '2026-04-16T12:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440009'::uuid, '2026-04-16T13:00:00+00:00', 3.6, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440009'::uuid, '2026-04-16T14:00:00+00:00', 3.6, 0, 0, 0, false);

-- Day session 5 telemetry (2026-04-17 08:00 to 2026-04-17 16:00, drowsiness 3.6)
INSERT INTO session_telemetry (session_id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, head_tilt_delta, sudden_brake)
VALUES
  ('550e8400-e29b-41d4-a716-446655440010'::uuid, '2026-04-17T08:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440010'::uuid, '2026-04-17T09:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440010'::uuid, '2026-04-17T10:00:00+00:00', 3.6, 1, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440010'::uuid, '2026-04-17T11:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440010'::uuid, '2026-04-17T12:00:00+00:00', 3.6, 0, 0, 1, false),
  ('550e8400-e29b-41d4-a716-446655440010'::uuid, '2026-04-17T13:00:00+00:00', 3.6, 0, 0, 0, false),
  ('550e8400-e29b-41d4-a716-446655440010'::uuid, '2026-04-17T14:00:00+00:00', 3.6, 0, 1, 0, false);
