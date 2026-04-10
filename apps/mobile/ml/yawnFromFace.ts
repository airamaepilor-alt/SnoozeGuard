const OPEN = 0.38;
const CLOSED = 0.24;
const COOLDOWN_MS = 2200;

/**
 * Detects one yawn when the mouth opens past OPEN then falls back below CLOSED.
 * Pure JS — no native dependencies.
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
