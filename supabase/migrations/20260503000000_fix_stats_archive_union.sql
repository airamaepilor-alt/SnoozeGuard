-- Fix: stats_archive completeness + RPC union
--
-- Problems solved:
--   1. stats_archive was missing tilt_count / brake_count — those events were
--      silently lost after the 7-day purge.
--   2. get_session_metrics and get_analytics_data only queried the live tables,
--      so the "1 Month", "3 Months", and "All Time" filter options returned
--      incomplete numbers once any purge had run.
--
-- Safe to run multiple times (CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS).

-- ── 1. Schema: add missing columns ───────────────────────────────────────────

ALTER TABLE stats_archive
  ADD COLUMN IF NOT EXISTS tilt_count  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brake_count int NOT NULL DEFAULT 0;

-- ── 2. Purge function: include tilt and brake in the archive ─────────────────

CREATE OR REPLACE FUNCTION purge_old_telemetry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff date := (NOW() - INTERVAL '7 days')::date;
BEGIN
  INSERT INTO stats_archive (
    user_id, period_date,
    session_count, total_drive_seconds,
    yawn_count, head_count, tilt_count, brake_count,
    alert_count, avg_drowsiness
  )
  SELECT
    s.user_id,
    DATE(s.started_at)                                                          AS period_date,
    COUNT(DISTINCT s.id)                                                        AS session_count,
    COALESCE(SUM(EXTRACT(EPOCH FROM (s.ended_at - s.started_at))), 0)::bigint  AS total_drive_seconds,
    COALESCE(SUM(t.yawn_count_delta), 0)::int                                  AS yawn_count,
    COALESCE(SUM(t.head_event_count_delta), 0)::int                            AS head_count,
    COALESCE(SUM(t.head_tilt_delta), 0)::int                                   AS tilt_count,
    COUNT(CASE WHEN t.sudden_brake = TRUE THEN 1 END)::int                     AS brake_count,
    COUNT(DISTINCT ae.id)::int                                                  AS alert_count,
    AVG(t.drowsiness_level)                                                     AS avg_drowsiness
  FROM driving_sessions s
  LEFT JOIN session_telemetry t        ON t.session_id  = s.id
  LEFT JOIN emergency_alert_events ae  ON ae.session_id = s.id
  WHERE DATE(s.started_at) <= cutoff
  GROUP BY s.user_id, DATE(s.started_at)
  ON CONFLICT (user_id, period_date) DO UPDATE SET
    session_count        = stats_archive.session_count        + EXCLUDED.session_count,
    total_drive_seconds  = stats_archive.total_drive_seconds  + EXCLUDED.total_drive_seconds,
    yawn_count           = stats_archive.yawn_count           + EXCLUDED.yawn_count,
    head_count           = stats_archive.head_count           + EXCLUDED.head_count,
    tilt_count           = stats_archive.tilt_count           + EXCLUDED.tilt_count,
    brake_count          = stats_archive.brake_count          + EXCLUDED.brake_count,
    alert_count          = stats_archive.alert_count          + EXCLUDED.alert_count,
    avg_drowsiness       = (stats_archive.avg_drowsiness + EXCLUDED.avg_drowsiness) / 2;

  DELETE FROM session_telemetry
  WHERE session_id IN (
    SELECT id FROM driving_sessions WHERE DATE(started_at) <= cutoff
  );

  DELETE FROM emergency_alert_events
  WHERE DATE(created_at) <= cutoff;

  DELETE FROM driving_sessions WHERE DATE(started_at) <= cutoff;

  DELETE FROM sms_rate_limit WHERE sent_date < CURRENT_DATE;
END;
$$;

-- ── 3. get_session_metrics: union live tables + stats_archive ─────────────────
--
-- Live tables hold the last ~7 days (purge runs daily).
-- stats_archive holds daily aggregates for everything older.
-- avg_drowsiness is combined as a session-count-weighted average so that
-- the focus_score stays consistent with mobile HomeScreen's calculation.

