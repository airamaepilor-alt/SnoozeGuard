import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { supabase } from "../lib/supabase";
import { countPendingTelemetryForUser } from "../lib/offline/db";
import { flushOutbox } from "../lib/offline/sync";
import { logger } from "../lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

// Same filter options as mobile HomeScreen
const FILTER_OPTIONS = [
  { label: "1 Week", days: 7 },
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "All Time", days: 0 },
] as const;

type DashboardMetrics = {
  sessionCount: number;
  totalDriveSec: number;
  avgDriveSec: number;
  avgDrowsiness: number;
  focusScore: number | null;
  drowsyEvents: number;
  yawnSum: number;
  headSum: number;
  tiltSum: number;
  brakeSum: number;
};

type SessionIncident = {
  id: string;
  started_at: string;
  peak_drowsiness: number;
  avg_drowsiness: number;
  duration_sec: number;
};

type SessionDay = {
  date: string;
  count: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstName(u: User | null): string {
  if (!u) return "Driver";
  const fn = u.user_metadata?.full_name;
  if (typeof fn === "string" && fn.trim()) return fn.trim().split(/\s+/)[0] ?? "Driver";
  const local = u.email?.split("@")[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "Driver";
}

function formatDriveTime(secs: number): string {
  if (secs <= 0) return "—";
  if (secs < 60) return `${secs}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function scoreLabel(score: number | null): { text: string; color: string } {
  if (score == null) return { text: "N/A", color: "text-on-surface-variant bg-surface-container" };
  if (score >= 75) return { text: "Optimal", color: "text-primary bg-primary/20" };
  if (score >= 50) return { text: "Elevated", color: "text-secondary bg-secondary/20" };
  return { text: "Critical", color: "text-error bg-error/20" };
}


// ─── Sub-components ───────────────────────────────────────────────────────────

function SessionActivityChart({
  data,
  filter,
}: {
  data: SessionDay[];
  filter: "week" | "month";
}) {
  const filtered = filter === "week" ? data.slice(-7) : data;
  const max = Math.max(1, ...filtered.map((d) => d.count));
  const today = new Date().toISOString().slice(0, 10);

  if (filtered.length === 0) {
    return (
      <div className="flex items-end justify-center h-48 text-on-surface-variant text-sm">
        No session data yet
      </div>
    );
  }

  // X-axis label positions (show ~5 evenly spaced)
  const labelIndices = new Set<number>([0]);
  if (filtered.length > 1) labelIndices.add(filtered.length - 1);
  if (filtered.length > 4) labelIndices.add(Math.floor(filtered.length / 4));
  if (filtered.length > 2) labelIndices.add(Math.floor(filtered.length / 2));
  if (filtered.length > 3) labelIndices.add(Math.floor((3 * filtered.length) / 4));

  return (
    <div>
      <div className="flex items-end justify-between h-48 gap-1.5">
        {filtered.map((d) => {
          const pct = Math.max(4, Math.round((d.count / max) * 100));
          const isToday = d.date === today;
          const hasData = d.count > 0;
          return (
            <div
              key={d.date}
              className={`flex-1 rounded-t-sm transition-all hover:opacity-80 cursor-default ${
                isToday
                  ? "bg-primary"
                  : hasData
                    ? "bg-primary/55"
                    : "bg-surface-container-high"
              }`}
              style={{ height: `${pct}%` }}
              title={`${d.date}: ${d.count} session${d.count !== 1 ? "s" : ""}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-3 text-[10px] text-slate-500 uppercase tracking-tighter">
        {filtered.map((d, i) =>
          labelIndices.has(i) ? (
            <span key={d.date}>
              {new Date(d.date + "T00:00:00").toLocaleDateString("en", {
                month: "short",
                day: "numeric",
              })}
            </span>
          ) : (
            <span key={d.date} />
          ),
        )}
      </div>
    </div>
  );
}

function IncidentRow({ incident }: { incident: SessionIncident }) {
  const peak = incident.peak_drowsiness;
  const isCritical = peak >= 8;
  const isWarning = peak >= 6 && peak < 8;

  const icon = isCritical ? "event_busy" : isWarning ? "warning" : "verified";
  const iconColor = isCritical ? "text-error" : isWarning ? "text-secondary" : "text-primary";
  const bgColor = isCritical ? "bg-error/10" : isWarning ? "bg-secondary/10" : "bg-primary/10";
  const label = isCritical ? "Critical Drowsiness Session" : isWarning ? "Elevated Drowsiness" : "Safe Session";

  const date = new Date(incident.started_at);
  const dateStr = date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  const shortId = `#SG-${incident.id.slice(0, 4).toUpperCase()}`;
  const durationStr = formatDriveTime(incident.duration_sec);

  return (
    <div className="flex items-center justify-between p-5 bg-surface-container/30 rounded-xl hover:bg-surface-container/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center shrink-0`}>
          <span
            className={`material-symbols-outlined ${iconColor} text-xl`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        </div>
        <div>
          <p className="font-bold text-on-surface">
            {label}{" "}
            <span className="text-on-surface-variant font-normal ml-1 text-sm">{shortId}</span>
          </p>
          <p className="text-xs text-on-surface-variant">
            Peak {peak.toFixed(1)}/10 · avg {incident.avg_drowsiness.toFixed(1)}/10 · {durationStr}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className="text-sm font-bold text-on-surface">{dateStr}</p>
        <p className="text-xs text-on-surface-variant">{timeStr}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const online = useOnlineStatus();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [sessionIncidents, setSessionIncidents] = useState<SessionIncident[]>([]);
  const [sessionsByDay, setSessionsByDay] = useState<SessionDay[]>([]);
  const [alerts7dCount, setAlerts7dCount] = useState<number | null>(null);
  const [pendingLocal, setPendingLocal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartFilter, setChartFilter] = useState<"week" | "month">("week");
  const [filterDays, setFilterDays] = useState(30); // default matches mobile

  // Compute key stats via server-side RPC so Supabase's max_rows cap never
  // truncates the telemetry (previously fetched raw rows hit the 1000-row default).
  const loadStats = useCallback(async (days: number, uid: string) => {
    const TAG = "loadStats";
    setLoading(true);
    logger.info(TAG, "start", { days, uid });

    const since = days > 0
      ? new Date(Date.now() - days * 86400 * 1000).toISOString()
      : null;
    logger.debug(TAG, "query window", { since: since ?? "all-time" });

    type RpcRow = {
      session_count: number; total_drive_sec: number; avg_drive_sec: number;
      avg_drowsiness: number; focus_score: number;
      yawn_sum: number; head_sum: number; tilt_sum: number; brake_sum: number;
    };
    const { data: rpcData, error: rpcError } = await supabase
      .rpc("get_session_metrics", { p_since: since })
      .returns<RpcRow[]>();

    if (rpcError) {
      logger.error(TAG, "get_session_metrics RPC failed", { message: rpcError.message, code: rpcError.code });
      setMetrics(null);
      setLoading(false);
      return;
    }

    const row = (rpcData as RpcRow[] | null)?.[0];
    logger.info(TAG, "rpc result", row ?? "empty");

    if (!row || Number(row.session_count) === 0) {
      logger.warn(TAG, "no sessions found — metrics set to null");
      setMetrics(null);
      setLoading(false);
      return;
    }

    void uid; // uid no longer needed in query body (RLS uses auth.uid())

    const result: DashboardMetrics = {
      sessionCount: Number(row.session_count),
      totalDriveSec: Math.round(Number(row.total_drive_sec)),
      avgDriveSec: Math.round(Number(row.avg_drive_sec)),
      avgDrowsiness: Number(row.avg_drowsiness),
      focusScore: Number(row.focus_score),
      drowsyEvents: Number(row.yawn_sum) + Number(row.head_sum) + Number(row.tilt_sum) + Number(row.brake_sum),
      yawnSum: Number(row.yawn_sum),
      headSum: Number(row.head_sum),
      tiltSum: Number(row.tilt_sum),
      brakeSum: Number(row.brake_sum),
    };

    logger.info(TAG, "final metrics", result);
    setMetrics(result);
    setLoading(false);
  }, []);

  // Initial load + supplementary data (chart, incidents, badge counts)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      logger.info("Dashboard", "effect fired", { uid: user.id, online, filterDays });

      if (online) {
        logger.debug("Dashboard", "flushing offline outbox");
        await flushOutbox(supabase, user.id);
      }
      if (!cancelled) void loadStats(filterDays, user.id);

      // Sessions by day (last 30 days) for bar chart
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: sessionDates, error: chartErr } = await supabase
        .from("driving_sessions")
        .select("started_at")
        .eq("user_id", user.id)
        .gte("started_at", thirtyDaysAgo);

      if (chartErr) {
        logger.error("Dashboard", "chart sessions query failed", { message: chartErr.message });
      } else {
        logger.debug("Dashboard", `chart sessions: ${sessionDates?.length ?? 0} rows`);
      }

      if (!cancelled && sessionDates) {
        const dayMap = new Map<string, number>();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000);
          dayMap.set(d.toISOString().slice(0, 10), 0);
        }
        for (const s of sessionDates) {
          const key = new Date(s.started_at as string).toISOString().slice(0, 10);
          dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
        }
        setSessionsByDay(Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })));
      }

      // Derive incidents from session_telemetry — last 30 days, top 5 by recency
      const { data: incidentSessions, error: incidentSessErr } = await supabase
        .from("driving_sessions")
        .select("id, started_at, ended_at")
        .eq("user_id", user.id)
        .gte("started_at", thirtyDaysAgo)
        .order("started_at", { ascending: false })
        .limit(50);

      if (incidentSessErr) {
        logger.error("Dashboard", "incident sessions query failed", { message: incidentSessErr.message });
      } else if (incidentSessions?.length) {
        const incidentIds = incidentSessions.map((s) => s.id as string);
        const { data: incidentTel, error: incidentTelErr } = await supabase
          .from("session_telemetry")
          .select("session_id, drowsiness_level")
          .in("session_id", incidentIds);

        if (incidentTelErr) {
          logger.error("Dashboard", "incident telemetry query failed", { message: incidentTelErr.message });
        } else {
          const telBySess = new Map<string, number[]>();
          for (const t of incidentTel ?? []) {
            const arr = telBySess.get(t.session_id) ?? [];
            arr.push(Number(t.drowsiness_level));
            telBySess.set(t.session_id, arr);
          }

          const weekAgoMs = Date.now() - 7 * 86400000;
          let weekAlerts = 0;
          const incidents: SessionIncident[] = [];

          for (const s of incidentSessions) {
            const levels = telBySess.get(s.id as string) ?? [];
            if (levels.length === 0) continue;
            const peak = Math.max(...levels);
            const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
            const durationSec = s.started_at && s.ended_at
              ? (new Date(s.ended_at as string).getTime() - new Date(s.started_at as string).getTime()) / 1000
              : 0;
            if (peak >= 6 && new Date(s.started_at as string).getTime() > weekAgoMs) weekAlerts++;
            incidents.push({ id: s.id as string, started_at: s.started_at as string, peak_drowsiness: peak, avg_drowsiness: avg, duration_sec: Math.round(durationSec) });
          }

          logger.debug("Dashboard", `incidents derived: ${incidents.length}, alerts7d: ${weekAlerts}`);
          if (!cancelled) setSessionIncidents(incidents.slice(0, 5));
          if (!cancelled) setAlerts7dCount(weekAlerts);
        }
      } else {
        if (!cancelled) setSessionIncidents([]);
        if (!cancelled) setAlerts7dCount(0);
      }

      const pending = await countPendingTelemetryForUser(user.id);
      logger.debug("Dashboard", `pending local telemetry: ${pending}`);
      if (!cancelled) setPendingLocal(pending);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, online]);

  // Re-fetch key stats when time filter changes
  useEffect(() => {
    if (!user) return;
    void loadStats(filterDays, user.id);
  }, [filterDays, user, loadStats]);

  const focusScore = metrics?.focusScore ?? null;
  const drowsyEvents = metrics?.drowsyEvents ?? 0;
  const yawns = metrics?.yawnSum ?? 0;
  const headEvents = metrics?.headSum ?? 0;
  const tiltEvents = metrics?.tiltSum ?? 0;
  const brakeEvents = metrics?.brakeSum ?? 0;

  const scoreInfo = useMemo(() => scoreLabel(focusScore), [focusScore]);
  const driveTimeStr = useMemo(() => formatDriveTime(metrics?.totalDriveSec ?? 0), [metrics]);
  const avgSessionStr = useMemo(() => formatDriveTime(metrics?.avgDriveSec ?? 0), [metrics]);
  const name = firstName(user);

  return (
    <div className="space-y-8">
      {/* ── Hero row ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 className="text-3xl sm:text-4xl font-headline font-extrabold tracking-tight text-on-surface mb-2">
            Systems Online
          </h2>
          <p className="text-on-surface-variant font-body max-w-md text-sm sm:text-base">
            Real-time driver drowsiness monitoring active for{" "}
            <span className="text-primary font-semibold">{name}</span>. Local database synced.
            {!online && (
              <span className="ml-2 text-secondary font-semibold">· Offline mode</span>
            )}
            {pendingLocal > 0 && (
              <span className="ml-2 text-secondary">{pendingLocal} queued</span>
            )}
          </p>
        </div>
        <Link
          to="/drive"
          className="group relative flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-on-primary-container text-on-primary px-5 py-3 sm:px-8 sm:py-5 rounded-xl font-headline font-bold text-base sm:text-lg shadow-lg hover:shadow-primary/20 transition-all active:scale-95 shrink-0 sm:ml-8"
        >
          <span
            className="material-symbols-outlined text-2xl transition-transform group-hover:scale-110"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            play_circle
          </span>
          <span>Start Driving Session</span>
        </Link>
      </div>

      {/* ── Quick Actions Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Real Driving Session */}
        <Link
          to="/drive"
          className="group p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 hover:border-primary/50 hover:shadow-lg transition-all active:scale-95"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
              <span className="material-symbols-outlined text-primary">directions_car</span>
            </div>
            <h3 className="text-sm font-bold text-on-surface">Real Driving</h3>
          </div>
          <p className="text-xs text-on-surface-variant">Monitor drowsiness on the road</p>
        </Link>

        {/* Simulation Practice */}
        <Link
          to="/simulation"
          className="group p-6 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 border border-secondary/20 hover:border-secondary/50 hover:shadow-lg transition-all active:scale-95"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center group-hover:bg-secondary/30 transition-colors">
              <span className="material-symbols-outlined text-secondary">sports_esports</span>
            </div>
            <h3 className="text-sm font-bold text-on-surface">Try Simulation</h3>
          </div>
          <p className="text-xs text-on-surface-variant">Practice detection in safe environment</p>
        </Link>

        {/* Safety Protocol */}
        <Link
          to="/safety-protocol"
          className="group p-6 rounded-2xl bg-gradient-to-br from-tertiary/20 to-tertiary/5 border border-tertiary/20 hover:border-tertiary/50 hover:shadow-lg transition-all active:scale-95"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-tertiary/20 flex items-center justify-center group-hover:bg-tertiary/30 transition-colors">
              <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
                emergency
              </span>
            </div>
            <h3 className="text-sm font-bold text-on-surface">Safety Protocol</h3>
          </div>
          <p className="text-xs text-on-surface-variant">Configure alerts &amp; contacts</p>
        </Link>

        {/* Emergency Contacts */}
        <Link
          to="/guardians"
          className="group p-6 rounded-2xl bg-gradient-to-br from-error/20 to-error/5 border border-error/20 hover:border-error/50 hover:shadow-lg transition-all active:scale-95"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center group-hover:bg-error/30 transition-colors">
              <span className="material-symbols-outlined text-error">contacts</span>
            </div>
            <h3 className="text-sm font-bold text-on-surface">Guardians</h3>
          </div>
          <p className="text-xs text-on-surface-variant">Manage emergency contacts</p>
        </Link>
      </div>

      {/* ── Time filter pills — same options as mobile ── */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setFilterDays(opt.days)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
              filterDays === opt.days
                ? "bg-primary text-on-primary border-primary"
                : "bg-transparent text-on-surface-variant border-outline-variant hover:border-on-surface-variant"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── KPI Bento grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Focus Score — spans 2 cols */}
        <div className="sm:col-span-2 bg-surface-container-high p-6 lg:p-8 rounded-xl flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-on-surface-variant font-label text-sm uppercase tracking-widest flex items-center gap-2">
                Focus Score
                <span className="material-symbols-outlined text-sm opacity-50 cursor-default">info</span>
              </p>
              <h3 className="text-5xl font-headline font-black text-on-surface mt-2">
                {loading ? "…" : focusScore != null ? focusScore : "—"}
                {focusScore != null && !loading && (
                  <span className="text-2xl text-primary">/100</span>
                )}
              </h3>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter ${scoreInfo.color}`}
            >
              {loading ? "…" : scoreInfo.text}
            </span>
          </div>
          <div className="mt-8 z-10">
            <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-on-primary-container rounded-full shadow-[0_0_15px_rgba(123,208,255,0.4)] transition-all duration-700"
                style={{ width: `${focusScore != null ? Math.max(2, focusScore) : 0}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-xs text-primary">trending_up</span>
              avg drowsiness {metrics ? Number(metrics.avgDrowsiness).toFixed(1) : "—"}/10 · {FILTER_OPTIONS.find((o) => o.days === filterDays)?.label ?? ""}
            </p>
          </div>
          {/* Background glow */}
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
        </div>

        {/* Drowsy Events */}
        <div className="bg-surface-container-low p-6 lg:p-8 rounded-xl border-l-4 border-secondary flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <p className="text-on-surface-variant font-label text-sm uppercase tracking-widest">
                Drowsy Events
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                visibility
              </span>
            </div>
            <h3 className="text-4xl font-headline font-bold text-on-surface">
              {loading ? "…" : String(drowsyEvents).padStart(2, "0")}
            </h3>
            <div className="mt-2 flex gap-2 flex-wrap">
              {yawns > 0 && (
                <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded border border-secondary/20">
                  {yawns} YAWN{yawns !== 1 ? "S" : ""}
                </span>
              )}
              {headEvents > 0 && (
                <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded border border-secondary/20">
                  {headEvents} NOD{headEvents !== 1 ? "S" : ""}
                </span>
              )}
              {tiltEvents > 0 && (
                <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded border border-secondary/20">
                  {tiltEvents} TILT{tiltEvents !== 1 ? "S" : ""}
                </span>
              )}
              {brakeEvents > 0 && (
                <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded border border-secondary/20">
                  {brakeEvents} BRAKE{brakeEvents !== 1 ? "S" : ""}
                </span>
              )}
              {!loading && yawns === 0 && headEvents === 0 && tiltEvents === 0 && brakeEvents === 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                  ALL CLEAR
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-4">
            ⓘ Yawns + nods + tilts + brakes · {FILTER_OPTIONS.find((o) => o.days === filterDays)?.label ?? ""}
          </p>
        </div>

        {/* Total Sessions */}
        <div className="bg-surface-container-low p-6 lg:p-8 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <p className="text-on-surface-variant font-label text-sm uppercase tracking-widest">
                Total Sessions
              </p>
              <span className="material-symbols-outlined text-on-surface-variant">route</span>
            </div>
            <h3 className="text-4xl font-headline font-bold text-on-surface">
              {loading ? "…" : metrics != null ? metrics.sessionCount.toLocaleString() : "—"}
            </h3>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/10">
            <p className="text-xs text-slate-500">
              High-risk sessions (7d):{" "}
              <span className="text-on-surface-variant font-semibold">
                {alerts7dCount != null ? alerts7dCount : "—"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Secondary row: chart + drive time ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Session Activity Chart — spans 2 cols */}
        <div className="lg:col-span-2 bg-surface-container p-6 lg:p-8 rounded-xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h4 className="text-lg font-headline font-bold text-on-surface">Session Activity</h4>
              <p className="text-sm text-slate-500">
                Frequency over last {chartFilter === "week" ? "7" : "30"} days
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setChartFilter("month")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  chartFilter === "month"
                    ? "bg-surface-bright text-primary"
                    : "bg-surface-container-high text-slate-300 hover:text-on-surface"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setChartFilter("week")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  chartFilter === "week"
                    ? "bg-surface-bright text-primary"
                    : "bg-surface-container-high text-slate-300 hover:text-on-surface"
                }`}
              >
                Week
              </button>
            </div>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-on-surface-variant text-sm">
              Loading…
            </div>
          ) : (
            <SessionActivityChart data={sessionsByDay} filter={chartFilter} />
          )}
        </div>

        {/* Total Drive Time */}
        <div className="bg-surface-container-high p-6 lg:p-8 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <p className="text-on-surface-variant font-label text-sm uppercase tracking-widest">
                Total Drive Time
              </p>
              <span className="material-symbols-outlined text-primary">timer</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-5xl font-headline font-black text-on-surface">
                {loading ? "…" : driveTimeStr}
              </h3>
              <p className="text-primary font-headline font-bold text-lg">
                {FILTER_OPTIONS.find((o) => o.days === filterDays)?.label ?? ""}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Avg. Session Length</span>
              <span className="text-on-surface font-bold">
                {loading ? "…" : avgSessionStr}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Avg Drowsiness</span>
              <span className="text-on-surface font-bold">
                {loading ? "…" : metrics ? `${Number(metrics.avgDrowsiness).toFixed(1)} / 10` : "—"}
              </span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, Math.max(4, (focusScore ?? 0)))}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Drowsiness Incidents ── */}
      <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10">
        <div className="flex justify-between items-center mb-8">
          <h4 className="text-xl font-headline font-bold text-on-surface">
            Recent Drowsiness Incidents
          </h4>
          <Link
            to="/history"
            className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
          >
            View Complete Log
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>

        {loading ? (
          <p className="text-on-surface-variant text-sm">Loading…</p>
        ) : sessionIncidents.length === 0 ? (
          <div className="flex items-center gap-4 p-5 bg-primary/5 rounded-xl border border-primary/10">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-primary text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
            </div>
            <p className="text-on-surface-variant text-sm">
              No sessions with telemetry found in the last 30 days.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessionIncidents.map((incident) => (
              <IncidentRow key={incident.id} incident={incident} />
            ))}
          </div>
        )}
      </div>

      {/* ── Debug log download ── */}
      <div className="flex justify-end">
        <button
          onClick={() => logger.download()}
          className="text-[10px] text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors"
        >
          <span className="material-symbols-outlined text-xs">bug_report</span>
          Download Diagnostic Log
        </button>
      </div>
    </div>
  );
}
