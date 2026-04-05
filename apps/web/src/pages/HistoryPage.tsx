import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

type SessionSummary = {
  id: string;
  started_at: string;
  ended_at: string | null;
  device_type: string;
  sampleCount: number;
  avgDrowsiness: number;
  yawnSum: number;
  headSum: number;
  brakeCount: number;
  series: { t: string; level: number }[];
};

type TelemetryRow = {
  id: number;
  recorded_at: string;
  drowsiness_level: number;
  yawn_count_delta: number;
  head_event_count_delta: number;
  sudden_brake: boolean;
  session_id: string;
};

function SessionSparkline({ series }: { series: { t: string; level: number }[] }) {
  if (series.length === 0) return <span className="text-xs text-zinc-600">No samples</span>;
  const w = 120;
  const h = 36;
  const levels = series.map((s) => s.level);
  const maxL = Math.max(10, ...levels);
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const pts = series.map((s, i) => {
    const x = i * step;
    const y = h - (s.level / maxL) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="text-primary" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts.join(" ")} />
    </svg>
  );
}

function WeeklyTrendChart({ points }: { points: { label: string; avg: number }[] }) {
  if (points.every((p) => p.avg === 0)) {
    return <p className="text-xs text-on-surface-variant">No samples in the last 7 days to chart.</p>;
  }
  const w = 360;
  const h = 100;
  const pad = 8;
  const maxL = Math.max(10, ...points.map((p) => p.avg));
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const pts = points.map((p, i) => {
    const x = pad + i * step;
    const y = h - pad - (p.avg / maxL) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <div className="w-full overflow-x-auto">
      <svg width={w} height={h + 28} className="text-primary" aria-label="Average drowsiness by day over the last week">
        <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.join(" ")} />
        {points.map((p, i) => {
          const x = pad + i * step;
          const y = h - pad - (p.avg / maxL) * (h - pad * 2);
          return <circle key={`pt-${i}`} cx={x} cy={y} r="3" fill="currentColor" />;
        })}
        {points.map((p, i) => (
          <text key={`lb-${i}`} x={pad + i * step} y={h + 14} textAnchor="middle" className="fill-on-surface-variant" style={{ fontSize: 9 }}>
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

type HistoryRpcPayload = {
  ok?: boolean;
  sessions?: {
    id: string;
    started_at: string;
    ended_at: string | null;
    device_type: string;
    sample_count: number;
    avg_drowsiness: number;
    yawn_sum: number;
    head_sum: number;
    brake_count: number;
    series: { t: string; level: number }[];
  }[];
  weekly_trend?: { day: string; avg: number; label?: string }[];
  latest_samples?: TelemetryRow[];
  has_more?: boolean;
};

function buildWeeklyTrend(rows: TelemetryRow[]): { label: string; avg: number }[] {
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const d = new Date(r.recorded_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const agg = byDay.get(key) ?? { sum: 0, n: 0 };
    agg.sum += Number(r.drowsiness_level);
    agg.n += 1;
    byDay.set(key, agg);
  }
  const out: { label: string; avg: number }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const agg = byDay.get(key);
    out.push({
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      avg: agg && agg.n ? agg.sum / agg.n : 0,
    });
  }
  return out;
}

function Chip({ children, tone }: { children: string; tone?: "yawn" | "head" | "brake" }) {
  const cls =
    tone === "yawn"
      ? "border border-secondary/30 bg-secondary/10 text-secondary"
      : tone === "head"
        ? "border border-primary/30 bg-primary/10 text-primary"
        : tone === "brake"
          ? "border border-tertiary/30 bg-tertiary/10 text-tertiary"
          : "border border-outline-variant/30 bg-surface-container-high text-on-surface-variant";
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{children}</span>;
}

export function HistoryPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [detailRows, setDetailRows] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tab, setTab] = useState<"sessions" | "samples">("sessions");
  const [weeklyTrend, setWeeklyTrend] = useState<{ label: string; avg: number }[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [rpcNote, setRpcNote] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const tzOffset = -new Date().getTimezoneOffset();

  const loadClientFallback = useCallback(
    async (cancelled: () => boolean) => {
      if (!user?.id) return;
      const { data: sess } = await supabase
        .from("driving_sessions")
        .select("id, started_at, ended_at, device_type")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);
      const ids = (sess ?? []).map((s) => s.id as string);
      if (ids.length === 0) {
        if (!cancelled()) {
          setSessions([]);
          setDetailRows([]);
          setWeeklyTrend([]);
        }
        return;
      }

      const { data: tel, error } = await supabase
        .from("session_telemetry")
        .select("id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, sudden_brake, session_id")
        .in("session_id", ids)
        .order("recorded_at", { ascending: true });

      const bySession = new Map<string, TelemetryRow[]>();
      for (const row of (tel ?? []) as TelemetryRow[]) {
        const list = bySession.get(row.session_id) ?? [];
        list.push(row);
        bySession.set(row.session_id, list);
      }

      const summaries: SessionSummary[] = (sess ?? []).map((s) => {
        const rows = bySession.get(s.id as string) ?? [];
        const n = rows.length;
        const avg = n ? rows.reduce((a, r) => a + Number(r.drowsiness_level), 0) / n : 0;
        const yawnSum = rows.reduce((a, r) => a + (r.yawn_count_delta ?? 0), 0);
        const headSum = rows.reduce((a, r) => a + (r.head_event_count_delta ?? 0), 0);
        const brakeCount = rows.filter((r) => r.sudden_brake).length;
        const series = rows.slice(-40).map((r) => ({ t: r.recorded_at, level: Number(r.drowsiness_level) }));
        return {
          id: s.id as string,
          started_at: s.started_at as string,
          ended_at: (s.ended_at as string | null) ?? null,
          device_type: s.device_type as string,
          sampleCount: n,
          avgDrowsiness: avg,
          yawnSum,
          headSum,
          brakeCount,
          series,
        };
      });

      const { data: latestTel, error: e2 } = await supabase
        .from("session_telemetry")
        .select("id, recorded_at, drowsiness_level, yawn_count_delta, head_event_count_delta, sudden_brake, session_id")
        .in("session_id", ids)
        .order("recorded_at", { ascending: false })
        .limit(80);

      if (!cancelled()) {
        if (!error) setSessions(summaries);
        if (!e2 && latestTel) setDetailRows(latestTel as TelemetryRow[]);
        const allRows = (tel ?? []) as TelemetryRow[];
        setWeeklyTrend(buildWeeklyTrend(allRows));
        setHasMore(false);
      }
    },
    [user?.id],
  );

  const fetchHistory = useCallback(
    async (reset: boolean, isCancelled: () => boolean) => {
      if (!user?.id) return;
      const cur = reset ? null : cursorRef.current;
      if (reset) {
        setLoading(true);
        cursorRef.current = null;
        setRpcNote(null);
      } else {
        setLoadingMore(true);
      }

      const { data: rpcRaw, error: rpcErr } = await supabase.rpc("user_driving_history", {
        p_session_limit: 20,
        p_tz_offset_minutes: tzOffset,
        p_cursor_started_at: cur,
        p_latest_samples_limit: 80,
      });
      if (isCancelled()) return;

      const payload = rpcRaw as HistoryRpcPayload | null;
      const ok = !rpcErr && payload?.ok === true && Array.isArray(payload.sessions);

      if (!ok) {
        await loadClientFallback(isCancelled);
        if (isCancelled()) return;
        if (reset) setRpcNote("Using browser-side history (apply migration 20260404160000 for server pagination).");
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const nextSessions = (payload.sessions ?? []).map((s) => ({
        id: s.id,
        started_at: s.started_at,
        ended_at: s.ended_at,
        device_type: s.device_type,
        sampleCount: Number(s.sample_count) || 0,
        avgDrowsiness: Number(s.avg_drowsiness) || 0,
        yawnSum: Number(s.yawn_sum) || 0,
        headSum: Number(s.head_sum) || 0,
        brakeCount: Number(s.brake_count) || 0,
        series: (s.series ?? []).map((p) => ({ t: p.t, level: Number(p.level) })),
      }));

      if (isCancelled()) return;

      if (reset) setSessions(nextSessions);
      else setSessions((prev) => [...prev, ...nextSessions]);

      setHasMore(Boolean(payload.has_more));
      if (nextSessions.length > 0) {
        cursorRef.current = nextSessions[nextSessions.length - 1].started_at;
      } else if (reset) {
        cursorRef.current = null;
      }

      const wt = (payload.weekly_trend ?? []).map((w) => ({
        label: w.label ?? w.day,
        avg: Number(w.avg) || 0,
      }));
      if (reset) setWeeklyTrend(wt);

      const samples = payload.latest_samples ?? [];
      if (reset && samples.length > 0) {
        setDetailRows(samples as TelemetryRow[]);
      }

      if (!isCancelled()) {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user?.id, tzOffset, loadClientFallback],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchHistory(true, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [user?.id, tzOffset, fetchHistory]);

  const weekLabel = useMemo(() => {
    const now = new Date();
    return `Week of ${now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }, []);

  return (
    <div className="space-y-6 font-body text-on-surface">
      <div>
        <h1 className="font-headline text-2xl font-extrabold text-on-surface">History</h1>
        <p className="text-sm text-on-surface-variant">{weekLabel} — session summaries and latest raw samples.</p>
        {rpcNote ? <p className="mt-2 text-xs text-secondary">{rpcNote}</p> : null}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("sessions")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === "sessions"
                ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Sessions
          </button>
          <button
            type="button"
            onClick={() => setTab("samples")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === "samples"
                ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Latest samples
          </button>
        </div>
      </div>

      {!loading && weeklyTrend.length > 0 ? (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/80 p-4">
          <h2 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">7-day fatigue trend</h2>
          <p className="mb-3 text-xs text-on-surface-variant">Average drowsiness level per calendar day (sessions in this view).</p>
          <WeeklyTrendChart points={weeklyTrend} />
        </section>
      ) : null}

      {loading ? (
        <p className="text-on-surface-variant">Loading…</p>
      ) : tab === "sessions" ? (
        sessions.length === 0 ? (
          <p className="text-on-surface-variant">No sessions yet.</p>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-outline-variant/15 bg-surface-container-low/90 p-4 shadow-sm shadow-black/20">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-on-surface">{new Date(s.started_at).toLocaleString()}</p>
                    <p className="text-xs text-on-surface-variant">
                      {s.device_type} · {s.sampleCount} samples · avg drowsiness {s.avgDrowsiness.toFixed(2)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Chip tone="yawn">{`YAWN +${s.yawnSum}`}</Chip>
                      <Chip tone="head">{`HEAD +${s.headSum}`}</Chip>
                      {s.brakeCount > 0 ? <Chip tone="brake">{`BRAKE ×${s.brakeCount}`}</Chip> : null}
                    </div>
                  </div>
                  <SessionSparkline series={s.series} />
                </div>
              </li>
            ))}
            {hasMore ? (
              <li className="pt-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void fetchHistory(false, () => false)}
                  className="rounded-xl bg-surface-container-high px-4 py-2 text-sm text-on-surface hover:bg-surface-bright disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more sessions"}
                </button>
              </li>
            ) : null}
          </ul>
        )
      ) : detailRows.length === 0 ? (
        <p className="text-on-surface-variant">No telemetry yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant/15 bg-surface-container-low/50">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Yawn Δ</th>
                <th className="px-3 py-2">Head Δ</th>
                <th className="px-3 py-2">Brake</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant/15">
                  <td className="px-3 py-2 text-on-surface">{new Date(r.recorded_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.drowsiness_level}</td>
                  <td className="px-3 py-2">{r.yawn_count_delta}</td>
                  <td className="px-3 py-2">{r.head_event_count_delta}</td>
                  <td className="px-3 py-2">{r.sudden_brake ? "yes" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
