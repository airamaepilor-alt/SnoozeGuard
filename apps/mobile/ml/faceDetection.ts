/**
 * MediaPipe Face Landmarker — detection logic.
 *
 * jaw   = faceBlendshapes jawOpen score (0.0–1.0)  → YAWN if jaw > 0.7
 * pitch = estimated from nose/eye/chin landmark positions (looking up/down)
 * roll  = angle of eye-to-eye line from horizontal (head tilt)
 *         HEAD_MOVE if |pitch| > 0.35 OR |roll| > 0.25 rad
 *
 * Note: facialTransformationMatrixes are NOT enabled by the react-native-mediapipe
 * library (setOutputFacialTransformationMatrixes is never called), so we derive
 * head pose from face landmarks directly.
 */

import { documentDirectory, getInfoAsync, downloadAsync } from "expo-file-system/legacy";

// ─── MediaPipe model management ──────────────────────────────────────────────

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export async function ensureModelPath(
  onProgress?: (msg: string) => void,
): Promise<string> {
  const path = (documentDirectory ?? "") + "face_landmarker.task";
  const info = await getInfoAsync(path);
  if (!info.exists) {
    onProgress?.("Downloading face detection model (~5 MB)…");
    await downloadAsync(MODEL_URL, path);
  }
  onProgress?.("Model ready.");
  // MediaPipe native code expects a raw filesystem path — strip file:// URI prefix
  return path.replace(/^file:\/\//, "");
}

// ─── Types from react-native-mediapipe (native result shape) ─────────────────
// Note: native Android returns `label` (not `categoryName`) from categoryName()

export type MPCategory = {
  label: string;   // e.g. "jawOpen"
  score: number;   // 0.0–1.0
};

export type MPClassifications = {
  categories: MPCategory[];
};

export type MPMatrix = {
  rows: number;
  columns: number;
  data: number[];  // 16-element column-major 4×4
};

type Lm = { x: number; y: number; z: number };

// Shape of a single face result inside the results[] array
export type MPFaceLandmarkerResult = {
  faceLandmarks?: unknown[][];
  faceBlendshapes?: MPClassifications[];
  facialTransformationMatrixes?: MPMatrix[];
};

// Full bundle emitted by the onResults event (results[] + metadata)
export type MPResultsBundle = {
  handle?: number;
  results: MPFaceLandmarkerResult[];
  inputImageHeight?: number;
  inputImageWidth?: number;
  inferenceTime?: number;
};

// ─── Parse raw MediaPipe result into usable values ───────────────────────────

export type ParsedFaceFrame = {
  jawOpen: number; // 0.0–1.0 blendshape score
  pitch:   number; // radians — looking up/down
  roll:    number; // radians — tilting sideways
};

export function parseFaceFrame(result: MPFaceLandmarkerResult): ParsedFaceFrame | null {
  if (!result.faceBlendshapes?.length) return null;

  // Need landmarks for head pose estimation
  const lms = result.faceLandmarks?.[0] as Lm[] | undefined;
  if (!lms || lms.length < 468) return null;

  // ── jawOpen from blendshapes ──────────────────────────────────────────────
  const jaw = result.faceBlendshapes[0].categories
    .find((c) => c.label === "jawOpen" || (c as { categoryName?: string }).categoryName === "jawOpen")?.score ?? 0;

  // ── Roll: angle of the eye-to-eye line from horizontal ───────────────────
  // Landmark 33 = left eye outer corner, 263 = right eye outer corner
  // In normalized image coords y increases downward; atan2 gives signed angle.
  const lEye = lms[33];
  const rEye = lms[263];
  const roll = Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x);

  // ── Pitch: nose position between eye-midpoint and chin ───────────────────
  // Landmark 168 = nose bridge (between eyes), 1 = nose tip, 152 = chin
  // noseRatio ≈ 0.45 when looking straight; increases when looking down.
  // Scaled so that ±0.12 ratio offset ≈ ±0.35 rad (the detection threshold).
  const noseBridge = lms[168];
  const noseTip    = lms[1];
  const chin       = lms[152];
  const faceH = chin.y - noseBridge.y;
  if (faceH <= 0) return null;
  const noseRatio = (noseTip.y - noseBridge.y) / faceH;
  const pitch = (noseRatio - 0.45) * 3.0; // scale to approximate radians

  return { jawOpen: jaw, pitch, roll };
}

