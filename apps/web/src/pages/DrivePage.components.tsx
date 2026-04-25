function getAlertHint(level: number): string {
  if (level === 6) return "Stay alert and active — you can continue driving.";
  if (level === 7) return "Consider pulling over and taking a rest break.";
  if (level === 8) return "Please pull over and rest now.";
  if (level === 9) return "Pull over immediately. Emergency contact will be notified.";
  if (level >= 10) return "EMERGENCY — Pull over and rest immediately!";
  return "Stay alert.";
}

export function DrowsinessAlertOverlay({
  open,
  level,
  title,
  actionsSummary,
  onDismiss,
  flash,
  emergencyContact,
  ecCountdown,
  ecSent,
  onNotifyNow,
}: {
  open: boolean;
  level: number;
  title: string;
  actionsSummary?: string;
  onDismiss: () => void;
  flash?: boolean;
  elapsedMs?: number;
  emergencyContact?: { contact_name: string; contact_phone: string | null } | null;
  ecCountdown?: number | null;
  ecSent?: boolean;
  onNotifyNow?: () => void;
}) {
  if (!open) return null;

  const hint = getAlertHint(level);
  const levelColor =
    level >= 10
      ? "text-red-400"
      : level >= 8
        ? "text-tertiary"
        : level >= 6
          ? "text-secondary"
          : "text-on-surface";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        flash ? "bg-tertiary/10" : "bg-black/85"
      }`}
    >
      {flash && (
        <>
          <div className="absolute top-0 left-0 right-0 h-2 bg-tertiary animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-tertiary animate-pulse" />
        </>
      )}

      <div className="bg-background rounded-3xl p-8 max-w-md w-full mx-4 text-center flex flex-col items-center gap-4 shadow-2xl border border-outline-variant/20">
        <p className="text-[10px] font-black tracking-[0.3em] text-tertiary uppercase">
          Drowsiness Alert
        </p>

        <p className={`text-8xl font-extrabold font-headline leading-none ${levelColor}`}>
          {level}
        </p>

        <div className="w-full h-px bg-outline-variant/20" />

        <p className="text-lg font-semibold text-primary w-full">{title}</p>
        <p className="text-sm text-on-surface-variant leading-relaxed">{hint}</p>

        {actionsSummary && (
          <p className="text-[10px] text-slate-500 font-mono">
            Actions: {actionsSummary}
          </p>
        )}

        {level >= 9 && (
          <div className="w-full bg-tertiary/10 border border-tertiary/30 rounded-2xl p-4 text-left">
            {ecCountdown !== null && ecCountdown !== undefined ? (
              <p className="text-sm font-bold text-tertiary text-center mb-3">
                Auto-notifying emergency contact in {ecCountdown}s
              </p>
            ) : ecSent ? (
              <p className="text-sm font-bold text-green-400 text-center mb-3">
                Emergency contact has been notified.
              </p>
            ) : null}
            {emergencyContact && (
              <div className="flex gap-2 flex-wrap">
                {emergencyContact.contact_phone && (
                  <a
                    href={`tel:${emergencyContact.contact_phone}`}
                    className="flex-1 text-center py-2 bg-green-500/20 border border-green-500/40 rounded-xl text-xs font-bold text-on-surface min-w-0"
                  >
                    📞 Call {emergencyContact.contact_name}
                  </a>
                )}
                {emergencyContact.contact_phone && (
                  <a
                    href={`sms:${emergencyContact.contact_phone}?body=URGENT: I triggered a drowsiness alert on SnoozeGuard. Please check on me or call me immediately.`}
                    className="flex-1 text-center py-2 bg-primary/20 border border-primary/40 rounded-xl text-xs font-bold text-on-surface min-w-0"
                  >
                    💬 SMS
                  </a>
                )}
                {onNotifyNow && (
                  <button
                    onClick={onNotifyNow}
                    className="flex-1 py-2 bg-tertiary/20 border border-tertiary/40 rounded-xl text-xs font-bold text-on-surface min-w-0"
                  >
                    🚨 Notify Now
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onDismiss}
          className="mt-2 w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-sm active:scale-95 transition-all hover:opacity-90"
        >
          I'm alert — dismiss
        </button>
      </div>
    </div>
  );
}
