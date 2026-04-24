import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

type TelemetryRow = {
  id: number;
  recorded_at: string;
  drowsiness_level: number;
  yawn_count_delta: number;
  head_event_count_delta: number;
  sudden_brake: boolean;
  session_id: string;
};

type SessionDetail = {
  id: string;
  started_at: string;
  ended_at: string | null;
  device_type: string;
  user_id: string;
};

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

function drowsinessColor(level: number): { pill: string; dot: string; text: string } {
  if (level >= 7) return { pill: "bg-tertiary/10 border-tertiary/20", dot: "bg-tertiary", text: "text-tertiary" };
  if (level >= 4) return { pill: "bg-secondary/10 border-secondary/20", dot: "bg-secondary", text: "text-secondary" };
  return { pill: "bg-primary/10 border-primary/20", dot: "bg-primary", text: "text-primary" };
}

function alertLevelBadge(level: number): { label: string; cls: string } {
  if (level >= 8) return { label: `Level ${level} (CRITICAL)`, cls: "text-white bg-error-container" };
  if (level >= 6) return { label: `Level ${level} (Warning)`, cls: "text-tertiary bg-tertiary-container/40" };
  if (level >= 4) return { label: `Level ${level} (Caution)`, cls: "text-secondary bg-secondary/10" };
  if (level >= 1) return { label: `Level ${level} (Mild)`, cls: "text-primary bg-primary/10" };
  return { label: "Level 0 (Optimal)", cls: "text-slate-400 bg-surface-container-high" };
}

