import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSession } from "../context/SessionContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import {
  listEmergencyContacts,
  addEmergencyContact,
  updateEmergencyContact,
  removeEmergencyContactById,
  toggleActiveEmergencyContact,
  type EmergencyContactEntry,
} from "../lib/emergencyNotify";
import {
  getLocalECList,
  upsertLocalEC,
  deleteLocalEC,
  toggleActiveLocalEC,
  type LocalEC,
} from "../db/database";
import { isOnline } from "../sync/flush";
import { getPresenceIds, subscribePresence } from "../lib/presenceStore";
import type { Theme } from "../theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContactStatus = "vigilant" | "standby" | "accepted" | "pending" | "rejected";

type DriverCard = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  ecStatus: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function statusDisplay(status: ContactStatus): { label: string; variant: "primary" | "secondary" | "tertiary" } {
  switch (status) {
    case "vigilant":  return { label: "Online",   variant: "primary" };
    case "standby":   return { label: "Offline",  variant: "secondary" };
    case "accepted":  return { label: "Accepted", variant: "primary" };
    case "pending":   return { label: "Pending",  variant: "secondary" };
    case "rejected":  return { label: "Rejected", variant: "tertiary" };
  }
}

function ecToLocal(ec: EmergencyContactEntry, userId: string): LocalEC {
  if (!ec.id) throw new Error("Emergency contact must have an id");
  return {
    id: ec.id,
    user_id: userId,
    contact_name: ec.contact_name,
    contact_phone: ec.contact_phone ?? "",
    contact_email: ec.contact_email ?? "",
    my_phone: "",
    is_active: ec.is_active ? 1 : 0,
    status: ec.status,
    pending_sync: 0,
    updated_at: new Date().toISOString(),
  };
}

// ─── View Detail Modal ────────────────────────────────────────────────────────

