import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Path, Stop, Line, Circle, Text as SvgText, G } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { getDatabase } from "../db/database";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { InfoModal } from "../components/InfoModal";
import type { Theme } from "../theme";

type DayPoint = { label: string; avg: number; sessions: number };
type HourPoint = { hour: number; avg: number };
type DetectionTotals = { yawns: number; heads: number; tilts: number; brakes: number };

const FILTER_OPTIONS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Circadian block labels (4-hour blocks)
const HOUR_BLOCK_LABELS = [
  "00:00 - 03:59",
  "04:00 - 07:59",
  "08:00 - 11:59",
  "12:00 - 15:59",
  "16:00 - 19:59",
  "20:00 - 23:59",
];

// ─── Smooth area chart ────────────────────────────────────────────────────────

function AreaChart({ points, width, height, t }: { points: DayPoint[]; width: number; height: number; t: Theme }) {
  if (points.length === 0) {
    return (
      <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: t.onSurfaceVariant, fontSize: 12 }}>No data available</Text>
      </View>
    );
  }

  // For single point, duplicate it to create a line
  const displayPoints = points.length === 1 ? [points[0], points[0]] : points;

  const pad = { top: 16, right: 12, bottom: 36, left: 32 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const xOf = (i: number) => pad.left + (i / (displayPoints.length - 1)) * cw;
  const yOf = (v: number) => pad.top + ch - (v / 10) * ch;
  const labelStep = Math.max(1, Math.ceil(displayPoints.length / 7));

  const linePts = displayPoints.map((p, i) => ({ x: xOf(i), y: yOf(p.avg) }));
  let d = `M ${linePts[0].x} ${linePts[0].y}`;
  for (let i = 1; i < linePts.length; i++) {
    const cp1x = linePts[i - 1].x + (linePts[i].x - linePts[i - 1].x) / 3;
    const cp1y = linePts[i - 1].y;
    const cp2x = linePts[i].x - (linePts[i].x - linePts[i - 1].x) / 3;
    const cp2y = linePts[i].y;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${linePts[i].x} ${linePts[i].y}`;
  }

  const fillPath = `${d} L ${linePts[linePts.length - 1].x} ${pad.top + ch} L ${linePts[0].x} ${pad.top + ch} Z`;

  const variance = displayPoints.reduce((s, p) => s + Math.abs(p.avg - (displayPoints.reduce((a, b) => a + b.avg, 0) / displayPoints.length)), 0) / displayPoints.length;
  const stability = variance < 1 ? "STABLE" : variance < 2 ? "MODERATE" : "VOLATILE";
  const stabilityColor = stability === "STABLE" ? "#4ade80" : stability === "MODERATE" ? t.secondary : t.tertiary;

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 }}>
        <Text style={{ fontSize: 10, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: stabilityColor + "33", color: stabilityColor }}>{stability}</Text>
      </View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="drowsinessGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.primary} stopOpacity="0.45" />
            <Stop offset="1" stopColor={t.primary} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        {[2, 4, 6, 8, 10].map((v) => (
          <Line key={v} x1={pad.left} y1={yOf(v)} x2={pad.left + cw} y2={yOf(v)}
            stroke={t.outlineVariant} strokeWidth="0.5" strokeDasharray="3,4" />
        ))}
        <Path d={fillPath} fill="url(#drowsinessGrad)" />
        <Path d={d} stroke={t.primary} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {linePts.map((pt, i) => (
          <Circle key={i} cx={pt.x} cy={pt.y} r="3.5" fill={t.primary} />
        ))}
        {[0, 5, 10].map((v) => (
          <SvgText key={v} x={pad.left - 4} y={yOf(v) + 4} fontSize="9" fill={t.onSurfaceVariant} textAnchor="end">{String(v)}</SvgText>
        ))}
        {points.map((p, i) => {
          if (i % labelStep !== 0 && i !== points.length - 1) return null;
          return <SvgText key={i} x={xOf(i)} y={pad.top + ch + 18} fontSize="9" fill={t.onSurfaceVariant} textAnchor="middle">{p.label}</SvgText>;
        })}
      </Svg>
    </View>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function BarChart({ data, width, height, color, maxOverride, t }: {
  data: { label: string; value: number }[];
  width: number; height: number; color: string; maxOverride?: number; t: Theme;
}) {
  if (data.length === 0) return null;
  const pad = { top: 8, right: 8, bottom: 28, left: 32 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  const maxVal = maxOverride ?? Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(6, cw / data.length - 4);
  const gap = cw / data.length;
  // Strip # so the SVG gradient ID is valid
  const gradId = `bg${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.5" />
        </LinearGradient>
      </Defs>
      {[0, 0.5, 1].map((f) => {
        const y = pad.top + ch * (1 - f);
        const v = Math.round(maxVal * f);
        return (
          <G key={f}>
            <Line x1={pad.left} y1={y} x2={pad.left + cw} y2={y}
              stroke={t.outlineVariant} strokeWidth="0.5" strokeDasharray="3,4" />
            <SvgText x={pad.left - 4} y={y + 4} fontSize="9" fill={t.onSurfaceVariant} textAnchor="end">{String(v)}</SvgText>
          </G>
        );
      })}
      {data.map((d, i) => {
        const barH = Math.max(2, (d.value / maxVal) * ch);
        const x = pad.left + i * gap + gap / 2 - barW / 2;
        const y = pad.top + ch - barH;
        const labelX = pad.left + i * gap + gap / 2;
        return (
          <G key={i}>
            <Path
              d={`M ${x + 3} ${y} Q ${x} ${y} ${x} ${y + 3} L ${x} ${pad.top + ch} L ${x + barW} ${pad.top + ch} L ${x + barW} ${y + 3} Q ${x + barW} ${y} ${x + barW - 3} ${y} Z`}
              fill={`url(#${gradId})`}
            />
            {d.label ? (
              <SvgText x={labelX} y={pad.top + ch + 14} fontSize="9" fill={t.onSurfaceVariant} textAnchor="middle">{d.label}</SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ data, size, t }: { data: { label: string; value: number; color: string }[]; size: number; t: Theme }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: t.onSurfaceVariant, fontSize: 11 }}>No data</Text>
    </View>
  );

  const cx = size / 2, cy = size / 2, r = size * 0.38, innerR = size * 0.22;
  let startAngle = -Math.PI / 2;
  const paths: { d: string; color: string }[] = [];

  for (const seg of data) {
    if (seg.value === 0) continue;
    const angle = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle), iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle), iy2 = cy + innerR * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    paths.push({
      d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`,
      color: seg.color,
    });
    startAngle = endAngle;
  }

  return (
    <Svg width={size} height={size}>
      {paths.map((p, i) => <Path key={i} d={p.d} fill={p.color} />)}
    </Svg>
  );
}

type AnalyticsTooltipKey = "drowsiness" | "activity" | "hourly" | "detection" | null;

const ANALYTICS_TOOLTIPS: Record<NonNullable<AnalyticsTooltipKey>, { title: string; body: string }> = {
  drowsiness: {
    title: "Drowsiness Fluctuations",
    body: "Shows your average drowsiness level (0–10) for each day. Higher values mean more drowsiness was detected that day. A flat low line is ideal. Spikes indicate days you were especially tired while driving.",
  },
  activity: {
    title: "Session Activity",
    body: "How many driving sessions you started on each day of the week. Helps identify which days you drive most — consider extra rest on those days.",
  },
  hourly: {
    title: "Hourly Drowsiness Pattern",
    body: "Average drowsiness level grouped by 4-hour circadian blocks. Early morning (00-04) shows baseline drowsiness, while evening (20-24) may peak. Peaks reveal your highest-risk times to drive.",
  },
  detection: {
    title: "Detection Breakdown",
    body: "Total drowsiness signals captured this period:\n• Yawns — mouth open wide\n• Head drops — head nodding down\n• Tilts — sustained head tilt sideways\n• Brakes — sudden hard braking\n\nA large slice of any category indicates a recurring drowsiness pattern.",
  },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export function AnalyticsScreen() {
  const session = useSession();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [filterDays, setFilterDays] = useState(30);
  const [dayPoints, setDayPoints] = useState<DayPoint[]>([]);
  const [hourPoints, setHourPoints] = useState<HourPoint[]>([]);
  const [detections, setDetections] = useState<DetectionTotals>({ yawns: 0, heads: 0, tilts: 0, brakes: 0 });
  const [sessionByDay, setSessionByDay] = useState<{ label: string; value: number }[]>([]);
  const [tooltip, setTooltip] = useState<AnalyticsTooltipKey>(null);

  const load = useCallback(() => {
    try {
      const db = getDatabase();
      const since = new Date(Date.now() - filterDays * 86400 * 1000).toISOString();

      // Query telemetry grouped by RECORDED date (not session start date) for accuracy
      const dayRows = db.getAllSync<{ day: string; avg: number; sessions: number }>(
        `SELECT DATE(t.recorded_at) AS day,
                AVG(t.drowsiness_level) AS avg,
                COUNT(DISTINCT s.id) AS sessions
         FROM driving_sessions_local s
         INNER JOIN session_telemetry_local t ON t.local_session_id = s.id
         WHERE s.user_id = ? AND t.recorded_at >= ?
         GROUP BY DATE(t.recorded_at)
         ORDER BY day ASC`,
        session.user.id, since,
      );
      
      // Fill entire date range with 0 for days without data (matches web behavior)
      const dayMap = new Map(dayRows.map(r => [r.day, { avg: Number(r.avg ?? 0), sessions: Number(r.sessions) }]));
      const filledDays: DayPoint[] = [];
      for (let i = filterDays - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400 * 1000);
        const key = d.toISOString().slice(0, 10);
        const entry = dayMap.get(key);
        filledDays.push({
          label: d.toLocaleDateString("en", { month: "numeric", day: "numeric" }),
          avg: entry?.avg ?? 0,
          sessions: entry?.sessions ?? 0,
        });
      }
      
      setDayPoints(filledDays);

      const dowRows = db.getAllSync<{ dow: number; count: number }>(
        `SELECT CAST(strftime('%w', s.started_at) AS INTEGER) AS dow, COUNT(*) AS count
         FROM driving_sessions_local s
         WHERE s.user_id = ? AND s.started_at >= ?
         GROUP BY dow`,
        session.user.id, since,
      );
      const dowMap = Object.fromEntries(dowRows.map((r) => [r.dow, r.count]));
      setSessionByDay(DAY_LABELS.map((l, i) => ({ label: l, value: dowMap[i] ?? 0 })));

      const hourRows = db.getAllSync<{ hour: number; avg: number }>(
        `SELECT (CAST(strftime('%H', t.recorded_at) AS INTEGER) / 4) AS hour,
                AVG(t.drowsiness_level) AS avg
         FROM driving_sessions_local s
         INNER JOIN session_telemetry_local t ON t.local_session_id = s.id
         WHERE s.user_id = ? AND t.recorded_at >= ? AND t.drowsiness_level IS NOT NULL
         GROUP BY hour
         ORDER BY hour`,
        session.user.id, since,
      );
      setHourPoints(hourRows.map((r) => ({ hour: Number(r.hour), avg: Number(r.avg ?? 0) })));

      const detRow = db.getFirstSync<{ yawns: number; heads: number; tilts: number; brakes: number }>(
        `SELECT COALESCE(SUM(t.yawn_count_delta), 0) AS yawns,
                COALESCE(SUM(t.head_event_count_delta), 0) AS heads,
                COALESCE(SUM(t.head_tilt_delta), 0) AS tilts,
                COALESCE(SUM(CASE WHEN t.sudden_brake=1 THEN 1 ELSE 0 END), 0) AS brakes
         FROM driving_sessions_local s
         LEFT JOIN session_telemetry_local t ON t.local_session_id = s.id
         WHERE s.user_id = ? AND s.started_at >= ?`,
        session.user.id, since,
      );
      setDetections({
        yawns: Number(detRow?.yawns ?? 0),
        heads: Number(detRow?.heads ?? 0),
        tilts: Number(detRow?.tilts ?? 0),
        brakes: Number(detRow?.brakes ?? 0),
      });
    } catch (err) {
      // DB may not be ready yet
    }
  }, [session.user.id, filterDays]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const CHART_W = 340;
  const donutData = [
    { label: "Yawns", value: detections.yawns, color: theme.primary },
    { label: "Head", value: detections.heads, color: theme.secondary },
    { label: "Tilts", value: detections.tilts, color: "#f59e0b" },
    { label: "Brakes", value: detections.brakes, color: theme.tertiary },
  ];

  const hourBarData = hourPoints.map((h) => ({
    label: HOUR_BLOCK_LABELS[h.hour] || "",
    value: h.avg,
  }));

  const activeTooltip = tooltip ? ANALYTICS_TOOLTIPS[tooltip] : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {activeTooltip && (
        <InfoModal
          visible
          title={activeTooltip.title}
          body={activeTooltip.body}
          onClose={() => setTooltip(null)}
        />
      )}

      <Text style={styles.title}>Analytics</Text>
      <Text style={styles.sub}>Your driving drowsiness insights</Text>

      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((o) => (
          <Pressable key={o.days} style={[styles.pill, filterDays === o.days && styles.pillActive]} onPress={() => setFilterDays(o.days)}>
            <Text style={[styles.pillText, filterDays === o.days && styles.pillTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Drowsiness Fluctuations</Text>
          <Pressable onPress={() => setTooltip("drowsiness")} hitSlop={8}>
            <MaterialIcons name="info-outline" size={16} color={theme.onSurfaceVariant} />
          </Pressable>
        </View>
        <Text style={styles.cardSub}>Average drowsiness level per day</Text>
        <AreaChart points={dayPoints} width={CHART_W} height={160} t={theme} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Session Activity</Text>
          <Pressable onPress={() => setTooltip("activity")} hitSlop={8}>
            <MaterialIcons name="info-outline" size={16} color={theme.onSurfaceVariant} />
          </Pressable>
        </View>
        <Text style={styles.cardSub}>Sessions per day of week</Text>
        <BarChart data={sessionByDay} width={CHART_W} height={130} color="#60a5fa" t={theme} />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Hourly Drowsiness Pattern</Text>
          <Pressable onPress={() => setTooltip("hourly")} hitSlop={8}>
            <MaterialIcons name="info-outline" size={16} color={theme.onSurfaceVariant} />
          </Pressable>
        </View>
        <Text style={styles.cardSub}>Avg drowsiness level by hour driven</Text>
        {hourBarData.length > 0 ? (
          <BarChart data={hourBarData} width={CHART_W} height={130} color="#f97316" maxOverride={10} t={theme} />
        ) : (
          <Text style={styles.empty}>No hourly data for this period</Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Detection Breakdown</Text>
          <Pressable onPress={() => setTooltip("detection")} hitSlop={8}>
            <MaterialIcons name="info-outline" size={16} color={theme.onSurfaceVariant} />
          </Pressable>
        </View>
        <Text style={styles.cardSub}>Total events detected this period</Text>
        <View style={styles.donutRow}>
          <DonutChart data={donutData} size={130} t={theme} />
          <View style={styles.legend}>
            {donutData.map((d) => (
              <View key={d.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                <Text style={styles.legendLabel}>{d.label}</Text>
                <Text style={styles.legendValue}>{d.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.background },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: t.onSurface },
  sub: { fontSize: 13, color: t.onSurfaceVariant, marginTop: 2, marginBottom: 12 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  pill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: t.onSurfaceVariant },
  pillActive: { backgroundColor: t.primary, borderColor: t.primary },
  pillText: { fontSize: 12, fontWeight: "700", color: t.onSurfaceVariant },
  pillTextActive: { color: t.onPrimary },
  card: {
    backgroundColor: `${t.surfaceContainerLow}ee`,
    borderRadius: 20, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: `${t.outlineVariant}88`,
    overflow: "hidden",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: t.onSurface },
  cardSub: { fontSize: 11, color: t.onSurfaceVariant, marginTop: 2, marginBottom: 10 },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 4 },
  legend: { flex: 1, gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, color: t.onSurfaceVariant, fontSize: 13 },
  legendValue: { color: t.onSurface, fontWeight: "800", fontSize: 14 },
  empty: { color: t.onSurfaceVariant, fontSize: 12, marginTop: 8, fontStyle: "italic" },
});
