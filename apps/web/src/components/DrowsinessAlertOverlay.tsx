type Props = {
  open: boolean;
  level: number;
  title: string;
  actionsSummary: string;
  onDismiss: () => void;
  onRestStop?: () => void;
  flash?: boolean;
};

export function DrowsinessAlertOverlay({
  open,
  level,
  title,
  actionsSummary,
  onDismiss,
  onRestStop,
  flash,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background/95 font-body text-on-surface backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sg-alert-title"
      aria-describedby="sg-alert-desc"
    >
      {flash ? (
        <>
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-3 animate-pulse bg-tertiary/90" aria-hidden />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-3 animate-pulse bg-tertiary/90" aria-hidden />
        </>
      ) : null}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-tertiary">Drowsiness alert</p>
        <h2 id="sg-alert-title" className="font-headline text-4xl font-black text-on-surface sm:text-5xl">
          Level {level}
        </h2>
        <p className="mt-2 text-lg text-primary">{title}</p>
        <p id="sg-alert-desc" className="mt-4 max-w-md text-sm text-on-surface-variant">
          {actionsSummary
            ? `Active responses: ${actionsSummary}. Pull over when safe.`
            : "Threshold exceeded. Pull over when safe."}
        </p>
        <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl bg-gradient-to-br from-primary to-on-primary-container py-4 font-headline text-lg font-bold text-on-primary shadow-lg shadow-primary/20 hover:opacity-95"
          >
            I’m alert — dismiss
          </button>
          {onRestStop ? (
            <button
              type="button"
              onClick={onRestStop}
              className="rounded-xl border border-outline-variant/40 py-3 text-on-surface hover:bg-surface-container-high"
            >
              Log rest stop intent
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
