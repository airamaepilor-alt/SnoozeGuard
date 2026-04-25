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

function getAlertVoiceMessage(level: number): string {
  if (level === 6)  return "Warning. Level 6 drowsiness detected. Please stay alert and active.";
  if (level === 7)  return "Warning, warning. Level 7 drowsiness detected. Please stay alert or pull over and rest.";
  if (level === 8)  return "High alert, high alert. Level 8 drowsiness detected. Please pull over and rest.";
  if (level === 9)  return "Critical alert, critical alert. Level 9 drowsiness detected. Please pull over and rest immediately.";
  if (level >= 10)  return "Emergency, emergency. Level 10 drowsiness detected. Please pull over immediately and rest.";
  return "Warning: drowsiness detected. Please stay alert.";
}

function getAlertVoiceRepeats(level: number): number {
  if (level === 8) return 2;
  if (level >= 9)  return 3;
  return 1;
}

/** Speak message using Web Speech API */
function speakMessage(message: string, repeats = 1): void {
  if (!("speechSynthesis" in window)) return;
  for (let i = 0; i < repeats; i++) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }
}

/** Cancel all active alert audio immediately. */
export function stopWebAlert(): void {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(0);
  if (audioCtx?.state === "running") void audioCtx.suspend();
}

/** Best-effort web implementations of BRD alert_map actions. */
export async function playWebAlert(actions: string[], level?: number): Promise<void> {
  for (const a of actions) {
    switch (a) {
      case "voice":
        if (level) {
          const msg = getAlertVoiceMessage(level);
          const repeats = getAlertVoiceRepeats(level);
          speakMessage(msg, repeats);
        }
        break;
      case "sound":
        await beep(880, 120, 0.06);
        break;
      case "alarm":
        await beep(440, 200, 0.12);
        await beep(880, 200, 0.12);
        break;
      case "vibration":
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([0, 500, 300, 500, 300, 500, 300, 500, 300, 500]);
        }
        break;
      case "iot_led":
      case "iot_buzzer":
      case "flashlight":
        // LED/buzzer handled server-side, flashlight requires permission
        break;
      default:
        break;
    }
  }
}
