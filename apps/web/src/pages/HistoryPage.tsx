import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "In Progress";
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (diffMs <= 0) return "< 1m";
  const totalMin = Math.round(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function maxLevel(series: { t: string; level: number }[]): number {
  return series.reduce((max, s) => Math.max(max, s.level), 0);
}

function drowsinessColor(avg: number): { pill: string; dot: string; text: string } {
  if (avg >= 7) return { pill: "bg-tertiary/10 border-tertiary/20", dot: "bg-tertiary", text: "text-tertiary" };
  if (avg >= 4) return { pill: "bg-secondary/10 border-secondary/20", dot: "bg-secondary", text: "text-secondary" };
  return { pill: "bg-primary/10 border-primary/20", dot: "bg-primary", text: "text-primary" };
}

function alertLevelBadge(level: number): { label: string; cls: string } {
  if (level >= 8) return { label: `Level ${level} (CRITICAL)`, cls: "text-white bg-error-container" };
  if (level >= 6) return { label: `Level ${level} (Warning)`, cls: "text-tertiary bg-tertiary-container/40" };
  if (level >= 4) return { label: `Level ${level} (Caution)`, cls: "text-secondary bg-secondary/10" };
  if (level >= 1) return { label: `Level ${level} (Mild)`, cls: "text-primary bg-primary/10" };
  return { label: "Level 0 (Optimal)", cls: "text-slate-400 bg-surface-container-high" };
}

function isCritical(s: SessionSummary): boolean {
  return s.avgDrowsiness >= 7 || maxLevel(s.series) >= 8;
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
  for (let i = 6; i >= 0; i--) {
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  badge,
  badgeColor,
  highlight,
  glow,
}: {
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
  highlight?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`bg-surface-container p-5 sm:p-6 rounded-2xl lg:rounded-3xl space-y-3 relative overflow-hidden ${
        glow ? "bg-surface-container-high" : ""
      }`}
    >
      {glow && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-tertiary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
      )}
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl sm:text-4xl font-headline font-black ${highlight ?? "text-on-surface"}`}>
          {value}
        </span>
        {badge && (
          <span className={`text-xs sm:text-sm font-bold ${badgeColor ?? "text-primary"}`}>{badge}</span>
        )}
      </div>
    </div>
  );
}

function EventTooltip({ icon, color, tooltip }: { icon: string; color: string; tooltip: string }) {
  return (
    <div className="group/icon relative">
      <span
        className={`material-symbols-outlined ${color} text-xl cursor-default transition-colors`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface-bright text-[10px] rounded-lg opacity-0 group-hover/icon:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl pointer-events-none">
        {tooltip}
      </span>
    </div>
  );
}

function SessionSparkline({ series }: { series: { t: string; level: number }[] }) {
  if (series.length === 0) return null;
  const w = 80;
  const h = 28;
  const levels = series.map((s) => s.level);
  const maxL = Math.max(10, ...levels);
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const pts = series.map((s, i) => {
    const x = i * step;
    const y = h - (s.level / maxL) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="text-primary shrink-0" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts.join(" ")} />
    </svg>
  );
}

function WeeklyTrendChart({ points }: { points: { label: string; avg: number }[] }) {
  if (points.every((p) => p.avg === 0)) {
    return (
      <p className="text-xs text-on-surface-variant py-4">No samples in the last 7 days to chart.</p>
    );
  }
  const w = 340;
  const h = 90;
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
      <svg
        width={w}
        height={h + 28}
        className="text-primary w-full"
        viewBox={`0 0 ${w} ${h + 28}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Average drowsiness by day over the last week"
      >
        <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" points={pts.join(" ")} />
        {points.map((p, i) => {
          const x = pad + i * step;
          const y = h - pad - (p.avg / maxL) * (h - pad * 2);
          return <circle key={`pt-${i}`} cx={x} cy={y} r="3" fill="currentColor" />;
        })}
        {points.map((p, i) => (
          <text
            key={`lb-${i}`}
            x={pad + i * step}
            y={h + 16}
            textAnchor="middle"
            fill="#c6c6cd"
            style={{ fontSize: 9 }}
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Session Table Row (desktop) ──────────────────────────────────────────────

function SessionTableRow({ s }: { s: SessionSummary }) {
  const crit = isCritical(s);
  const dc = drowsinessColor(s.avgDrowsiness);
  const ml = maxLevel(s.series);
  const badge = alertLevelBadge(ml);
  const pct = Math.round(s.avgDrowsiness * 10);

  const date = new Date(s.started_at);
  const dateStr = date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  const duration = formatDuration(s.started_at, s.ended_at);

  return (
    <tr
      className={`transition-colors group ${
        crit
          ? "bg-tertiary-container/10 hover:bg-tertiary-container/20"
          : "hover:bg-white/[0.02]"
      }`}
    >
      {/* Date & Time */}
      <td className={`px-4 lg:px-8 py-5 lg:py-6 ${crit ? "border-l-4 border-tertiary" : ""}`}>
        <div className="flex items-center gap-3 lg:gap-4">
          <div
            className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${
              crit ? "bg-tertiary-container text-tertiary" : "bg-surface-container-highest text-primary"
            }`}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={{ fontVariationSettings: crit ? "'FILL' 1" : "'FILL' 0" }}
            >
              {crit ? "emergency_home" : "event"}
            </span>
          </div>
          <div>
            <p className="text-on-surface font-bold text-sm">{dateStr}</p>
            <p className="text-slate-500 text-xs">{timeStr}</p>
          </div>
        </div>
      </td>

      {/* Duration */}
      <td className="px-4 lg:px-8 py-5 lg:py-6">
        <span className="font-medium text-slate-300 text-sm">{duration}</span>
      </td>

      {/* Avg Drowsiness */}
      <td className="px-4 lg:px-8 py-5 lg:py-6 text-center">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${dc.pill}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dc.dot} animate-pulse`} />
          <span className={`text-xs font-bold ${dc.text}`}>{pct}%</span>
        </div>
      </td>

      {/* Max Alert */}
      <td className="hidden md:table-cell px-4 lg:px-8 py-5 lg:py-6 text-center">
        <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      </td>

      {/* Key Events */}
      <td className="hidden lg:table-cell px-4 lg:px-8 py-5 lg:py-6">
        <div className="flex items-center gap-3">
          {s.yawnSum > 0 && (
            <EventTooltip
              icon="sentiment_neutral"
              color={crit ? "text-tertiary" : "text-slate-500 hover:text-secondary"}
              tooltip={`${s.yawnSum} Yawn${s.yawnSum !== 1 ? "s" : ""}`}
            />
          )}
          {s.headSum > 0 && (
            <EventTooltip
              icon="bedtime"
              color={crit ? "text-tertiary" : "text-slate-500 hover:text-secondary"}
              tooltip={`${s.headSum} Head Nod${s.headSum !== 1 ? "s" : ""}`}
            />
          )}
          {s.brakeCount > 0 && (
            <EventTooltip
              icon="car_crash"
              color={crit ? "text-tertiary" : "text-slate-500 hover:text-tertiary"}
              tooltip={`${s.brakeCount} Sudden Brake${s.brakeCount !== 1 ? "s" : ""}`}
            />
          )}
          {s.sampleCount > 0 && (
            <EventTooltip
              icon="monitoring"
              color="text-slate-600"
              tooltip={`${s.sampleCount} samples`}
            />
          )}
          {s.yawnSum === 0 && s.headSum === 0 && s.brakeCount === 0 && (
            <span className="text-xs text-slate-600">No notable events</span>
          )}
        </div>
      </td>

      {/* Action */}
      <td className="px-4 lg:px-8 py-5 lg:py-6 text-right">
        <Link
          to={`/history/${s.id}`}
          className={`inline-flex items-center justify-end gap-2 text-xs font-black uppercase tracking-widest hover:underline transition-colors ${
            crit ? "text-tertiary" : "text-primary"
          }`}
        >
          <SessionSparkline series={s.series} />
          <span>{crit ? "Review" : "Details"}</span>
        </Link>
      </td>
    </tr>
  );
}

// ─── Session Card (mobile fallback) ──────────────────────────────────────────

function SessionCard({ s }: { s: SessionSummary }) {
  const crit = isCritical(s);
  const dc = drowsinessColor(s.avgDrowsiness);
  const ml = maxLevel(s.series);
  const badge = alertLevelBadge(ml);
  const pct = Math.round(s.avgDrowsiness * 10);

  const date = new Date(s.started_at);
  const dateStr = date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  const duration = formatDuration(s.started_at, s.ended_at);

  return (
    <Link
      to={`/history/${s.id}`}
      className={`block rounded-2xl p-4 transition-all hover:shadow-lg ${
        crit
          ? "bg-tertiary-container/15 border-l-4 border-tertiary hover:bg-tertiary-container/20"
          : "bg-surface-container-low hover:bg-surface-container"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              crit ? "bg-tertiary-container text-tertiary" : "bg-surface-container-highest text-primary"
            }`}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={{ fontVariationSettings: crit ? "'FILL' 1" : "'FILL' 0" }}
            >
              {crit ? "emergency_home" : "event"}
            </span>
          </div>
          <div>
            <p className="text-on-surface font-bold text-sm">{dateStr}</p>
            <p className="text-slate-500 text-xs">{timeStr} · {duration}</p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${dc.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dc.dot} animate-pulse`} />
          <span className={`text-xs font-bold ${dc.text}`}>{pct}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
        <div className="flex items-center gap-2">
          {s.yawnSum > 0 && (
            <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-md border border-secondary/20">
              {s.yawnSum} YWN
            </span>
          )}
          {s.headSum > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
              {s.headSum} NOD
            </span>
          )}
          {s.brakeCount > 0 && (
            <span className="text-[10px] bg-tertiary/10 text-tertiary px-2 py-0.5 rounded-md border border-tertiary/20">
              {s.brakeCount} BRK
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
  const [searchQuery, setSearchQuery] = useState("");
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
      if (reset && samples.length > 0) setDetailRows(samples as TelemetryRow[]);

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

  // ─── Derived stats ───────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (sessions.length === 0) return null;
    const totalSessions = sessions.length;
    const avgFatigueRaw = sessions.reduce((a, s) => a + s.avgDrowsiness, 0) / totalSessions;
    const avgFatigePct = Math.round(avgFatigueRaw * 10);
    const criticalCount = sessions.filter(isCritical).length;
    const safetyScore = Math.max(0, 100 - avgFatigePct);
    return { totalSessions, avgFatigePct, criticalCount, safetyScore };
  }, [sessions]);

  // ─── Filtered sessions ───────────────────────────────────────────────────────

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => {
      const dateStr = new Date(s.started_at).toLocaleDateString("en", {
        month: "short", day: "numeric", year: "numeric",
      }).toLowerCase();
      return dateStr.includes(q) || s.device_type?.toLowerCase().includes(q);
    });
  }, [sessions, searchQuery]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 font-body text-on-surface">

      {/* ── Page header & search ── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div className="space-y-1.5">
          <h2 className="text-3xl sm:text-4xl font-headline font-extrabold tracking-tight text-on-surface">
            Driving History
          </h2>
          <p className="text-on-surface-variant font-medium max-w-lg text-sm sm:text-base">
            Comprehensive log of fatigue levels and safety events from your recent driving operations.
          </p>
          {rpcNote && <p className="text-xs text-secondary">{rpcNote}</p>}
        </div>

        {/* Search + filter bar */}
        <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/10 shadow-xl">
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[18px] pointer-events-none">
              search
            </span>
            <input
              className="w-full bg-surface-container-lowest rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 placeholder:text-slate-600 text-on-surface outline-none transition-all min-w-[160px] sm:min-w-[200px]"
              placeholder="Search sessions…"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => void fetchHistory(true, () => false)}
            className="p-2.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all shrink-0"
            title="Refresh"
          >
            <span className="material-symbols-outlined text-[20px]">refresh</span>
          </button>
        </div>
      </section>

      {/* ── Stats overview ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          label="Total Sessions"
          value={loading ? "…" : String(stats?.totalSessions ?? 0)}
          badge={sessions.length > 0 ? "recorded" : undefined}
          badgeColor="text-slate-500"
        />
        <StatCard
          label="Avg Fatigue"
          value={loading ? "…" : `${stats?.avgFatigePct ?? 0}%`}
          badge={stats && stats.avgFatigePct < 30 ? "↓ Low" : undefined}
          badgeColor="text-primary"
        />
        <StatCard
          label="Critical Alerts"
          value={loading ? "…" : String(stats?.criticalCount ?? 0)}
          badge={stats?.criticalCount ? "this view" : undefined}
          badgeColor="text-slate-500"
          highlight={stats && stats.criticalCount > 0 ? "text-tertiary" : undefined}
          glow={Boolean(stats && stats.criticalCount > 0)}
        />
        <StatCard
          label="Safety Score"
          value={loading ? "…" : `${stats?.safetyScore ?? 100}`}
          badge={stats && stats.safetyScore >= 80 ? "A+" : undefined}
          badgeColor="text-primary"
        />
      </section>

      {/* ── Tab toggle ── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("sessions")}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
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
          className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
            tab === "samples"
              ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Telemetry Samples
        </button>
      </div>

      {/* ── Content area ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-on-surface-variant text-sm">
          <span className="material-symbols-outlined animate-spin mr-2 text-primary">progress_activity</span>
          Loading history…
        </div>
      ) : tab === "sessions" ? (
        <>
          {filteredSessions.length === 0 ? (
            <div className="flex items-center gap-4 p-6 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
              </div>
              <p className="text-on-surface-variant text-sm">
                {searchQuery ? "No sessions match your search." : "No sessions recorded yet. Stay safe on the road!"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <section className="hidden sm:block bg-surface-container-low rounded-[2rem] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-high/50">
                        <th className="px-4 lg:px-8 py-5 lg:py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                          Date &amp; Start Time
                        </th>
                        <th className="px-4 lg:px-8 py-5 lg:py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Duration
                        </th>
                        <th className="px-4 lg:px-8 py-5 lg:py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center whitespace-nowrap">
                          Avg Drowsiness
                        </th>
                        <th className="hidden md:table-cell px-4 lg:px-8 py-5 lg:py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center whitespace-nowrap">
                          Max Alert
                        </th>
                        <th className="hidden lg:table-cell px-4 lg:px-8 py-5 lg:py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Key Events
                        </th>
                        <th className="px-4 lg:px-8 py-5 lg:py-6 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredSessions.map((s) => (
                        <SessionTableRow key={s.id} s={s} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table footer */}
                <div className="px-4 lg:px-8 py-5 lg:py-6 bg-surface-container-highest/30 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-white/5">
                  <p className="text-xs text-slate-500">
                    Showing{" "}
                    <span className="text-on-surface font-bold">{filteredSessions.length}</span>{" "}
                    session{filteredSessions.length !== 1 ? "s" : ""}
                    {hasMore && <span className="ml-1 text-slate-600">(more available)</span>}
                  </p>
                  {hasMore && (
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => void fetchHistory(false, () => false)}
                      className="flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface text-sm font-bold rounded-xl hover:bg-surface-bright disabled:opacity-50 transition-all"
                    >
                      {loadingMore ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                          Loading…
                        </>
                      ) : (
                        <>
                          Load more
                          <span className="material-symbols-outlined text-sm">expand_more</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </section>

              {/* Mobile cards */}
              <section className="sm:hidden space-y-3">
                {filteredSessions.map((s) => (
                  <SessionCard key={s.id} s={s} />
                ))}
                {hasMore && (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void fetchHistory(false, () => false)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-surface-container-high text-on-surface text-sm font-bold rounded-xl hover:bg-surface-bright disabled:opacity-50 transition-all"
                  >
                    {loadingMore ? "Loading…" : "Load more sessions"}
                  </button>
                )}
              </section>
            </>
          )}
        </>
      ) : detailRows.length === 0 ? (
        <p className="text-on-surface-variant text-sm">No telemetry samples yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface-container-low/50 border border-outline-variant/15">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Yawn Δ</th>
                <th className="px-4 py-3">Head Δ</th>
                <th className="px-4 py-3">Brake</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant/10 hover:bg-surface-container/30">
                  <td className="px-4 py-2.5 text-on-surface text-xs">{new Date(r.recorded_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs font-bold">
                    <span className={r.drowsiness_level >= 7 ? "text-tertiary" : r.drowsiness_level >= 4 ? "text-secondary" : "text-primary"}>
                      {r.drowsiness_level}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{r.yawn_count_delta}</td>
                  <td className="px-4 py-2.5 text-xs text-on-surface-variant">{r.head_event_count_delta}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {r.sudden_brake ? (
                      <span className="text-tertiary font-bold">Yes</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Bottom insight section ── */}
      {!loading && sessions.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 pb-4">
          {/* Weekly Safety Pulse */}
          <div className="lg:col-span-2 bg-gradient-to-br from-primary/10 to-transparent p-6 sm:p-8 rounded-2xl lg:rounded-[2rem] border border-primary/10 flex flex-col gap-6 relative overflow-hidden group">
            <div className="relative z-10 space-y-3">
              <h3 className="text-xl sm:text-2xl font-headline font-bold text-on-surface">
                Your Weekly Safety Pulse
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed max-w-md">
                {stats && stats.criticalCount > 0
                  ? `${stats.criticalCount} critical session${stats.criticalCount !== 1 ? "s" : ""} detected. Most fatigue occurs in night-time hours. Consider scheduling mandatory rest breaks.`
                  : "Fatigue levels appear stable this period. No critical sessions detected. Keep maintaining safe driving habits."}
              </p>
              <Link
                to="/analytics"
                className="inline-flex items-center gap-2 text-primary font-bold text-sm group-hover:gap-4 transition-all"
              >
                View Full Analysis
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
            {weeklyTrend.length > 0 && (
              <div className="relative z-10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                  7-Day Fatigue Trend
                </p>
                <WeeklyTrendChart points={weeklyTrend} />
              </div>
            )}
            <div className="absolute right-0 bottom-0 w-64 h-64 opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-700">
              <div className="w-full h-full bg-primary/40 rounded-full blur-[100px]" />
            </div>
          </div>

          {/* Safety Milestones */}
          <div className="bg-surface-container p-6 sm:p-8 rounded-2xl lg:rounded-[2rem] flex flex-col justify-center items-center text-center space-y-4 border border-outline-variant/10">
            <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <span
                className="material-symbols-outlined text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                emoji_events
              </span>
            </div>
            <div>
              <h4 className="text-lg sm:text-xl font-headline font-bold text-on-surface">Safety Milestones</h4>
              <p className="text-on-surface-variant text-xs mt-1">
                {stats && stats.safetyScore >= 80
                  ? `Safety score of ${stats.safetyScore} — excellent vigilance across ${stats.totalSessions} recorded sessions.`
                  : `${stats?.totalSessions ?? 0} sessions recorded. Focus on reducing drowsy episodes to improve your score.`}
              </p>
            </div>
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Safety score</span>
                <span className="text-on-surface font-bold">{stats?.safetyScore ?? 100}/100</span>
              </div>
              <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                <div
                  className="bg-secondary h-full rounded-full transition-all duration-700"
                  style={{ width: `${stats?.safetyScore ?? 100}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
