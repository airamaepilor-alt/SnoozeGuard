import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useThemeToggle } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="relative inline-flex items-center w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ background: on ? "rgb(var(--sg-primary))" : "rgb(var(--sg-surface-container-highest))" }}
    >
      <span
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300"
        style={{ left: on ? "calc(100% - 1.25rem)" : "0.25rem" }}
      />
    </button>
  );
}

export function AccountPage() {
  const { user, profile, signOut } = useAuth();
  const { isDark, toggleTheme } = useThemeToggle();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState("");
  const [autoPurge, setAutoPurge] = useState(true);
  const [audioBoost, setAudioBoost] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const displayName = fullName.trim() || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const email = user?.email ?? "";
  const roleLabel = profile?.role === "super_admin" ? "Fleet Manager" : "Driver";

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    // Mirror mobile: update auth user_metadata so full_name is consistent
    // across both auth.users and profiles (if a DB trigger syncs them)
    const [authResult, profileResult] = await Promise.all([
      supabase.auth.updateUser({ data: { full_name: fullName.trim() || null } }),
      supabase.from("profiles").update({ full_name: fullName.trim() || null }).eq("id", user.id),
    ]);

    setSaving(false);
    const error = authResult.error ?? profileResult.error;
    if (error) {
      setMessage({ text: `Error: ${error.message}`, ok: false });
    } else {
      setMessage({ text: "Profile updated successfully.", ok: true });
    }
  }

  function onReset() {
    setFullName(profile?.full_name ?? "");
    setPhone("");
    setAutoPurge(true);
    setAudioBoost(false);
    setMessage({ text: "Reset to current saved values.", ok: true });
  }

  return (
    <form onSubmit={onSave} className="max-w-5xl mx-auto font-body text-on-surface space-y-12 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-headline font-black text-2xl sm:text-3xl text-primary uppercase tracking-wider mb-1">
          Account Settings
        </h1>
        <p className="text-sm text-on-surface-variant">
          Manage your driver profile, preferences, and security settings.
        </p>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`rounded-xl px-5 py-3 text-sm font-medium ${
            message.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-error-container/30 text-error"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ── Section 1: Driver Identity ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-2">
          <h2 className="font-headline text-xl font-bold text-on-surface">Driver Identity</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Manage your public profile and driver identification details used by the vigilance system.
          </p>
        </div>
        <div className="md:col-span-2 bg-surface-container-low p-7 sm:p-8 rounded-3xl space-y-6">
          {/* Avatar + account level */}
          <div className="flex items-center gap-6">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-primary/20 ring-2 ring-primary/20 flex items-center justify-center select-none">
                <span className="font-headline font-black text-primary text-2xl sm:text-3xl">{initials}</span>
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-label text-primary uppercase tracking-widest mb-1">Account Level</p>
              <p className="text-base sm:text-lg font-headline font-bold text-on-surface">Sentinel Gold Member</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{roleLabel}</p>
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest px-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your display name"
                className="w-full bg-surface-container-high border-none rounded-xl py-4 px-5 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest px-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full bg-surface-container-high border-none rounded-xl py-4 px-5 text-on-surface-variant focus:outline-none transition-all font-medium cursor-not-allowed opacity-70"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest px-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 912 345 6789"
                className="w-full bg-surface-container-high border-none rounded-xl py-4 px-5 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Vigilance Preferences ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-2">
          <h2 className="font-headline text-xl font-bold text-on-surface">Vigilance Preferences</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Customize how the interface responds to your environment.
          </p>
        </div>
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Theme Toggle Card */}
          <div className="bg-surface-container-low p-6 rounded-3xl flex flex-col justify-between min-h-[14rem]">
            <div>
              <div className="w-12 h-12 bg-surface-container-highest rounded-2xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-secondary">
                  {isDark ? "dark_mode" : "light_mode"}
                </span>
              </div>
              <h3 className="font-headline font-bold text-on-surface mb-1">
                {isDark ? "Sentinel Night" : "Sentinel Day"}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {isDark
                  ? "High-contrast obsidian theme for late-night safety."
                  : "Clean bright theme for daytime driving."}
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between bg-surface-container-high p-1 rounded-full">
              <button
                type="button"
                onClick={() => isDark && toggleTheme()}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${
                  !isDark ? "bg-primary text-on-primary shadow-lg" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => !isDark && toggleTheme()}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${
                  isDark ? "bg-primary text-on-primary shadow-lg" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Night
              </button>
            </div>
          </div>

          {/* Affiliated Institutions (visual/static) */}
          <div className="bg-surface-container-low p-6 rounded-3xl">
            <h3 className="font-headline font-bold text-on-surface mb-4">Affiliated Institutions</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 bg-surface-container-high rounded-2xl">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">local_shipping</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Global Transit Co.</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Verified Provider</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 bg-surface-container-high rounded-2xl">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-secondary text-xl">shield</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Sentinel Assurance</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Safety Partner</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Session Security ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-2">
          <h2 className="font-headline text-xl font-bold text-on-surface">Session Security</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Manage active monitoring sessions and historical logs.
          </p>
        </div>
        <div className="md:col-span-2 space-y-4">
          <div className="bg-surface-container-low p-6 rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">history</span>
                </div>
                <div>
                  <h4 className="font-bold text-on-surface">Session History Auto-Purge</h4>
                  <p className="text-sm text-on-surface-variant mt-0.5">Clear monitoring logs every 24 hours.</p>
                </div>
              </div>
              <Toggle on={autoPurge} onToggle={() => setAutoPurge((v) => !v)} />
            </div>
          </div>
          <div className="bg-surface-container-low p-6 rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-secondary">notifications_active</span>
                </div>
                <div>
                  <h4 className="font-bold text-on-surface">Audio Alerts Volume Boost</h4>
                  <p className="text-sm text-on-surface-variant mt-0.5">Intelligent volume boosting during fatigue detection.</p>
                </div>
              </div>
              <Toggle on={audioBoost} onToggle={() => setAudioBoost((v) => !v)} />
            </div>
          </div>
          <div className="bg-surface-container-low p-6 rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-error-container/30 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-error">logout</span>
                </div>
                <div>
                  <h4 className="font-bold text-on-surface">Sign Out</h4>
                  <p className="text-sm text-on-surface-variant mt-0.5">End your current session and return to login.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="shrink-0 px-4 py-2 rounded-xl bg-error-container/40 text-error text-xs font-bold hover:bg-error-container/60 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Action Buttons ── */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-primary text-on-primary font-headline font-extrabold py-5 rounded-2xl shadow-[0_10px_30px_rgba(123,208,255,0.15)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {saving ? "SAVING…" : "SAVE CHANGES"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex-1 bg-surface-container-high text-on-surface font-headline font-bold py-5 rounded-2xl hover:bg-surface-bright transition-all"
        >
          RESET TO DEFAULT
        </button>
      </div>
    </form>
  );
}
