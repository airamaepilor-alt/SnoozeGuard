-- Aggregate session metrics server-side so the web dashboard never hits the
-- PostgREST max_rows cap (default 1000).  Previously the dashboard fetched raw
-- telemetry rows to JavaScript and summed them there; any user with > 1000
-- total telemetry rows received a truncated count that was lower than mobile.
--
-- This function mirrors the mobile HomeScreen calculation exactly:
--   avg_drowsiness = average of per-session averages (not a flat row average)
--   focus_score    = max(0, round(100 - avg_drowsiness * 10))

CREATE OR REPLACE FUNCTION get_session_metrics(
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  session_count  BIGINT,
  total_drive_sec FLOAT,
  avg_drive_sec   FLOAT,
  avg_drowsiness  FLOAT,
  focus_score     INT,
  yawn_sum        BIGINT,
  head_sum        BIGINT,
  tilt_sum        BIGINT,
  brake_sum       BIGINT
)
LANGUAGE SQL
SECURITY INVOKER          -- RLS on driving_sessions limits to auth.uid() rows
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT                                                          AS session_count,
    COALESCE(SUM(per.drive_sec), 0)                                          AS total_drive_sec,
    CASE WHEN COUNT(*) > 0
         THEN COALESCE(SUM(per.drive_sec), 0) / COUNT(*)
         ELSE 0 END                                                           AS avg_drive_sec,
    COALESCE(AVG(COALESCE(per.sess_avg, 0)), 0)                              AS avg_drowsiness,
    GREATEST(0, ROUND(100 - AVG(COALESCE(per.sess_avg, 0)) * 10))::INT       AS focus_score,
    COALESCE(SUM(per.yawn_sum), 0)                                           AS yawn_sum,
    COALESCE(SUM(per.head_sum), 0)                                           AS head_sum,
    COALESCE(SUM(per.tilt_sum), 0)                                           AS tilt_sum,
    COALESCE(SUM(per.brake_sum), 0)                                          AS brake_sum
  FROM (
    SELECT
      s.id,
      EXTRACT(EPOCH FROM (s.ended_at - s.started_at))          AS drive_sec,
      AVG(t.drowsiness_level)                                   AS sess_avg,
      COALESCE(SUM(t.yawn_count_delta), 0)                     AS yawn_sum,
      COALESCE(SUM(t.head_event_count_delta), 0)               AS head_sum,
      COALESCE(SUM(t.head_tilt_delta), 0)                      AS tilt_sum,
      COUNT(CASE WHEN t.sudden_brake THEN 1 END)               AS brake_sum
    FROM public.driving_sessions s
    LEFT JOIN public.session_telemetry t ON t.session_id = s.id
    WHERE (p_since IS NULL OR s.started_at >= p_since)
    GROUP BY s.id, s.started_at, s.ended_at
  ) per
$$;

GRANT EXECUTE ON FUNCTION get_session_metrics(TIMESTAMPTZ) TO authenticated;
