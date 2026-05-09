import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import type { Theme } from "../theme";

// ─── Types ─────────────────────────────────────────────────────────────────────

type State =
  | "loading"
  | "pending"
  | "processing"
  | "accepted"
  | "already_accepted"
  | "declined"
  | "already_declined"
  | "expired"
  | "invalid"
  | "error";

// ─── Component ─────────────────────────────────────────────────────────────────

export function AcceptGuardianModal({
  token,
  onClose,
}: {
  token: string | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [state, setState] = useState<State>("loading");
  const [driverName, setDriverName] = useState("A SnoozeGuard user");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setState("loading");
    setErrorMsg(null);

    (async () => {
      const { data, error } = await supabase.rpc("get_contact_request_by_token", {
        p_token: token,
      });

      if (error || !data || (data as unknown[]).length === 0) {
        setState("invalid");
        return;
      }

      const row = (
        data as Array<{ driver_name: string; status: string; expired: boolean }>
      )[0];
      setDriverName(row.driver_name);

      if (row.expired)              { setState("expired");          return; }
      if (row.status === "accepted") { setState("already_accepted"); return; }
      if (row.status === "rejected") { setState("already_declined"); return; }

      setState("pending");
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setState("processing");
    const { data, error } = await supabase.rpc("accept_contact_request_by_token", {
      p_token: token,
    });
    if (error) { setErrorMsg(error.message); setState("error"); return; }
    const result = data as { success: boolean; already_accepted?: boolean; error?: string };
    if (!result.success) { setErrorMsg(result.error ?? "Failed to accept."); setState("error"); return; }
    setState(result.already_accepted ? "already_accepted" : "accepted");
  };

  const handleDecline = async () => {
    if (!token) return;
    setState("processing");
    const { data, error } = await supabase.rpc("decline_contact_request_by_token", {
      p_token: token,
    });
    if (error) { setErrorMsg(error.message); setState("error"); return; }
    setState("declined");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderContent = () => {
    if (state === "loading" || state === "processing") {
      return (
        <View style={s.center}>
          <ActivityIndicator color={t.primary} size="large" />
          <Text style={[s.hint, { color: t.onSurfaceVariant }]}>
            {state === "processing" ? "Processing…" : "Loading request…"}
          </Text>
        </View>
      );
    }

    if (state === "accepted") {
      return (
        <View style={s.center}>
          <View style={[s.iconBox, { backgroundColor: "#4ade8020" }]}>
            <Text style={s.bigEmoji}>✓</Text>
          </View>
          <Text style={[s.resultTitle, { color: t.onSurface }]}>You're now a guardian!</Text>
          <Text style={[s.resultBody, { color: t.onSurfaceVariant }]}>
            You accepted {driverName}'s request. You'll receive an SMS if they trigger a fatigue alert.
          </Text>
          <Pressable style={[s.doneBtn, { backgroundColor: t.primary }]} onPress={onClose}>
            <Text style={[s.doneBtnText, { color: t.onPrimary }]}>Done</Text>
          </Pressable>
        </View>
      );
    }

    if (state === "already_accepted") {
      return (
        <View style={s.center}>
          <View style={[s.iconBox, { backgroundColor: `${t.primary}20` }]}>
            <Text style={s.bigEmoji}>🛡️</Text>
          </View>
          <Text style={[s.resultTitle, { color: t.onSurface }]}>Already accepted</Text>
          <Text style={[s.resultBody, { color: t.onSurfaceVariant }]}>
            You've already accepted {driverName}'s guardian request.
          </Text>
          <Pressable style={[s.doneBtn, { backgroundColor: t.primary }]} onPress={onClose}>
            <Text style={[s.doneBtnText, { color: t.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      );
    }

    if (state === "declined") {
      return (
        <View style={s.center}>
          <View style={[s.iconBox, { backgroundColor: `${t.onSurfaceVariant}15` }]}>
            <Text style={s.bigEmoji}>✕</Text>
          </View>
          <Text style={[s.resultTitle, { color: t.onSurface }]}>Request declined</Text>
          <Text style={[s.resultBody, { color: t.onSurfaceVariant }]}>
            You've declined {driverName}'s guardian request.
          </Text>
          <Pressable style={[s.doneBtn, { backgroundColor: t.primary }]} onPress={onClose}>
            <Text style={[s.doneBtnText, { color: t.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      );
    }

    if (state === "already_declined") {
      return (
        <View style={s.center}>
          <View style={[s.iconBox, { backgroundColor: `${t.onSurfaceVariant}15` }]}>
            <Text style={s.bigEmoji}>🚫</Text>
          </View>
          <Text style={[s.resultTitle, { color: t.onSurface }]}>Already declined</Text>
          <Text style={[s.resultBody, { color: t.onSurfaceVariant }]}>
            You previously declined this request. Ask {driverName} to send a new invitation if you changed your mind.
          </Text>
          <Pressable style={[s.doneBtn, { backgroundColor: t.primary }]} onPress={onClose}>
            <Text style={[s.doneBtnText, { color: t.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      );
    }

    if (state === "expired") {
      return (
        <View style={s.center}>
          <View style={[s.iconBox, { backgroundColor: "#f59e0b20" }]}>
            <Text style={s.bigEmoji}>⏱</Text>
          </View>
          <Text style={[s.resultTitle, { color: t.onSurface }]}>Link expired</Text>
          <Text style={[s.resultBody, { color: t.onSurfaceVariant }]}>
            This invitation is older than 7 days. Ask {driverName} to send a new request.
          </Text>
          <Pressable style={[s.doneBtn, { backgroundColor: t.primary }]} onPress={onClose}>
            <Text style={[s.doneBtnText, { color: t.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      );
    }

    if (state === "invalid" || state === "error") {
      return (
        <View style={s.center}>
          <View style={[s.iconBox, { backgroundColor: `${t.tertiary}20` }]}>
            <Text style={s.bigEmoji}>⚠️</Text>
          </View>
          <Text style={[s.resultTitle, { color: t.onSurface }]}>
            {state === "invalid" ? "Invalid link" : "Something went wrong"}
          </Text>
          <Text style={[s.resultBody, { color: t.onSurfaceVariant }]}>
            {errorMsg ?? "This link doesn't look right. Make sure you opened the full URL."}
          </Text>
          <Pressable style={[s.doneBtn, { backgroundColor: t.primary }]} onPress={onClose}>
            <Text style={[s.doneBtnText, { color: t.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      );
    }

    // ── Pending: show Accept / Decline ─────────────────────────────────────
    return (
      <View style={s.pendingContent}>
        <View style={s.header}>
          <View style={[s.sgMark, { backgroundColor: t.primary }]}>
            <Text style={[s.sgMarkText, { color: t.onPrimary }]}>SG</Text>
          </View>
          <Text style={[s.brand, { color: t.primary }]}>SNOOZEGUARD</Text>
        </View>

        <View style={[s.avatarWrap, { borderColor: `${t.primary}30` }]}>
          <View style={[s.avatar, { backgroundColor: `${t.primary}15` }]}>
            <Text style={[s.avatarText, { color: t.primary }]}>
              {driverName.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={[s.driverName, { color: t.onSurface }]}>{driverName}</Text>
        <Text style={[s.requestLabel, { color: t.onSurfaceVariant }]}>
          wants you as their emergency guardian
        </Text>

        <View style={[s.infoCard, { backgroundColor: t.surfaceContainerHigh, borderColor: `${t.outlineVariant}30` }]}>
          <Text style={[s.infoLabel, { color: t.onSurfaceVariant }]}>WHAT THIS MEANS</Text>
          <Text style={[s.infoText, { color: t.onSurfaceVariant }]}>
            {"• "}You'll receive an SMS if they trigger a fatigue alert{"\n"}
            {"• "}The SMS includes their last known location{"\n"}
            {"• "}You can call or SMS them directly from the alert
          </Text>
        </View>

        <Pressable
          style={[s.acceptBtn, { backgroundColor: t.primary }]}
          onPress={() => void handleAccept()}
        >
          <Text style={[s.acceptBtnText, { color: t.onPrimary }]}>✓  Accept — become their guardian</Text>
        </Pressable>

        <Pressable
          style={[s.declineBtn, { borderColor: `${t.outlineVariant}40` }]}
          onPress={() => void handleDecline()}
        >
          <Text style={[s.declineBtnText, { color: t.onSurfaceVariant }]}>No thanks, decline</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <Modal
      visible={token !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <Pressable style={s.dismissArea} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: t.surfaceContainerLow }]}>
          <View style={[s.handle, { backgroundColor: `${t.outlineVariant}50` }]} />
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.72)" },
    dismissArea: { flex: 1 },
    sheet: {
      borderTopLeftRadius: 32, borderTopRightRadius: 32,
      paddingBottom: 32, maxHeight: "90%",
      overflow: "hidden",
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      alignSelf: "center", marginTop: 12, marginBottom: 4,
    },

    // Loading / result states
    center: { alignItems: "center", paddingHorizontal: 28, paddingTop: 20, paddingBottom: 8, gap: 12 },
    iconBox: { width: 68, height: 68, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    bigEmoji: { fontSize: 30 },
    resultTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
    resultBody: { fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 4 },
    hint: { fontSize: 14, marginTop: 12 },
    doneBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16, marginTop: 8, width: "100%" },
    doneBtnText: { fontWeight: "800", fontSize: 15, textAlign: "center" },

    // Pending state
    pendingContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8, gap: 12 },
    header: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 },
    sgMark: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    sgMarkText: { fontSize: 10, fontWeight: "900", letterSpacing: -0.5 },
    brand: { fontSize: 10, fontWeight: "900", letterSpacing: 2 },
    avatarWrap: {
      width: 80, height: 80, borderRadius: 24, borderWidth: 2,
      alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 4,
    },
    avatar: { width: 68, height: 68, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 24, fontWeight: "900" },
    driverName: { fontSize: 22, fontWeight: "800", textAlign: "center" },
    requestLabel: { fontSize: 14, textAlign: "center", marginTop: -4 },
    infoCard: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 6 },
    infoLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 2 },
    infoText: { fontSize: 13, lineHeight: 20 },
    acceptBtn: { paddingVertical: 15, borderRadius: 18, alignItems: "center", marginTop: 4 },
    acceptBtnText: { fontWeight: "800", fontSize: 15 },
    declineBtn: {
      paddingVertical: 13, borderRadius: 18, alignItems: "center",
      borderWidth: 1, marginBottom: 4,
    },
    declineBtnText: { fontWeight: "600", fontSize: 14 },
  });
