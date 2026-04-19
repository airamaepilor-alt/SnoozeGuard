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
import { getEmergencyContact, upsertEmergencyContact } from "../lib/emergencyNotify";
import { getDatabase } from "../db/database";
import { isOnline } from "../sync/flush";
import { getPresenceIds, subscribePresence } from "../lib/presenceStore";
import type { Theme } from "../theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type CachedEC = {
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  my_phone: string;
  pending_sync: number;
};

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

// ─── SG Brand Mark ────────────────────────────────────────────────────────────

function SGMark({ t, size = 24 }: { t: Theme; size?: number }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.3,
        backgroundColor: t.primary, alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ color: t.onPrimary, fontSize: size * 0.38, fontWeight: "900", letterSpacing: -0.5 }}>
        SG
      </Text>
    </View>
  );
}

// ─── View Detail Modal ────────────────────────────────────────────────────────

function ViewDetailModal({
  visible, name, phone, email, status, onClose,
}: {
  visible: boolean;
  name: string;
  phone: string | null;
  email: string | null;
  status: ContactStatus;
  onClose: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { label, variant } = statusDisplay(status);
  const pillColor = variant === "primary" ? t.primary : variant === "secondary" ? t.secondary : t.tertiary;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.sheetHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <SGMark t={t} size={26} />
              <Text style={[s.brandText, { color: t.primary }]}>SNOOZEGUARD</Text>
            </View>
            <View style={[s.pill, { backgroundColor: `${pillColor}20` }]}>
              <Text style={[s.pillText, { color: pillColor }]}>{label}</Text>
            </View>
          </View>

          {/* Avatar */}
          <View style={s.avatarSection}>
            <View style={[s.avatarRing, { borderColor: `${t.primary}33` }]}>
              <View style={[s.avatar, { backgroundColor: t.surfaceContainerHigh }]}>
                <Text style={[s.avatarText, { color: t.primary }]}>{initials(name)}</Text>
              </View>
              {status === "vigilant" && <View style={[s.activeDot, { borderColor: t.surfaceContainerLow }]} />}
            </View>
            <Text style={[s.driverName, { color: t.onSurface }]}>{name}</Text>
            <Text style={[s.driverRole, { color: pillColor }]}>
              {status === "vigilant" ? "● Online" : status === "standby" ? "○ Offline" : `● ${label}`}
            </Text>
          </View>

          {/* Contact pills */}
          <View style={{ gap: 8, paddingHorizontal: 20, marginBottom: 16 }}>
            {phone ? (
              <TouchableOpacity style={[s.phonePill, { backgroundColor: t.surfaceContainerHigh }]}
                onPress={() => void Linking.openURL(`tel:${phone}`)}>
                <Text style={s.phonePillIcon}>📞</Text>
                <Text style={[s.phonePillText, { color: t.onSurfaceVariant }]}>{phone}</Text>
              </TouchableOpacity>
            ) : null}
            {email ? (
              <TouchableOpacity style={[s.phonePill, { backgroundColor: t.surfaceContainerHigh }]}
                onPress={() => void Linking.openURL(`mailto:${email}`)}>
                <Text style={s.phonePillIcon}>✉️</Text>
                <Text style={[s.phonePillText, { color: t.onSurfaceVariant }]}>{email}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Stat card */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: t.surfaceContainerHigh }]}>
              <Text style={[s.statLabel, { color: t.onSurfaceVariant }]}>STATUS</Text>
              <Text style={[s.statValue, { color: pillColor }]}>{label}</Text>
            </View>
          </View>

          {/* Close */}
          <TouchableOpacity style={[s.closeBtn, { borderTopColor: `${t.outlineVariant}22` }]} onPress={onClose}>
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
  visible: boolean;
  name: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={s.modalBackdrop}>
        <View style={[s.removeCard, { backgroundColor: t.surfaceContainerLow }]}>
          <View style={[s.removeIconBox, { backgroundColor: `${t.tertiary}22` }]}>
            <Text style={{ fontSize: 26 }}>🗑</Text>
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
              onPress={onCancel} disabled={busy}
            >
              <Text style={{ color: t.onSurface, fontWeight: "700", fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.removeConfirmBtn, { backgroundColor: `${t.tertiary}22` }]}
              onPress={onConfirm} disabled={busy}
            >
              {busy
                ? <ActivityIndicator color={t.tertiary} size="small" />
                : <Text style={{ color: t.tertiary, fontWeight: "700", fontSize: 14 }}>Remove</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({
  name, phone, email, statusBadge, onView,
  onSecondary, secondaryLabel, secondaryColor,
}: {
  name: string;
  phone: string | null;
  email: string | null;
  statusBadge: ContactStatus;
  onView: () => void;
  onSecondary: () => void;
  secondaryLabel: string;
  secondaryColor: string;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { label, variant } = statusDisplay(statusBadge);
  const badgeColor = variant === "primary" ? t.primary : variant === "secondary" ? t.secondary : t.tertiary;

  return (
    <View style={[s.card, { backgroundColor: t.surfaceContainer }]}>
      <View style={[s.cardBadge, { backgroundColor: `${badgeColor}20` }]}>
        <Text style={[s.cardBadgeText, { color: badgeColor }]}>{label}</Text>
      </View>
      <View style={s.cardIdentity}>
        <View style={[s.cardAvatar, { backgroundColor: t.surfaceContainerHigh }]}>
          <Text style={[s.cardAvatarText, { color: t.primary }]}>{initials(name)}</Text>
        </View>
        <View style={{ flex: 1, paddingRight: 72 }}>
          <Text style={[s.cardName, { color: t.onSurface }]} numberOfLines={1}>{name}</Text>
          <Text style={[s.cardSub, { color: t.onSurfaceVariant }]} numberOfLines={1}>
            {phone || email || "No contact info"}
          </Text>
        </View>
      </View>
      <View style={s.cardActions}>
        <TouchableOpacity style={[s.cardBtn, { backgroundColor: t.surfaceBright }]} onPress={onView}>
          <Text style={[s.cardBtnText, { color: t.primary }]}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.cardBtn, { backgroundColor: `${secondaryColor}20` }]} onPress={onSecondary}>
          <Text style={[s.cardBtnText, { color: secondaryColor }]}>{secondaryLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Emergency Contact Tab ────────────────────────────────────────────────────

function EmergencyContactTab() {
  const { user } = useSession();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [myPhone, setMyPhone] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ecDbStatus, setEcDbStatus] = useState("pending");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function readCache(): CachedEC | null {
    try {
      return getDatabase().getFirstSync<CachedEC>(
        "SELECT contact_name, contact_phone, contact_email, my_phone, pending_sync FROM emergency_contacts_local WHERE user_id = ?",
        user.id,
      ) ?? null;
    } catch { return null; }
  }

  function writeCache(data: { contact_name: string; contact_phone: string; contact_email: string; my_phone: string; pending: boolean }) {
    try {
      getDatabase().runSync(
        `INSERT OR REPLACE INTO emergency_contacts_local
         (user_id, contact_name, contact_phone, contact_email, my_phone, pending_sync, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        user.id, data.contact_name, data.contact_phone, data.contact_email,
        data.my_phone, data.pending ? 1 : 0, new Date().toISOString(),
      );
    } catch { /* ignore */ }
  }

  const syncPending = useCallback(async () => {
    const cached = readCache();
    if (!cached || cached.pending_sync === 0) return;
    if (!(await isOnline())) return;
    const [res] = await Promise.all([
      upsertEmergencyContact(supabase, user.id, {
        contact_name: cached.contact_name,
        contact_phone: cached.contact_phone,
        contact_email: cached.contact_email,
      }),
      cached.my_phone
        ? supabase.from("profiles").update({ phone: cached.my_phone }).eq("id", user.id)
        : Promise.resolve(),
    ]);
    if (!res.error) { writeCache({ ...cached, pending: false }); setOffline(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const cached = readCache();
    if (cached) {
      setName(cached.contact_name); setPhone(cached.contact_phone);
      setEmail(cached.contact_email); setMyPhone(cached.my_phone);
      setLoading(false);
    }
    try {
      const online = await isOnline();
      setOffline(!online);
      if (!online) return;

      const [ec, profileRes, ecRow] = await Promise.all([
        getEmergencyContact(supabase, user.id),
        supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
        supabase.from("emergency_contacts").select("status").eq("user_id", user.id).maybeSingle(),
      ]);

      const freshPhone = (profileRes.data as { phone?: string } | null)?.phone ?? "";
      const dbStatus = (ecRow.data as { status?: string } | null)?.status ?? "pending";
      setEcDbStatus(dbStatus);

      if (ec) {
        setName(ec.contact_name); setPhone(ec.contact_phone ?? "");
        setEmail(ec.contact_email ?? ""); setMyPhone(freshPhone);
        writeCache({ contact_name: ec.contact_name, contact_phone: ec.contact_phone ?? "", contact_email: ec.contact_email ?? "", my_phone: freshPhone, pending: false });
      } else if (!cached) {
        setMyPhone(freshPhone);
      }
      if (cached?.pending_sync === 1) await syncPending();
    } catch { /* stay cached */ }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, syncPending]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(async (st) => {
      if (st.isConnected && st.isInternetReachable) await syncPending();
    });
    return unsub;
  }, [syncPending]);

  const save = async () => {
    setError(""); setSaved(false);
    if (!name.trim()) { setError("Name is required."); return; }
    if (!phone.trim() && !email.trim()) { setError("Provide a phone number or email."); return; }
    setSaving(true);
    writeCache({ contact_name: name.trim(), contact_phone: phone.trim(), contact_email: email.trim(), my_phone: myPhone.trim(), pending: true });
    try {
      const online = await isOnline();
      if (!online) {
        setOffline(true); setSaved(true); setShowForm(false);
        setTimeout(() => setSaved(false), 4000);
        return;
      }
      const [res] = await Promise.all([
        upsertEmergencyContact(supabase, user.id, { contact_name: name.trim(), contact_phone: phone.trim(), contact_email: email.trim() }),
        supabase.from("profiles").update({ phone: myPhone.trim() }).eq("id", user.id),
      ]);
      if (res.error) { setError(res.error); }
      else {
        writeCache({ contact_name: name.trim(), contact_phone: phone.trim(), contact_email: email.trim(), my_phone: myPhone.trim(), pending: false });
        setSaved(true); setShowForm(false);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch { setError("Saved locally. Will sync when online."); }
    finally { setSaving(false); }
  };

  const handleRemove = async () => {
    setRemoveBusy(true);
    try {
      if (await isOnline()) await supabase.from("emergency_contacts").delete().eq("user_id", user.id);
      getDatabase().runSync("DELETE FROM emergency_contacts_local WHERE user_id = ?", user.id);
      setName(""); setPhone(""); setEmail(""); setRemoveOpen(false);
    } catch { /* ignore */ }
    finally { setRemoveBusy(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.primary} /></View>;

  const hasContact = name.trim().length > 0;
  const contactStatus: ContactStatus = ecDbStatus === "accepted" ? "accepted" : ecDbStatus === "rejected" ? "rejected" : "pending";

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabContent}>
      {offline && <OfflineBanner t={t} s={s} />}

      <Text style={[s.tabDesc, { color: t.onSurfaceVariant }]}>
        Your designated emergency contact will be notified if a critical drowsiness alert goes unacknowledged during your drive.
      </Text>

      {saved && <Text style={s.successText}>{offline ? "✓ Saved locally — syncing when online" : "✓ Saved successfully"}</Text>}
      {error ? <Text style={[s.errorText, { color: t.tertiary }]}>{error}</Text> : null}

      {hasContact && !showForm ? (
        <ContactCard
          name={name} phone={phone || null} email={email || null}
          statusBadge={contactStatus}
          onView={() => setViewOpen(true)}
          onSecondary={() => setShowForm(true)}
          secondaryLabel="Edit"
          secondaryColor={t.primary}
        />
      ) : hasContact && showForm ? (
        <ECForm
          t={t} s={s} myPhone={myPhone} name={name} phone={phone} email={email} saving={saving}
          onMyPhone={setMyPhone} onName={(v) => { setName(v); setError(""); }}
          onPhone={(v) => { setPhone(v); setError(""); }} onEmail={(v) => { setEmail(v); setError(""); }}
          onSave={() => void save()} onCancel={() => setShowForm(false)} showCancel
        />
      ) : showForm ? (
        <ECForm
          t={t} s={s} myPhone={myPhone} name={name} phone={phone} email={email} saving={saving}
          onMyPhone={setMyPhone} onName={(v) => { setName(v); setError(""); }}
          onPhone={(v) => { setPhone(v); setError(""); }} onEmail={(v) => { setEmail(v); setError(""); }}
          onSave={() => void save()} onCancel={() => setShowForm(false)} showCancel={false}
        />
      ) : (
        <EmptyGuardian t={t} s={s} onAdd={() => setShowForm(true)} />
      )}

      <ViewDetailModal
        visible={viewOpen} name={name} phone={phone || null} email={email || null}
        status={contactStatus} onClose={() => setViewOpen(false)}
      />
      <RemoveModal visible={removeOpen} name={name} busy={removeBusy} onCancel={() => setRemoveOpen(false)} onConfirm={() => void handleRemove()} />
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

  // Read online IDs from the shared presence store (channel owned by App.tsx)
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

  if (loading) return <View style={s.center}><ActivityIndicator color={t.primary} /></View>;

  if (offline) return (
    <View style={[s.center, { paddingHorizontal: 32, gap: 12 }]}>
      <Text style={{ fontSize: 40 }}>📡</Text>
      <Text style={{ fontSize: 16, fontWeight: "700", color: t.onSurface, textAlign: "center" }}>Offline</Text>
      <Text style={{ fontSize: 13, color: t.onSurfaceVariant, textAlign: "center" }}>
        Connect to the internet to see drivers you are protecting.
      </Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabContent}>
      <Text style={[s.tabDesc, { color: t.onSurfaceVariant }]}>
        Drivers who have added you as their emergency contact. You will be notified if they trigger a high fatigue alert.
      </Text>

      {error && <Text style={[s.errorText, { color: t.tertiary }]}>{error}</Text>}

      {drivers.length === 0 ? (
        <View style={[s.center, { paddingTop: 40, gap: 12 }]}>
          <Text style={{ fontSize: 48 }}>🛡️</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: t.onSurface }}>No drivers assigned</Text>
          <Text style={{ fontSize: 13, color: t.onSurfaceVariant, textAlign: "center" }}>
            No drivers have designated you as their emergency contact yet.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {drivers.map((d) => (
            <ContactCard
              key={d.id} name={d.name} phone={d.phone} email={d.email}
              statusBadge={onlineIds.has(d.user_id) ? "vigilant" : "standby"}
              onView={() => setViewing(d)}
              onSecondary={() => setRemoving(d)}
              secondaryLabel="Remove"
              secondaryColor={t.tertiary}
            />
          ))}
        </View>
      )}

      {viewing && (
        <ViewDetailModal
          visible name={viewing.name} phone={viewing.phone} email={viewing.email}
          status={onlineIds.has(viewing.user_id) ? "vigilant" : "standby"}
          onClose={() => setViewing(null)}
        />
      )}
      {removing && (
        <RemoveModal
          visible name={removing.name} busy={removeBusy}
          onCancel={() => setRemoving(null)} onConfirm={() => void handleRemove(removing)}
        />
      )}
    </ScrollView>
  );
}

// ─── Small shared sub-components ─────────────────────────────────────────────

function OfflineBanner({ t, s }: { t: Theme; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[s.offlineBanner, { backgroundColor: `${t.secondary}20`, borderColor: `${t.secondary}50` }]}>
      <Text style={{ color: t.secondary, fontWeight: "700", fontSize: 12 }}>Offline — showing cached data</Text>
    </View>
  );
}

function EmptyGuardian({ t, s, onAdd }: { t: Theme; s: ReturnType<typeof makeStyles>; onAdd: () => void }) {
  return (
    <View style={[s.center, { paddingTop: 40, gap: 12 }]}>
      <Text style={{ fontSize: 48 }}>🛡️</Text>
      <Text style={{ fontSize: 16, fontWeight: "700", color: t.onSurface }}>No contact set</Text>
      <Text style={{ fontSize: 13, color: t.onSurfaceVariant, textAlign: "center" }}>
        Add an emergency contact who will be alerted if you show signs of fatigue.
      </Text>
      <TouchableOpacity style={[s.saveBtn, { backgroundColor: t.primary, paddingHorizontal: 32, marginTop: 8 }]} onPress={onAdd}>
        <Text style={[s.saveBtnText, { color: t.onPrimary }]}>Add Contact</Text>
      </TouchableOpacity>
    </View>
  );
}

function ECForm({
  t, s, myPhone, name, phone, email, saving, showCancel,
  onMyPhone, onName, onPhone, onEmail, onSave, onCancel,
}: {
  t: Theme; s: ReturnType<typeof makeStyles>;
  myPhone: string; name: string; phone: string; email: string; saving: boolean; showCancel: boolean;
  onMyPhone: (v: string) => void; onName: (v: string) => void;
  onPhone: (v: string) => void; onEmail: (v: string) => void;
  onSave: () => void; onCancel: () => void;
}) {
  return (
    <View style={[s.formCard, { backgroundColor: t.surfaceContainerLow, borderColor: `${t.outlineVariant}40` }]}>
      <Text style={[s.formSection, { color: t.onSurfaceVariant }]}>YOUR MOBILE NUMBER</Text>
      <Text style={[s.formHint, { color: t.onSurfaceVariant }]}>Shown to your contact so they can call you when an alert fires.</Text>
      <TextInput style={[s.input, { color: t.onSurface, backgroundColor: t.surfaceContainerHigh, borderColor: `${t.outlineVariant}60` }]}
        value={myPhone} onChangeText={onMyPhone} placeholder="+63 912 345 6789"
        placeholderTextColor={t.onSurfaceVariant} keyboardType="phone-pad" />

      <Text style={[s.formSection, { color: t.onSurfaceVariant, marginTop: 8 }]}>EMERGENCY CONTACT</Text>
      {[
        { label: "Full name *", value: name, onChange: onName, kb: "default" as const, cap: "words" as const },
        { label: "Mobile number", value: phone, onChange: onPhone, kb: "phone-pad" as const, cap: "none" as const },
        { label: "Email address", value: email, onChange: onEmail, kb: "email-address" as const, cap: "none" as const },
      ].map(({ label, value, onChange, kb, cap }) => (
        <View key={label}>
          <Text style={[s.formLabel, { color: t.onSurface }]}>{label}</Text>
          <TextInput
            style={[s.input, { color: t.onSurface, backgroundColor: t.surfaceContainerHigh, borderColor: `${t.outlineVariant}60` }]}
            value={value} onChangeText={onChange}
            placeholder={label.includes("name") ? "e.g. Maria Santos" : label.includes("Mobile") ? "+63 912 345 6789" : "contact@email.com"}
            placeholderTextColor={t.onSurfaceVariant}
            keyboardType={kb} autoCapitalize={cap}
          />
        </View>
      ))}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        {showCancel && (
          <TouchableOpacity style={[s.saveBtn, { flex: 0.45, backgroundColor: t.surfaceContainerHigh }]} onPress={onCancel}>
            <Text style={[s.saveBtnText, { color: t.onSurfaceVariant }]}>Cancel</Text>
          </TouchableOpacity>
        )}
        <Pressable style={[s.saveBtn, { flex: 1, backgroundColor: t.primary }]} disabled={saving} onPress={onSave}>
          {saving ? <ActivityIndicator color={t.onPrimary} /> : <Text style={[s.saveBtnText, { color: t.onPrimary }]}>Save Changes</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function EmergencyContactScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [tab, setTab] = useState<"ec" | "connection">("connection");

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ padding: 12, paddingBottom: 0 }}>
        <View style={[s.tabBar, { backgroundColor: t.surfaceContainerLow }]}>
          {(["ec", "connection"] as const).map((key) => (
            <TouchableOpacity
              key={key}
              style={[s.tabItem, tab === key && [s.tabItemActive, { backgroundColor: t.surfaceBright }]]}
              onPress={() => setTab(key)}
            >
              <Text style={[s.tabLabel, { color: tab === key ? t.primary : t.onSurfaceVariant }]}>
                {key === "ec" ? "Emergency Contact" : "Connection"}
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
    // Layout
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    tabContent: { padding: 20, paddingBottom: 40 },
    tabDesc: { fontSize: 13, lineHeight: 20, marginBottom: 16 },

    // Tab bar
    tabBar: { flexDirection: "row", borderRadius: 14, padding: 4 },
    tabItem: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: "center" },
    tabItemActive: {},
    tabLabel: { fontSize: 13, fontWeight: "700" },

    // Banners
    offlineBanner: { borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, alignItems: "center" },
    successText: { color: "#4ade80", fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "center" },
    errorText: { fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "center" },

    // Contact card
    card: { borderRadius: 24, padding: 20, position: "relative", overflow: "hidden" },
    cardBadge: { position: "absolute", top: 14, right: 14, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99 },
    cardBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
    cardIdentity: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
    cardAvatar: { width: 54, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    cardAvatarText: { fontSize: 20, fontWeight: "900" },
    cardName: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
    cardSub: { fontSize: 13, fontWeight: "500" },
    cardActions: { flexDirection: "row", gap: 10 },
    cardBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    cardBtnText: { fontWeight: "700", fontSize: 13 },

    // Form card
    formCard: { borderRadius: 20, padding: 16, borderWidth: 1 },
    formSection: { fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 6 },
    formHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
    formLabel: { fontWeight: "600", fontSize: 13, marginBottom: 6, marginTop: 4 },
    input: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12, fontSize: 15 },
    saveBtn: { padding: 16, borderRadius: 16, alignItems: "center", elevation: 3 },
    saveBtnText: { fontWeight: "800", fontSize: 15 },

    // View detail modal
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
    sheet: { backgroundColor: t.surfaceContainerLow, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: "hidden" },
    sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
    brandText: { fontSize: 11, fontWeight: "900", letterSpacing: 2 },
    pill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99 },
    pillText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
    avatarSection: { alignItems: "center", paddingBottom: 20, gap: 8 },
    avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, alignItems: "center", justifyContent: "center", position: "relative" },
    avatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 32, fontWeight: "900" },
    activeDot: { position: "absolute", bottom: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: "#4ade80", borderWidth: 2 },
    driverName: { fontSize: 20, fontWeight: "800", textAlign: "center" },
    driverRole: { fontSize: 12, fontWeight: "700", textAlign: "center" },
    phonePill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 99, paddingHorizontal: 20, paddingVertical: 12, alignSelf: "center" },
    phonePillIcon: { fontSize: 16 },
    phonePillText: { fontWeight: "600", fontSize: 14 },
    statsRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginBottom: 14 },
    statCard: { flex: 1, borderRadius: 18, padding: 16 },
    statLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: "800" },
    closeBtn: { paddingVertical: 20, alignItems: "center", borderTopWidth: 1, marginTop: 4 },
    closeBtnText: { fontSize: 15, fontWeight: "600" },

    // Remove modal
    removeCard: { width: "100%", borderRadius: 28, padding: 28, alignItems: "center", gap: 12 },
    removeIconBox: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    removeTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
    removeBody: { fontSize: 13, textAlign: "center", lineHeight: 20 },
    removeBtnRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
    removeCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
    removeConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  });