function ViewDetailModal({
  visible, name, phone, email, status, onClose,
}: {
  visible: boolean; name: string; phone: string | null;
  email: string | null; status: ContactStatus; onClose: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { label, variant } = statusDisplay(status);
  const pillColor = variant === "primary" ? t.primary : variant === "secondary" ? t.secondary : t.tertiary;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.sheet, { backgroundColor: t.surfaceContainerLow }]}>
          <View style={[s.dragHandle, { backgroundColor: `${t.outlineVariant}50` }]} />
          <View style={s.sheetHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[s.sgMark, { backgroundColor: t.primary }]}>
                <Text style={[s.sgMarkText, { color: t.onPrimary }]}>SG</Text>
              </View>
              <Text style={[s.brandText, { color: t.primary }]}>SNOOZEGUARD</Text>
            </View>
            <View style={[s.pill, { backgroundColor: `${pillColor}20` }]}>
              <Text style={[s.pillText, { color: pillColor }]}>{label}</Text>
            </View>
          </View>

          <View style={s.avatarSection}>
            <View style={[s.avatarRing, { borderColor: `${t.primary}30` }]}>
              <View style={[s.avatar, { backgroundColor: `${t.primary}15` }]}>
                <Text style={[s.avatarText, { color: t.primary }]}>{initials(name)}</Text>
              </View>
              {status === "vigilant" && (
                <View style={[s.activeDot, { borderColor: t.surfaceContainerLow }]} />
              )}
            </View>
            <Text style={[s.driverName, { color: t.onSurface }]}>{name}</Text>
            <Text style={[s.driverRole, { color: pillColor }]}>
              {status === "vigilant" ? "● Online" : status === "standby" ? "○ Offline" : `● ${label}`}
            </Text>
          </View>

          <View style={{ gap: 8, paddingHorizontal: 20, marginBottom: 16 }}>
            {phone ? (
              <TouchableOpacity
                style={[s.contactPill, { backgroundColor: t.surfaceContainerHigh }]}
                onPress={() => void Linking.openURL(`tel:${phone}`)}>
                <Text style={s.contactPillIcon}>📞</Text>
                <Text style={[s.contactPillText, { color: t.onSurfaceVariant }]}>{phone}</Text>
              </TouchableOpacity>
            ) : null}
            {email ? (
              <TouchableOpacity
                style={[s.contactPill, { backgroundColor: t.surfaceContainerHigh }]}
                onPress={() => void Linking.openURL(`mailto:${email}`)}>
                <Text style={s.contactPillIcon}>✉️</Text>
                <Text style={[s.contactPillText, { color: t.onSurfaceVariant }]}>{email}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <View style={[s.statCard, { backgroundColor: t.surfaceContainerHigh }]}>
              <Text style={[s.statLabel, { color: t.onSurfaceVariant }]}>STATUS</Text>
              <Text style={[s.statValue, { color: pillColor }]}>{label}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.closeBtn, { borderTopColor: `${t.outlineVariant}30` }]}
            onPress={onClose}>
            <Text style={[s.closeBtnText, { color: t.onSurfaceVariant }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Remove Confirmation Modal ────────────────────────────────────────────────

function RemoveModal({
  visible, name, busy, onCancel, onConfirm,
}: {
  visible: boolean; name: string; busy: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={s.modalBackdrop}>
        <View style={[s.removeCard, { backgroundColor: t.surfaceContainerLow }]}>
          <View style={[s.removeIconBox, { backgroundColor: `${t.tertiary}20` }]}>
            <Text style={{ fontSize: 28 }}>🗑</Text>
          </View>
          <Text style={[s.removeTitle, { color: t.onSurface }]}>Remove Contact?</Text>
          <Text style={[s.removeBody, { color: t.onSurfaceVariant }]}>
            Are you sure you want to remove{" "}
            <Text style={{ fontWeight: "800", color: t.onSurface }}>{name}</Text>
            {"?"}{"\n"}They will no longer receive alerts on your behalf.
          </Text>
          <View style={s.removeBtnRow}>
            <TouchableOpacity
              style={[s.removeCancelBtn, { backgroundColor: t.surfaceContainerHigh }]}
              onPress={onCancel} disabled={busy}>
              <Text style={{ color: t.onSurface, fontWeight: "700", fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.removeConfirmBtn, { backgroundColor: `${t.tertiary}20` }]}
              onPress={onConfirm} disabled={busy}>
              {busy
                ? <ActivityIndicator color={t.tertiary} size="small" />
                : <Text style={{ color: t.tertiary, fontWeight: "700", fontSize: 14 }}>Remove</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function AddEditModal({
  visible, contact, saving, error, onClose, onSave,
}: {
  visible: boolean;
  contact: LocalEC | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (data: { name: string; phone: string; email: string }) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [name, setName] = useState(contact?.contact_name ?? "");
  const [phone, setPhone] = useState(contact?.contact_phone ?? "");
  const [email, setEmail] = useState(contact?.contact_email ?? "");
  const [localErr, setLocalErr] = useState("");

  useEffect(() => {
    if (visible) {
      setName(contact?.contact_name ?? "");
      setPhone(contact?.contact_phone ?? "");
      setEmail(contact?.contact_email ?? "");
      setLocalErr("");
    }
  }, [visible, contact]);

  const handleSave = () => {
    if (!name.trim()) { setLocalErr("Name is required."); return; }
    if (!phone.trim() && !email.trim()) { setLocalErr("Provide a phone number or email."); return; }
    setLocalErr("");
    onSave({ name: name.trim(), phone: phone.trim(), email: email.trim() });
  };

  const displayErr = localErr || error;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.sheet, { backgroundColor: t.surfaceContainerLow }]}>
          <View style={[s.dragHandle, { backgroundColor: `${t.outlineVariant}50` }]} />
          <View style={s.sheetHeader}>
            <Text style={[s.sheetTitle, { color: t.onSurface }]}>
              {contact ? "Edit Guardian" : "Add Guardian"}
            </Text>
            <TouchableOpacity onPress={onClose} style={s.closeX}>
              <Text style={[{ fontSize: 18, color: t.onSurfaceVariant }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 12 }}>
            {!!displayErr && (
              <View style={[s.errorBanner, { backgroundColor: `${t.tertiary}15`, borderColor: `${t.tertiary}40` }]}>
                <Text style={[s.errorBannerText, { color: t.tertiary }]}>{displayErr}</Text>
              </View>
            )}

            <View style={[s.formCard, { backgroundColor: t.surfaceContainerHigh, borderColor: `${t.outlineVariant}30` }]}>
              <Text style={[s.formSectionLabel, { color: t.primary }]}>GUARDIAN DETAILS</Text>
              {([
                { label: "FULL NAME *", value: name, onChange: setName, kb: "default" as const, cap: "words" as const, ph: "e.g. Maria Santos" },
                { label: "MOBILE NUMBER", value: phone, onChange: setPhone, kb: "phone-pad" as const, cap: "none" as const, ph: "+63 912 345 6789" },
                { label: "EMAIL ADDRESS", value: email, onChange: setEmail, kb: "email-address" as const, cap: "none" as const, ph: "contact@email.com" },
              ]).map(({ label, value, onChange, kb, cap, ph }) => (
                <View key={label}>
                  <Text style={[s.formLabel, { color: t.onSurfaceVariant }]}>{label}</Text>
                  <TextInput
                    style={[s.input, { color: t.onSurface, backgroundColor: t.surfaceContainerLow, borderColor: `${t.outlineVariant}40` }]}
                    value={value} onChangeText={(v) => { onChange(v); setLocalErr(""); }}
                    placeholder={ph} placeholderTextColor={t.onSurfaceVariant}
                    keyboardType={kb} autoCapitalize={cap} />
                </View>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, padding: 20, paddingTop: 12 }}>
            <TouchableOpacity
              style={[s.secondaryBtn, { flex: 0.45, backgroundColor: t.surfaceContainerHigh }]}
              onPress={onClose}>
              <Text style={[s.secondaryBtnText, { color: t.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <Pressable
              style={[s.primaryBtn, { flex: 1, backgroundColor: t.primary }]}
              disabled={saving} onPress={handleSave}>
              {saving
                ? <ActivityIndicator color={t.onPrimary} />
                : <Text style={[s.primaryBtnText, { color: t.onPrimary }]}>
                    {contact ? "Save Changes" : "Add Guardian"}
                  </Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Guardian Card ────────────────────────────────────────────────────────────

function GuardianCard({
  contact, toggling, canActivate, onView, onToggleActive, onEdit, onRemove,
}: {
  contact: LocalEC;
  toggling: boolean;
  canActivate: boolean;
  onView: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const isActive = contact.is_active === 1;
  const isPending = contact.status === "pending";
  const ecStatus: ContactStatus = isPending ? "pending" : "accepted";
  const { label, variant } = statusDisplay(ecStatus);
  const badgeColor = variant === "primary" ? t.primary : variant === "secondary" ? t.secondary : t.tertiary;

  return (
    <View style={[
      s.card,
      { backgroundColor: isActive ? `${t.primary}08` : t.surfaceContainerLow },
      isActive && { borderWidth: 1.5, borderColor: `${t.primary}30` },
    ]}>
      {isActive && (
        <View style={[s.activeRow, { borderBottomColor: `${t.primary}15` }]}>
          <View style={[s.activeDotSmall, { backgroundColor: t.primary }]} />
          <Text style={[s.activeLabel, { color: t.primary }]}>Active Guardian</Text>
        </View>
      )}
      <View style={[s.cardBadge, { backgroundColor: `${badgeColor}18` }]}>
        <Text style={[s.cardBadgeText, { color: badgeColor }]}>{label}</Text>
      </View>
      <View style={s.cardIdentity}>
        <View style={[s.cardAvatar, { backgroundColor: isActive ? `${t.primary}20` : `${t.primary}15` }]}>
          <Text style={[s.cardAvatarText, { color: t.primary }]}>{initials(contact.contact_name)}</Text>
        </View>
        <View style={{ flex: 1, paddingRight: 80 }}>
          <Text style={[s.cardName, { color: t.onSurface }]} numberOfLines={1}>{contact.contact_name}</Text>
          <Text style={[s.cardSub, { color: t.onSurfaceVariant }]} numberOfLines={1}>
            {contact.contact_phone || contact.contact_email || "No contact info"}
          </Text>
        </View>
      </View>
      <View style={[s.cardDivider, { backgroundColor: isActive ? `${t.primary}15` : `${t.outlineVariant}30` }]} />
      <View style={s.cardActions}>
        <TouchableOpacity
          style={[s.cardBtn, { backgroundColor: `${t.primary}10` }]}
          onPress={onView}>
          <Text style={[s.cardBtnText, { color: t.primary }]}>View</Text>
        </TouchableOpacity>
        <View style={[s.cardBtnDivider, { backgroundColor: isActive ? `${t.primary}15` : `${t.outlineVariant}30` }]} />
        <TouchableOpacity
          style={[s.cardBtn, { backgroundColor: `${t.primary}10` }]}
          onPress={onEdit}>
          <Text style={[s.cardBtnText, { color: t.primary }]}>Edit</Text>
        </TouchableOpacity>
        <View style={[s.cardBtnDivider, { backgroundColor: isActive ? `${t.primary}15` : `${t.outlineVariant}30` }]} />
        <TouchableOpacity
          style={[s.cardBtn, { backgroundColor: isActive ? `${t.onSurfaceVariant}08` : `${t.primary}10` }]}
          onPress={onToggleActive}
          disabled={toggling || (!isActive && !canActivate) || (!isActive && isPending)}>
          <Text style={[s.cardBtnText, { color: isActive ? t.onSurfaceVariant : isPending ? t.onSurfaceVariant : t.primary, opacity: (toggling || (!isActive && !canActivate) || (!isActive && isPending)) ? 0.4 : 1 }]}>
            {toggling ? "…" : isActive ? "Deactivate" : isPending ? "Pending" : "Activate"}
          </Text>
        </TouchableOpacity>
        <View style={[s.cardBtnDivider, { backgroundColor: isActive ? `${t.primary}15` : `${t.outlineVariant}30` }]} />
        <TouchableOpacity
          style={[s.cardBtn, { backgroundColor: `${t.tertiary}10` }]}
          onPress={onRemove}>
          <Text style={[s.cardBtnText, { color: t.tertiary }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function OfflineBanner({ t, s }: { t: Theme; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[s.offlineBanner, { backgroundColor: `${t.secondary}15`, borderColor: `${t.secondary}40` }]}>
      <Text style={{ color: t.secondary, fontWeight: "700", fontSize: 12 }}>
        📡  Offline — showing cached data
      </Text>
    </View>
  );
}

// ─── Emergency Contact Tab ────────────────────────────────────────────────────

function EmergencyContactTab() {
  const { user } = useSession();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [contacts, setContacts] = useState<LocalEC[]>([]);
  const [myPhone, setMyPhone] = useState("");
  const [myPhoneSaving, setMyPhoneSaving] = useState(false);
  const [myPhoneSaved, setMyPhoneSaved] = useState(false);
  const [error, setError] = useState("");
  const [addEditModal, setAddEditModal] = useState<LocalEC | "add" | null>(null);
  const [viewContact, setViewContact] = useState<LocalEC | null>(null);
  const [removeContact, setRemoveContact] = useState<LocalEC | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    console.log("[EC] Starting load for user:", user.id);
    
    // 1. Read SQLite immediately
    const cached = getLocalECList(user.id);
    console.log("[EC] Cached contacts from SQLite:", cached.length, cached);
    setContacts(cached);
    if (cached.length > 0) setLoading(false);

    // 2. Sync from Supabase if online
    const online = await isOnline();
    console.log("[EC] Online status:", online);
    setOffline(!online);
    if (!online) { 
      console.log("[EC] Offline, stopping sync");
      setLoading(false); 
      return; 
    }

    try {
      console.log("[EC] Fetching from Supabase...");
      const [ecs, profileRes] = await Promise.all([
        listEmergencyContacts(supabase, user.id),
        supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
      ]);

      console.log("[EC] Supabase returned", ecs.length, "contacts:", ecs);
      console.log("[EC] Profile phone:", profileRes.data);

      // Full sync: replace local cache with Supabase data
      const db = (await import("../db/database")).getDatabase();
      db.runSync("DELETE FROM emergency_contacts_local WHERE user_id = ?", user.id);
      console.log("[EC] Cleared old contacts from SQLite");
      
      // Deduplicate by id and filter out any without valid ids
      const uniqueIds = new Set<string>();
      let insertedCount = 0;
      for (const ec of ecs) {
        console.log("[EC] Processing contact:", ec.id, ec.contact_name, ec.status);
        if (!ec.id) { 
          console.warn("[EC] Skipping contact without id"); 
          continue; 
        }
        if (uniqueIds.has(ec.id)) { 
          console.warn("[EC] Skipping duplicate id:", ec.id); 
          continue; 
        }
        uniqueIds.add(ec.id);
        try {
          const localEC = ecToLocal(ec, user.id);
          console.log("[EC] Converted to local:", localEC);
          upsertLocalEC(localEC);
          insertedCount++;
        } catch (e) {
          console.warn("[EC] Failed to upsert EC:", ec.id, e);
        }
      }
      console.log("[EC] Inserted", insertedCount, "contacts to SQLite");
      
      const final = getLocalECList(user.id);
      console.log("[EC] Final contacts after sync:", final.length, final);
      setContacts(final);
      setMyPhone((profileRes.data as { phone?: string } | null)?.phone ?? "");
    } catch (e) { 
      console.error("[EC] Sync error:", e);
    }
    finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(async (st) => {
      if (st.isConnected && st.isInternetReachable) void load();
    });
    return unsub;
  }, [load]);

  const handleToggleActive = async (contactId: string) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    if (contact.is_active !== 1 && contact.status === "pending") {
      setError("Guardian has not accepted the request yet. Wait for their confirmation.");
      return;
    }
    const activeCount = contacts.filter((c) => c.is_active === 1).length;
    if (contact.is_active !== 1 && activeCount >= 3) {
      setError("Maximum of 3 active guardians allowed. Deactivate one first.");
      return;
    }
    setTogglingId(contactId);
    const result = toggleActiveLocalEC(user.id, contactId);
    if (result.error) { setError(result.error); setTogglingId(null); return; }
    setContacts(getLocalECList(user.id));
    if (await isOnline()) {
      const { error: e } = await toggleActiveEmergencyContact(supabase, user.id, contactId);
      if (e) setError(e);
    }
    setTogglingId(null);
  };

  const handleSave = async (data: { name: string; phone: string; email: string }) => {
    setFormSaving(true);
    setFormError("");

    if (!(await isOnline())) {
      setFormError("Internet required to save guardian info.");
      setFormSaving(false);
      return;
    }

    try {
      if (addEditModal === "add") {
        const res = await addEmergencyContact(supabase, user.id, {
          contact_name: data.name,
          contact_phone: data.phone,
          contact_email: data.email,
        });
        if (res.error) { setFormError(res.error); return; }
        if (res.id) {
          upsertLocalEC({
            id: res.id,
            user_id: user.id,
            contact_name: data.name,
            contact_phone: data.phone,
            contact_email: data.email,
            my_phone: myPhone,
            is_active: contacts.filter((c) => c.is_active === 1).length < 3 ? 1 : 0,
            status: res.status || "pending",
            pending_sync: 0,
            updated_at: new Date().toISOString(),
          });
        }
      } else if (addEditModal) {
        const res = await updateEmergencyContact(supabase, addEditModal.id, user.id, {
          contact_name: data.name,
          contact_phone: data.phone,
          contact_email: data.email,
        });
        if (res.error) { setFormError(res.error); return; }
        upsertLocalEC({
          ...addEditModal,
          contact_name: data.name,
          contact_phone: data.phone,
          contact_email: data.email,
          status: addEditModal.status,
          pending_sync: 0,
          updated_at: new Date().toISOString(),
        });
      }
      setContacts(getLocalECList(user.id));
      setAddEditModal(null);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removeContact) return;
    setRemoveBusy(true);

    if (!(await isOnline())) {
      setError("Internet required to remove a guardian.");
      setRemoveBusy(false);
      setRemoveContact(null);
      return;
    }

    const { error: e } = await removeEmergencyContactById(supabase, removeContact.id, user.id);
    if (e) { setError(e); }
    else {
      deleteLocalEC(removeContact.id);
      setContacts(getLocalECList(user.id));
      setRemoveContact(null);
    }
    setRemoveBusy(false);
  };

  const handleSaveMyPhone = async () => {
    if (!(await isOnline())) { setError("Internet required to save phone."); return; }
    setMyPhoneSaving(true);
    await supabase.from("profiles").update({ phone: myPhone.trim() || null }).eq("id", user.id);
    setMyPhoneSaving(false);
    setMyPhoneSaved(true);
    setTimeout(() => setMyPhoneSaved(false), 3000);
  };

  if (loading && contacts.length === 0) return (
    <View style={s.center}><ActivityIndicator color={t.primary} size="large" /></View>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      {offline && <OfflineBanner t={t} s={s} />}

      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 16, gap: 8 }}>
        <Text style={[s.tabDesc, { color: t.onSurfaceVariant, flex: 1, marginBottom: 0 }]}>
          Your guardians are notified when a drowsiness alert goes unacknowledged.{" "}
          Up to <Text style={{ fontWeight: "800", color: t.primary }}>3</Text> active guardians receive alerts — toggle anytime.
        </Text>
        {contacts.length > 0 && (
          <View style={[s.activeCountBadge, { backgroundColor: `${t.primary}10` }]}>
            <Text style={[s.activeCountText, { color: t.primary }]}>
              {contacts.filter((cx) => cx.is_active === 1).length}/3 active
            </Text>
          </View>
        )}
      </View>

      {!!error && (
        <View style={[s.errorBanner, { backgroundColor: `${t.tertiary}15`, borderColor: `${t.tertiary}40` }]}>
          <Text style={[s.errorBannerText, { color: t.tertiary }]}>{error}</Text>
        </View>
      )}

      {/* Guardian list */}
      {contacts.length === 0 ? (
        <View style={s.emptyState}>
          <View style={[s.emptyIcon, { backgroundColor: `${t.primary}15` }]}>
            <Text style={{ fontSize: 32 }}>🛡️</Text>
          </View>
          <Text style={[s.emptyTitle, { color: t.onSurface }]}>No guardians yet</Text>
          <Text style={[s.emptyBody, { color: t.onSurfaceVariant }]}>
            Add emergency contacts who can be alerted when you show signs of fatigue during a drive.
          </Text>
          <Pressable style={[s.primaryBtn, { backgroundColor: t.primary }]} onPress={() => { setFormError(""); setAddEditModal("add"); }}>
            <Text style={[s.primaryBtnText, { color: t.onPrimary }]}>Add Guardian</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {contacts.map((c) => (
            <GuardianCard
              key={c.id}
              contact={c}
              toggling={togglingId === c.id}
              canActivate={contacts.filter((cx) => cx.is_active === 1).length < 3 && c.status !== "pending"}
              onView={() => setViewContact(c)}
              onToggleActive={() => void handleToggleActive(c.id)}
              onEdit={() => { setFormError(""); setAddEditModal(c); }}
              onRemove={() => setRemoveContact(c)}
            />
          ))}
          <TouchableOpacity
            style={[s.addAnotherBtn, { borderColor: `${t.outlineVariant}50` }]}
            onPress={() => { setFormError(""); setAddEditModal("add"); }}>
            <Text style={[s.addAnotherText, { color: t.onSurfaceVariant }]}>+ Add Another Guardian</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Your number */}
      <View style={[s.formCard, { backgroundColor: t.surfaceContainerLow, borderColor: `${t.outlineVariant}30`, marginTop: 24 }]}>
        <Text style={[s.formSectionLabel, { color: t.primary }]}>YOUR NUMBER</Text>
        <Text style={[s.formHint, { color: t.onSurfaceVariant }]}>
          Shown to your guardian so they can reach you when an alert fires.
        </Text>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <TextInput
            style={[s.input, { flex: 1, color: t.onSurface, backgroundColor: t.surfaceContainerHigh, borderColor: `${t.outlineVariant}40` }]}
            value={myPhone} onChangeText={setMyPhone}
            placeholder="+63 912 345 6789" placeholderTextColor={t.onSurfaceVariant}
            keyboardType="phone-pad" />
          <TouchableOpacity
            style={[s.savePhoneBtn, { backgroundColor: myPhoneSaved ? "#4ade8025" : `${t.primary}15` }]}
            onPress={() => void handleSaveMyPhone()} disabled={myPhoneSaving}>
            <Text style={[s.savePhoneBtnText, { color: myPhoneSaved ? "#4ade80" : t.primary }]}>
              {myPhoneSaving ? "…" : myPhoneSaved ? "Saved ✓" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <AddEditModal
        visible={addEditModal !== null}
        contact={addEditModal !== null && addEditModal !== "add" ? addEditModal : null}
        saving={formSaving}
        error={formError}
        onClose={() => setAddEditModal(null)}
        onSave={(data) => void handleSave(data)}
      />
      {viewContact && (
        <ViewDetailModal
          visible name={viewContact.contact_name}
          phone={viewContact.contact_phone || null}
          email={viewContact.contact_email || null}
          status="accepted" onClose={() => setViewContact(null)} />
      )}
      {removeContact && (
        <RemoveModal
          visible name={removeContact.contact_name} busy={removeBusy}
          onCancel={() => setRemoveContact(null)} onConfirm={() => void handleRemove()} />
      )}
    </ScrollView>
  );
}

// ─── Connection Tab ───────────────────────────────────────────────────────────

function ConnectionTab() {
  const { user } = useSession();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [drivers, setDrivers] = useState<DriverCard[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<DriverCard | null>(null);
  const [removing, setRemoving] = useState<DriverCard | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const online = await isOnline();
    setOffline(!online);
    if (!online) { setLoading(false); return; }

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
          phone: p?.phone ?? row.contact_phone,
          email: p?.email ?? row.contact_email,
          ecStatus: row.status,
        };
      }));

      setDrivers(enriched);
    } catch { setError("Failed to load. Check your connection."); }
    finally { setLoading(false); }
  }, [user.id, user.email]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setOnlineIds(getPresenceIds());
    return subscribePresence(() => setOnlineIds(new Set(getPresenceIds())));
  }, []);

  const handleRemove = async (d: DriverCard) => {
    setRemoveBusy(true);
    try {
      await supabase.from("emergency_contacts").delete().eq("id", d.id);
      setRemoving(null); void load();
    } catch { setError("Failed to remove."); }
    finally { setRemoveBusy(false); }
  };

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={t.primary} size="large" /></View>
  );

  if (offline) return (
    <View style={[s.center, { paddingHorizontal: 40, gap: 16 }]}>
      <Text style={{ fontSize: 44 }}>📡</Text>
      <Text style={[s.emptyTitle, { color: t.onSurface }]}>You're offline</Text>
      <Text style={[s.emptyBody, { color: t.onSurfaceVariant }]}>
        Connect to the internet to see drivers you are protecting.
      </Text>
    </View>
  );

  const onlineCount = drivers.filter((d) => onlineIds.has(d.user_id)).length;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text style={[s.tabDesc, { color: t.onSurfaceVariant, marginBottom: 0, flex: 1 }]}>
          Drivers who have added you as their emergency contact.
        </Text>
        {drivers.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 12 }}>
            <View style={[s.onlineDot, { backgroundColor: onlineCount > 0 ? t.primary : t.outlineVariant }]} />
            <Text style={{ fontSize: 10, fontWeight: "700", color: t.onSurfaceVariant }}>
              {onlineCount} online
            </Text>
          </View>
        )}
      </View>

      {error && (
        <View style={[s.errorBanner, { backgroundColor: `${t.tertiary}15`, borderColor: `${t.tertiary}40` }]}>
          <Text style={[s.errorBannerText, { color: t.tertiary }]}>{error}</Text>
        </View>
      )}

      {drivers.length === 0 ? (
        <View style={s.emptyState}>
          <View style={[s.emptyIcon, { backgroundColor: `${t.primary}15` }]}>
            <Text style={{ fontSize: 32 }}>🛡️</Text>
          </View>
          <Text style={[s.emptyTitle, { color: t.onSurface }]}>No drivers assigned</Text>
          <Text style={[s.emptyBody, { color: t.onSurfaceVariant }]}>
            No drivers have designated you as their emergency contact yet.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {drivers.map((d) => {
            const isOnline = onlineIds.has(d.user_id);
            const ecStatus: ContactStatus = isOnline ? "vigilant" : "standby";
            const { variant } = statusDisplay(ecStatus);
            const badgeColor = variant === "primary" ? t.primary : t.secondary;
            return (
              <View key={d.id} style={[s.card, { backgroundColor: t.surfaceContainerLow }]}>
                <View style={[s.cardBadge, { backgroundColor: `${badgeColor}18` }]}>
                  <Text style={[s.cardBadgeText, { color: badgeColor }]}>{isOnline ? "Online" : "Offline"}</Text>
                </View>
                <View style={s.cardIdentity}>
                  <View style={[s.cardAvatar, { backgroundColor: `${t.primary}15` }]}>
                    <Text style={[s.cardAvatarText, { color: t.primary }]}>{initials(d.name)}</Text>
                  </View>
                  <View style={{ flex: 1, paddingRight: 80 }}>
                    <Text style={[s.cardName, { color: t.onSurface }]} numberOfLines={1}>{d.name}</Text>
                    <Text style={[s.cardSub, { color: t.onSurfaceVariant }]} numberOfLines={1}>
                      {d.phone || d.email || "No contact info"}
                    </Text>
                  </View>
                </View>
                <View style={[s.cardDivider, { backgroundColor: `${t.outlineVariant}30` }]} />
                <View style={s.cardActions}>
                  <TouchableOpacity
                    style={[s.cardBtn, { backgroundColor: `${t.primary}10` }]}
                    onPress={() => setViewing(d)}>
                    <Text style={[s.cardBtnText, { color: t.primary }]}>View</Text>
                  </TouchableOpacity>
                  <View style={[s.cardBtnDivider, { backgroundColor: `${t.outlineVariant}30` }]} />
                  <TouchableOpacity
                    style={[s.cardBtn, { backgroundColor: `${t.tertiary}10` }]}
                    onPress={() => setRemoving(d)}>
                    <Text style={[s.cardBtnText, { color: t.tertiary }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {viewing && (
        <ViewDetailModal
          visible name={viewing.name} phone={viewing.phone} email={viewing.email}
          status={onlineIds.has(viewing.user_id) ? "vigilant" : "standby"}
          onClose={() => setViewing(null)} />
      )}
      {removing && (
        <RemoveModal
          visible name={removing.name} busy={removeBusy}
          onCancel={() => setRemoving(null)} onConfirm={() => void handleRemove(removing)} />
      )}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function EmergencyContactScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [tab, setTab] = useState<"ec" | "connection">("ec");

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={[s.tabBarWrapper, { borderBottomColor: `${t.outlineVariant}20` }]}>
        <View style={[s.tabBar, { backgroundColor: t.surfaceContainerLow }]}>
          {(["ec", "connection"] as const).map((key) => (
            <TouchableOpacity
              key={key}
              style={[s.tabItem, tab === key && [s.tabItemActive, { backgroundColor: t.surfaceBright }]]}
              onPress={() => setTab(key)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabLabel, { color: tab === key ? t.primary : t.onSurfaceVariant }]}>
                {key === "ec" ? "My Guardian" : "I Protect"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {tab === "ec" ? <EmergencyContactTab /> : <ConnectionTab />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    tabContent: { padding: 20, paddingBottom: 48 },
    tabDesc: { fontSize: 13, lineHeight: 20, marginBottom: 16 },

    // Tab bar
    tabBarWrapper: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    tabBar: { flexDirection: "row", borderRadius: 16, padding: 4 },
    tabItem: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
    tabItemActive: {},
    tabLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },

    // Banners
    offlineBanner: { borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, alignItems: "center" },
    errorBanner: { borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, alignItems: "center" },
    errorBannerText: { fontSize: 13, fontWeight: "700" },

    // Contact card
    card: { borderRadius: 24, overflow: "hidden" },
    activeRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1 },
    activeDotSmall: { width: 6, height: 6, borderRadius: 99 },
    activeLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
    cardBadge: { position: "absolute", top: 16, right: 16, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, zIndex: 1 },
    cardBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
    cardIdentity: { flexDirection: "row", alignItems: "center", gap: 14, padding: 20, paddingBottom: 16 },
    cardAvatar: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    cardAvatarText: { fontSize: 18, fontWeight: "900" },
    cardName: { fontSize: 15, fontWeight: "800", marginBottom: 3 },
    cardSub: { fontSize: 12, fontWeight: "500" },
    cardDivider: { height: 1 },
    cardActions: { flexDirection: "row" },
    cardBtn: { flex: 1, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
    cardBtnDivider: { width: 1 },
    cardBtnText: { fontWeight: "700", fontSize: 13 },

    // Add another button
    addAnotherBtn: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 20, paddingVertical: 16, alignItems: "center" },
    addAnotherText: { fontSize: 13, fontWeight: "700" },

    // Form
    formCard: { borderRadius: 20, padding: 18, borderWidth: 1, gap: 12 },
    formSectionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2, marginBottom: 2 },
    formHint: { fontSize: 12, lineHeight: 18 },
    formLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6, marginTop: 4 },
    input: { borderWidth: 1, borderRadius: 14, padding: 13, fontSize: 15, marginBottom: 4 },

    // Buttons
    primaryBtn: { padding: 16, borderRadius: 18, alignItems: "center" },
    primaryBtnText: { fontWeight: "800", fontSize: 15 },
    secondaryBtn: { padding: 16, borderRadius: 18, alignItems: "center" },
    secondaryBtnText: { fontWeight: "700", fontSize: 14 },
    savePhoneBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, alignItems: "center" },
    savePhoneBtnText: { fontSize: 13, fontWeight: "700" },

    // Empty state
    emptyState: { alignItems: "center", paddingTop: 48, paddingBottom: 24, gap: 12 },
    emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    emptyTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
    emptyBody: { fontSize: 13, textAlign: "center", lineHeight: 20, maxWidth: 260 },

    // Active count badge
    activeCountBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
    activeCountText: { fontSize: 10, fontWeight: "800" },

    // Online indicator
    onlineDot: { width: 7, height: 7, borderRadius: 99 },

    // Sheet modal (view detail + add/edit)
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
    sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: "hidden", maxHeight: "90%", paddingBottom: 8 },
    dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
    sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
    sheetTitle: { fontSize: 18, fontWeight: "800" },
    closeX: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },

    // View detail modal
    sgMark: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    sgMarkText: { fontSize: 10, fontWeight: "900", letterSpacing: -0.5 },
    brandText: { fontSize: 10, fontWeight: "900", letterSpacing: 2 },
    pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99 },
    pillText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
    avatarSection: { alignItems: "center", paddingBottom: 20, gap: 8 },
    avatarRing: { width: 96, height: 96, borderRadius: 28, borderWidth: 3, alignItems: "center", justifyContent: "center" },
    avatar: { width: 82, height: 82, borderRadius: 24, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 30, fontWeight: "900" },
    activeDot: { position: "absolute", bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: "#4ade80", borderWidth: 2 },
    driverName: { fontSize: 20, fontWeight: "800", textAlign: "center" },
    driverRole: { fontSize: 12, fontWeight: "700", textAlign: "center" },
    contactPill: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 13 },
    contactPillIcon: { fontSize: 16 },
    contactPillText: { fontWeight: "600", fontSize: 14, flex: 1 },
    statCard: { borderRadius: 18, padding: 16 },
    statLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: "800" },
    closeBtn: { paddingVertical: 20, alignItems: "center", borderTopWidth: 1, marginTop: 4 },
    closeBtnText: { fontSize: 15, fontWeight: "600" },

    // Remove modal
    removeCard: { width: "100%", borderRadius: 28, padding: 28, alignItems: "center", gap: 14 },
    removeIconBox: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    removeTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
    removeBody: { fontSize: 13, textAlign: "center", lineHeight: 20 },
    removeBtnRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
    removeCancelBtn: { flex: 1, paddingVertical: 15, borderRadius: 16, alignItems: "center" },
    removeConfirmBtn: { flex: 1, paddingVertical: 15, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  });
