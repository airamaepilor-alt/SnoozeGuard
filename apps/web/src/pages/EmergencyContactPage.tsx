import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContactStatus = "accepted" | "pending" | "rejected" | "vigilant" | "standby";

type ContactEntry = {
  id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  is_active: boolean;
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
    case "vigilant":  return { label: "Online",   colorClass: "text-primary",  bgClass: "bg-primary/10" };
    case "standby":   return { label: "Offline",  colorClass: "text-secondary", bgClass: "bg-secondary/10" };
    case "accepted":  return { label: "Accepted", colorClass: "text-primary",  bgClass: "bg-primary/10" };
    case "pending":   return { label: "Pending",  colorClass: "text-secondary", bgClass: "bg-secondary/10" };
    case "rejected":  return { label: "Rejected", colorClass: "text-tertiary", bgClass: "bg-tertiary/10" };
  }
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ContactStatus }) {
  const { label, colorClass, bgClass } = statusMeta(status);
  return (
    <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full tracking-[0.15em] uppercase shrink-0 ${colorClass} ${bgClass}`}>
      {label}
    </span>
  );
}

// ─── View Detail Dialog ───────────────────────────────────────────────────────

function ViewDialog({
  name, phone, email, status, activeSince, showActiveSince, onClose,
}: {
  name: string; phone: string | null; email: string | null;
  status: ContactStatus; activeSince: string | null; showActiveSince: boolean;
  onClose: () => void;
}) {
  const { label, colorClass } = statusMeta(status);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-surface-container-low sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center font-headline font-black text-on-primary text-[10px] select-none">SG</div>
            <span className="text-primary font-headline font-black text-[10px] tracking-[0.2em] uppercase">SnoozeGuard</span>
          </div>
          <StatusPill status={status} />
        </div>

        <div className="flex flex-col items-center gap-3 pt-8 pb-6 px-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 ring-4 ring-primary/15 flex items-center justify-center">
              <span className="font-headline font-black text-primary text-4xl select-none">{getInitials(name)}</span>
            </div>
            {status === "vigilant" && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 ring-2 ring-surface-container-low block animate-pulse" />
            )}
          </div>
          <div className="text-center">
            <h3 className="font-headline font-bold text-xl text-on-surface">{name}</h3>
            <p className={`text-xs font-semibold mt-0.5 ${colorClass}`}>
              {status === "vigilant" ? "● Online" : status === "standby" ? "○ Offline" : `● ${label}`}
            </p>
          </div>

          <div className="w-full space-y-2">
            {phone && (
              <a href={`tel:${phone}`}
                className="flex items-center gap-3 w-full px-4 py-3 bg-surface-container-high rounded-2xl text-on-surface-variant hover:text-primary transition-colors group">
                <span className="material-symbols-outlined text-[18px] group-hover:text-primary transition-colors">call</span>
                <span className="text-sm font-medium">{phone}</span>
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`}
                className="flex items-center gap-3 w-full px-4 py-3 bg-surface-container-high rounded-2xl text-on-surface-variant hover:text-primary transition-colors group">
                <span className="material-symbols-outlined text-[18px] group-hover:text-primary transition-colors">mail</span>
                <span className="text-sm font-medium truncate">{email}</span>
              </a>
            )}
          </div>

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

        <button onClick={onClose}
          className="w-full py-4 text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors border-t border-outline-variant/10">
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Remove Dialog ────────────────────────────────────────────────────────────