// ─── Yawn detector ───────────────────────────────────────────────────────────
// Mirrors C# exactly: fires when jaw > 0.7 (jawOpen blendshape).
// Uses open→close hysteresis so it counts ONCE per yawn, not every frame.

const JAW_OPEN_THRESHOLD  = 0.7;  // same as C# jaw > 0.7
const JAW_CLOSE_THRESHOLD = 0.4;  // mouth must relax before next yawn counts
const YAWN_COOLDOWN_MS    = 2000;

export function createYawnDetector(onYawn: () => void): {
  process: (frame: ParsedFaceFrame | null, now: number) => void;
} {
  let wasOpen    = false;
  let lastYawnAt = 0;

  return {
    process(frame, now) {
      if (!frame) { wasOpen = false; return; }

      if (now - lastYawnAt < YAWN_COOLDOWN_MS) {
        wasOpen = frame.jawOpen >= JAW_OPEN_THRESHOLD;
        return;
      }

      if (frame.jawOpen >= JAW_OPEN_THRESHOLD) {
        wasOpen = true;
      } else if (frame.jawOpen <= JAW_CLOSE_THRESHOLD && wasOpen) {
        // Jaw closed after being wide open → count one yawn
        lastYawnAt = now;
        wasOpen    = false;
        onYawn();
      }
    },
  };
}

// ─── Head movement detector ──────────────────────────────────────────────────
// Mirrors C# exactly: fires when |pitch| > 0.4 OR |roll| > 0.4.
// Position-based: fires once on ENTRY into off-road zone. Cooldown prevents
// re-firing while the head stays turned.

// Roll threshold: atan2-based, 0.25 rad ≈ 14° tilt (landmark-based, more sensitive than matrix)
// Pitch threshold: 0.35 rad equivalent in our scaled coordinate
const HEAD_ROLL_THRESHOLD  = 0.25;
const HEAD_PITCH_THRESHOLD = 0.35;
/** @deprecated kept for tiltDetector which uses same check */
const HEAD_THRESHOLD_RAD = HEAD_ROLL_THRESHOLD;
const HEAD_COOLDOWN_MS   = 500;

export function createHeadDetector(onHeadEvent: () => void): {
  process: (frame: ParsedFaceFrame | null, now: number) => void;
} {
  let wasOffCenter = false;
  let lastEventAt  = 0;

  return {
    process(frame, now) {
      if (!frame) { wasOffCenter = false; return; }

      const offCenter =
        Math.abs(frame.pitch) > HEAD_PITCH_THRESHOLD ||
        Math.abs(frame.roll)  > HEAD_ROLL_THRESHOLD;

      // Count on TRANSITION: on-road → off-road
      if (offCenter && !wasOffCenter && now - lastEventAt > HEAD_COOLDOWN_MS) {
        lastEventAt = now;
        onHeadEvent();
      }

      wasOffCenter = offCenter;
    },
  };
}

// ─── Sustained tilt detector ─────────────────────────────────────────────────
// Head tilted left/right (roll) or up/down (pitch) for ≥10 seconds → level 8.
// Uses the same pitch/roll thresholds as the head movement detector.

const TILT_DURATION_MS = 10_000;
const TILT_MAX_MISSES  = 4; // at ~600ms/frame, 4 misses ≈ 2.4s grace window

export function createTiltDetector(onSustainedTilt: () => void): {
  process: (frame: ParsedFaceFrame | null, now: number) => void;
  reset:   () => void;
} {
  let tiltStartAt: number | null = null;
  let fired     = false;
  let missCount = 0;

  return {
    process(frame, now) {
      if (!frame) {
        missCount += 1;
        if (missCount > TILT_MAX_MISSES) { tiltStartAt = null; fired = false; }
        return;
      }
      missCount = 0;

      const isTilted =
        Math.abs(frame.pitch) > HEAD_PITCH_THRESHOLD ||
        Math.abs(frame.roll)  > HEAD_ROLL_THRESHOLD;

      if (isTilted) {
        if (tiltStartAt === null) { tiltStartAt = now; fired = false; }
        else if (!fired && now - tiltStartAt >= TILT_DURATION_MS) {
          fired = true;
          onSustainedTilt();
        }
      } else {
        tiltStartAt = null;
        fired       = false;
      }
    },
    reset() { tiltStartAt = null; fired = false; missCount = 0; },
  };
}
