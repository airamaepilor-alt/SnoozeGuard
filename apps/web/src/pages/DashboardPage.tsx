import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { supabase } from "../lib/supabase";
import { countPendingTelemetryForUser } from "../lib/offline/db";
import { flushOutbox } from "../lib/offline/sync";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  safest_hour?: number | null;
  histogram_hours?: unknown;
  tz_offset_minutes_applied?: number | null;
};

type AlertEvent = {
  id: string;
  drowsiness_level: number;
  alert_label: string | null;
  source: string | null;
  created_at: string;
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

function formatHoursLarge(totalSec: number): { value: string; unit: string } {
  if (totalSec <= 0) return { value: "—", unit: "" };
  const h = Math.floor(totalSec / 3600);
  return { value: h.toLocaleString(), unit: "Hours Recorded" };
}

function scoreLabel(score: number | null): { text: string; color: string } {
  if (score == null) return { text: "N/A", color: "text-on-surface-variant bg-surface-container" };
  if (score >= 75) return { text: "Optimal", color: "text-primary bg-primary/20" };
  if (score >= 50) return { text: "Elevated", color: "text-secondary bg-secondary/20" };
  return { text: "Critical", color: "text-error bg-error/20" };
}

function avgSessionMin(totalSec: number, count: number): string {
  if (!count || totalSec <= 0) return "—";
  const avg = totalSec / count / 60;
  if (avg >= 60) return `${(avg / 60).toFixed(1)} hrs`;
  return `${Math.round(avg)} min`;
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

function IncidentRow({ event }: { event: AlertEvent }) {
  const level = Number(event.drowsiness_level);
  const isCritical = level >= 8;
  const isWarning = level >= 6 && level < 8;

  const icon = isCritical ? "event_busy" : isWarning ? "warning" : "verified";
  const iconColor = isCritical ? "text-error" : isWarning ? "text-secondary" : "text-primary";
  const bgColor = isCritical ? "bg-error/10" : isWarning ? "bg-secondary/10" : "bg-primary/10";

  const label =
    event.alert_label ??
    (isCritical ? "Critical Fatigue Alert" : isWarning ? "Drowsiness Warning" : "Safe Session");
  const date = new Date(event.created_at);
  const dateStr = date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  const shortId = `#SG-${event.id.slice(0, 4).toUpperCase()}`;

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
            Level {level} · {event.source ?? "mobile"}
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

  const [rpcMetrics, setRpcMetrics] = useState<DashboardRpcPayload | null>(null);
  const [sessionCountTotal, setSessionCountTotal] = useState<number | null>(null);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [sessionsByDay, setSessionsByDay] = useState<SessionDay[]>([]);
  const [alerts7dCount, setAlerts7dCount] = useState<number | null>(null);
  const [totalDriveSec, setTotalDriveSec] = useState(0);
  const [pendingLocal, setPendingLocal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartFilter, setChartFilter] = useState<"week" | "month">("week");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      if (online) await flushOutbox(supabase, user.id);

      const tzOffset = -new Date().getTimezoneOffset();

      // RPC for main metrics
      const { data: rpcRaw } = await supabase.rpc("user_dashboard_metrics", {
        p_session_limit: 40,
        p_tz_offset_minutes: tzOffset,
      });
      const rpc = rpcRaw as DashboardRpcPayload | null;
      const rpcOk = rpc?.ok === true;

      if (!cancelled) {
        if (rpcOk && rpc) {
          setRpcMetrics(rpc);
          setSessionCountTotal(rpc.session_count_total ?? null);
          setTotalDriveSec(Number(rpc.total_drive_seconds) || 0);
        }
      }

      // Fallback session count
      if (!rpcOk) {
        const { count: sc } = await supabase
          .from("driving_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (!cancelled) setSessionCountTotal(sc ?? null);
      }

      // Sessions by day (last 30 days) for bar chart
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: sessionDates } = await supabase
        .from("driving_sessions")
        .select("started_at")
        .eq("user_id", user.id)
        .gte("started_at", thirtyDaysAgo);

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
        setSessionsByDay(
          Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })),
        );
      }

      // Recent alert events for incidents list
      const { data: eventsData } = await supabase
        .from("alert_events")
        .select("id, drowsiness_level, alert_label, source, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!cancelled && eventsData) setAlertEvents(eventsData as AlertEvent[]);

      // 7-day alert count
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { count: alertC } = await supabase
        .from("alert_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", weekAgo);
      if (!cancelled) setAlerts7dCount(alertC ?? 0);

      if (!cancelled) {
        setPendingLocal(await countPendingTelemetryForUser(user.id));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, online]);

  const focusScore = useMemo(() => {
    if (rpcMetrics?.focus_score != null) return Math.round(rpcMetrics.focus_score);
    if (rpcMetrics?.avg_drowsiness != null && (rpcMetrics.sample_count ?? 0) > 0) {
      return Math.max(0, Math.min(100, Math.round(100 - Number(rpcMetrics.avg_drowsiness) * 10)));
    }
    return null;
  }, [rpcMetrics]);

  const yawns = Number(rpcMetrics?.yawn_delta_sum) || 0;
  const headEvents = Number(rpcMetrics?.head_delta_sum) || 0;
  const drowsyEvents = yawns + headEvents;
  const scoreInfo = scoreLabel(focusScore);
  const driveTime = formatHoursLarge(totalDriveSec);
  const avgMin = avgSessionMin(totalDriveSec, sessionCountTotal ?? 0);
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
            Real-time driver fatigue monitoring active for{" "}
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
              Based on avg drowsiness across your telemetry window
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
              {!loading && yawns === 0 && headEvents === 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                  ALL CLEAR
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-4">
            ⓘ Yawns + head movements in your last 40 sessions
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
              {loading ? "…" : sessionCountTotal != null ? sessionCountTotal.toLocaleString() : "—"}
            </h3>
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/10">
            <p className="text-xs text-slate-500">
              Alerts (7d):{" "}
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
                {loading ? "…" : driveTime.value}
              </h3>
              <p className="text-primary font-headline font-bold text-lg">
                {driveTime.unit || "Hours Recorded"}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Avg. Session Length</span>
              <span className="text-on-surface font-bold">
                {loading ? "…" : avgMin}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Telemetry Samples</span>
              <span className="text-on-surface font-bold">
                {loading ? "…" : (rpcMetrics?.sample_count ?? "—")}
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

      {/* ── Recent Fatigue Incidents ── */}
      <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10">
        <div className="flex justify-between items-center mb-8">
          <h4 className="text-xl font-headline font-bold text-on-surface">
            Recent Fatigue Incidents
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
        ) : alertEvents.length === 0 ? (
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
              No fatigue incidents recorded yet. Stay safe on the road!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertEvents.map((ev) => (
              <IncidentRow key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
