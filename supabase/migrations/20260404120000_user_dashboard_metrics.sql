-- Server-side dashboard aggregates (FR-11 at scale): single RPC for the signed-in driver.
-- Histogram / “safe hour” hours are **UTC** (document in UI). Pass client offset later if needed.

create or replace function public.user_dashboard_metrics(p_session_limit integer default 40)
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
      greatest(1, least(coalesce(p_session_limit, 40), 200))::int as lim
  ),
  recent as (
    select ds.id, ds.started_at, ds.ended_at
    from driving_sessions ds
    cross join params p
    where ds.user_id = p.uid
    order by ds.started_at desc
    limit (select lim from params)
  ),
  tel as (
    select
      t.drowsiness_level,
      t.yawn_count_delta,
      t.head_event_count_delta,
      t.recorded_at,
      t.sudden_brake
    from session_telemetry t
    inner join recent r on r.id = t.session_id
  ),
  session_count as (
    select count(*)::bigint as c
    from driving_sessions ds
    cross join params p
    where ds.user_id = p.uid
  ),
  ag as (
    select
      count(*)::bigint as sample_count,
      coalesce(avg(drowsiness_level), 0)::numeric as avg_drowsiness,
      coalesce(sum(yawn_count_delta), 0)::bigint as yawn_sum,
      coalesce(sum(head_event_count_delta), 0)::bigint as head_sum,
      count(*) filter (where drowsiness_level >= 6 and drowsiness_level < 7)::bigint as l6,
      count(*) filter (where drowsiness_level >= 7 and drowsiness_level < 8)::bigint as l7,
      count(*) filter (where drowsiness_level >= 8)::bigint as l8,
      max(recorded_at) as newest
    from tel
  ),
  drive_secs as (
    select coalesce(sum(extract(epoch from (r.ended_at - r.started_at)))::bigint, 0) as secs
    from recent r
    where r.ended_at is not null and r.ended_at > r.started_at
  ),
  hourly as (
    select
      (extract(hour from recorded_at at time zone 'utc'))::int as hr,
      count(*)::bigint as cnt,
      avg(drowsiness_level)::numeric as avgd
    from tel
    group by 1
  ),
  peak as (
    select hr, cnt from hourly order by cnt desc nulls last limit 1
  ),
  safest as (
    select hr, avgd from hourly where cnt >= 2 order by avgd asc nulls last limit 1
  ),
  caution as (
    select hr, avgd from hourly where cnt >= 2 order by avgd desc nulls last limit 1
  ),
  trail as (
    select count(*)::bigint as c
    from tel t
    cross join ag
    where ag.newest is not null
      and t.recorded_at >= (ag.newest - interval '7 days')
  ),
  hist as (
    select coalesce(jsonb_agg(cnt order by hr), '[]'::jsonb) as arr
    from (
      select s.hr, coalesce(h.cnt, 0::bigint) as cnt
      from generate_series(0, 23) as s(hr)
      left join hourly h on h.hr = s.hr
    ) q
  )
  select
    case
      when p.uid is null then
        jsonb_build_object('ok', false, 'reason', 'not_authenticated')
      else
        jsonb_build_object(
          'ok', true,
          'session_count_total', (select c from session_count),
          'window_session_count', (select count(*)::bigint from recent),
          'sample_count', ag.sample_count,
          'avg_drowsiness', round(ag.avg_drowsiness::numeric, 4),
          'yawn_delta_sum', ag.yawn_sum,
          'head_delta_sum', ag.head_sum,
          'l6_count', ag.l6,
          'l7_count', ag.l7,
          'l8_count', ag.l8,
          'newest_recorded_at', ag.newest,
          'samples_7d_trail', (select c from trail),
          'total_drive_seconds', (select secs from drive_secs),
          'focus_score',
            case
              when ag.sample_count > 0 then
                greatest(0, least(100, round(100 - ag.avg_drowsiness * 9)::int))
              else null::int
            end,
          'peak_hour_utc', (select hr from peak),
          'peak_hour_sample_count', (select cnt from peak),
          'safest_hour_utc', (select hr from safest),
          'safest_hour_avg_drowsiness', (select round(avgd::numeric, 4) from safest),
          'caution_hour_utc', (select hr from caution),
          'caution_hour_avg_drowsiness', (select round(avgd::numeric, 4) from caution),
          'histogram_utc_hours', (select arr from hist)
        )
    end
  from params p
  cross join ag
$$;

grant execute on function public.user_dashboard_metrics(integer) to authenticated;

comment on function public.user_dashboard_metrics(integer) is
  'Aggregated telemetry for auth.uid() over the N most recent driving sessions (default 40). Hours are UTC.';
