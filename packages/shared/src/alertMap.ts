export type AlertLevelConfig = {
  label: string;
  actions: string[];
  /** Session yawn count that activates this level (OR logic with head_count) */
  yawn_count: number;
  /** Session head-movement event count that activates this level (OR logic with yawn_count) */
  head_count: number;
};

/** Keys are stringified levels, e.g. "6", "7", "8". */
export type AlertMap = Record<string, AlertLevelConfig>;

export const DEFAULT_ALERT_MAP: AlertMap = {
  "6":  { label: "Mild fatigue",        actions: ["voice"],                                           yawn_count: 3,  head_count: 20  },
  "7":  { label: "Moderate fatigue",    actions: ["voice", "vibration"],                              yawn_count: 5,  head_count: 35  },
  "8":  { label: "High fatigue",        actions: ["vibration", "voice"],                              yawn_count: 8,  head_count: 55  },
  "9":  { label: "Severe — pull over",  actions: ["voice", "vibration", "iot_led", "iot_buzzer"],    yawn_count: 12, head_count: 80  },
  "10": { label: "Critical — stop now", actions: ["voice", "vibration", "iot_led", "iot_buzzer"],    yawn_count: 18, head_count: 110 },
};

/** Valid action types */
const VALID_ACTIONS = new Set(["voice", "vibration", "iot_led", "iot_buzzer"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseAlertMap(raw: unknown): AlertMap {
  if (!isRecord(raw)) return { ...DEFAULT_ALERT_MAP };
  const out: AlertMap = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isRecord(v)) continue;
    const def = DEFAULT_ALERT_MAP[k];
    const label = typeof v.label === "string" ? v.label : def?.label ?? `Level ${k}`;
    const actions = Array.isArray(v.actions) 
      ? v.actions.filter((a): a is string => typeof a === "string" && VALID_ACTIONS.has(a)) 
      : [];
    const yawn_count = typeof v.yawn_count === "number" ? v.yawn_count : def?.yawn_count ?? 3;
    const head_count = typeof v.head_count === "number" ? v.head_count : def?.head_count ?? 20;
    out[k] = {
      label,
      actions: actions.length ? actions : def?.actions ?? ["voice"],
      yawn_count,
      head_count,
    };
  }
  return Object.keys(out).length ? out : { ...DEFAULT_ALERT_MAP };
}

/**
 * Compute drowsiness level from per-level thresholds stored in the alert map.
 * Returns the highest level whose yawn OR head threshold has been reached.
 * Sudden brake immediately returns level 9.
 */
export function computeLevelFromAlertMap(
  yawnCount: number,
  headCount: number,
  suddenBrake: boolean,
  alertMap: AlertMap,
): number {
  // sudden brake is handled as a special alert — does not affect drowsiness level
  const levels = Object.keys(alertMap)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  let result = 0;
  for (const lv of levels) {
    const cfg = alertMap[String(lv)];
    if (yawnCount >= cfg.yawn_count || headCount >= cfg.head_count) {
      result = lv;
    }
  }
  return result;
}

/** Highest alert_map key ≤ current level (e.g. level 7 → config for "7"). */
export function alertConfigForDrowsinessLevel(level: number, map: AlertMap): AlertLevelConfig | null {
  const lv = Math.round(Number(level));
  const numericKeys = Object.keys(map)
    .map((k) => Number(k))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  if (numericKeys.length === 0) return null;
  const atOrBelow = numericKeys.filter((k) => k <= lv);
  if (atOrBelow.length === 0) return null;
  const chosen = Math.max(...atOrBelow);
  return map[String(chosen)] ?? null;
}

export function shouldAlertForLevel(drowsinessLevel: number, triggerLevel: number): boolean {
  return Number(drowsinessLevel) >= Number(triggerLevel);
}
