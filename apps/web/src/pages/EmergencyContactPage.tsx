import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContactStatus = "accepted" | "pending" | "rejected" | "vigilant" | "standby";

type GuardianRow = {
  id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
};

type DriverCard = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  ecStatus: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
}

function statusMeta(status: ContactStatus): { label: string; colorClass: string; bgClass: string } {
  switch (status) {
    case "vigilant":  return { label: "Online",    colorClass: "text-primary",           bgClass: "bg-primary/10" };
    case "standby":   return { label: "Offline",   colorClass: "text-secondary",         bgClass: "bg-secondary/10" };
    case "accepted":  return { label: "Accepted",  colorClass: "text-primary",           bgClass: "bg-primary/10" };
    case "pending":   return { label: "Pending",   colorClass: "text-secondary",         bgClass: "bg-secondary/10" };
    case "rejected":  return { label: "Rejected",  colorClass: "text-tertiary",          bgClass: "bg-tertiary/10" };
  }
}

// ─── SG Brand Mark ────────────────────────────────────────────────────────────

function SGMark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg bg-primary font-headline font-black text-on-primary tracking-tight select-none ${
        size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"
      }`}
    >
      SG
    </div>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ContactStatus }) {
  const { label, colorClass, bgClass } = statusMeta(status);
  return (
    <span className={`text-[10px] font-bold px-3 py-1 rounded-full tracking-widest uppercase ${colorClass} ${bgClass}`}>
      {label}
    </span>
  );
}

// ─── View Detail Dialog ───────────────────────────────────────────────────────

function ViewDialog({
  name,
  phone,
  email,
  status,
  activeSince,
  showActiveSince,
  onClose,
}: {
  name: string;
  phone: string | null;
  email: string | null;
  status: ContactStatus;
  activeSince: string | null;
  showActiveSince: boolean;
  onClose: () => void;
}) {
  const { label, colorClass } = statusMeta(status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-surface-container-low rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <SGMark />
            <span className="text-primary font-headline font-black text-xs tracking-[0.2em] uppercase">
              SnoozeGuard
            </span>
          </div>
          <StatusPill status={status} />
        </div>

        {/* Avatar section */}
        <div className="flex flex-col items-center gap-3 px-6 pb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-surface-container-high ring-4 ring-primary/20 flex items-center justify-center shadow-[0_0_40px_rgba(123,208,255,0.12)]">
              <span className="font-headline font-black text-primary text-3xl select-none">
                {getInitials(name)}
              </span>
            </div>
            {status === "vigilant" && (
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 ring-2 ring-surface-container-low block animate-pulse" />
            )}
          </div>

          <div className="text-center">
            <h3 className="font-headline font-bold text-xl text-on-surface">{name}</h3>
            <p className={`text-xs font-semibold mt-0.5 ${colorClass}`}>
              {status === "vigilant" ? "● Online" : status === "standby" ? "○ Offline" : `● ${label}`}
            </p>
          </div>

          {/* Contact pills */}
          <div className="w-full space-y-2">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-3 w-full px-4 py-3 bg-surface-container-high rounded-2xl text-on-surface-variant hover:text-primary transition-colors group"
              >
                <span className="material-symbols-outlined text-[18px] group-hover:text-primary transition-colors">call</span>
                <span className="text-sm font-medium">{phone}</span>
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-3 w-full px-4 py-3 bg-surface-container-high rounded-2xl text-on-surface-variant hover:text-primary transition-colors group"
              >
                <span className="material-symbols-outlined text-[18px] group-hover:text-primary transition-colors">mail</span>
                <span className="text-sm font-medium truncate">{email}</span>
              </a>
            )}
          </div>

          {/* Stat cards */}
          <div className={`w-full grid gap-3 ${showActiveSince ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="bg-surface-container-high rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Status</p>
              <p className={`font-headline font-bold text-lg ${colorClass}`}>{label}</p>
            </div>
            {showActiveSince && (
              <div className="bg-surface-container-high rounded-2xl p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Active Since</p>
                <p className="font-headline font-bold text-lg text-on-surface">{fmtTime(activeSince)}</p>
              </div>
            )}
          </div>

        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full py-4 text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors border-t border-outline-variant/10"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Remove Confirm Dialog ────────────────────────────────────────────────────

function RemoveDialog({
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-surface-container-low rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-tertiary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-tertiary text-2xl">person_remove</span>
        </div>
        <div>
          <h3 className="font-headline font-bold text-lg text-on-surface">Remove Contact?</h3>
          <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
            Are you sure you want to remove{" "}
            <span className="font-bold text-on-surface">{name}</span>?{" "}
            They will no longer receive alerts on your behalf.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            onClick={onCancel}
            disabled={busy}
            className="py-3.5 bg-surface-container-high rounded-xl text-sm font-bold text-on-surface hover:bg-surface-bright transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="py-3.5 bg-tertiary/15 rounded-xl text-sm font-bold text-tertiary hover:bg-tertiary/25 transition-colors disabled:opacity-50"
          >
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({
  name,
  phone,
  email,
  statusBadge,
  onView,
  onSecondary,
  secondaryLabel,
  secondaryIcon,
  secondaryClass,
}: {
  name: string;
  phone: string | null;
  email: string | null;
  statusBadge: ContactStatus;
  onView: () => void;
  onSecondary: () => void;
  secondaryLabel: string;
  secondaryIcon: string;
  secondaryClass: string;
}) {
  const { label, colorClass, bgClass } = statusMeta(statusBadge);

  return (
    <div className="bg-surface-container rounded-3xl p-6 relative overflow-hidden group hover:bg-surface-container-high transition-colors duration-200">
      {/* Status badge */}
      <div className="absolute top-5 right-5">
        <span className={`text-[10px] font-bold px-3 py-1 rounded-full tracking-widest uppercase ${colorClass} ${bgClass}`}>
          {label}
        </span>
      </div>

      {/* Identity */}
      <div className="flex items-center gap-4 mb-5 pr-24">
        <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center shrink-0 ring-1 ring-outline-variant/10">
          <span className="font-headline font-black text-primary text-xl select-none">
            {getInitials(name)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-headline font-bold text-base text-on-surface truncate">{name}</p>
          <p className="text-sm text-on-surface-variant truncate mt-0.5">
            {phone || email || "No contact info"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-bright rounded-xl text-sm font-bold text-primary hover:opacity-80 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">visibility</span>
          View
        </button>
        <button
          onClick={onSecondary}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all ${secondaryClass}`}
        >
          <span className="material-symbols-outlined text-[18px]">{secondaryIcon}</span>
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}

// ─── EC Form ──────────────────────────────────────────────────────────────────

function ECForm({
  myPhone, name, phone, email, saving,
  showCancel, onMyPhone, onName, onPhone, onEmail, onSave, onCancel,
}: {
  myPhone: string; name: string; phone: string; email: string;
  saving: boolean; showCancel: boolean;
  onMyPhone: (v: string) => void; onName: (v: string) => void;
  onPhone: (v: string) => void; onEmail: (v: string) => void;
  onSave: () => void; onCancel: () => void;
}) {
  const inputCls = "w-full bg-surface-container-high border-none rounded-xl py-3.5 px-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/60 focus:outline-none transition-all font-medium text-sm";
  const labelCls = "text-xs font-label text-on-surface-variant uppercase tracking-widest px-1 block mb-1.5";

  return (
    <div className="space-y-5">
      {/* My phone */}
      <div className="bg-surface-container-low rounded-2xl p-5 space-y-4">
        <div>
          <h4 className="font-headline font-bold text-sm text-on-surface mb-0.5">Your Mobile Number</h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Shown to your guardian so they can reach you when an alert fires.
          </p>
        </div>
        <div>
          <label className={labelCls}>Mobile Number</label>
          <input type="tel" value={myPhone} onChange={(e) => onMyPhone(e.target.value)}
            placeholder="+63 912 345 6789" className={inputCls} />
        </div>
      </div>

      {/* EC fields */}
      <div className="bg-surface-container-low rounded-2xl p-5 space-y-4">
        <div>
          <h4 className="font-headline font-bold text-sm text-on-surface mb-0.5">Emergency Contact</h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            If a critical drowsiness alert goes unacknowledged for 2 minutes, your location is sent to this person.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Full Name *</label>
            <input type="text" value={name} onChange={(e) => onName(e.target.value)}
              placeholder="e.g. Maria Santos" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Their Mobile Number</label>
            <input type="tel" value={phone} onChange={(e) => onPhone(e.target.value)}
              placeholder="+63 912 345 6789" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Their Email Address</label>
            <input type="email" value={email} onChange={(e) => onEmail(e.target.value)}
              placeholder="contact@email.com" className={inputCls} autoComplete="off" />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {showCancel && (
          <button type="button" onClick={onCancel}
            className="flex-1 py-4 bg-surface-container-high rounded-2xl font-headline font-bold text-on-surface-variant hover:bg-surface-bright transition-all">
            Cancel
          </button>
        )}
        <button type="button" onClick={onSave} disabled={saving}
          className="flex-1 py-4 bg-primary text-on-primary rounded-2xl font-headline font-extrabold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_8px_24px_rgba(123,208,255,0.2)]">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── My Guardian Tab ──────────────────────────────────────────────────────────

function MyGuardianTab() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [myPhone, setMyPhone] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ecDbStatus, setEcDbStatus] = useState("pending");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [ecRes, profileRes] = await Promise.all([
        supabase.from("emergency_contacts").select("contact_name, contact_phone, contact_email, status").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
      ]);
      const ec = ecRes.data as { contact_name: string; contact_phone: string | null; contact_email: string | null; status: string } | null;
      if (ec) {
        setName(ec.contact_name);
        setPhone(ec.contact_phone ?? "");
        setEmail(ec.contact_email ?? "");
        setEcDbStatus(ec.status ?? "pending");
      }
      setMyPhone((profileRes.data as { phone?: string } | null)?.phone ?? "");
    } catch {
      setError("Failed to load contact.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!user?.id) return;
    setError(null); setSaved(false);
    if (!name.trim()) { setError("Name is required."); return; }
    if (!phone.trim() && !email.trim()) { setError("Provide a phone number or email."); return; }
    setSaving(true);
    try {
      const payload = { user_id: user.id, contact_name: name.trim(), contact_phone: phone.trim() || null, contact_email: email.trim() || null };
      const [ecRes, profileRes] = await Promise.all([
        supabase.from("emergency_contacts").upsert(payload, { onConflict: "user_id" }),
        supabase.from("profiles").update({ phone: myPhone.trim() || null }).eq("id", user.id),
      ]);
      const err = ecRes.error ?? profileRes.error;
      if (err) { setError(err.message); }
      else { setSaved(true); setShowForm(false); void load(); setTimeout(() => setSaved(false), 3000); }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!user?.id) return;
    setRemoveBusy(true);
    try {
      await supabase.from("emergency_contacts").delete().eq("user_id", user.id);
      setName(""); setPhone(""); setEmail(""); setRemoveOpen(false);
    } catch {
      setError("Failed to remove.");
    } finally {
      setRemoveBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
      </div>
    );
  }

  const hasContact = name.trim().length > 0;
  const contactStatus: ContactStatus = ecDbStatus === "accepted" ? "accepted" : ecDbStatus === "rejected" ? "rejected" : "pending";

  return (
    <div className="space-y-8">
      {/* Section layout */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: description */}
        <div className="md:col-span-1 space-y-2">
          <h2 className="font-headline text-xl font-bold text-on-surface">Emergency Contact</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Your designated emergency contact. They will be notified if a critical drowsiness alert goes unacknowledged during your drive.
          </p>
        </div>

        {/* Right: content */}
        <div className="md:col-span-2 space-y-4">
          {/* Banners */}
          {saved && (
            <div className="bg-emerald-500/10 text-emerald-400 rounded-xl px-5 py-3 text-sm font-medium">
              ✓ Saved successfully
            </div>
          )}
          {error && (
            <div className="bg-tertiary/10 text-tertiary rounded-xl px-5 py-3 text-sm font-medium">
              {error}
            </div>
          )}

          {hasContact && !showForm ? (
            <ContactCard
              name={name} phone={phone || null} email={email || null}
              statusBadge={contactStatus}
              onView={() => setViewOpen(true)}
              onSecondary={() => setShowForm(true)}
              secondaryLabel="Edit"
              secondaryIcon="edit"
              secondaryClass="bg-primary/10 text-primary hover:bg-primary/20"
            />
          ) : hasContact && showForm ? (
            <ECForm
              myPhone={myPhone} name={name} phone={phone} email={email} saving={saving} showCancel
              onMyPhone={setMyPhone} onName={(v) => { setName(v); setError(null); }}
              onPhone={(v) => { setPhone(v); setError(null); }} onEmail={(v) => { setEmail(v); setError(null); }}
              onSave={() => void save()} onCancel={() => setShowForm(false)}
            />
          ) : showForm ? (
            <ECForm
              myPhone={myPhone} name={name} phone={phone} email={email} saving={saving} showCancel={false}
              onMyPhone={setMyPhone} onName={(v) => { setName(v); setError(null); }}
              onPhone={(v) => { setPhone(v); setError(null); }} onEmail={(v) => { setEmail(v); setError(null); }}
              onSave={() => void save()} onCancel={() => setShowForm(false)}
            />
          ) : (
            /* Empty state */
            <div className="bg-surface-container-low rounded-3xl p-10 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  person_add
                </span>
              </div>
              <div>
                <p className="font-headline font-bold text-on-surface text-lg">No guardian set</p>
                <p className="text-sm text-on-surface-variant mt-1 max-w-xs mx-auto leading-relaxed">
                  Add an emergency contact who will be alerted if you show signs of fatigue during a drive.
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="mt-1 px-6 py-3 bg-primary text-on-primary rounded-2xl font-headline font-bold text-sm hover:opacity-90 transition-all shadow-[0_8px_24px_rgba(123,208,255,0.2)]"
              >
                Add Guardian
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Dialogs */}
      {viewOpen && (
        <ViewDialog
          name={name} phone={phone || null} email={email || null}
          status={contactStatus} activeSince={null} showActiveSince={false}
          onClose={() => setViewOpen(false)}
        />
      )}
      {removeOpen && (
        <RemoveDialog name={name} busy={removeBusy} onCancel={() => setRemoveOpen(false)} onConfirm={() => void handleRemove()} />
      )}
    </div>
  );
}

// ─── I Protect Tab ────────────────────────────────────────────────────────────

function IProtectTab() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<DriverCard[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<DriverCard | null>(null);
  const [removing, setRemoving] = useState<DriverCard | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const [byId, byEmail] = await Promise.all([
        supabase.from("emergency_contacts").select("*").eq("contact_user_id", user.id),
        supabase.from("emergency_contacts").select("*").ilike("contact_email", user.email ?? "__no_match__"),
      ]);

      const seen = new Set<string>();
      const rows: Array<{ id: string; user_id: string; contact_name: string; contact_phone: string | null; contact_email: string | null; status: string }> = [];
      for (const row of [...(byId.data ?? []), ...(byEmail.data ?? [])]) {
        if (!seen.has(row.id as string)) { seen.add(row.id as string); rows.push(row as typeof rows[number]); }
      }

      const enriched: DriverCard[] = await Promise.all(rows.map(async (row) => {
        const profileRes = await supabase.from("profiles").select("full_name, phone, email").eq("id", row.user_id).maybeSingle();
        const p = profileRes.data as { full_name?: string; phone?: string; email?: string } | null;
        return {
          id: row.id, user_id: row.user_id,
          name: p?.full_name ?? row.contact_name,
          phone: p?.phone ?? null,
          email: p?.email ?? null,
          ecStatus: row.status,
        };
      }));

      setDrivers(enriched);
    } catch {
      setError("Failed to load. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email]);

  // Load contacts + watch for EC changes
  useEffect(() => {
    void load();
    const channel = supabase
      .channel("ec-iprotect-contacts")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_contacts" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  // Track which drivers are online via Supabase Realtime presence
  useEffect(() => {
    const ch = supabase.channel("presence:drivers");
    ch.on("presence", { event: "sync" }, () => {
      // Presence key = user_id (set in mobile App.tsx), so Object.keys is the id list
      setOnlineIds(new Set(Object.keys(ch.presenceState())));
    }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const handleRemove = async (d: DriverCard) => {
    setRemoveBusy(true);
    try {
      await supabase.from("emergency_contacts").delete().eq("id", d.id);
      setRemoving(null); void load();
    } catch {
      setError("Failed to remove.");
    } finally {
      setRemoveBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: description */}
        <div className="md:col-span-1 space-y-2">
          <h2 className="font-headline text-xl font-bold text-on-surface">Connection</h2>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Drivers who have added you as their emergency contact. You will be notified if they trigger a high fatigue alert.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
            <span className="text-xs text-on-surface-variant font-medium">
              {drivers.filter((d) => onlineIds.has(d.user_id)).length} online now
            </span>
          </div>
        </div>

        {/* Right: grid of cards */}
        <div className="md:col-span-2 space-y-4">
          {error && (
            <div className="bg-tertiary/10 text-tertiary rounded-xl px-5 py-3 text-sm font-medium">{error}</div>
          )}

          {drivers.length === 0 ? (
            <div className="bg-surface-container-low rounded-3xl p-10 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-primary text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  shield
                </span>
              </div>
              <div>
                <p className="font-headline font-bold text-on-surface text-lg">No drivers assigned</p>
                <p className="text-sm text-on-surface-variant mt-1 max-w-xs mx-auto leading-relaxed">
                  No drivers have connected with you as their emergency contact yet.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {drivers.map((d) => (
                <ContactCard
                  key={d.id} name={d.name} phone={d.phone} email={d.email}
                  statusBadge={onlineIds.has(d.user_id) ? "vigilant" : "standby"}
                  onView={() => setViewing(d)}
                  onSecondary={() => setRemoving(d)}
                  secondaryLabel="Remove"
                  secondaryIcon="person_remove"
                  secondaryClass="bg-tertiary/10 text-tertiary hover:bg-tertiary/20"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {viewing && (
        <ViewDialog
          name={viewing.name} phone={viewing.phone} email={viewing.email}
          status={onlineIds.has(viewing.user_id) ? "vigilant" : "standby"}
          activeSince={null} showActiveSince={false}
          onClose={() => setViewing(null)}
        />
      )}
      {removing && (
        <RemoveDialog name={removing.name} busy={removeBusy} onCancel={() => setRemoving(null)} onConfirm={() => void handleRemove(removing)} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "my-guardian" | "i-protect";

export function EmergencyContactPage() {
  const [activeTab, setActiveTab] = useState<Tab>("i-protect");

  return (
    <div className="max-w-5xl mx-auto font-body text-on-surface space-y-10 pb-12">
      {/* Page header */}
      <div>
        <h1 className="font-headline font-black text-2xl sm:text-3xl text-primary uppercase tracking-wider mb-1">
          Emergency Contact
        </h1>
        <p className="text-sm text-on-surface-variant">
          Manage your emergency contact and drivers who have connected with you.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex p-1 bg-surface-container-low rounded-xl w-full max-w-sm">
        {(["my-guardian", "i-protect"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition-all duration-150 ${
              activeTab === key
                ? "bg-surface-bright text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {key === "my-guardian" ? "Emergency Contact" : "Connection"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "my-guardian" ? <MyGuardianTab /> : <IProtectTab />}
    </div>
  );
}
