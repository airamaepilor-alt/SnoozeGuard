import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { supabase } from "../lib/supabase";

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <span
        className="material-symbols-outlined text-on-surface-variant text-sm cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        info
      </span>
      {open && (
        <div className="absolute z-50 left-7 top-1/2 -translate-y-1/2 w-64 bg-surface-container-high text-on-surface text-xs leading-relaxed rounded-2xl p-4 shadow-2xl border border-outline/20">
          {text}
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter = 7 | 30 | 90;
type DailyAvg = { date: string; avg: number };
type Pt = { x: number; y: number };

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function cutoffISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Returns Mon=0 … Sun=6 session counts. */
function buildDowCounts(sessions: { started_at: string }[]): number[] {
  const counts = Array(7).fill(0) as number[];
  for (const s of sessions) {
    let dow = new Date(s.started_at).getDay(); // 0=Sun … 6=Sat
    dow = dow === 0 ? 6 : dow - 1; // remap to Mon=0 … Sun=6
    counts[dow] += 1;
  }
  return counts;
}

/** Smooth monotone cubic bezier path string through an array of {x,y} points. */
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const cpx = (p.x + c.x) / 2;
    d += ` C${cpx},${p.y} ${cpx},${c.y} ${c.x},${c.y}`;
  }
  return d;
}

function fmtPct(v: number): string {
  return `${(v * 10).toFixed(1)}%`; // level → pct (0-10 → 0-100%)
}

function hourBlockLabel(i: number): string {
  const h = i * 4;
  const end = h + 4;
  return `${String(h).padStart(2, "0")}:00 - ${String(end === 24 ? 0 : end).padStart(2, "0")}:00`;
}

/** Color for a 0-10 drowsiness level. */
function levelColor(avg: number): { bar: string; text: string } {
  if (avg >= 7) return { bar: "bg-error", text: "text-error" };
  if (avg >= 5) return { bar: "bg-secondary", text: "text-secondary" };
  if (avg >= 3) return { bar: "bg-primary", text: "text-primary" };
  return { bar: "bg-primary/50", text: "text-primary/70" };
}

// ─── SVG Area Chart ───────────────────────────────────────────────────────────

const VW = 760;
const VH = 240;
const PAD = { top: 16, right: 8, bottom: 44, left: 8 };
const CW = VW - PAD.left - PAD.right;
const CH = VH - PAD.top - PAD.bottom;

