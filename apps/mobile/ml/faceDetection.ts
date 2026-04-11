/**
 * MediaPipe Face Landmarker — detection logic.
 *
 * Mirrors the C# reference project exactly:
 *   pitch = Math.asin(-m[6])
 *   roll  = Math.atan2(m[4], m[0])
 *   jaw   = faceBlendshapes jawOpen score (0.0–1.0)
 *
 *   HEAD_MOVE if |pitch| > 0.4 rad  OR  |roll| > 0.4 rad
 *   YAWN      if jaw > 0.7
 */

import * as FileSystem from "expo-file-system";

// ─── MediaPipe model management ──────────────────────────────────────────────

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export async function ensureModelPath(
  onProgress?: (msg: string) => void,
): Promise<string> {
  const path = (FileSystem.documentDirectory ?? "") + "face_landmarker.task";
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    onProgress?.("Downloading face detection model (~5 MB)…");
    await FileSystem.downloadAsync(MODEL_URL, path);
  }
  onProgress?.("Model ready.");
  return path;
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

// Shape of a single face result inside the results[] array
export type MPFaceLandmarkerResult = {
  faceLandmarks?: unknown[][];
  faceBlendshapes?: MPClassifications[];
  facialTransformationMatrixes?: MPMatrix[];
};

// Full bundle emitted by the onResults event (results[] + metadata)
export type MPResultsBundle = {
  handle: number;
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
  if (
    !result.faceBlendshapes?.length ||
    !result.facialTransformationMatrixes?.length
  ) return null;

  // Native Android uses field name "label" (from category.categoryName())
  const jaw = result.faceBlendshapes[0].categories
    .find((c) => c.label === "jawOpen")?.score ?? 0;

  const m = result.facialTransformationMatrixes[0].data;
  if (!m || m.length < 16) return null;

  const pitch = Math.asin(Math.max(-1, Math.min(1, -m[6]))); // clamp for asin safety
  const roll  = Math.atan2(m[4], m[0]);

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

const HEAD_THRESHOLD_RAD = 0.4;  // same as C# 0.4 radians ≈ 23°
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
        Math.abs(frame.pitch) > HEAD_THRESHOLD_RAD ||
        Math.abs(frame.roll)  > HEAD_THRESHOLD_RAD;

      // Count on TRANSITION: on-road → off-road (same as C# sendMessage on each frame,
      // but we gate with wasOffCenter to avoid counting every frame)
      if (offCenter && !wasOffCenter && now - lastEventAt > HEAD_COOLDOWN_MS) {
        lastEventAt = now;
        onHeadEvent();
      }

      wasOffCenter = offCenter;
    },
  };
}

// ─── Sustained tilt detector ─────────────────────────────────────────────────
// Head stays off-road for ≥5 seconds → fires level 8 alert.

const TILT_DURATION_MS = 5_000;
const TILT_MAX_MISSES  = 10; // at ~15fps, 10 misses ≈ 650ms grace window

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
        Math.abs(frame.pitch) > HEAD_THRESHOLD_RAD ||
        Math.abs(frame.roll)  > HEAD_THRESHOLD_RAD;

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