function RemoveDialog({ name, busy, onCancel, onConfirm }: {
  name: string; busy: boolean; onCancel: () => void; onConfirm: () => void;
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
            Are you sure you want to remove <span className="font-bold text-on-surface">{name}</span>?{" "}
            They will no longer receive alerts on your behalf.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full">
          <button onClick={onCancel} disabled={busy}
            className="py-3.5 bg-surface-container-high rounded-xl text-sm font-bold text-on-surface hover:bg-surface-bright transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="py-3.5 bg-tertiary/15 rounded-xl text-sm font-bold text-tertiary hover:bg-tertiary/25 transition-colors disabled:opacity-50">
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Dialog ────────────────────────────────────────────────────────

function AddEditDialog({
  contact, saving, error, onClose, onSave,
}: {
  contact: ContactEntry | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (data: { name: string; phone: string; email: string }) => void;
}) {
  const [name, setName] = useState(contact?.contact_name ?? "");
  const [phone, setPhone] = useState(contact?.contact_phone ?? "");
  const [email, setEmail] = useState(contact?.contact_email ?? "");
  const [localErr, setLocalErr] = useState<string | null>(null);

  const inputCls = "w-full bg-surface-container-high rounded-xl py-3.5 px-4 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all text-sm font-medium";

  const handleSave = () => {
    if (!name.trim()) { setLocalErr("Name is required."); return; }
    if (!phone.trim() && !email.trim()) { setLocalErr("Provide a phone number or email."); return; }
    setLocalErr(null);
    onSave({ name: name.trim(), phone: phone.trim(), email: email.trim() });
  };

  const displayErr = localErr ?? error;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-surface-container-low sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant/10">
          <h3 className="font-headline font-bold text-lg text-on-surface">
            {contact ? "Edit Guardian" : "Add Guardian"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {displayErr && (
            <div className="flex items-center gap-2.5 bg-tertiary/10 text-tertiary rounded-2xl px-4 py-3 text-sm font-medium border border-tertiary/20">
              <span className="material-symbols-outlined text-sm">error</span>
              {displayErr}
            </div>
          )}

          <div className="bg-surface-container-low rounded-3xl p-5 border border-outline-variant/10 space-y-4">
            <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-primary">Guardian Details</p>
            <div className="space-y-3">
              {([
                { label: "Full Name *", value: name, onChange: setName, type: "text", placeholder: "e.g. Maria Santos" },
                { label: "Mobile Number", value: phone, onChange: setPhone, type: "tel", placeholder: "+63 912 345 6789" },
                { label: "Email Address", value: email, onChange: setEmail, type: "email", placeholder: "contact@email.com" },
              ] as const).map(({ label, value, onChange, type, placeholder }) => (
                <div key={label}>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5 px-1">{label}</label>
                  <input type={type} value={value} onChange={(e) => { onChange(e.target.value); setLocalErr(null); }}
                    placeholder={placeholder} className={inputCls} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-4 bg-surface-container-high rounded-2xl font-headline font-bold text-sm text-on-surface-variant hover:bg-surface-bright active:scale-[0.98] transition-all">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 py-4 bg-gradient-to-br from-primary to-on-primary-container text-on-primary rounded-2xl font-headline font-extrabold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_8px_24px_rgba(123,208,255,0.15)]">
            {saving ? "Saving…" : contact ? "Save Changes" : "Add Guardian"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Guardian Card ────────────────────────────────────────────────────────────

function GuardianCard({
  contact, settingActive,
  onView, onEdit, onRemove, onSetActive,
}: {
  contact: ContactEntry;
  settingActive: boolean;
  onView: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onSetActive: () => void;
}) {
  const isActive = contact.is_active;
  const ecStatus: ContactStatus = contact.status === "pending" ? "pending" : "accepted";

  return (
    <div className={`rounded-3xl overflow-hidden border transition-all ${
      isActive
        ? "bg-primary/5 border-primary/30"
        : "bg-surface-container-low border-outline-variant/10 hover:border-outline-variant/30"
    }`}>
      {isActive && (
        <div className="px-5 pt-3.5 pb-0 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-primary">Active Guardian</span>
        </div>
      )}
      <div className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isActive ? "bg-primary/15" : "bg-primary/10"}`}>
          <span className="font-headline font-black text-primary text-lg select-none">{getInitials(contact.contact_name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-headline font-bold text-on-surface truncate leading-snug">{contact.contact_name}</p>
          <p className="text-xs text-on-surface-variant truncate mt-0.5">{contact.contact_phone || contact.contact_email || "No contact info"}</p>
        </div>
        <StatusPill status={ecStatus} />
      </div>
      <div className={`flex border-t ${isActive ? "border-primary/15" : "border-outline-variant/10"}`}>
        <button onClick={onView}
          className={`flex-1 py-3 text-xs font-bold hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 border-r ${isActive ? "border-primary/15 text-primary" : "border-outline-variant/10 text-primary"}`}>
          <span className="material-symbols-outlined text-sm">visibility</span>
          View
        </button>
        {!isActive ? (
          <button onClick={onSetActive} disabled={settingActive}
            className="flex-1 py-3 text-xs font-bold text-primary hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 border-r border-outline-variant/10 disabled:opacity-50">
            <span className="material-symbols-outlined text-sm">radio_button_checked</span>
            {settingActive ? "Setting…" : "Set Active"}
          </button>
        ) : (
          <button onClick={onEdit}
            className="flex-1 py-3 text-xs font-bold text-primary hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 border-r border-primary/15">
            <span className="material-symbols-outlined text-sm">edit</span>
            Edit
          </button>
        )}
        <button onClick={onRemove}
          className="flex-1 py-3 text-xs font-bold text-tertiary hover:bg-tertiary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-sm">person_remove</span>
          Remove
        </button>
      </div>
    </div>
  );
}

// ─── My Guardian Tab ──────────────────────────────────────────────────────────

function MyGuardianTab() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [myPhone, setMyPhone] = useState("");
  const [myPhoneSaving, setMyPhoneSaving] = useState(false);
  const [myPhoneSaved, setMyPhoneSaved] = useState(false);
  const [addEditOpen, setAddEditOpen] = useState<ContactEntry | "add" | null>(null);
  const [viewOpen, setViewOpen] = useState<ContactEntry | null>(null);
  const [removeOpen, setRemoveOpen] = useState<ContactEntry | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [contactsRes, profileRes] = await Promise.all([
        supabase.from("emergency_contacts")
          .select("id, contact_name, contact_phone, contact_email, status, is_active")
          .eq("user_id", user.id)
          .order("is_active", { ascending: false })
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
      ]);
      setContacts((contactsRes.data ?? []) as ContactEntry[]);
      setMyPhone((profileRes.data as { phone?: string } | null)?.phone ?? "");
    } catch {
      setError("Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  const handleSetActive = async (contactId: string) => {
    if (!user?.id) return;
    setSettingActiveId(contactId);
    // Optimistic update
    setContacts((prev) => prev.map((c) => ({ ...c, is_active: c.id === contactId })));
    await supabase.from("emergency_contacts").update({ is_active: false }).eq("user_id", user.id);
    await supabase.from("emergency_contacts").update({ is_active: true }).eq("id", contactId);
    setSettingActiveId(null);
    void load();
  };

  const handleSave = async (data: { name: string; phone: string; email: string }) => {
    if (!user?.id) return;
    setFormSaving(true);
    setFormError(null);
    try {
      if (addEditOpen === "add") {
        const { count } = await supabase
          .from("emergency_contacts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        const isFirst = (count ?? 0) === 0;
        const { error: e } = await supabase.from("emergency_contacts").insert({
          user_id: user.id,
          contact_name: data.name,
          contact_phone: data.phone || null,
          contact_email: data.email || null,
          status: "pending",
          is_active: false,
        });
        if (e) { setFormError(e.message); return; }
      } else if (addEditOpen) {
        const { error: e } = await supabase.from("emergency_contacts")
          .update({ contact_name: data.name, contact_phone: data.phone || null, contact_email: data.email || null })
          .eq("id", addEditOpen.id)
          .eq("user_id", user.id);
        if (e) { setFormError(e.message); return; }
      }
      setAddEditOpen(null);
      void load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removeOpen || !user?.id) return;
    setRemoveBusy(true);
    try {
      const { error: e } = await supabase.from("emergency_contacts")
        .delete().eq("id", removeOpen.id).eq("user_id", user.id);
      if (e) { setError(e.message); }
      else { setRemoveOpen(null); void load(); }
    } catch {
      setError("Failed to remove.");
    } finally {
      setRemoveBusy(false);
    }
  };

  const handleSaveMyPhone = async () => {
    if (!user?.id) return;
    setMyPhoneSaving(true);
    await supabase.from("profiles").update({ phone: myPhone.trim() || null }).eq("id", user.id);
    setMyPhoneSaving(false);
    setMyPhoneSaved(true);
    setTimeout(() => setMyPhoneSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-on-surface-variant leading-relaxed">
        Your guardians are notified when a critical drowsiness alert goes unacknowledged.
        Only the <span className="font-bold text-primary">Active</span> guardian receives alerts — switch anytime.
      </p>

      {error && (
        <div className="flex items-center gap-2.5 bg-tertiary/10 text-tertiary rounded-2xl px-4 py-3 text-sm font-medium border border-tertiary/20">
          <span className="material-symbols-outlined text-sm">error</span>
          {error}
        </div>
      )}

      {/* Guardian list */}
      {contacts.length === 0 ? (
        <div className="bg-surface-container-low rounded-3xl p-10 flex flex-col items-center text-center gap-4 border border-outline-variant/10">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
          </div>
          <div>
            <p className="font-headline font-bold text-on-surface text-lg">No guardians yet</p>
            <p className="text-sm text-on-surface-variant mt-1 max-w-xs mx-auto leading-relaxed">
              Add emergency contacts who can be alerted when you show signs of fatigue during a drive.
            </p>
          </div>
          <button onClick={() => { setFormError(null); setAddEditOpen("add"); }}
            className="px-6 py-3 bg-gradient-to-br from-primary to-on-primary-container text-on-primary rounded-2xl font-headline font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(123,208,255,0.15)]">
            Add Guardian
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((c) => (
            <GuardianCard
              key={c.id}
              contact={c}
              settingActive={settingActiveId === c.id}
              onView={() => setViewOpen(c)}
              onEdit={() => { setFormError(null); setAddEditOpen(c); }}
              onRemove={() => setRemoveOpen(c)}
              onSetActive={() => void handleSetActive(c.id)}
            />
          ))}
          <button onClick={() => { setFormError(null); setAddEditOpen("add"); }}
            className="w-full py-3.5 border-2 border-dashed border-outline-variant/30 rounded-2xl text-xs font-bold text-on-surface-variant hover:border-primary/30 hover:text-primary flex items-center justify-center gap-2 transition-colors">
            <span className="material-symbols-outlined text-sm">add</span>
            Add Another Guardian
          </button>
        </div>
      )}

      {/* Your number — applies to all guardians */}
      <div className="bg-surface-container-low rounded-3xl p-5 border border-outline-variant/10 space-y-4">
        <div>
          <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-primary mb-1">Your Number</p>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Shown to your guardian so they can reach you when an alert fires.
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="tel" value={myPhone} onChange={(e) => setMyPhone(e.target.value)}
            placeholder="+63 912 345 6789"
            className="flex-1 bg-surface-container-high rounded-xl py-3.5 px-4 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary/50 focus:outline-none text-sm font-medium"
          />
          <button onClick={() => void handleSaveMyPhone()} disabled={myPhoneSaving}
            className={`px-5 py-3.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${
              myPhoneSaved ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}>
            {myPhoneSaving ? "…" : myPhoneSaved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      {/* Dialogs */}
      {addEditOpen !== null && (
        <AddEditDialog
          contact={addEditOpen === "add" ? null : addEditOpen}
          saving={formSaving}
          error={formError}
          onClose={() => setAddEditOpen(null)}
          onSave={(data) => void handleSave(data)}
        />
      )}
      {viewOpen && (
        <ViewDialog
          name={viewOpen.contact_name}
          phone={viewOpen.contact_phone}
          email={viewOpen.contact_email}
          status={viewOpen.status === "pending" ? "pending" : "accepted"}
          activeSince={null}
          showActiveSince={false}
          onClose={() => setViewOpen(null)}
        />
      )}
      {removeOpen && (
        <RemoveDialog
          name={removeOpen.contact_name}
          busy={removeBusy}
          onCancel={() => setRemoveOpen(null)}
          onConfirm={() => void handleRemove()}
        />
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

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("ec-iprotect-contacts")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_contacts" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  useEffect(() => {
    const ch = supabase.channel("presence:drivers");
    ch.on("presence", { event: "sync" }, () => {
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

  const onlineCount = drivers.filter((d) => onlineIds.has(d.user_id)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-on-surface-variant leading-relaxed max-w-sm">
          Drivers who have added you as their emergency contact. You're notified if they trigger a high fatigue alert.
        </p>
        {drivers.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0 ml-4">
            <span className={`w-1.5 h-1.5 rounded-full ${onlineCount > 0 ? "bg-primary animate-pulse" : "bg-outline-variant"}`} />
            <span className="text-[10px] font-bold text-on-surface-variant whitespace-nowrap">
              {onlineCount} online
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-tertiary/10 text-tertiary rounded-2xl px-4 py-3 text-sm font-medium border border-tertiary/20">
          <span className="material-symbols-outlined text-sm">error</span>
          {error}
        </div>
      )}

      {drivers.length === 0 ? (
        <div className="bg-surface-container-low rounded-3xl p-10 flex flex-col items-center text-center gap-4 border border-outline-variant/10">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
          </div>
          <div>
            <p className="font-headline font-bold text-on-surface text-lg">No drivers assigned</p>
            <p className="text-sm text-on-surface-variant mt-1 max-w-xs mx-auto leading-relaxed">
              No drivers have connected with you as their emergency contact yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {drivers.map((d) => {
            const isOnline = onlineIds.has(d.user_id);
            const ecStatus: ContactStatus = isOnline ? "vigilant" : "standby";
            return (
              <div key={d.id} className="bg-surface-container-low rounded-3xl overflow-hidden border border-outline-variant/10 hover:border-outline-variant/30 transition-colors">
                <div className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-headline font-black text-primary text-lg select-none">{getInitials(d.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-bold text-on-surface truncate">{d.name}</p>
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">{d.phone || d.email || "No contact info"}</p>
                  </div>
                  <StatusPill status={ecStatus} />
                </div>
                <div className="flex border-t border-outline-variant/10">
                  <button onClick={() => setViewing(d)}
                    className="flex-1 py-3 text-xs font-bold text-primary hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 border-r border-outline-variant/10">
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    View
                  </button>
                  <button onClick={() => setRemoving(d)}
                    className="flex-1 py-3 text-xs font-bold text-tertiary hover:bg-tertiary/5 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">person_remove</span>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewing && (
        <ViewDialog
          name={viewing.name} phone={viewing.phone} email={viewing.email}
          status={onlineIds.has(viewing.user_id) ? "vigilant" : "standby"}
          activeSince={null} showActiveSince={false}
          onClose={() => setViewing(null)} />
      )}
      {removing && (
        <RemoveDialog name={removing.name} busy={removeBusy}
          onCancel={() => setRemoving(null)} onConfirm={() => void handleRemove(removing)} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "my-guardian" | "i-protect";

export function EmergencyContactPage() {
  const [activeTab, setActiveTab] = useState<Tab>("my-guardian");

  const tabs = [
    { key: "my-guardian" as Tab, label: "My Guardian", icon: "person_add" },
    { key: "i-protect" as Tab, label: "I Protect", icon: "shield" },
  ];

  return (
    <div className="max-w-xl mx-auto font-body text-on-surface pb-12">
      <div className="mb-8">
        <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-primary mb-2">Safety System</p>
        <h1 className="font-headline font-black text-3xl text-on-surface leading-none mb-2">
          Emergency<br />Contact
        </h1>
        <p className="text-sm text-on-surface-variant">
          Manage your guardians and monitor drivers you protect.
        </p>
      </div>

      <div className="flex gap-2 mb-8">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              activeTab === key
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-surface-container-high text-on-surface-variant border-outline-variant/10 hover:bg-surface-bright"
            }`}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: activeTab === key ? "'FILL' 1" : "'FILL' 0" }}
            >
              {icon}
            </span>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "my-guardian" ? <MyGuardianTab /> : <IProtectTab />}
    </div>
  );
}
