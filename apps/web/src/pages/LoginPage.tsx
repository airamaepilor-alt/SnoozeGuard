import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export function LoginPage() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) setError(err.message);
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (err) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background font-body text-on-surface selection:bg-primary/30">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[20%] h-[60%] w-[60%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[50%] w-[50%] rounded-full bg-secondary/5 blur-[120px]" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-high shadow-xl shadow-black/30">
            <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              security
            </span>
          </div>
          <h1 className="mb-2 font-headline text-3xl font-black tracking-tighter text-primary">SnoozeGuard</h1>
          <p className="max-w-[280px] text-sm text-on-surface-variant">
            Sleep Detection System — sign in with Supabase Auth (email or Google).
          </p>
        </div>

        <div className="rounded-3xl border border-outline-variant/15 bg-surface-container/90 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void signInWithGoogle()}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-outline-variant/25 bg-surface-bright transition-all hover:bg-surface-container-highest active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-lg font-bold text-primary" aria-hidden>
                G
              </span>
              <span className="text-sm font-semibold tracking-wide text-on-surface">Continue with Google</span>
            </button>
            <p className="text-center text-[11px] leading-relaxed text-on-surface-variant">
              Enable the Google provider and add this site URL to the redirect allowlist in Supabase.
            </p>
          </div>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-outline-variant/30" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">or email</span>
            <div className="h-px flex-1 bg-outline-variant/30" />
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <label className="block text-sm text-on-surface-variant">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-outline-variant/40 bg-background/80 px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm text-on-surface-variant">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-outline-variant/40 bg-background/80 px-4 py-3 text-on-surface focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </label>
            {error ? <p className="text-sm text-tertiary">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-gradient-to-br from-primary to-on-primary-container py-3.5 font-headline font-bold text-on-primary shadow-lg shadow-primary/15 transition hover:opacity-95 disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
            <button
              type="button"
              className="w-full text-sm text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
            </button>
          </form>
        </div>
      </main>

      <footer className="relative z-10 mx-auto max-w-lg px-6 pb-8 text-center text-[11px] leading-relaxed text-on-surface-variant">
        Encrypted session sync · Row-level security on Supabase · Passwords handled by Supabase Auth (not stored in this app).
      </footer>
    </div>
  );
}
