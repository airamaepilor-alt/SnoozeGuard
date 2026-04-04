import { useEffect, useMemo, useState } from "react";
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
    <svg width={w} height={h} className="text-sky-400" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts.join(" ")} />
    </svg>
  );
}

function WeeklyTrendChart({ points }: { points: { label: string; avg: number }[] }) {
  if (points.every((p) => p.avg === 0)) {
    return <p className="text-xs text-zinc-500">No samples in the last 7 days to chart.</p>;
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
      <svg width={w} height={h + 28} className="text-sky-400" aria-label="Average drowsiness by day over the last week">
        <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.join(" ")} />
        {points.map((p, i) => {
          const x = pad + i * step;
          const y = h - pad - (p.avg / maxL) * (h - pad * 2);
          return <circle key={`pt-${i}`} cx={x} cy={y} r="3" fill="currentColor" />;
        })}
        {points.map((p, i) => (
          <text key={`lb-${i}`} x={pad + i * step} y={h + 14} textAnchor="middle" className="fill-zinc-500" style={{ fontSize: 9 }}>
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

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
      ? "bg-amber-900/50 text-amber-200"
      : tone === "head"
        ? "bg-violet-900/50 text-violet-200"
        : tone === "brake"
          ? "bg-red-900/50 text-red-200"
          : "bg-zinc-800 text-zinc-300";
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{children}</span>;
}

export function HistoryPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [detailRows, setDetailRows] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"sessions" | "samples">("sessions");
  const [weeklyTrend, setWeeklyTrend] = useState<{ label: string; avg: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase
        .from("driving_sessions")
        .select("id, started_at, ended_at, device_type")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);
      const ids = (sess ?? []).map((s) => s.id as string);
      if (ids.length === 0) {
        if (!cancelled) {
          setSessions([]);
          setDetailRows([]);
          setWeeklyTrend([]);
          setLoading(false);
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

      if (!cancelled) {
        if (!error) setSessions(summaries);
        if (!e2 && latestTel) setDetailRows(latestTel as TelemetryRow[]);
        const allRows = (tel ?? []) as TelemetryRow[];
        setWeeklyTrend(buildWeeklyTrend(allRows));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const weekLabel = useMemo(() => {
    const now = new Date();
    return `Week of ${now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">History</h1>
        <p className="text-zinc-400">{weekLabel} — session summaries and latest raw samples.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("sessions")}
            className={`rounded-lg px-3 py-1 text-sm ${tab === "sessions" ? "bg-sky-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
          >
            Sessions
          </button>
          <button
            type="button"
            onClick={() => setTab("samples")}
            className={`rounded-lg px-3 py-1 text-sm ${tab === "samples" ? "bg-sky-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
          >
            Latest samples
          </button>
        </div>
      </div>

      {!loading && weeklyTrend.length > 0 ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">7-day fatigue trend</h2>
          <p className="mb-3 text-xs text-zinc-500">Average drowsiness level per calendar day (sessions loaded in this view).</p>
          <WeeklyTrendChart points={weeklyTrend} />
        </section>
      ) : null}

      {loading ? (
        <p className="text-zinc-400">Loading…</p>
      ) : tab === "sessions" ? (
        sessions.length === 0 ? (
          <p className="text-zinc-400">No sessions yet.</p>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{new Date(s.started_at).toLocaleString()}</p>
                    <p className="text-xs text-zinc-500">
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
          </ul>
        )
      ) : detailRows.length === 0 ? (
        <p className="text-zinc-400">No telemetry yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-500">
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
                <tr key={r.id} className="border-t border-zinc-800">
                  <td className="px-3 py-2 text-zinc-300">{new Date(r.recorded_at).toLocaleString()}</td>
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
