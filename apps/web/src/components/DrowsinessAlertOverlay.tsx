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
      className="fixed inset-0 z-[100] flex flex-col bg-[#0b1326]/95 text-[#dae2fd]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sg-alert-title"
      aria-describedby="sg-alert-desc"
    >
      {flash ? (
        <>
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-3 animate-pulse bg-red-500/85" aria-hidden />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-3 animate-pulse bg-red-500/85" aria-hidden />
        </>
      ) : null}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-red-300">Drowsiness alert</p>
        <h2 id="sg-alert-title" className="text-4xl font-extrabold text-white sm:text-5xl">
          Level {level}
        </h2>
        <p className="mt-2 text-lg text-sky-200">{title}</p>
        <p id="sg-alert-desc" className="mt-4 max-w-md text-sm text-zinc-400">
          {actionsSummary
            ? `Active responses: ${actionsSummary}. Pull over when safe.`
            : "Threshold exceeded. Pull over when safe."}
        </p>
        <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl bg-sky-600 py-4 text-lg font-semibold text-white hover:bg-sky-500"
          >
            I’m alert — dismiss
          </button>
          {onRestStop ? (
            <button
              type="button"
              onClick={onRestStop}
              className="rounded-xl border border-zinc-600 py-3 text-zinc-200 hover:bg-zinc-800/80"
            >
              Log rest stop intent
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
