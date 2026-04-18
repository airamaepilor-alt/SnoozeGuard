-- Auto-purge: retain only 7 days of raw data; aggregate counts into stats_archive

CREATE TABLE IF NOT EXISTS stats_archive (
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_date   date        NOT NULL,
  session_count int         NOT NULL DEFAULT 0,
  total_drive_seconds bigint NOT NULL DEFAULT 0,
  yawn_count    int         NOT NULL DEFAULT 0,
  head_count    int         NOT NULL DEFAULT 0,
  alert_count   int         NOT NULL DEFAULT 0,
  avg_drowsiness numeric(4,2),
  PRIMARY KEY (user_id, period_date)
);

ALTER TABLE stats_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_stats" ON stats_archive FOR ALL USING (auth.uid() = user_id);

-- Function: purge old raw data, aggregating into stats_archive first
CREATE OR REPLACE FUNCTION purge_old_telemetry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff date := (NOW() - INTERVAL '7 days')::date;
BEGIN
  -- Aggregate sessions older than 7 days into stats_archive
  INSERT INTO stats_archive (user_id, period_date, session_count, total_drive_seconds, yawn_count, head_count, alert_count, avg_drowsiness)
  SELECT
    s.user_id,
    DATE(s.started_at)                                        AS period_date,
    COUNT(DISTINCT s.id)                                      AS session_count,
    COALESCE(SUM(EXTRACT(EPOCH FROM (s.ended_at - s.started_at))), 0)::bigint AS total_drive_seconds,
    COALESCE(SUM(t.yawn_count_delta), 0)::int                 AS yawn_count,
    COALESCE(SUM(t.head_event_count_delta), 0)::int           AS head_count,
    COUNT(DISTINCT ae.id)::int                                AS alert_count,
    AVG(t.drowsiness_level)                                   AS avg_drowsiness
  FROM driving_sessions s
  LEFT JOIN session_telemetry t   ON t.session_id = s.id
  LEFT JOIN emergency_alert_events ae ON ae.session_id = s.id
  WHERE DATE(s.started_at) <= cutoff
  GROUP BY s.user_id, DATE(s.started_at)
  ON CONFLICT (user_id, period_date) DO UPDATE SET
    session_count        = stats_archive.session_count        + EXCLUDED.session_count,
    total_drive_seconds  = stats_archive.total_drive_seconds  + EXCLUDED.total_drive_seconds,
    yawn_count           = stats_archive.yawn_count           + EXCLUDED.yawn_count,
    head_count           = stats_archive.head_count           + EXCLUDED.head_count,
    alert_count          = stats_archive.alert_count          + EXCLUDED.alert_count,
    avg_drowsiness       = (stats_archive.avg_drowsiness + EXCLUDED.avg_drowsiness) / 2;

  -- Delete telemetry for old sessions
  DELETE FROM session_telemetry
  WHERE session_id IN (
    SELECT id FROM driving_sessions WHERE DATE(started_at) <= cutoff
  );

  -- Delete old emergency alert events
  DELETE FROM emergency_alert_events
  WHERE DATE(created_at) <= cutoff;

  -- Delete old sessions
  DELETE FROM driving_sessions WHERE DATE(started_at) <= cutoff;

  -- Purge stale SMS rate limit rows (older than today)
  DELETE FROM sms_rate_limit WHERE sent_date < CURRENT_DATE;
END;
$$;

-- Enable pg_cron if available, then schedule daily purge at 2:00 AM UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule('daily-telemetry-purge', '0 2 * * *', 'SELECT purge_old_telemetry()');
  END IF;
END $$;
