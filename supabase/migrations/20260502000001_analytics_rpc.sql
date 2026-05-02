-- Analytics data aggregated server-side so the telemetry row limit never
-- truncates daily/hourly averages or detection totals.
-- Previously AnalyticsPage fetched raw rows with .limit(8000); with Supabase's
-- default max_rows=1000 only a fraction of sessions were counted.

CREATE OR REPLACE FUNCTION get_analytics_data(
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE SQL
SECURITY INVOKER          -- RLS on driving_sessions limits to auth.uid() rows
SET search_path = public
AS $$
  SELECT json_build_object(

    -- Daily average drowsiness (only days that have data; client fills zeros)
    'daily_avg', (
      SELECT COALESCE(json_agg(
        json_build_object('day', day, 'avg', avg)
        ORDER BY day
      ), '[]'::json)
      FROM (
        SELECT
          (t.recorded_at AT TIME ZONE 'UTC')::DATE::TEXT AS day,
          AVG(t.drowsiness_level)                        AS avg
        FROM public.driving_sessions s
        JOIN public.session_telemetry t ON t.session_id = s.id
        WHERE (p_since IS NULL OR t.recorded_at >= p_since)
        GROUP BY (t.recorded_at AT TIME ZONE 'UTC')::DATE
      ) d
    ),

    -- Hourly averages: 6 blocks of 4 hours each (UTC, matches mobile)
    'hourly_avg', (
      SELECT COALESCE(json_agg(
        json_build_object('block', block, 'avg', avg)
        ORDER BY block
      ), '[]'::json)
      FROM (
        SELECT
          FLOOR(EXTRACT(HOUR FROM t.recorded_at AT TIME ZONE 'UTC') / 4)::INT AS block,
          AVG(t.drowsiness_level)                                               AS avg
        FROM public.driving_sessions s
        JOIN public.session_telemetry t ON t.session_id = s.id
        WHERE (p_since IS NULL OR t.recorded_at >= p_since)
        GROUP BY block
      ) h
    ),

    -- Detection event totals
    'detections', (
      SELECT json_build_object(
        'yawns',  COALESCE(SUM(t.yawn_count_delta), 0),
        'heads',  COALESCE(SUM(t.head_event_count_delta), 0),
        'tilts',  COALESCE(SUM(t.head_tilt_delta), 0),
        'brakes', COUNT(CASE WHEN t.sudden_brake THEN 1 END)
      )
      FROM public.driving_sessions s
      LEFT JOIN public.session_telemetry t ON t.session_id = s.id
      WHERE (p_since IS NULL OR s.started_at >= p_since)
    )

  )
$$;

GRANT EXECUTE ON FUNCTION get_analytics_data(TIMESTAMPTZ) TO authenticated;
