import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import type { Theme } from "../theme";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function sameDay(a: Date, b: Date): boolean {
  return dayMs(a) === dayMs(b);
}

type Props = {
  visible: boolean;
  fromDate: string;
  toDate: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
};

export function DateRangePicker({ visible, fromDate, toDate, onApply, onClose }: Props) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [picking, setPicking] = useState<"start" | "end">("start");
  const wasVisible = useRef(false);

  // Initialize picker state when modal opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (visible && !wasVisible.current) {
      const s = toLocalDate(fromDate);
      const e = toLocalDate(toDate);
      setStart(s);
      setEnd(e);
      setViewYear(s.getFullYear());
      setViewMonth(s.getMonth());
      setPicking("start");
    }
    wasVisible.current = visible;
  }, [visible]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();

  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const todayMs = dayMs(new Date());
  const startMs = start ? dayMs(start) : null;
  const endMs = end ? dayMs(end) : null;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const handleDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    if (picking === "start" || (start && end)) {
      setStart(d);
      setEnd(null);
      setPicking("end");
    } else if (picking === "end") {
      if (start && d < start) {
        setEnd(start);
        setStart(d);
      } else {
        setEnd(d);
      }
      setPicking("start");
    }
  };

  const canApply = Boolean(start && end);
  const isSingleDay = start && end && sameDay(start, end);

  const formatDisplay = (d: Date | null) =>
    d ? d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "Select date";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Selected range chips */}
          <View style={styles.rangeRow}>
            <Pressable
              style={[styles.chip, picking === "start" && styles.chipActive]}
              onPress={() => setPicking("start")}
            >
              <Text style={styles.chipLabel}>FROM</Text>
              <Text style={[styles.chipDate, picking === "start" && { color: t.primary }]}>
                {formatDisplay(start)}
              </Text>
            </Pressable>
            <MaterialIcons name="arrow-forward" size={16} color={t.onSurfaceVariant} />
            <Pressable
              style={[styles.chip, picking === "end" && styles.chipActive]}
              onPress={() => { if (start) setPicking("end"); }}
            >
              <Text style={styles.chipLabel}>TO</Text>
              <Text style={[styles.chipDate, picking === "end" && { color: t.primary }]}>
                {formatDisplay(end)}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>
            {picking === "start" ? "Tap a start date" : "Now tap an end date"}
          </Text>

          {/* Month nav */}
          <View style={styles.monthNav}>
            <Pressable onPress={prevMonth} hitSlop={12} style={styles.navBtn}>
              <MaterialIcons name="chevron-left" size={26} color={t.onSurface} />
            </Pressable>
            <Text style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
            <Pressable onPress={nextMonth} hitSlop={12} style={styles.navBtn}>
              <MaterialIcons name="chevron-right" size={26} color={t.onSurface} />
            </Pressable>
          </View>

          {/* Day-of-week header */}
          <View style={styles.row}>
            {DOW.map((d) => (
              <Text key={d} style={styles.dowLabel}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((day, di) => {
                if (day === null) return <View key={di} style={styles.cell} />;

                const dTime = new Date(viewYear, viewMonth, day).getTime();
                const isStart = startMs !== null && dTime === startMs;
                const isEnd = endMs !== null && dTime === endMs;
                const inRange = startMs !== null && endMs !== null && dTime > startMs && dTime < endMs;
                const isToday = dTime === todayMs;
                const hasRange = startMs !== null && endMs !== null && !isSingleDay;

                return (
                  <Pressable key={di} style={styles.cell} onPress={() => handleDay(day)}>
                    {/* Range background strips */}
                    {inRange && <View style={[styles.strip, styles.stripFull]} />}
                    {isStart && hasRange && <View style={[styles.strip, styles.stripRight]} />}
                    {isEnd && hasRange && <View style={[styles.strip, styles.stripLeft]} />}

                    {/* Day circle */}
                    <View style={[
                      styles.circle,
                      (isStart || isEnd) && styles.circleSelected,
                      isToday && !isStart && !isEnd && styles.circleToday,
                    ]}>
                      <Text style={[
                        styles.dayNum,
                        (isStart || isEnd) && styles.dayNumSelected,
                        inRange && styles.dayNumInRange,
                        isToday && !isStart && !isEnd && { color: t.primary },
                      ]}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]}
              disabled={!canApply}
              onPress={() => { if (start && end) onApply(toISO(start), toISO(end)); }}
            >
              <Text style={styles.applyText}>Apply</Text>
            </Pressable>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#000000bb",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    backgroundColor: t.surfaceContainerLow,
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: `${t.outlineVariant}44`,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 18,
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    flex: 1,
    backgroundColor: `${t.surfaceContainerHigh}cc`,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: `${t.outlineVariant}55`,
  },
  chipActive: {
    borderColor: t.primary,
    backgroundColor: `${t.primary}12`,
  },
  chipLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: t.onSurfaceVariant,
    marginBottom: 3,
  },
  chipDate: {
    fontSize: 12,
    fontWeight: "700",
    color: t.onSurface,
  },
  hint: {
    fontSize: 11,
    color: t.onSurfaceVariant,
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 14,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  navBtn: { padding: 2 },
  monthLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: t.onSurface,
  },
  row: {
    flexDirection: "row",
  },
  dowLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: t.onSurfaceVariant,
    paddingVertical: 6,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  strip: {
    position: "absolute",
    top: "18%",
    bottom: "18%",
    backgroundColor: `${t.primary}20`,
  },
  stripFull: { left: 0, right: 0 },
  stripRight: { left: "50%", right: 0 },
  stripLeft: { left: 0, right: "50%" },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  circleSelected: {
    backgroundColor: t.primary,
  },
  circleToday: {
    borderWidth: 1.5,
    borderColor: t.primary,
  },
  dayNum: {
    fontSize: 13,
    color: t.onSurface,
    fontWeight: "400",
  },
  dayNumSelected: {
    color: t.onPrimary,
    fontWeight: "800",
  },
  dayNumInRange: {
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${t.outlineVariant}88`,
    alignItems: "center",
  },
  cancelText: { color: t.onSurface, fontWeight: "700", fontSize: 14 },
  applyBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: t.primary,
    alignItems: "center",
    shadowColor: t.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyBtnDisabled: { opacity: 0.4 },
  applyText: { color: t.onPrimary, fontWeight: "800", fontSize: 14 },
});
