/**
 * On-device motion pipeline (FR-3 / FR-4):
 * - Accelerometer statistics → stillness vs movement, jerk → sudden braking proxy.
 * - Gyroscope spikes → head movement proxy (complements accel variance).
 * - Yawn: handled on mobile via ML Kit mouth landmarks in `DriveScreen` (this class keeps `yawnCountDelta` at 0).
 */

export type TelemetrySample = {
  drowsinessLevel: number;
  yawnCountDelta: number;
  headEventCountDelta: number;
  suddenBrake: boolean;
};

const RING = 24;

export class HeuristicDrowsinessEstimator {
  private ring: number[] = [];
  private prevMag = 1;
  private stillTicks = 0;
  private level = 1;
  private gyroSpike = false;

  pushAccel(x: number, y: number, z: number) {
    const mag = Math.sqrt(x * x + y * y + z * z);
    this.ring.push(mag);
    if (this.ring.length > RING) this.ring.shift();

    const jerk = Math.abs(mag - this.prevMag);
    this.prevMag = mag;

    const variance = varianceSample(this.ring);
    if (variance < 0.015) this.stillTicks += 1;
    else this.stillTicks = Math.max(0, this.stillTicks - 2);

    if (variance > 0.35) {
      this.level = Math.min(10, this.level + 0.35);
    } else if (this.stillTicks > 8) {
      this.level = Math.min(10, this.level + 0.08);
    } else {
      this.level = Math.max(0, this.level - 0.05);
    }

    this._lastVariance = variance;
    this._lastJerk = jerk;
  }

  /** Rad/s — large magnitude between ticks counts as a head movement event. */
  pushGyro(x: number, y: number, z: number) {
    const mag = Math.sqrt(x * x + y * y + z * z);
    if (mag > 1.25) this.gyroSpike = true;
  }

  private _lastVariance = 0;
  private _lastJerk = 0;

  tick(_dtMs: number): TelemetrySample {
    const headFromAccel = this._lastVariance > 0.45 ? 1 : 0;
    const headFromGyro = this.gyroSpike ? 1 : 0;
    const headEventCountDelta = headFromAccel + headFromGyro > 0 ? 1 : 0;
    this.gyroSpike = false;

    const suddenBrake = this._lastJerk > 2.2;

    return {
      drowsinessLevel: clamp(Math.round(this.level * 10) / 10, 0, 10),
      yawnCountDelta: 0,
      headEventCountDelta,
      suddenBrake,
    };
  }
}

function varianceSample(values: number[]): number {
  if (values.length < 4) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((acc, x) => acc + (x - mean) ** 2, 0) / values.length;
  return v;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
