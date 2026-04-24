import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useThemeToggle } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

export function AccountPage() {
  const { user, profile, signOut } = useAuth();
  const { isDark, toggleTheme } = useThemeToggle();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const isGoogleSignIn = user?.app_metadata?.provider === "google";

  // Load profile data from database on mount and when user changes
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (data) {
        setFullName(data.full_name ?? "");
      }
    };

    void loadProfile();
  }, [user?.id]);

  const displayName = fullName.trim() || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const email = user?.email ?? "";
  const roleLabel = profile?.role === "super_admin" ? "Fleet Manager" : "Driver";

  async function onSave(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    // Update auth user_metadata and profiles table
    const [authResult, profileResult] = await Promise.all([
      supabase.auth.updateUser({ data: { full_name: fullName.trim() || null } }),
      supabase.from("profiles").update({
        full_name: fullName.trim() || null,
      }).eq("id", user.id),
    ]);

    setSaving(false);
    const error = authResult.error ?? profileResult.error;
    if (error) {
      setMessage({ text: `Error: ${error.message}`, ok: false });
    } else {
      setMessage({ text: "Profile updated successfully.", ok: true });
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    // Validate
    if (newPassword.length < 6) {
      setMessage({ text: "Password must be at least 6 characters.", ok: false });
      setSaving(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ text: "Passwords do not match.", ok: false });
      setSaving(false);
      return;
    }

    // Update password
    const result = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (result.error) {
      setMessage({ text: `Error: ${result.error.message}`, ok: false });
    } else {
      setMessage({ text: "Password changed successfully.", ok: true });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    }
  }

  function onReset() {
    setFullName(profile?.full_name ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordForm(false);
    setMessage({ text: "Reset to current saved values.", ok: true });
  }

  return (
    <div className="max-w-5xl mx-auto font-body text-on-surface space-y-12 pb-12">
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
          {/* Avatar + account level + action buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-primary/20 ring-2 ring-primary/20 flex items-center justify-center select-none">
                <span className="font-headline font-black text-primary text-2xl sm:text-3xl">{initials}</span>
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs font-label text-primary uppercase tracking-widest mb-1">Account Level</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{roleLabel}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={saving}
                className="px-5 py-2 bg-primary text-on-primary font-headline font-bold rounded-xl hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 text-xs"
              >
                {saving ? "SAVING…" : "SAVE"}
              </button>
              <button
                type="button"
                onClick={onReset}
                className="px-5 py-2 bg-surface-container-high text-on-surface font-headline font-bold rounded-xl hover:bg-surface-bright transition-all text-xs"
              >
                RESET
              </button>
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

          {/* Thesis Foundation (visual/static) */}
          <div className="bg-surface-container-low p-6 rounded-3xl">
            <h3 className="font-headline font-bold text-on-surface mb-4">Thesis Foundation</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 bg-surface-container-high rounded-2xl">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">MediaPipe</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Face Detection ML</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 bg-surface-container-high rounded-2xl">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-secondary text-xl">psychology</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Drowsiness Detection Research</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">Academic Study</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Password & Security ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-2">
          <h2 className="font-headline text-xl font-bold text-on-surface">Password & Security</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Manage your authentication credentials and security settings.
          </p>
        </div>
        <div className="md:col-span-2 space-y-4">
          {/* Change Password Card */}
          <div className="bg-surface-container-low p-6 rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">lock</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-on-surface">Change Password</h4>
                  <p className="text-sm text-on-surface-variant mt-0.5">
                    {isGoogleSignIn
                      ? "Set a password as a backup login method."
                      : "Update your account password for enhanced security."}
                  </p>
                </div>
              </div>
            </div>
            {!showPasswordForm ? (
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="w-full bg-primary-container text-primary font-headline font-bold px-5 py-3 rounded-xl hover:bg-primary hover:text-on-primary transition-all duration-300 text-sm"
              >
                SET PASSWORD
              </button>
            ) : (
              <form onSubmit={(e) => void onChangePassword(e)} className="space-y-4">
                {!isGoogleSignIn && (
                  <div className="space-y-2">
                    <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest px-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium text-sm"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest px-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-label text-on-surface-variant uppercase tracking-widest px-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full bg-surface-container-high border-none rounded-xl py-3 px-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-none transition-all font-medium text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-primary text-on-primary font-headline font-bold px-4 py-3 rounded-xl hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 text-sm"
                  >
                    {saving ? "SAVING…" : "SAVE PASSWORD"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="flex-1 bg-surface-container-high text-on-surface font-headline font-bold px-4 py-3 rounded-xl hover:bg-surface-bright transition-all text-sm"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sign Out Card */}
          <div className="bg-surface-container-low p-6 rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-error-container/30 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-error">logout</span>
                </div>
                <div className="flex-1">
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

    </div>
  );
}
