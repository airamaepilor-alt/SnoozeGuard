import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
  peak_hour?: number | null;
  peak_hour_sample_count?: number | null;
  safest_hour?: number | null;
  safest_hour_avg_drowsiness?: number | null;
  caution_hour?: number | null;
  caution_hour_avg_drowsiness?: number | null;
  histogram_hours?: unknown;
  /** Minutes east of UTC used for hour buckets (matches `-new Date().getTimezoneOffset()`). */
  tz_offset_minutes_applied?: number | null;
};

function dashboardFirstName(u: User | null): string {
  if (!u) return "Driver";
  const fn = u.user_metadata?.full_name;
  if (typeof fn === "string" && fn.trim()) return fn.trim().split(/\s+/)[0] ?? "Driver";
  const local = u.email?.split("@")[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "Driver";
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/80 p-3 sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-1 font-headline text-lg font-bold text-on-surface sm:text-xl">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-on-surface-variant/80">{hint}</p> : null}
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
  const hours = parseHistogramUtc(rpc.histogram_hours);
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
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="text-primary" aria-label="Samples by hour">
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

function localHourLabel(h: number | null | undefined) {
  if (h == null || Number.isNaN(h)) return "—";
  return `${h}:00 (device local)`;
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

      const tzOffset = -new Date().getTimezoneOffset();
      const { data: rpcRaw, error: rpcErr } = await supabase.rpc("user_dashboard_metrics", {
        p_session_limit: 40,
        p_tz_offset_minutes: tzOffset,
      });
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
  const hasChart = rpcMetrics
    ? parseHistogramUtc(rpcMetrics.histogram_hours).some((n) => n > 0)
    : telemetry.length > 0;

  const firstName = useMemo(() => dashboardFirstName(user), [user]);
  const focusDisplay = metrics.safeScore != null ? `${metrics.safeScore}` : "—";
  const readyLabel =
    metrics.safeScore != null && metrics.safeScore >= 70 ? "Ready" : metrics.safeScore != null ? "Monitor" : "…";

  return (
    <div className="mx-auto max-w-lg space-y-10 lg:max-w-5xl">
      <div className="flex flex-col items-center text-center lg:max-w-lg lg:items-start lg:text-left">
        <div className="relative mb-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/25 bg-primary-container sg-status-pulse">
            <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              shield_with_heart
            </span>
          </div>
          <div className="absolute -bottom-2 -right-2 rounded-full bg-primary px-3 py-1 font-headline text-[10px] font-bold uppercase tracking-widest text-primary-container">
            {readyLabel}
          </div>
        </div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Vigilance system active</p>
        <h1 className="font-headline text-3xl font-extrabold leading-tight text-on-surface">
          {timeGreeting()}, <span className="text-primary">{firstName}</span>
        </h1>
        <p className="mt-3 text-sm text-on-surface-variant">
          {rpcMetrics ? (
            <>
              Metrics from <strong className="text-on-surface">Supabase</strong>{" "}
              <code className="text-primary/80">user_dashboard_metrics</code> (40 sessions, local hour buckets).
            </>
          ) : (
            <>
              <strong className="text-on-surface">Browser-side</strong> aggregates — apply dashboard RPC migrations for server analytics.
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-on-surface-variant/90">
          <span className={online ? "text-emerald-400" : "text-secondary"}>{online ? "Online" : "Offline"}</span>
          {rpcFailed && !rpcMetrics ? <span className="text-secondary"> · RPC fallback</span> : null}
          {pendingLocal > 0 ? <span className="text-secondary"> · {pendingLocal} queued in IndexedDB</span> : null}
        </p>
      </div>

      <Link
        to="/drive"
        className="group flex h-20 w-full max-w-md items-center justify-center gap-4 rounded-xl bg-gradient-to-r from-primary to-on-primary-container shadow-lg shadow-primary/10 transition-all duration-200 active:scale-[0.98] lg:max-w-lg"
      >
        <span className="material-symbols-outlined text-3xl text-on-primary transition-transform group-hover:scale-110" style={{ fontVariationSettings: "'FILL' 1" }}>
          play_circle
        </span>
        <span className="font-headline text-xl font-extrabold tracking-tight text-on-primary">Start driving</span>
      </Link>

      <div className="grid grid-cols-2 gap-4 lg:max-w-3xl">
        <div className="sg-glass-panel relative col-span-2 overflow-hidden rounded-2xl border border-primary/10 p-6">
          <div className="mb-4 flex justify-between gap-4">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Focus score (heuristic)</p>
              <h2 className="font-headline text-5xl font-black text-primary">
                {focusDisplay}
                {metrics.safeScore != null ? <span className="text-xl text-on-primary-container">%</span> : null}
              </h2>
            </div>
            <div className="rounded-lg bg-primary/10 p-2">
              <span className="material-symbols-outlined text-primary">analytics</span>
            </div>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${metrics.safeScore != null ? Math.min(100, Math.max(4, metrics.safeScore)) : 8}%` }}
            />
          </div>
          <p className="mt-4 text-xs text-on-surface/60">
            Based on average drowsiness in your telemetry window. Higher is more alert — tune thresholds in Admin if needed.
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
          <span className="material-symbols-outlined mb-3 text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified_user
          </span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Samples (7d trail)</p>
          <p className="font-headline text-2xl font-bold text-on-surface">{metrics.samplesWeek}</p>
          <p className="mt-2 text-[10px] font-bold text-secondary">Telemetry in trailing week</p>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
          <span className="material-symbols-outlined mb-3 text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
            warning
          </span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Alerts (7 days)</p>
          <p className="font-headline text-2xl font-bold text-on-surface">{alerts7dCount === null ? "—" : String(alerts7dCount)}</p>
          <p className="mt-2 text-[10px] font-bold text-tertiary">From alert_events</p>
        </div>

        <div className="col-span-2 rounded-2xl border border-outline-variant/15 bg-surface-container-high p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Overview (BRD §12)</p>
          {loading ? (
            <p className="text-on-surface-variant">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Total sessions"
                value={sessionCountTotal != null ? String(sessionCountTotal) : "—"}
                hint="All time"
              />
              <StatCard
                label="Avg drowsiness"
                value={metrics.avgDrowsy}
                hint={rpcMetrics ? "Server window" : "Browser window"}
              />
              <StatCard label="Yawn Δ sum" value={String(metrics.yawns)} />
              <StatCard label="Head Δ sum" value={String(metrics.head)} />
              <StatCard
                label="L6+ samples"
                value={`${metrics.l6 + metrics.l7 + metrics.l8}`}
                hint={`L7+: ${metrics.l7 + metrics.l8} · L8+: ${metrics.l8}`}
              />
              <StatCard
                label="Peak hour"
                value={metrics.peakC > 0 ? `${metrics.peakHour}:00` : "—"}
                hint={metrics.peakC > 0 ? `${metrics.peakC} samples` : undefined}
              />
            </div>
          )}
          <p className="mt-3 text-[10px] text-on-surface-variant">
            Time-of-day trends: see{" "}
            <Link to="/history" className="font-bold text-primary hover:underline">
              History
            </Link>
            .
          </p>
        </div>
      </div>

      {rpcMetrics && (rpcMetrics.sample_count ?? 0) > 0 ? (
        <section className="grid gap-4 lg:max-w-3xl lg:grid-cols-3">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/25 p-5 lg:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/90">Safe hours insight</p>
            <p className="mt-2 text-sm leading-relaxed text-on-surface/90">
              Lowest avg drowsiness around <strong className="text-emerald-300">{localHourLabel(rpcMetrics.safest_hour)}</strong>
              {rpcMetrics.safest_hour_avg_drowsiness != null ? (
                <>
                  {" "}
                  (avg <span className="font-mono">{Number(rpcMetrics.safest_hour_avg_drowsiness).toFixed(2)}</span>).
                </>
              ) : null}
            </p>
          </div>
          <div className="rounded-2xl border border-secondary/30 bg-secondary/5 p-5 lg:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Higher-load window</p>
            <p className="mt-2 text-sm leading-relaxed text-on-surface/90">
              Highest avg around <strong className="text-secondary">{localHourLabel(rpcMetrics.caution_hour)}</strong>
              {rpcMetrics.caution_hour_avg_drowsiness != null ? (
                <>
                  {" "}
                  (avg <span className="font-mono">{Number(rpcMetrics.caution_hour_avg_drowsiness).toFixed(2)}</span>).
                </>
              ) : null}
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-surface-container/80 p-5 lg:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Drive time (window)</p>
            <p className="mt-2 font-headline text-3xl font-bold text-on-surface">
              {formatDriveDuration(Number(rpcMetrics.total_drive_seconds) || 0)}
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">
              Ended sessions in latest {rpcMetrics.window_session_count ?? 40} (server).
            </p>
          </div>
        </section>
      ) : null}

      {!loading && hasChart ? (
        <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/60 p-4 lg:max-w-3xl">
          <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {rpcMetrics ? "Time-of-day sample density" : "Time-of-day sample density (local)"}
          </h2>
          <p className="mb-3 text-xs text-on-surface-variant">
            {rpcMetrics
              ? "Server buckets use your browser timezone offset."
              : "Bucketed by your browser local hour."}
          </p>
          <MiniHistogram counts={metrics.hours} />
        </section>
      ) : null}

      <section className="lg:max-w-3xl">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Recent sessions</h2>
        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-on-surface-variant">No sessions yet. Start one from Drive.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-outline-variant/15 bg-surface-container-low/90 px-4 py-3 shadow-sm shadow-black/20"
              >
                <div className="flex justify-between gap-2 text-sm">
                  <span className="text-on-surface">{new Date(s.started_at).toLocaleString()}</span>
                  <span className="text-on-surface-variant">{s.device_type}</span>
                </div>
                <div className="text-xs text-on-surface-variant">
                  {s.ended_at ? `Ended ${new Date(s.ended_at).toLocaleString()}` : "Active"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