function buildTrendChart(
  telemetry: TelemetryRow[]
): { points: { t: string; level: number }[]; maxLevel: number } {
  const points = telemetry.map((r) => ({ t: r.recorded_at, level: Number(r.drowsiness_level) }));
  const maxLevel = points.reduce((max, p) => Math.max(max, p.level), 0);
  return { points, maxLevel };
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !sessionId) return;

    const fetchSessionDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch session
        const { data: sess, error: sessErr } = await supabase
          .from("driving_sessions")
          .select("*")
          .eq("id", sessionId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (sessErr || !sess) {
          setError("Session not found or access denied");
          setLoading(false);
          return;
        }

        setSession(sess as SessionDetail);

        // Fetch telemetry
        const { data: tel, error: telErr } = await supabase
          .from("session_telemetry")
          .select("*")
          .eq("session_id", sessionId)
          .order("recorded_at", { ascending: true });

        if (!telErr && tel) {
          setTelemetry(tel as TelemetryRow[]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    };

    void fetchSessionDetail();
  }, [user?.id, sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-on-surface-variant text-sm">
        <span className="material-symbols-outlined animate-spin mr-2 text-primary">progress_activity</span>
        Loading session details…
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="space-y-4 max-w-2xl">
        <button
          onClick={() => navigate("/history")}
          className="flex items-center gap-2 text-primary font-bold text-sm hover:gap-4 transition-all mb-6"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to History
        </button>
        <div className="flex items-center gap-4 p-6 bg-error-container/20 rounded-2xl border border-error-container/30">
          <div className="w-10 h-10 rounded-full bg-error-container/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-error-container" style={{ fontVariationSettings: "'FILL' 1" }}>
              error
            </span>
          </div>
          <p className="text-on-surface-variant text-sm">{error || "Session not found"}</p>
        </div>
      </div>
    );
  }

  const dateStr = new Date(session.started_at).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const startTimeStr = new Date(session.started_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  const duration = formatDuration(session.started_at, session.ended_at);

  const telStats = {
    sampleCount: telemetry.length,
    avgDrowsiness: telemetry.length ? telemetry.reduce((a, r) => a + Number(r.drowsiness_level), 0) / telemetry.length : 0,
    yawnSum: telemetry.reduce((a, r) => a + (r.yawn_count_delta ?? 0), 0),
    headSum: telemetry.reduce((a, r) => a + (r.head_event_count_delta ?? 0), 0),
    brakeCount: telemetry.filter((r) => r.sudden_brake).length,
    maxLevel: telemetry.length ? Math.max(...telemetry.map((r) => Number(r.drowsiness_level))) : 0,
  };

  const { points, maxLevel } = buildTrendChart(telemetry);
  const avgColor = drowsinessColor(telStats.avgDrowsiness);
  const maxBadge = alertLevelBadge(telStats.maxLevel);

  // Build chart SVG
  const chartW = 800;
  const chartH = 200;
  const chartPad = 40;
  const step = points.length > 1 ? (chartW - chartPad * 2) / (points.length - 1) : 0;
  const pts = points.map((p, i) => {
    const x = chartPad + i * step;
    const y = chartH - chartPad - (p.level / Math.max(10, maxLevel)) * (chartH - chartPad * 2);
    return `${x},${y}`;
  });

  return (
    <div className="space-y-8 font-body text-on-surface">
      {/* Back button */}
      <button
        onClick={() => navigate("/history")}
        className="flex items-center gap-2 text-primary font-bold text-sm hover:gap-4 transition-all"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Back to History
      </button>

      {/* Header */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-headline font-extrabold tracking-tight text-on-surface">
              Session Details
            </h1>
            <p className="text-on-surface-variant font-medium text-sm sm:text-base mt-1">
              {dateStr} at {startTimeStr} — {duration}
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${avgColor.pill}`}
          >
            <span className={`w-2 h-2 rounded-full ${avgColor.dot} animate-pulse`} />
            <span className={`text-sm font-bold ${avgColor.text}`}>
              {Math.round(telStats.avgDrowsiness * 10)}%
            </span>
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-surface-container p-4 rounded-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Samples</p>
          <p className="text-2xl font-headline font-black text-on-surface mt-2">{telStats.sampleCount}</p>
        </div>
        <div className="bg-surface-container p-4 rounded-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Max Alert</p>
          <p className={`text-2xl font-headline font-black mt-2 ${maxBadge.cls}`}>{telStats.maxLevel}</p>
        </div>
        <div className="bg-surface-container p-4 rounded-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Yawns</p>
          <p className="text-2xl font-headline font-black text-on-surface mt-2">{telStats.yawnSum}</p>
        </div>
        <div className="bg-surface-container p-4 rounded-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Head Nods</p>
          <p className="text-2xl font-headline font-black text-on-surface mt-2">{telStats.headSum}</p>
        </div>
        <div className="bg-surface-container p-4 rounded-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Brakes</p>
          <p className="text-2xl font-headline font-black text-on-surface mt-2">{telStats.brakeCount}</p>
        </div>
      </section>

      {/* Drowsiness trend chart */}
      {points.length > 0 && (
        <section className="bg-surface-container-low rounded-2xl p-6 sm:p-8 border border-outline-variant/10">
          <h2 className="text-xl font-headline font-bold text-on-surface mb-6">Drowsiness Trend</h2>
          <div className="overflow-x-auto">
            <svg
              width={chartW}
              height={chartH}
              className="text-primary w-full"
              viewBox={`0 0 ${chartW} ${chartH}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid lines */}
              {[0, 2, 4, 6, 8].map((i) => {
                const y = chartH - chartPad - (i / 10) * (chartH - chartPad * 2);
                return (
                  <g key={`grid-${i}`}>
                    <line x1={chartPad} y1={y} x2={chartW - chartPad} y2={y} stroke="#3a3a3f" strokeWidth="1" />
                    <text x={chartPad - 8} y={y} textAnchor="end" dominantBaseline="middle" fill="#c6c6cd" fontSize="10">
                      {i}
                    </text>
                  </g>
                );
              })}
              {/* Line chart */}
              <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" points={pts.join(" ")} />
              {/* Data points */}
              {points.map((p, i) => {
                const x = chartPad + i * step;
                const y = chartH - chartPad - (p.level / Math.max(10, maxLevel)) * (chartH - chartPad * 2);
                const color = p.level >= 7 ? "#ff6b6b" : p.level >= 4 ? "#ffa94d" : "#51cf66";
                return <circle key={`pt-${i}`} cx={x} cy={y} r="4" fill={color} />;
              })}
            </svg>
          </div>
        </section>
      )}

      {/* Telemetry table */}
      {telemetry.length === 0 ? (
        <div className="flex items-center gap-4 p-6 bg-primary/5 rounded-2xl border border-primary/10">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
          </div>
          <p className="text-on-surface-variant text-sm">No telemetry samples recorded for this session.</p>
        </div>
      ) : (
        <section className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3 text-center">Level</th>
                  <th className="px-4 py-3 text-center">Yawn Δ</th>
                  <th className="px-4 py-3 text-center">Head Δ</th>
                  <th className="px-4 py-3 text-center">Brake</th>
                </tr>
              </thead>
              <tbody>
                {telemetry.map((r) => {
                  const dc = drowsinessColor(r.drowsiness_level);
                  return (
                    <tr key={r.id} className="border-t border-outline-variant/10 hover:bg-surface-container/30">
                      <td className="px-4 py-3 text-on-surface text-xs">
                        {new Date(r.recorded_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-center">
                        <span className={dc.text}>{r.drowsiness_level}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant text-center">
                        {r.yawn_count_delta || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant text-center">
                        {r.head_event_count_delta || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-center">
                        {r.sudden_brake ? (
                          <span className="text-tertiary font-bold">●</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
