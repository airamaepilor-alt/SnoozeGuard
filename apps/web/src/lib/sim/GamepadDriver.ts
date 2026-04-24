// GamepadDriver.ts — reads steering wheel + pedals via the Web Gamepad API

export interface GamepadState {
  steer: number;    // -1 (full left) to +1 (full right)
  throttle: number; // 0 (off) to 1 (full press)
  brake: number;    // 0 (off) to 1 (full press)
  connected: boolean;
  deviceName: string;
}

export interface AxisMapping {
  steerAxis: number;
  throttleAxis: number;
  brakeAxis: number;
  steerInvert: boolean;
  throttleInvert: boolean;
  brakeInvert: boolean;
  throttleRange: [number, number]; // [min_raw, max_raw]
  brakeRange: [number, number];
}

const STORAGE_KEY = "sg_sim_axis_mapping";

// Default works for Logitech G29/G920: axis 0 = steer, 1 = throttle, 2 = brake
// Pedals rest at +1.0 and go to -1.0 when fully pressed → invert=true
export const DEFAULT_MAPPING: AxisMapping = {
  steerAxis: 0,
  throttleAxis: 1,
  brakeAxis: 2,
  steerInvert: false,
  throttleInvert: true,
  brakeInvert: true,
  throttleRange: [-1, 1],
  brakeRange: [-1, 1],
};

function normalizeAxis(
  raw: number,
  range: [number, number],
  invert: boolean,
): number {
  const [lo, hi] = range;
  const span = hi - lo;
  if (span === 0) return 0;
  let n = (raw - lo) / span;
  if (invert) n = 1 - n;
  return Math.max(0, Math.min(1, n));
}

export class GamepadDriver {
  private mapping: AxisMapping;

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.mapping = saved ? (JSON.parse(saved) as AxisMapping) : { ...DEFAULT_MAPPING };
  }

  /** Read current gamepad state. Call every animation frame. */
  getState(): GamepadState {
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp || gp.axes.length < 1) continue;

      const m = this.mapping;
      let steer = gp.axes[m.steerAxis] ?? 0;
      if (m.steerInvert) steer = -steer;
      steer = Math.max(-1, Math.min(1, steer));

      const rawT = gp.axes[m.throttleAxis] ?? m.throttleRange[0];
      const throttle = normalizeAxis(rawT, m.throttleRange, m.throttleInvert);

      const rawB = gp.axes[m.brakeAxis] ?? m.brakeRange[0];
      const brake = normalizeAxis(rawB, m.brakeRange, m.brakeInvert);

      return { steer, throttle, brake, connected: true, deviceName: gp.id };
    }
    return { steer: 0, throttle: 0, brake: 0, connected: false, deviceName: "" };
  }

  /** Returns all raw axis values from the first connected gamepad. Used by calibration UI. */
  getRawAxes(): number[] {
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp && gp.axes.length >= 1) return [...gp.axes];
    }
    return [];
  }

  getMapping(): AxisMapping {
    return { ...this.mapping };
  }

  saveMapping(m: AxisMapping) {
    this.mapping = { ...m };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  }

  resetMapping() {
    this.mapping = { ...DEFAULT_MAPPING };
    localStorage.removeItem(STORAGE_KEY);
  }

  hasCustomMapping(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }
}
