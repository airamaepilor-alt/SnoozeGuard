/** Admin `admin_config` fields used to map yaw/head counts into risk. */
export type DrowsinessSignalThresholds = {
  yawn_threshold: number;
  head_movement_threshold: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Deterministic drowsiness level (0–10) from cumulative session signals and admin thresholds.
 * Intended to align FR-5 with the same formula on web + mobile; replace weights when ML lands.
 */
export function computeDrowsinessLevelFromSignals(input: {
  sessionYawnCount: number;
  sessionHeadEventCount: number;
  suddenBrakeThisTick: boolean;
  thresholds: DrowsinessSignalThresholds;
  /** Optional 0–10 from another estimator (e.g. accel / vision); blended when set. */
  motionProxyLevel?: number;
}): number {
  const yTh = Math.max(1, Number(input.thresholds.yawn_threshold) || 1);
  const hTh = Math.max(1, Number(input.thresholds.head_movement_threshold) || 1);
  const yRatio = input.sessionYawnCount / yTh;
  const hRatio = input.sessionHeadEventCount / hTh;
  let score = 1 + 2.2 * Math.min(2, yRatio) + 2.2 * Math.min(2, hRatio);
  if (input.suddenBrakeThisTick) score += 2;
  if (input.motionProxyLevel != null && !Number.isNaN(input.motionProxyLevel)) {
    const m = clamp(input.motionProxyLevel, 0, 10);
    score = 0.55 * score + 0.45 * m;
  }
  return clamp(Math.round(score), 0, 10);
}

export function drowsinessStatusLabel(level: number): { label: string; band: "low" | "mid" | "high" } {
  const lv = clamp(Math.round(level), 0, 10);
  if (lv <= 3) return { label: "Optimal", band: "low" };
  if (lv <= 5) return { label: "Stable", band: "low" };
  if (lv <= 7) return { label: "Elevated", band: "mid" };
  return { label: "Critical attention", band: "high" };
}
