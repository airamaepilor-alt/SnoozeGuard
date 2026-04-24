/**
 * Face detection utilities for web (mirrors mobile/ml/faceDetection.ts)
 */

// ─── Yawn detector ───────────────────────────────────────────────────────────
// Fires when jaw > 0.7 (jawOpen score).
// Uses open→close hysteresis so it counts ONCE per yawn, not every frame.

const JAW_OPEN_THRESHOLD = 0.7;
const JAW_CLOSE_THRESHOLD = 0.4;
const YAWN_COOLDOWN_MS = 2000;

export function createYawnDetector(onYawn: () => void): {
  process: (jawOpen: number) => void;
  reset: () => void;
} {
  let wasOpen = false;
  let lastYawnAt = 0;

  return {
    process(jawOpen) {
      const now = Date.now();
      if (now - lastYawnAt < YAWN_COOLDOWN_MS) {
        wasOpen = jawOpen >= JAW_OPEN_THRESHOLD;
        return;
      }

      if (jawOpen >= JAW_OPEN_THRESHOLD) {
        wasOpen = true;
      } else if (jawOpen <= JAW_CLOSE_THRESHOLD && wasOpen) {
        // Jaw closed after being wide open → count one yawn
        lastYawnAt = now;
        wasOpen = false;
        onYawn();
      }
    },
    reset() {
      wasOpen = false;
      lastYawnAt = 0;
    },
  };
}

// ─── Head movement detector ──────────────────────────────────────────────────
// Fires when |pitch| > 0.35 OR |roll| > 0.25 radians (converted from degrees).
// Position-based: fires once on ENTRY into off-axis zone. Cooldown prevents
// re-firing while the head stays turned.

const HEAD_PITCH_THRESHOLD = 20; // degrees, equivalent to ~0.35 rad
const HEAD_ROLL_THRESHOLD = 14; // degrees, equivalent to ~0.25 rad
const HEAD_COOLDOWN_MS = 500;

export function createHeadDetector(onHeadEvent: () => void): {
  process: (pitchDeg: number, rollDeg: number) => void;
  reset: () => void;
} {
  let wasOffCenter = false;
  let lastEventAt = 0;

  return {
    process(pitchDeg, rollDeg) {
      const now = Date.now();
      const offCenter =
        Math.abs(pitchDeg) > HEAD_PITCH_THRESHOLD || Math.abs(rollDeg) > HEAD_ROLL_THRESHOLD;

      // Count on TRANSITION: on-center → off-center
      if (offCenter && !wasOffCenter && now - lastEventAt > HEAD_COOLDOWN_MS) {
        lastEventAt = now;
        onHeadEvent();
      }

      wasOffCenter = offCenter;
    },
    reset() {
      wasOffCenter = false;
      lastEventAt = 0;
    },
  };
}

// ─── Sustained tilt detector ─────────────────────────────────────────────────
// Head tilted left/right or up/down for ≥10 seconds → fires alert.
// Uses the same pitch/roll thresholds as the head movement detector.

const TILT_DURATION_MS = 10_000;
const TILT_MAX_MISSES = 4; // grace window for missed detections

export function createTiltDetector(onSustainedTilt: () => void): {
  process: (pitchDeg: number, rollDeg: number) => void;
  reset: () => void;
} {
  let tiltStartAt: number | null = null;
  let fired = false;
  let missCount = 0;

  return {
    process(pitchDeg, rollDeg) {
      const now = Date.now();
      const isTilted =
        Math.abs(pitchDeg) > HEAD_PITCH_THRESHOLD || Math.abs(rollDeg) > HEAD_ROLL_THRESHOLD;

      if (isTilted) {
        missCount = 0;
        if (tiltStartAt === null) {
          tiltStartAt = now;
          fired = false;
        } else if (!fired && now - tiltStartAt >= TILT_DURATION_MS) {
          fired = true;
          onSustainedTilt();
        }
      } else {
        missCount += 1;
        if (missCount > TILT_MAX_MISSES) {
          tiltStartAt = null;
          fired = false;
        }
      }
    },
    reset() {
      tiltStartAt = null;
      fired = false;
      missCount = 0;
    },
  };
}
