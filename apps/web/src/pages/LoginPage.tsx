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
    <div className="flex min-h-dvh flex-col bg-[#0b1326] px-4 py-10 text-[#dae2fd]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <h1 className="mb-1 text-center text-3xl font-extrabold tracking-tight text-sky-300">SnoozeGuard</h1>
        <p className="mb-8 text-center text-sm text-zinc-400">Supabase Auth · Sleep detection system</p>

        <button
          type="button"
          disabled={busy}
          onClick={() => void signInWithGoogle()}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/25 bg-[#171f33]/90 py-3 font-medium text-zinc-100 shadow-[0_0_24px_rgba(56,189,248,0.08)] backdrop-blur-md hover:bg-[#222a3d] disabled:opacity-50"
        >
          <span aria-hidden className="text-lg font-bold text-sky-300">
            G
          </span>
          Continue with Google
        </button>
        <p className="mb-6 text-center text-xs text-zinc-500">
          Enable the Google provider and add this site URL to redirect allowlist in the Supabase dashboard.
        </p>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-sky-500/15 bg-[#222a3d]/80 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          <label className="block text-sm text-zinc-400">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-600/80 bg-[#0b1326]/80 px-3 py-2.5 text-zinc-100 placeholder:text-zinc-600"
              autoComplete="email"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-600/80 bg-[#0b1326]/80 px-3 py-2.5 text-zinc-100"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-sky-600 py-3 font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="w-full text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
      </div>

      <footer className="mx-auto mt-8 max-w-lg pb-6 text-center text-[11px] leading-relaxed text-zinc-500">
        Encrypted session sync · Row-level security on Supabase · No passwords stored in this app (handled by Supabase Auth).
      </footer>
    </div>
  );
}