CREATE OR REPLACE FUNCTION get_session_metrics(
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  session_count   BIGINT,
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
SECURITY INVOKER
SET search_path = public
AS $$
  WITH

  -- Live: per-session aggregates from the raw tables (most recent ~7 days)
  live AS (
    SELECT
      COUNT(*)::BIGINT                             AS session_count,
      COALESCE(SUM(per.drive_sec), 0)              AS total_drive_sec,
      COALESCE(AVG(COALESCE(per.sess_avg, 0)), 0)  AS avg_drowsiness,
      COALESCE(SUM(per.yawn_sum), 0)               AS yawn_sum,
      COALESCE(SUM(per.head_sum), 0)               AS head_sum,
      COALESCE(SUM(per.tilt_sum), 0)               AS tilt_sum,
      COALESCE(SUM(per.brake_sum), 0)              AS brake_sum
    FROM (
      SELECT
        EXTRACT(EPOCH FROM (s.ended_at - s.started_at))  AS drive_sec,
        AVG(t.drowsiness_level)                           AS sess_avg,
        COALESCE(SUM(t.yawn_count_delta), 0)             AS yawn_sum,
        COALESCE(SUM(t.head_event_count_delta), 0)       AS head_sum,
        COALESCE(SUM(t.head_tilt_delta), 0)              AS tilt_sum,
        COUNT(CASE WHEN t.sudden_brake THEN 1 END)       AS brake_sum
      FROM public.driving_sessions s
      LEFT JOIN public.session_telemetry t ON t.session_id = s.id
      WHERE (p_since IS NULL OR s.started_at >= p_since)
      GROUP BY s.id, s.started_at, s.ended_at
    ) per
  ),

  -- Archive: daily summaries for days already purged from the live tables.
  -- Only rows that fall within the caller's requested time window are included.
  arch AS (
    SELECT
      COALESCE(SUM(sa.session_count), 0)::BIGINT           AS session_count,
      COALESCE(SUM(sa.total_drive_seconds)::FLOAT, 0)      AS total_drive_sec,
      CASE WHEN SUM(sa.session_count) > 0
           THEN SUM(COALESCE(sa.avg_drowsiness, 0) * sa.session_count)::FLOAT
                / SUM(sa.session_count)
           ELSE 0 END                                       AS avg_drowsiness,
      COALESCE(SUM(sa.yawn_count), 0)::BIGINT              AS yawn_sum,
      COALESCE(SUM(sa.head_count), 0)::BIGINT              AS head_sum,
      COALESCE(SUM(sa.tilt_count), 0)::BIGINT              AS tilt_sum,
      COALESCE(SUM(sa.brake_count), 0)::BIGINT             AS brake_sum
    FROM public.stats_archive sa
    WHERE sa.user_id = auth.uid()
      -- Only look at days that have been purged (strictly before the live window)
      AND sa.period_date < (NOW() - INTERVAL '7 days')::date
      -- Respect the caller's time filter
      AND (p_since IS NULL OR sa.period_date >= p_since::date)
  ),

  -- Combined totals: weighted average for avg_drowsiness
  combined AS (
    SELECT
      (l.session_count + a.session_count)                   AS session_count,
      (l.total_drive_sec + a.total_drive_sec)               AS total_drive_sec,
      CASE WHEN (l.session_count + a.session_count) > 0
           THEN (  l.avg_drowsiness * l.session_count
                 + a.avg_drowsiness * a.session_count
                )::FLOAT / (l.session_count + a.session_count)
           ELSE 0 END                                        AS avg_drowsiness,
      (l.yawn_sum  + a.yawn_sum)                            AS yawn_sum,
      (l.head_sum  + a.head_sum)                            AS head_sum,
      (l.tilt_sum  + a.tilt_sum)                            AS tilt_sum,
      (l.brake_sum + a.brake_sum)                           AS brake_sum
    FROM live l, arch a
  )

  SELECT
    session_count,
    total_drive_sec,
    CASE WHEN session_count > 0
         THEN total_drive_sec / session_count
         ELSE 0 END                                          AS avg_drive_sec,
    avg_drowsiness,
    GREATEST(0, ROUND(100 - avg_drowsiness * 10))::INT      AS focus_score,
    yawn_sum,
    head_sum,
    tilt_sum,
    brake_sum
  FROM combined
$$;

GRANT EXECUTE ON FUNCTION get_session_metrics(TIMESTAMPTZ) TO authenticated;

-- ── 4. get_analytics_data: include archive for daily_avg and detections ───────
--
-- hourly_avg intentionally stays live-only: the archive stores only daily
-- totals, so hourly block breakdown cannot be reconstructed for purged days.

CREATE OR REPLACE FUNCTION get_analytics_data(
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE SQL
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT json_build_object(

    -- Daily average drowsiness: live telemetry UNION archive daily averages.
    -- The two sets cover non-overlapping date ranges (archive < 7-day cutoff,
    -- live >= cutoff) so UNION ALL is safe with no duplicate days.
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

        UNION ALL

        SELECT
          sa.period_date::TEXT                           AS day,
          COALESCE(sa.avg_drowsiness, 0)::FLOAT         AS avg
        FROM public.stats_archive sa
        WHERE sa.user_id = auth.uid()
          AND sa.period_date < (NOW() - INTERVAL '7 days')::date
          AND (p_since IS NULL OR sa.period_date >= p_since::date)
      ) d
    ),

    -- Hourly averages: live telemetry only (archive has no sub-day breakdown)
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

    -- Detection totals: live + archive
    'detections', (
      WITH live_det AS (
        SELECT
          COALESCE(SUM(t.yawn_count_delta), 0)           AS yawns,
          COALESCE(SUM(t.head_event_count_delta), 0)     AS heads,
          COALESCE(SUM(t.head_tilt_delta), 0)            AS tilts,
          COUNT(CASE WHEN t.sudden_brake THEN 1 END)     AS brakes
        FROM public.driving_sessions s
        LEFT JOIN public.session_telemetry t ON t.session_id = s.id
        WHERE (p_since IS NULL OR s.started_at >= p_since)
      ),
      arch_det AS (
        SELECT
          COALESCE(SUM(yawn_count),  0) AS yawns,
          COALESCE(SUM(head_count),  0) AS heads,
          COALESCE(SUM(tilt_count),  0) AS tilts,
          COALESCE(SUM(brake_count), 0) AS brakes
        FROM public.stats_archive
        WHERE user_id = auth.uid()
          AND period_date < (NOW() - INTERVAL '7 days')::date
          AND (p_since IS NULL OR period_date >= p_since::date)
      )
      SELECT json_build_object(
        'yawns',  l.yawns  + a.yawns,
        'heads',  l.heads  + a.heads,
        'tilts',  l.tilts  + a.tilts,
        'brakes', l.brakes + a.brakes
      )
      FROM live_det l, arch_det a
    )

  )
$$;

GRANT EXECUTE ON FUNCTION get_analytics_data(TIMESTAMPTZ) TO authenticated;
