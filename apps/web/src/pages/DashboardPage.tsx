import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { supabase } from "../lib/supabase";
import { countPendingTelemetryForUser } from "../lib/offline/db";
import { flushOutbox } from "../lib/offline/sync";

type SessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  device_type: string;
};

type TelemetryLite = {
  drowsiness_level: number;
  yawn_count_delta: number;
  head_event_count_delta: number;
  recorded_at: string;
};

/** Matches `user_dashboard_metrics` JSON from Supabase (migration `20260404120000`). */
type DashboardRpcPayload = {
  ok?: boolean;
  reason?: string;
  session_count_total?: number;
  window_session_count?: number;
  sample_count?: number;
  avg_drowsiness?: number;
  yawn_delta_sum?: number;
  head_delta_sum?: number;
  l6_count?: number;
  l7_count?: number;
  l8_count?: number;
  newest_recorded_at?: string | null;
  samples_7d_trail?: number;
  total_drive_seconds?: number;
  focus_score?: number | null;
  peak_hour_utc?: number | null;
  peak_hour_sample_count?: number | null;
  safest_hour_utc?: number | null;
  safest_hour_avg_drowsiness?: number | null;
  caution_hour_utc?: number | null;
  caution_hour_avg_drowsiness?: number | null;
  histogram_utc_hours?: unknown;
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function hourHistogram(rows: TelemetryLite[]): number[] {
  const h = Array.from({ length: 24 }, () => 0);
  for (const r of rows) {
    const hr = new Date(r.recorded_at).getHours();
    if (hr >= 0 && hr < 24) h[hr] += 1;
  }
  return h;
}

function parseHistogramUtc(raw: unknown): number[] {
  if (!Array.isArray(raw)) return Array.from({ length: 24 }, () => 0);
  return raw.map((v) => (typeof v === "number" ? v : Number(v) || 0));
}

function metricsFromClientTelemetry(telemetry: TelemetryLite[]) {
  if (telemetry.length === 0) {
    return {
      avgDrowsy: "—",
      yawns: 0,
      head: 0,
      l6: 0,
      l7: 0,
      l8: 0,
      hours: hourHistogram([]),
      peakHour: 0,
      peakC: 0,
      samplesWeek: 0,
      safeScore: 0 as number | null,
    };
  }
  const sum = telemetry.reduce((a, r) => a + Number(r.drowsiness_level), 0);
  const yawns = telemetry.reduce((a, r) => a + (r.yawn_count_delta ?? 0), 0);
  const head = telemetry.reduce((a, r) => a + (r.head_event_count_delta ?? 0), 0);
  let l6 = 0;
  let l7 = 0;
  let l8 = 0;
  for (const r of telemetry) {
    const lv = Number(r.drowsiness_level);
    if (lv >= 8) l8 += 1;
    else if (lv >= 7) l7 += 1;
    else if (lv >= 6) l6 += 1;
  }
  const hours = hourHistogram(telemetry);
  let peakHour = 0;
  let peakC = 0;
  hours.forEach((c, i) => {
    if (c > peakC) {
      peakC = c;
      peakHour = i;
    }
  });
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const newestTs = telemetry.reduce((m, r) => Math.max(m, new Date(r.recorded_at).getTime()), 0);
  const cutoff = newestTs - weekMs;
  const samplesWeek = telemetry.filter((r) => new Date(r.recorded_at).getTime() >= cutoff).length;
  const avgNum = sum / telemetry.length;
  const safeScore = Math.max(0, Math.min(100, Math.round(100 - avgNum * 9)));
  return {
    avgDrowsy: avgNum.toFixed(2),
    yawns,
    head,
    l6,
    l7,
    l8,
    hours,
    peakHour,
    peakC,
    samplesWeek,
    safeScore,
  };
}

function metricsFromRpc(rpc: DashboardRpcPayload) {
  const hours = parseHistogramUtc(rpc.histogram_utc_hours);
  let peakHour = 0;
  let peakC = 0;
  hours.forEach((c, i) => {
    if (c > peakC) {
      peakC = c;
      peakHour = i;
    }
  });
  const avg = Number(rpc.avg_drowsiness) || 0;
  const focus = rpc.focus_score ?? (rpc.sample_count ? Math.max(0, Math.min(100, Math.round(100 - avg * 9))) : null);
  return {
    avgDrowsy: (rpc.sample_count ?? 0) > 0 ? avg.toFixed(2) : "—",
    yawns: Number(rpc.yawn_delta_sum) || 0,
    head: Number(rpc.head_delta_sum) || 0,
    l6: Number(rpc.l6_count) || 0,
    l7: Number(rpc.l7_count) || 0,
    l8: Number(rpc.l8_count) || 0,
    hours,
    peakHour,
    peakC,
    samplesWeek: Number(rpc.samples_7d_trail) || 0,
    safeScore: focus,
  };
}

function MiniHistogram({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const w = 320;
  const h = 80;
  const barW = w / 24;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="text-sky-500" aria-label="Samples by hour">
      {counts.map((c, i) => {
        const bh = (c / max) * (h - 8);
        return (
          <rect
            key={i}
            x={i * barW + 1}
            y={h - bh - 4}
            width={barW - 2}
            height={Math.max(1, bh)}
            fill="currentColor"
            opacity={0.75}
          />
        );
      })}
    </svg>
  );
}

function formatDriveDuration(totalSec: number) {
  if (totalSec <= 0) return "—";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function utcHourLabel(h: number | null | undefined) {
  if (h == null || Number.isNaN(h)) return "—";
  return `${h}:00 UTC`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryLite[]>([]);
  const [rpcMetrics, setRpcMetrics] = useState<DashboardRpcPayload | null>(null);
  const [rpcFailed, setRpcFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingLocal, setPendingLocal] = useState(0);
  const [clientSessionCount, setClientSessionCount] = useState<number | null>(null);
  const [alerts7dCount, setAlerts7dCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      if (online) await flushOutbox(supabase, user.id);

      const { data: rpcRaw, error: rpcErr } = await supabase.rpc("user_dashboard_metrics", { p_session_limit: 40 });
      const rpcParsed = rpcRaw as DashboardRpcPayload | null;
      const rpcOk = !rpcErr && rpcParsed?.ok === true;
      if (!cancelled) {
        setRpcFailed(Boolean(rpcErr) || !rpcOk);
        setRpcMetrics(rpcOk ? rpcParsed : null);
      }

      const { data: recent } = await supabase
        .from("driving_sessions")
        .select("id, started_at, ended_at, device_type")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(5);

      let tel: TelemetryLite[] = [];
      if (!rpcOk) {
        const { count: sc } = await supabase
          .from("driving_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (!cancelled) setClientSessionCount(sc ?? null);

        const { data: win } = await supabase
          .from("driving_sessions")
          .select("id")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(40);
        const sessionIds = (win ?? []).map((s) => s.id as string);
        if (sessionIds.length > 0) {
          const { data: telData, error: e3 } = await supabase
            .from("session_telemetry")
            .select("drowsiness_level, yawn_count_delta, head_event_count_delta, recorded_at")
            .in("session_id", sessionIds)
            .order("recorded_at", { ascending: false })
            .limit(2500);
          if (!e3 && telData) tel = telData as TelemetryLite[];
        }
      } else if (!cancelled) {
        setClientSessionCount(null);
      }

      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: alertC, error: alertErr } = await supabase
        .from("alert_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", weekAgo);

      if (!cancelled) {
        if (recent) setSessions(recent as SessionRow[]);
        setTelemetry(tel);
        setPendingLocal(await countPendingTelemetryForUser(user.id));
        setAlerts7dCount(alertErr ? null : alertC ?? 0);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, online]);

  const metrics = useMemo(() => {
    if (rpcMetrics) return metricsFromRpc(rpcMetrics);
    return metricsFromClientTelemetry(telemetry);
  }, [rpcMetrics, telemetry]);

  const sessionCountTotal = rpcMetrics?.session_count_total ?? clientSessionCount;
  const hasChart = rpcMetrics ? parseHistogramUtc(rpcMetrics.histogram_utc_hours).some((n) => n > 0) : telemetry.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400">
          {rpcMetrics ? (
            <>
              Overview metrics are computed on <strong className="text-zinc-300">Supabase</strong> via{" "}
              <code className="text-zinc-500">user_dashboard_metrics</code> (latest 40 sessions). Histogram hours are{" "}
              <strong className="text-zinc-300">UTC</strong>—compare to your local timezone.
            </>
          ) : (
            <>
              RPC unavailable or migration not applied—using <strong className="text-zinc-300">browser-side</strong> aggregates. Apply{" "}
              <code className="text-zinc-500">20260404120000_user_dashboard_metrics.sql</code> for server-side analytics at scale.
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Browser: <span className={online ? "text-emerald-400" : "text-amber-400"}>{online ? "online" : "offline"}</span>
          {rpcFailed && !rpcMetrics ? <span className="text-amber-300"> · server metrics fallback active</span> : null}
          {pendingLocal > 0 ? (
            <span className="text-amber-300"> · {pendingLocal} telemetry sample(s) waiting in IndexedDB</span>
          ) : null}
        </p>
      </div>
      <Link
        to="/drive"
        className="inline-flex w-full max-w-md items-center justify-center rounded-xl bg-sky-600 py-4 text-lg font-semibold text-white hover:bg-sky-500"
      >
        Start driving
      </Link>

      {rpcMetrics && (rpcMetrics.sample_count ?? 0) > 0 ? (
        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-5 md:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/90">Safe hours insight</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Your <strong className="text-zinc-100">lowest average drowsiness</strong> in this window clustered around{" "}
              <strong className="text-emerald-300">{utcHourLabel(rpcMetrics.safest_hour_utc)}</strong>
              {rpcMetrics.safest_hour_avg_drowsiness != null ? (
                <>
                  {" "}
                  (avg level <span className="font-mono text-zinc-200">{Number(rpcMetrics.safest_hour_avg_drowsiness).toFixed(2)}</span>).
                </>
              ) : null}{" "}
              If that aligns with your local schedule, similar departure times may feel easier to sustain—still validate with your own sleep data.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-900/50 bg-amber-950/15 p-5 md:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/90">Higher-load window</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              The <strong className="text-zinc-100">highest average drowsiness</strong> (where we had enough samples) was around{" "}
              <strong className="text-amber-300">{utcHourLabel(rpcMetrics.caution_hour_utc)}</strong>
              {rpcMetrics.caution_hour_avg_drowsiness != null ? (
                <>
                  {" "}
                  (avg <span className="font-mono text-zinc-200">{Number(rpcMetrics.caution_hour_avg_drowsiness).toFixed(2)}</span>).
                </>
              ) : null}{" "}
              Consider planning breaks or handoffs near that part of the day (UTC).
            </p>
          </div>
          <div className="rounded-2xl border border-sky-900/40 bg-[#0b1326]/80 p-5 md:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400/90">Drive time in window</p>
            <p className="mt-2 text-3xl font-bold text-white">{formatDriveDuration(Number(rpcMetrics.total_drive_seconds) || 0)}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Sum of <code className="text-zinc-600">ended_at - started_at</code> for ended sessions in your latest {rpcMetrics.window_session_count ?? 40}{" "}
              sessions (server-side).
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Focus score (heuristic):{" "}
              <span className="font-mono text-sky-200">{metrics.safeScore != null ? metrics.safeScore : "—"}</span>
              /100 — same formula as before, now computed in SQL when RPC is used.
            </p>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Overview (BRD §12)</h2>
        {loading ? (
          <p className="text-zinc-400">Loading…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total driving sessions"
              value={sessionCountTotal != null ? String(sessionCountTotal) : "—"}
              hint={rpcMetrics ? "All sessions for your account" : "Counted in browser via Supabase"}
            />
            <StatCard
              label="Avg drowsiness (window)"
              value={metrics.avgDrowsy}
              hint={rpcMetrics ? "Server: samples in latest 40 sessions" : "Client: local browser aggregation"}
            />
            <StatCard
              label="Samples (7-day trail)"
              value={String(metrics.samplesWeek)}
              hint={rpcMetrics ? "Server: from newest sample timestamp" : "Client: trailing window from newest sample"}
            />
            <StatCard
              label={rpcMetrics ? "Peak sample hour (UTC)" : "Peak sample hour (local)"}
              value={metrics.peakC > 0 ? `${metrics.peakHour}:00` : "—"}
              hint={metrics.peakC > 0 ? `${metrics.peakC} samples` : "Not enough data"}
            />
            <StatCard
              label="Focus score (heuristic)"
              value={metrics.safeScore != null ? String(metrics.safeScore) : "—"}
              hint="100 − 9×avg level (0–100)"
            />
            <StatCard label="Yawn Δ sum" value={String(metrics.yawns)} />
            <StatCard label="Head movement Δ sum" value={String(metrics.head)} />
            <StatCard
              label="High drowsiness samples"
              value={`L6+: ${metrics.l6 + metrics.l7 + metrics.l8}`}
              hint={`L7+: ${metrics.l7 + metrics.l8} · L8+: ${metrics.l8}`}
            />
            <StatCard
              label="Alerts fired (7 days)"
              value={alerts7dCount === null ? "—" : String(alerts7dCount)}
              hint="Rows in alert_events (requires migration 20260404130000)"
            />
          </div>
        )}
      </section>

      {!loading && hasChart ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {rpcMetrics ? "Time-of-day sample density (UTC)" : "Time-of-day sample density (local)"}
          </h2>
          <p className="mb-3 text-xs text-zinc-500">
            {rpcMetrics
              ? "Bucketed by the hour of `recorded_at` in UTC on the server."
              : "Bucketed by your browser's local hour."}
          </p>
          <MiniHistogram counts={metrics.hours} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Recent sessions</h2>
        {loading ? (
          <p className="text-zinc-400">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-zinc-400">No sessions yet. Start one from Drive.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="text-zinc-200">{new Date(s.started_at).toLocaleString()}</span>
                  <span className="text-zinc-500">{s.device_type}</span>
                </div>
                <div className="text-xs text-zinc-500">{s.ended_at ? `Ended ${new Date(s.ended_at).toLocaleString()}` : "Active"}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
