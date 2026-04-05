-- Paginated driving history + bounded telemetry for web/mobile (FR-11 scale).

create or replace function public.user_driving_history(
  p_session_limit integer default 20,
  p_tz_offset_minutes integer default 0,
  p_cursor_started_at timestamptz default null,
  p_latest_samples_limit integer default 80
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with
  params as (
    select
      auth.uid() as uid,
      greatest(1, least(coalesce(p_session_limit, 20), 100))::int as lim,
      coalesce(p_tz_offset_minutes, 0)::int as tz_off,
      p_cursor_started_at as cur,
      greatest(10, least(coalesce(p_latest_samples_limit, 80), 500))::int as sample_lim
  ),
  recent as (
    select ds.id, ds.started_at, ds.ended_at, ds.device_type
    from driving_sessions ds
    cross join params p
    where ds.user_id = p.uid
      and (p.cur is null or ds.started_at < p.cur)
    order by ds.started_at desc
    limit (select lim from params)
  ),
  recent_ids as (
    select id from recent
  ),
  stats as (
    select
      t.session_id,
      count(*)::bigint as sample_count,
      avg(t.drowsiness_level)::numeric as avg_drowsiness,
      coalesce(sum(t.yawn_count_delta), 0)::bigint as yawn_sum,
      coalesce(sum(t.head_event_count_delta), 0)::bigint as head_sum,
      count(*) filter (where t.sudden_brake)::bigint as brake_count
    from session_telemetry t
    where t.session_id in (select id from recent_ids)
    group by t.session_id
  ),
  ranked as (
    select
      t.session_id,
      t.recorded_at,
      t.drowsiness_level,
      row_number() over (partition by t.session_id order by t.recorded_at desc) as rn
    from session_telemetry t
    where t.session_id in (select id from recent_ids)
  ),
  series_rows as (
    select session_id, recorded_at, drowsiness_level
    from ranked
    where rn <= 40
  ),
  series_agg as (
    select
      session_id,
      jsonb_agg(
        jsonb_build_object('t', recorded_at, 'level', drowsiness_level)
        order by recorded_at
      ) as series
    from series_rows
    group by session_id
  ),
  sessions_row as (
    select
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', r.id,
              'started_at', r.started_at,
              'ended_at', r.ended_at,
              'device_type', r.device_type,
              'sample_count', coalesce(st.sample_count, 0),
              'avg_drowsiness', round(coalesce(st.avg_drowsiness, 0)::numeric, 4),
              'yawn_sum', coalesce(st.yawn_sum, 0),
              'head_sum', coalesce(st.head_sum, 0),
              'brake_count', coalesce(st.brake_count, 0),
              'series', coalesce(sg.series, '[]'::jsonb)
            )
            order by r.started_at desc
          )
          from recent r
          left join stats st on st.session_id = r.id
          left join series_agg sg on sg.session_id = r.id
        ),
        '[]'::jsonb
      ) as sessions_arr,
      (select min(started_at) from recent) as oldest_started
  ),
  has_more as (
    select exists (
      select 1
      from driving_sessions ds
      cross join params p
      cross join sessions_row sr
      where ds.user_id = p.uid
        and sr.oldest_started is not null
        and ds.started_at < sr.oldest_started
    ) as hm
  ),
  bounds as (
    select
      ((now() at time zone 'utc') + (p.tz_off * interval '1 minute'))::date as end_day
    from params p
  ),
  day_series as (
    select ((b.end_day - ((6 - n) || ' days')::interval))::date as d
    from bounds b
    cross join generate_series(0, 6) as gs(n)
  ),
  tel_local_days as (
    select
      t.drowsiness_level,
      ((t.recorded_at at time zone 'utc') + (p.tz_off * interval '1 minute'))::date as local_day
    from session_telemetry t
    cross join params p
    inner join driving_sessions ds on ds.id = t.session_id and ds.user_id = p.uid
    where t.session_id in (select id from recent_ids)
  ),
  agg_days as (
    select local_day, avg(drowsiness_level)::numeric as avgd
    from tel_local_days
    group by local_day
  ),
  weekly_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'day', ds.d::text,
          'avg', coalesce(round(a.avgd::numeric, 4), 0),
          'label', trim(to_char(ds.d, 'Dy'))
        )
        order by ds.d
      ),
      '[]'::jsonb
    ) as arr
    from day_series ds
    left join agg_days a on a.local_day = ds.d
  ),
  latest_samples as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'recorded_at', x.recorded_at,
          'drowsiness_level', x.drowsiness_level,
          'yawn_count_delta', x.yawn_count_delta,
          'head_event_count_delta', x.head_event_count_delta,
          'sudden_brake', x.sudden_brake,
          'session_id', x.session_id
        )
        order by x.recorded_at desc
      ),
      '[]'::jsonb
    ) as arr
    from (
      select t.id, t.recorded_at, t.drowsiness_level, t.yawn_count_delta, t.head_event_count_delta,
             t.sudden_brake, t.session_id
      from session_telemetry t
      where t.session_id in (select id from recent_ids)
      order by t.recorded_at desc
      limit (select sample_lim from params)
    ) x
  )
  select
    case
      when (select uid from params) is null then
        jsonb_build_object('ok', false, 'reason', 'not_authenticated')
      else
        jsonb_build_object(
          'ok', true,
          'sessions', (select sessions_arr from sessions_row),
          'weekly_trend', (select arr from weekly_json),
          'latest_samples', (select arr from latest_samples),
          'has_more', (select hm from has_more)
        )
    end
$$;

grant execute on function public.user_driving_history(integer, integer, timestamptz, integer) to authenticated;

comment on function public.user_driving_history(integer, integer, timestamptz, integer) is
  'History page payload: paginated sessions with per-session stats + sparkline series, weekly trend in local calendar days, and capped latest samples.';
