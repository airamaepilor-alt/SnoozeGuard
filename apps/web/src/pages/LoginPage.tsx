import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

// ─── Google SVG icon ──────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─── Password field ───────────────────────────────────────────────────────────

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  right,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  right?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <label htmlFor={id} className="text-sm font-bold text-on-surface">
          {label}
        </label>
        {right}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "••••••••••••••••"}
          autoComplete={autoComplete}
          required
          className="w-full bg-surface-container rounded-xl py-3.5 sm:py-4 pl-5 pr-12 text-on-surface placeholder:text-outline/70 focus:ring-2 focus:ring-primary/60 focus:outline-none transition-all duration-200 text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          <span className="material-symbols-outlined text-[20px]">
            {show ? "visibility_off" : "visibility"}
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

export function LoginPage() {
  const { session, loading } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  function switchMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setInfo(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // Client-side validation matching mobile
    if (mode === "signup") {
      if (!displayName.trim()) {
        setError("Please enter your display name.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) setError(err.message);
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: displayName.trim(), email: email.trim() },
          },
        });
        if (err) {
          setError(err.message);
        } else {
          if (data.user?.id) {
            await supabase.from("profiles").upsert({
              id: data.user.id,
              email: (data.user.user_metadata?.email as string) || data.user.email || email,
              full_name: (data.user.user_metadata?.full_name as string) || displayName.trim(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "id" });
          }
          setInfo("Account created! Check your email to confirm, then sign in.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (err) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isSignUp = mode === "signup";

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background font-body text-on-surface grid grid-cols-1 lg:grid-cols-2">

      {/* ── Left: Branding panel (desktop only) ── */}
      <section className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden bg-surface-container-lowest">
        {/* Atmospheric depth layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-background via-surface-container-lowest to-surface-container-low" />
          {/* Primary glow — top right */}
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]" />
          {/* Secondary glow — bottom left */}
          <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full bg-secondary/6 blur-[100px]" />
          {/* Center ambient */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/4 blur-[140px]" />
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(var(--sg-primary)/1) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--sg-primary)/1) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Brand top */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-on-primary-container flex items-center justify-center">
              <span
                className="material-symbols-outlined text-on-primary text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                security
              </span>
            </div>
            <h1 className="font-headline text-lg font-bold tracking-wider text-primary uppercase">
              SnoozeGuard
            </h1>
          </div>
        </div>

        {/* Centre tagline */}
        <div className="relative z-10 max-w-sm">
          <p className="font-headline font-extrabold text-primary leading-tight mb-6"
            style={{ fontSize: "clamp(2rem, 3vw, 2.75rem)" }}>
            The Guardian<br />Pulse
          </p>
          <div className="flex items-start gap-3 text-on-surface-variant">
            <span
              className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              security
            </span>
            <p className="text-base leading-relaxed">
              Enterprise-grade safety monitoring for elite fleets and solo operators.
            </p>
          </div>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 flex gap-10">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-outline font-label">
              System Status
            </span>
            <span className="font-headline font-bold text-secondary">Vigilant: Active</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-outline font-label">
              Encrypted Channel
            </span>
            <span className="font-headline font-bold text-primary">AES-256-GCM</span>
          </div>
        </div>
      </section>

      {/* ── Right: Login form ── */}
      <section className="flex items-center justify-center p-6 sm:p-10 lg:p-16 xl:p-24 bg-surface-container-lowest overflow-y-auto">
        <div className="w-full max-w-[480px]">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 sm:mb-10 flex items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-on-primary-container flex items-center justify-center">
              <span
                className="material-symbols-outlined text-on-primary text-base"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                security
              </span>
            </div>
            <h1 className="font-headline text-xl font-bold tracking-wider text-primary uppercase">
              SnoozeGuard
            </h1>
          </div>

          {/* Header */}
          <div className="mb-8 sm:mb-10">
            <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-on-surface mb-3">
              {isSignUp ? "Create Account" : "Secure Access"}
            </h2>
            <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">
              {isSignUp
                ? "Join SnoozeGuard to start monitoring driver fatigue."
                : "Authorized personnel only. Verify your identity to proceed."}
            </p>
          </div>

          {/* Form card */}
          <div className="space-y-5 sm:space-y-6">

            {/* Google */}
            <button
              type="button"
              disabled={busy}
              onClick={() => void signInWithGoogle()}
              className="w-full min-h-[3.5rem] sm:min-h-[4rem] flex items-center justify-center gap-3 bg-surface-container-high hover:bg-surface-bright text-on-surface font-semibold rounded-xl border border-outline-variant/10 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 text-sm sm:text-base"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div className="relative flex items-center gap-4">
              <div className="flex-1 h-px bg-outline-variant/20" />
              <span className="text-[10px] sm:text-xs text-outline uppercase tracking-widest font-label shrink-0">
                or {isSignUp ? "sign up with" : "authorize via"} email
              </span>
              <div className="flex-1 h-px bg-outline-variant/20" />
            </div>

            {/* Fields */}
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 sm:space-y-5">

              {/* Display name — signup only */}
              {isSignUp && (
                <div className="space-y-2">
                  <label htmlFor="displayName" className="text-sm font-bold text-on-surface block">
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setError(null); }}
                    placeholder="Your name"
                    autoCapitalize="words"
                    autoComplete="name"
                    required={isSignUp}
                    className="w-full bg-surface-container rounded-xl py-3.5 sm:py-4 px-5 text-on-surface placeholder:text-outline/70 focus:ring-2 focus:ring-primary/60 focus:outline-none transition-all duration-200 text-sm"
                  />
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-bold text-on-surface block">
                  {isSignUp ? "Email Address" : "Work Email"}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full bg-surface-container rounded-xl py-3.5 sm:py-4 px-5 text-on-surface placeholder:text-outline/70 focus:ring-2 focus:ring-primary/60 focus:outline-none transition-all duration-200 text-sm"
                />
              </div>

              {/* Password */}
              <PasswordField
                id="password"
                label="Password"
                value={password}
                onChange={(v) => { setPassword(v); setError(null); }}
                placeholder={isSignUp ? "At least 6 characters" : "Your password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />

              {/* Confirm password — signup only */}
              {isSignUp && (
                <PasswordField
                  id="confirmPassword"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChange={(v) => { setConfirmPassword(v); setError(null); }}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                />
              )}

              {/* Error / Info messages */}
              {error && (
                <p className="text-sm font-semibold text-tertiary text-center leading-relaxed">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-sm font-semibold text-emerald-400 text-center leading-relaxed">
                  {info}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[3.5rem] sm:min-h-[4rem] bg-gradient-to-r from-primary to-on-primary-container text-on-primary font-headline font-extrabold text-base sm:text-xl rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
              >
                {busy
                  ? "Please wait…"
                  : isSignUp
                    ? "Create Account"
                    : "Enter Dashboard"}
              </button>

              {/* Mode toggle */}
              <button
                type="button"
                onClick={switchMode}
                className="w-full text-sm text-on-surface-variant hover:text-on-surface transition-colors underline underline-offset-4 py-1"
              >
                {isSignUp
                  ? "Have an account? Sign in"
                  : "Need an account? Sign up"}
              </button>
            </form>
          </div>

          {/* Footer links */}
          <div className="mt-10 sm:mt-14 pt-6 sm:pt-8 flex flex-wrap justify-between items-center gap-4 text-[10px] sm:text-xs text-outline font-label uppercase tracking-widest border-t border-outline-variant/10">
            <div className="flex gap-4 sm:gap-6">
              <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary transition-colors">Safety Terms</a>
            </div>
            <span className="opacity-60">v1.0.0</span>
          </div>
        </div>
      </section>

      {/* ── Floating help button ── */}
      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50">
        <button
          type="button"
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-surface-container-high text-primary flex items-center justify-center shadow-2xl border border-outline-variant/20 hover:scale-110 active:scale-95 transition-all duration-200"
          aria-label="Help"
        >
          <span className="material-symbols-outlined text-[20px] sm:text-[22px]">help</span>
        </button>
      </div>
    </div>
  );
}
