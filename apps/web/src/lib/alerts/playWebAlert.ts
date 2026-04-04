let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function beep(freq: number, durationMs: number, gain = 0.08): Promise<void> {
  const ctx = getCtx();
  if (ctx.state === "suspended") void ctx.resume();
  return new Promise((resolve) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    osc.onended = () => resolve();
    window.setTimeout(() => resolve(), durationMs + 50);
  });
}

/** Best-effort web implementations of BRD alert_map actions. */
export async function playWebAlert(actions: string[]): Promise<void> {
  for (const a of actions) {
    switch (a) {
      case "sound":
      case "voice":
        await beep(880, 120, 0.06);
        break;
      case "alarm":
        await beep(440, 200, 0.12);
        await beep(880, 200, 0.12);
        break;
      case "vibration":
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([100, 80, 100]);
        }
        break;
      case "flashlight":
      case "iot_led":
        break;
      default:
        break;
    }
  }
}
