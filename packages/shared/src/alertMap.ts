export type AlertLevelConfig = {
  label: string;
  actions: string[];
};

/** Keys are stringified levels, e.g. "6", "7", "8". */
export type AlertMap = Record<string, AlertLevelConfig>;

export const DEFAULT_ALERT_MAP: AlertMap = {
  "6": { label: "Soft alarm", actions: ["sound", "voice"] },
  "7": { label: "Strong alert", actions: ["sound", "vibration"] },
  "8": { label: "Critical", actions: ["flashlight", "alarm", "iot_led"] },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseAlertMap(raw: unknown): AlertMap {
  if (!isRecord(raw)) return { ...DEFAULT_ALERT_MAP };
  const out: AlertMap = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isRecord(v)) continue;
    const label = typeof v.label === "string" ? v.label : DEFAULT_ALERT_MAP[k]?.label ?? `Level ${k}`;
    const actions = Array.isArray(v.actions) ? v.actions.filter((a): a is string => typeof a === "string") : [];
    out[k] = { label, actions: actions.length ? actions : DEFAULT_ALERT_MAP[k]?.actions ?? ["sound"] };
  }
  return Object.keys(out).length ? out : { ...DEFAULT_ALERT_MAP };
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