function AreaChart({ data, filter }: { data: DailyAvg[]; filter: Filter; loading: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const noData = data.every((d) => d.avg === 0);

  // Reduce label count based on filter
  const labelStep = filter === 7 ? 1 : filter === 30 ? 4 : 14;

  const maxVal = Math.max(1, ...data.map((d) => d.avg));

  const pts: Pt[] = data.map((d, i) => ({
    x: PAD.left + (data.length > 1 ? (i / (data.length - 1)) * CW : CW / 2),
    y: PAD.top + (1 - d.avg / maxVal) * CH,
  }));

  const linePath = smoothPath(pts);
  const areaPath =
    pts.length > 0
      ? `${linePath} L${pts[pts.length - 1].x},${PAD.top + CH} L${pts[0].x},${PAD.top + CH} Z`
      : "";

  const avgAll = data.length > 0 ? data.reduce((s, d) => s + d.avg, 0) / data.length : 0;
  const prevHalf = data.slice(0, Math.floor(data.length / 2));
  const currHalf = data.slice(Math.floor(data.length / 2));
  const prevAvg = prevHalf.length ? prevHalf.reduce((s, d) => s + d.avg, 0) / prevHalf.length : 0;
  const currAvg = currHalf.length ? currHalf.reduce((s, d) => s + d.avg, 0) / currHalf.length : 0;
  const delta = currAvg - prevAvg;

  return (
    <div className="space-y-4">
      {/* Stat header row */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-headline font-bold text-on-surface">Drowsiness Fluctuations</h3>
            <Tooltip text="This line shows how sleepy you were each day. The higher the line goes, the drowsier you were. 0% = wide awake, 100% = very sleepy!" />
          </div>
          <p className="text-on-surface-variant text-sm font-medium">Avg Drowsiness % per day</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-headline font-black text-primary">
            {noData ? "—" : fmtPct(avgAll)}
          </span>
          {!noData && (
            <p
              className={`text-[10px] font-bold tracking-widest uppercase ${
                delta >= 0 ? "text-tertiary" : "text-primary"
              }`}
            >
              {delta >= 0 ? "+" : ""}
              {fmtPct(Math.abs(delta))} vs prior
            </p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-[240px] w-full select-none">
        {noData ? (
          <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant text-sm">
            No telemetry in this period
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VW} ${VH}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#7bd0ff" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#7bd0ff" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {[0, 0.33, 0.66, 1].map((f) => (
              <line
                key={f}
                x1={PAD.left}
                y1={PAD.top + f * CH}
                x2={PAD.left + CW}
                y2={PAD.top + f * CH}
                stroke="#45464d"
                strokeOpacity="0.4"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
            ))}

            {/* Area fill */}
            <path d={areaPath} fill="url(#areaGrad)" />

            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke="#7bd0ff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points + hover */}
            {pts.map((p, i) => (
              <g key={i} onMouseEnter={() => setHovered(i)}>
                <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
                {hovered === i && (
                  <>
                    <circle cx={p.x} cy={p.y} r="6" fill="#0b1326" stroke="#7bd0ff" strokeWidth="2" />
                    <rect
                      x={Math.min(p.x - 28, VW - 76)}
                      y={p.y - 32}
                      width="72"
                      height="22"
                      rx="5"
                      fill="#31394d"
                    />
                    <text
                      x={Math.min(p.x - 28, VW - 76) + 36}
                      y={p.y - 17}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#7bd0ff"
                      fontWeight="700"
                      fontFamily="Inter, sans-serif"
                    >
                      {fmtPct(data[i].avg)}
                    </text>
                  </>
                )}
              </g>
            ))}

            {/* X-axis labels */}
            {data.map((d, i) => {
              if (i % labelStep !== 0 && i !== data.length - 1) return null;
              const x = PAD.left + (data.length > 1 ? (i / (data.length - 1)) * CW : CW / 2);
              const label = new Date(d.date + "T00:00:00").toLocaleDateString("en", {
                month: "numeric",
                day: "numeric",
              });
              return (
                <text
                  key={i}
                  x={x}
                  y={VH - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#c6c6cd"
                  fontFamily="Inter, sans-serif"
                  opacity="0.7"
                >
                  {label}
                </text>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── Session Activity Bar ─────────────────────────────────────────────────────

const DOW_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function SessionActivityBar({ counts, loading }: { counts: number[]; loading: boolean }) {
  const max = Math.max(1, ...counts);
  const todayDow = (() => {
    let d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-headline font-bold text-on-surface">Session Activity</h3>
            <Tooltip text="This shows how many times you drove on each day of the week. Taller bar = more drives that day. The glowing bar is today!" />
          </div>
          <p className="text-on-surface-variant text-sm font-medium">Daily Drive Counts</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">route</span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm py-12">
          Loading…
        </div>
      ) : (
        <div className="flex items-end justify-between gap-2 pt-4" style={{ height: 140 }}>
          {counts.map((c, i) => {
            const pct = Math.max(4, Math.round((c / max) * 100));
            const isToday = i === todayDow;
            const barColor = isToday ? "bg-primary" : c > 0 ? "bg-primary/60" : "bg-surface-container-high";
            return (
              <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                <div
                  className={`w-full rounded-full transition-all ${barColor}`}
                  style={{ height: `${pct}%` }}
                  title={`${c} session${c !== 1 ? "s" : ""}`}
                />
                <span
                  className={`text-[10px] font-bold uppercase ${isToday ? "text-primary" : "text-on-surface-variant"}`}
                >
                  {DOW_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Hourly Drowsiness Distribution ──────────────────────────────────────────────

function HourlyDistribution({ hourly, loading }: { hourly: number[]; loading: boolean }) {
  const max = Math.max(1, ...hourly);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xl font-headline font-bold text-on-surface">Hourly Drowsiness Distribution</h3>
          <Tooltip text="This shows what time of day you tend to feel most sleepy while driving. Longer bar = more drowsy during that time block. Short bar = you were alert!" />
        </div>
        <p className="text-on-surface-variant text-sm font-medium">Circadian Alertness Levels</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-on-surface-variant text-sm">
          Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {hourly.map((avg, i) => {
            const { bar, text } = levelColor(avg);
            const pct = Math.round((avg / max) * 100);
            return (
              <div key={i} className="flex items-center gap-4">
                <span className="w-24 text-xs font-bold text-on-surface-variant shrink-0">
                  {hourBlockLabel(i)}
                </span>
                <div className="flex-1 h-3 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className={`h-full ${bar} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
                <span className={`w-10 text-xs font-black text-right ${text} shrink-0`}>
                  {avg > 0 ? `${pct}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

const DONUT_R = 40;
const DONUT_C = 2 * Math.PI * DONUT_R; // 251.33

type DonutSeg = { value: number; color: string; label: string };

function DonutChart({
  yawns,
  head,
  tilt,
  brakes,
  loading,
}: {
  yawns: number;
  head: number;
  tilt: number;
  brakes: number;
  loading: boolean;
}) {
  const total = yawns + head + tilt + brakes;

  const segments: DonutSeg[] = [
    { value: yawns, color: "#7bd0ff", label: "Yawns" },
    { value: head, color: "#ffb95f", label: "Head Nods" },
    { value: tilt, color: "#d8b4ff", label: "Head Tilts" },
    { value: brakes, color: "#ffb3ad", label: "Sudden Brakes" },
  ];

  // Compute each segment's dasharray/offset
  let cumPct = 0;
  const arcs = segments.map((s) => {
    const pct = total > 0 ? s.value / total : 0;
    const len = pct * DONUT_C;
    const offset = -(cumPct * DONUT_C);
    cumPct += pct;
    return { ...s, pct, len, offset };
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xl font-headline font-bold text-on-surface">Detection Breakdown</h3>
          <Tooltip text="This pie-like chart shows WHAT made you drowsy — yawning, head nodding, head tilting, or sudden braking. Bigger slice = happened more often!" />
        </div>
        <p className="text-on-surface-variant text-sm font-medium">Primary Trigger Classification</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-on-surface-variant text-sm">
          Loading…
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 px-2">
          {/* Donut SVG */}
          <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full"
              style={{ transform: "rotate(-90deg)" }}
            >
              {/* Track */}
              <circle cx="50" cy="50" r={DONUT_R} fill="transparent" stroke="#222a3d" strokeWidth="12" />
              {/* Segments */}
              {total > 0 ? (
                arcs.map((a) =>
                  a.len > 0 ? (
                    <circle
                      key={a.label}
                      cx="50"
                      cy="50"
                      r={DONUT_R}
                      fill="transparent"
                      stroke={a.color}
                      strokeWidth="12"
                      strokeDasharray={`${a.len} ${DONUT_C - a.len}`}
                      strokeDashoffset={a.offset}
                      strokeLinecap="round"
                    />
                  ) : null,
                )
              ) : (
                <circle cx="50" cy="50" r={DONUT_R} fill="transparent" stroke="#45464d" strokeWidth="12" />
              )}
            </svg>
            {/* Centre label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-headline font-black text-on-surface">
                {total > 999 ? `${(total / 1000).toFixed(1)}k` : total}
              </span>
              <span className="text-[9px] text-on-surface-variant uppercase font-black tracking-tight">
                Total Events
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-5">
            {arcs.map((a) => (
              <div key={a.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                  <span className="text-sm font-medium text-on-surface-variant">{a.label}</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-black text-on-surface">
                  <span>{total > 0 ? a.value.toLocaleString() : "—"}</span>
                  <span className="text-xs font-medium text-on-surface-variant">
                    {total > 0 ? `${Math.round(a.pct * 100)}%` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Predictive Risk Banner ───────────────────────────────────────────────────

function RiskBanner({ hourly, onReviewAlert }: { hourly: number[]; onReviewAlert: () => void }) {
  // Night blocks (20-24 = idx 5, 00-04 = idx 0) vs daytime (08-16 = idx 2+3)
  const nightAvg = (hourly[0] + hourly[5]) / 2;
  const dayAvg = (hourly[2] + hourly[3]) / 2;
  const riskPct =
    nightAvg > 0 && dayAvg > 0 ? Math.round(((nightAvg - dayAvg) / Math.max(0.1, dayAvg)) * 100) : null;

  const message =
    riskPct !== null && riskPct > 0
      ? `Analysis indicates a ${riskPct}% drowsiness increase during night shifts (22:00–04:00). Consider scheduling breaks.`
      : "No significant circadian risk pattern detected in this period. Alertness levels appear stable.";

  return (
    <div className="bg-surface-container-low rounded-2xl lg:rounded-3xl p-5 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
      <div className="flex items-start sm:items-center gap-4 sm:gap-6">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-bright flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            psychology
          </span>
        </div>
        <div>
          <h4 className="text-on-surface font-headline font-bold">Predictive Risk Assessment</h4>
          <p className="text-on-surface-variant text-sm mt-1 max-w-xl">{message}</p>
        </div>
      </div>
      <button
        onClick={onReviewAlert}
        className="shrink-0 bg-primary-container text-primary font-headline font-bold px-5 sm:px-8 py-3 rounded-xl hover:bg-primary hover:text-on-primary transition-all duration-300 whitespace-nowrap text-sm sm:text-base"
      >
        Review Alert Protocol
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [filter, setFilter] = useState<Filter>(30);
  const [loading, setLoading] = useState(true);

  const [dailyAvg, setDailyAvg] = useState<DailyAvg[]>([]);
  const [dowCounts, setDowCounts] = useState<number[]>(Array(7).fill(0));
  const [hourlyAvg, setHourlyAvg] = useState<number[]>(Array(6).fill(0));
  const [yawnSum, setYawnSum] = useState(0);
  const [headSum, setHeadSum] = useState(0);
  const [tiltSum, setTiltSum] = useState(0);
  const [brakeCount, setBrakeCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const cutoff = cutoffISO(filter);

      // Session rows — only needed for day-of-week bar chart (no telemetry join)
      const { data: sessionRows } = await supabase
        .from("driving_sessions")
        .select("started_at")
        .eq("user_id", user.id)
        .gte("started_at", cutoff);

      if (cancelled) return;
      if (!cancelled) setDowCounts(buildDowCounts(sessionRows ?? []));

      // All telemetry aggregates via RPC — no row-count cap applies to server-side aggregates
      type RpcResult = {
        daily_avg: { day: string; avg: number }[];
        hourly_avg: { block: number; avg: number }[];
        detections: { yawns: number; heads: number; tilts: number; brakes: number };
      };
      const { data: rpcRaw } = await supabase
        .rpc("get_analytics_data", { p_since: cutoff })
        .overrideTypes<RpcResult>();

      if (cancelled) return;

      const rpc = rpcRaw as RpcResult | null;

      // Daily avg — fill zeros for days without data (mirrors buildDailyAvg)
      const dayMap = new Map((rpc?.daily_avg ?? []).map((d) => [d.day, Number(d.avg)]));
      const filledDays: DailyAvg[] = [];
      for (let i = filter - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86_400_000);
        const key = d.toISOString().slice(0, 10);
        filledDays.push({ date: key, avg: dayMap.get(key) ?? 0 });
      }
      setDailyAvg(filledDays);

      // Hourly avg — 6 blocks, default 0
      const hourlyBlocks = Array(6).fill(0) as number[];
      for (const h of rpc?.hourly_avg ?? []) {
        if (h.block >= 0 && h.block < 6) hourlyBlocks[h.block] = Number(h.avg);
      }
      setHourlyAvg(hourlyBlocks);

      // Detection totals
      const det = rpc?.detections ?? { yawns: 0, heads: 0, tilts: 0, brakes: 0 };
      setYawnSum(Number(det.yawns));
      setHeadSum(Number(det.heads));
      setTiltSum(Number(det.tilts));
      setBrakeCount(Number(det.brakes));

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, filter, online]);


  return (
    <div className="space-y-10">
      {/* ── Page header + filter ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl sm:text-4xl font-headline font-black text-on-surface tracking-tight">
            Driver Drowsiness Analytics
          </h2>
          <p className="text-on-surface-variant font-body text-base">
            Systemized monitoring of cognitive state across the fleet.
            {!online && <span className="ml-2 text-secondary font-semibold">· Offline mode</span>}
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex p-1 bg-surface-container-low rounded-2xl shrink-0">
          {([7, 30, 90] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 text-sm font-headline font-bold rounded-xl transition-all ${
                filter === f
                  ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {f}D
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 1: Area chart + Session activity bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Drowsiness Fluctuations area chart (2/3 width) */}
        <div className="lg:col-span-2 bg-surface-container rounded-2xl lg:rounded-[2rem] p-5 sm:p-8 flex flex-col gap-6 relative overflow-hidden">
          <AreaChart data={dailyAvg} filter={filter} loading={loading} />
          {/* Ambient glow */}
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Session Activity bar chart (1/3 width) */}
        <div className="bg-surface-container rounded-2xl lg:rounded-[2rem] p-5 sm:p-8 flex flex-col gap-6">
          <SessionActivityBar counts={dowCounts} loading={loading} />
        </div>
      </div>

      {/* ── Row 2: Hourly distribution + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="bg-surface-container rounded-2xl lg:rounded-[2rem] p-5 sm:p-8">
          <HourlyDistribution hourly={hourlyAvg} loading={loading} />
        </div>

        <div className="bg-surface-container rounded-2xl lg:rounded-[2rem] p-5 sm:p-8">
          <DonutChart yawns={yawnSum} head={headSum} tilt={tiltSum} brakes={brakeCount} loading={loading} />
        </div>
      </div>

      {/* ── Predictive Risk Assessment footer ── */}
      {!loading && <RiskBanner hourly={hourlyAvg} onReviewAlert={() => navigate("/admin")} />}
    </div>
  );
}
