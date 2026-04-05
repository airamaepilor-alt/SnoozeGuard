import type { Face } from "react-native-vision-camera-face-detector";

/** Mouth height / width from ML Kit mouth landmarks (yawn → ratio rises). */
export function mouthOpenRatio(face: Face): number | null {
  const L = face.landmarks?.MOUTH_LEFT;
  const R = face.landmarks?.MOUTH_RIGHT;
  const B = face.landmarks?.MOUTH_BOTTOM;
  if (!L || !R || !B) return null;
  const w = Math.hypot(R.x - L.x, R.y - L.y);
  if (w < 4) return null;
  const midX = (L.x + R.x) / 2;
  const midY = (L.y + R.y) / 2;
  const h = Math.hypot(B.x - midX, B.y - midY);
  return h / w;
}

const OPEN = 0.38;
const CLOSED = 0.24;
const COOLDOWN_MS = 2200;

export type YawnEdgeDetector = {
  /** Call when mouth looks open enough for a sustained yawn closing. */
  onYawn: () => void;
};

/**
 * Detects one yawn when the mouth opens past {@link OPEN} then falls back below {@link CLOSED}.
 */
export function createYawnEdgeDetector(onYawn: () => void): {
  pushRatio: (ratio: number | null, now: number) => void;
} {
  let open = false;
  let sawOpen = false;
  let lastYawnAt = 0;

  return {
    pushRatio(ratio: number | null, now: number) {
      if (ratio == null || Number.isNaN(ratio)) {
        open = false;
        return;
      }
      if (now - lastYawnAt < COOLDOWN_MS) {
        open = ratio >= OPEN;
        return;
      }
      if (ratio >= OPEN) {
        open = true;
        sawOpen = true;
      } else if (ratio <= CLOSED) {
        if (open && sawOpen) {
          lastYawnAt = now;
          onYawn();
        }
        open = false;
        sawOpen = false;
      }
    },
  };
}
