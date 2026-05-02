import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { drivingSessionActive, endSessionFn } from "./sessionState";
import type { Session } from "@supabase/supabase-js";
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import * as WebBrowser from "expo-web-browser";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { SessionProvider } from "./context/SessionContext";
import { ThemeProvider, useTheme, useThemeToggle } from "./context/ThemeContext";
import { supabase } from "./lib/supabase";
import type { MainTabParamList } from "./navigation/types";
import type { Theme } from "./theme";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { DriveScreen } from "./screens/DriveScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { EmergencyContactScreen } from "./screens/EmergencyContactScreen";
import { AccountScreen } from "./screens/AccountScreen";
import { IotDevicesScreen } from "./screens/IotDevicesScreen";
import { AboutScreen } from "./screens/AboutScreen";
import { TermsScreen } from "./screens/TermsScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { EmergencyAlertMapScreen } from "./screens/EmergencyAlertMapScreen";
import { EmergencyContactSetupModal } from "./screens/EmergencyContactSetupModal";
import { getEmergencyContact, registerPushToken } from "./lib/emergencyNotify";
import { getDatabase, upsertLocalEC, getPref, setPref } from "./db/database";
import { flushEndedSessions, flushPendingTelemetry, rehydrateSessions, recoverDeletedRemoteSessions } from "./sync/flush";
import { setPresenceIds } from "./lib/presenceStore";
import { theme } from "./theme";

WebBrowser.maybeCompleteAuthSession();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const Tab = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<MainTabParamList>();
const openDrawerRef = { current: null as (() => void) | null };

const NAV_DARK_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.background,
    card: theme.surfaceContainerLow,
    primary: theme.primary,
    text: theme.onSurface,
    border: theme.outlineVariant,
  },
};

const TAB_BAR_CONTENT_HEIGHT = 52;
const DRAWER_WIDTH = 300;

// ─── Themed confirmation modal (reusable) ────────────────────────────────────

type ConfirmModalProps = {
  visible: boolean;
  icon?: string;
  title: string;
  body: string;
  confirmLabel: string;
  confirmDanger?: boolean;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmModal({
  visible, icon, title, body,
  confirmLabel, confirmDanger = false,
  cancelLabel = "Cancel",
  onConfirm, onCancel,
}: ConfirmModalProps) {
  const t = useTheme();
  const cs = useMemo(() => makeConfirmStyles(t), [t]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={cs.overlay}>
        <View style={cs.sheet}>
          {icon ? <Text style={cs.icon}>{icon}</Text> : null}
          <Text style={cs.title}>{title}</Text>
          <Text style={cs.body}>{body}</Text>
          <Pressable style={[cs.btn, confirmDanger ? cs.dangerBtn : cs.primaryBtn]} onPress={onConfirm}>
            <Text style={[cs.btnText, confirmDanger ? cs.dangerText : cs.primaryText]}>{confirmLabel}</Text>
          </Pressable>
          <Pressable style={cs.cancelBtn} onPress={onCancel}>
            <Text style={cs.cancelText}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeConfirmStyles = (t: Theme) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#000000aa", justifyContent: "center", alignItems: "center", padding: 24 },
  sheet: {
    backgroundColor: t.surfaceContainerLow, borderRadius: 24, padding: 28,
    width: "100%", maxWidth: 380, alignItems: "center",
    borderWidth: 1, borderColor: `${t.outlineVariant}44`,
    gap: 10, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, elevation: 16,
  },
  icon: { fontSize: 42 },
  title: { fontSize: 20, fontWeight: "800", color: t.onSurface, textAlign: "center" },
  body: { fontSize: 14, color: t.onSurfaceVariant, textAlign: "center", lineHeight: 21, marginBottom: 4 },
  btn: { width: "100%", paddingVertical: 15, borderRadius: 16, alignItems: "center", borderWidth: 1 },
  primaryBtn: { backgroundColor: t.primary, borderColor: t.primary },
  dangerBtn: { backgroundColor: `${t.tertiary}22`, borderColor: `${t.tertiary}88` },
  btnText: { fontWeight: "800", fontSize: 15 },
  primaryText: { color: t.onPrimary },
  dangerText: { color: t.tertiary },
  cancelBtn: { paddingVertical: 10 },
  cancelText: { color: t.onSurfaceVariant, fontSize: 14, fontWeight: "600" },
});

// ─── Left navigation drawer ───────────────────────────────────────────────────

type AppDrawerProps = {
  visible: boolean;
  onClose: () => void;
  session: Session;
  superAdmin: boolean;
  onSignOut: () => void;
  onGuard: (navFn: () => void) => void;
};

function AppDrawer({ visible, onClose, session, superAdmin, onSignOut, onGuard }: AppDrawerProps) {
  const t = useTheme();
  const styles = useMemo(() => makeDrawerStyles(t), [t]);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [myPhone, setMyPhone] = useState("");
  const [online, setOnline] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Real-time network status
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsub();
  }, []);

  const loadDrawerData = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", session.user.id)
      .maybeSingle();
    setMyPhone((data as { phone?: string } | null)?.phone ?? "");
  }, [session.user.id]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
      void loadDrawerData();
    } else {
      Animated.spring(slideAnim, { toValue: -DRAWER_WIDTH, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
    }
  }, [visible, slideAnim, loadDrawerData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress(0);
    try {
      // Recover sessions deleted from Supabase before counting pending work
      await recoverDeletedRemoteSessions(supabase, session.user.id);

      const db = getDatabase();
      const n1 = db.getFirstSync<{ c: number }>(
        "SELECT COUNT(*) as c FROM driving_sessions_local WHERE user_id = ? AND ended_at IS NOT NULL AND ended_synced = 0",
        session.user.id,
      )?.c ?? 0;
      const n2 = db.getFirstSync<{ c: number }>(
        `SELECT COUNT(*) as c FROM session_telemetry_local t
         JOIN driving_sessions_local s ON s.id = t.local_session_id
         WHERE t.remote_synced = 0 AND s.user_id = ?`,
        session.user.id,
      )?.c ?? 0;
      const total = n1 + n2;
      let done = 0;
      const onProgress = () => {
        done += 1;
        setSyncProgress(total > 0 ? Math.round((done / total) * 100) : 100);
      };
      await flushEndedSessions(supabase, session.user.id, onProgress);
      await flushPendingTelemetry(supabase, session.user.id, onProgress);
    } catch { /* silent */ }
    finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const guardedNav = (screenName: keyof MainTabParamList) => {
    onClose();
    const nav = () => { if (navigationRef.isReady()) navigationRef.navigate(screenName); };
    if (drivingSessionActive.current) onGuard(nav);
    else nav();
  };

  const displayName = session.user.user_metadata?.full_name ?? session.user.email ?? "User";
  const initial = displayName.charAt(0).toUpperCase();

  type NavItem = { name: keyof MainTabParamList; icon: string; label: string };
  const navItems: NavItem[] = [
    { name: "EmergencyContact", icon: "emergency", label: "Emergency Contact" },
    { name: "Account", icon: "manage-accounts", label: "Account" },
    { name: "IotDevices", icon: "devices-other", label: "IoT Devices" },
    { name: "About", icon: "info-outline", label: "About SnoozeGuard" },
    { name: "Terms", icon: "gavel", label: "Terms & Privacy" },
    ...(superAdmin ? [{ name: "Admin" as keyof MainTabParamList, icon: "admin-panel-settings", label: "Admin Config" }] : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <Animated.View style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}>
          {/* User info */}
          <View style={styles.userSection}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{displayName}</Text>
                <Text style={styles.userEmail}>{session.user.email}</Text>
                {myPhone ? <Text style={styles.userPhone}>{myPhone}</Text> : null}
              </View>
            </View>
            
            {/* Share Button - Right side */}
            <Pressable
              style={styles.shareButtonIcon}
              onPress={() => {
                void Share.share({
                  message: "Check out SnoozeGuard - Real-time driver drowsiness detection! Download now:\nhttps://expo.dev/accounts/airamaepilor/projects/snoozeguard/builds/2928e749-d945-48af-8121-bfee1dcb76a2",
                  title: "Share SnoozeGuard",
                  // @ts-expect-error Android specific prop
                  icon: require("./assets/icon.png"),
                });
              }}
            >
              <MaterialIcons name="share" size={20} color={t.primary} />
            </Pressable>
          </View>

          {/* Online / offline + sync */}
          <Pressable
            style={[styles.syncBtn, online ? styles.syncBtnOk : styles.syncBtnWarn]}
            onPress={() => online ? void handleSync() : undefined}
            disabled={syncing || online === null}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={t.primary} style={{ marginRight: 8 }} />
            ) : (
              <Text style={online ? styles.syncIconOk : styles.syncIcon}>
                {online === null ? "…" : online ? "●" : "○"}
              </Text>
            )}
            <Text style={online ? styles.syncLabelOk : styles.syncLabelWarn}>
              {syncing
                ? syncProgress !== null && syncProgress > 0
                  ? `Syncing… ${syncProgress}%`
                  : "Syncing…"
                : online === null ? "Checking…" : online ? "Online — tap to sync" : "Offline"}
            </Text>
          </Pressable>

          <View style={styles.divider} />

          {/* Navigation links */}
          <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
            {navItems.map((item) => (
              <Pressable key={item.name} style={styles.navItem} onPress={() => guardedNav(item.name)}>
                <MaterialIcons name={item.icon as React.ComponentProps<typeof MaterialIcons>["name"]} size={22} color={t.onSurface} />
                <Text style={styles.navItemText}>{item.label}</Text>
              </Pressable>
            ))}
            <View style={styles.navSectionDivider} />
            <Pressable style={styles.navItem} onPress={() => {
              onClose();
              void Linking.openURL("https://snoozeguard-cf3d8.web.app");
            }}>
              <MaterialIcons name="open-in-browser" size={22} color={t.onSurface} />
              <Text style={styles.navItemText}>Web Dashboard</Text>
            </Pressable>
          </ScrollView>

          <View style={styles.divider} />

          {/* Sign out */}
          <Pressable style={styles.signOutItem} onPress={() => setConfirmSignOut(true)}>
            <MaterialIcons name="logout" size={22} color={t.tertiary} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>

          {confirmSignOut && (
            <View style={styles.confirmSheet}>
              <Text style={styles.confirmTitle}>Sign out?</Text>
              <Text style={styles.confirmBody}>
                {drivingSessionActive.current
                  ? "Your active session will be ended and saved."
                  : "You'll need to sign in again to access SnoozeGuard."}
              </Text>
              <Pressable
                style={styles.confirmDangerBtn}
                onPress={() => {
                  setConfirmSignOut(false);
                  onClose();
                  if (drivingSessionActive.current) endSessionFn.current?.();
                  void supabase.auth.signOut().then(onSignOut);
                }}
              >
                <Text style={styles.confirmDangerText}>Sign out</Text>
              </Pressable>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setConfirmSignOut(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeDrawerStyles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  scrim: { flex: 1, backgroundColor: "#000000aa" },
  panel: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: DRAWER_WIDTH,
    backgroundColor: t.surfaceContainerLow,
    borderRightWidth: 1, borderRightColor: `${t.outlineVariant}44`,
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, elevation: 16,
  },
  userSection: {
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20,
    backgroundColor: `${t.primary}11`,
    borderBottomWidth: 1, borderBottomColor: `${t.outlineVariant}33`,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
  },
  userInfo: {
    flexDirection: "row", alignItems: "center", flex: 1, gap: 12,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: `${t.primary}33`,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: t.primary, fontSize: 22, fontWeight: "800" },
  userName: { color: t.onSurface, fontWeight: "700", fontSize: 16 },
  userEmail: { color: t.onSurfaceVariant, fontSize: 12, marginTop: 2 },
  userPhone: { color: t.onSurfaceVariant, fontSize: 12, marginTop: 2 },
  shareButtonIcon: { paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: `${t.primary}22`, borderWidth: 1, borderColor: `${t.primary}44`, alignItems: "center", justifyContent: "center" },
  shareButtonCompact: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: `${t.primary}22`, borderRadius: 12, borderWidth: 1, borderColor: `${t.primary}44` },
  shareTextCompact: { color: t.primary, fontSize: 13, fontWeight: "700" },
  syncBtn: { flexDirection: "row", alignItems: "center", margin: 12, padding: 12, borderRadius: 14, borderWidth: 1, gap: 8 },
  syncBtnOk: { backgroundColor: "#4ade8011", borderColor: "#4ade8044" },
  syncBtnWarn: { backgroundColor: `${t.outlineVariant}22`, borderColor: `${t.outlineVariant}66` },
  syncIcon: { fontSize: 14, color: t.onSurfaceVariant },
  syncIconOk: { fontSize: 14, color: "#4ade80" },
  syncLabelOk: { color: "#4ade80", fontSize: 12, fontWeight: "600", flex: 1 },
  syncLabelWarn: { color: t.onSurfaceVariant, fontSize: 12, fontWeight: "600", flex: 1 },
  divider: { height: 1, backgroundColor: `${t.outlineVariant}44`, marginHorizontal: 12, marginVertical: 4 },
  navList: { flex: 1, paddingVertical: 4 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 20 },
  navItemText: { color: t.onSurface, fontSize: 15, fontWeight: "600" },
  navItemSub: { color: t.onSurfaceVariant, fontSize: 10, marginTop: 1 },
  navSectionDivider: { height: 1, backgroundColor: `${t.outlineVariant}44`, marginHorizontal: 20, marginVertical: 6 },
  signOutItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, paddingHorizontal: 20, marginBottom: 8 },
  signOutText: { color: t.tertiary, fontSize: 15, fontWeight: "700" },
  confirmSheet: { margin: 12, padding: 16, borderRadius: 16, backgroundColor: `${t.tertiary}11`, borderWidth: 1, borderColor: `${t.tertiary}44`, gap: 10 },
  confirmTitle: { color: t.onSurface, fontWeight: "800", fontSize: 15, textAlign: "center" },
  confirmBody: { color: t.onSurfaceVariant, fontSize: 12, textAlign: "center", lineHeight: 18 },
  confirmDangerBtn: { backgroundColor: `${t.tertiary}22`, borderWidth: 1, borderColor: `${t.tertiary}66`, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  confirmDangerText: { color: t.tertiary, fontWeight: "700", fontSize: 14 },
  confirmCancelBtn: { alignItems: "center", paddingVertical: 8 },
  confirmCancelText: { color: t.onSurfaceVariant, fontSize: 13 },
});

// ─── Main app ─────────────────────────────────────────────────────────────────

function MainApp({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const appTheme = useTheme();
  const { isDark, toggleTheme } = useThemeToggle();
  const [superAdmin, setSuperAdmin] = useState(false);
  const [hasEmergencyContact, setHasEmergencyContact] = useState<boolean | null>(null);
  const [showEcSetup, setShowEcSetup] = useState(false);
  const [alertBadge, setAlertBadge] = useState<string | number | undefined>(undefined);
  const [guardVisible, setGuardVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const guardActionRef = useRef<(() => void) | null>(null);
  const insets = useSafeAreaInsets();

  // Wire drawer opener so the headerLeft button can trigger it from outside
  useEffect(() => {
    openDrawerRef.current = () => setDrawerOpen(true);
    return () => { openDrawerRef.current = null; };
  }, []);

  const showSessionGuard = useCallback((navFn: () => void) => {
    guardActionRef.current = navFn;
    setGuardVisible(true);
  }, []);

  const tabBarStyle = useMemo(() => {
    const bottom = Math.max(insets.bottom, 8);
    return {
      backgroundColor: theme.surfaceContainerLow,
      borderTopWidth: 1,
      borderTopColor: theme.navBorder,
      paddingTop: 6,
      paddingBottom: bottom,
      height: TAB_BAR_CONTENT_HEIGHT + 6 + bottom,
    };
  }, [insets.bottom]);

  const refreshAlertBadge = async () => {
    const userEmail = session.user.email ?? "__no_email__";
    const [byUserId, byEmail, pendingReqs] = await Promise.all([
      supabase
        .from("emergency_contacts")
        .select("user_id")
        .eq("contact_user_id", session.user.id)
        .eq("status", "accepted"),
      supabase
        .from("emergency_contacts")
        .select("user_id")
        .ilike("contact_email", userEmail)
        .neq("status", "pending"),
      supabase
        .from("emergency_contacts")
        .select("id", { count: "exact", head: true })
        .eq("contact_user_id", session.user.id)
        .eq("status", "pending"),
    ]);

    const driverIds = Array.from(new Set([
      ...(byUserId.data ?? []).map((c) => c.user_id as string),
      ...(byEmail.data ?? []).map((c) => c.user_id as string),
    ]));

    let activeCount = 0;
    if (driverIds.length > 0) {
      const { count } = await supabase
        .from("emergency_alert_events")
        .select("id", { count: "exact", head: true })
        .in("user_id", driverIds)
        .eq("status", "active");
      activeCount = count ?? 0;
    }

    const totalBadge = activeCount + (pendingReqs.count ?? 0);
    setAlertBadge(totalBadge > 0 ? "!" : undefined);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled) setSuperAdmin(profile?.role === "super_admin");

      const ec = await getEmergencyContact(supabase, session.user.id);
      if (!cancelled) {
        setHasEmergencyContact(Boolean(ec));
        if (!ec) setShowEcSetup(true);
        if (ec) {
          try {
            upsertLocalEC({
              id: ec.id,
              user_id: session.user.id,
              contact_name: ec.contact_name,
              contact_phone: ec.contact_phone ?? "",
              contact_email: ec.contact_email ?? "",
              my_phone: "",
              is_active: 1,
              status: ec.status ?? "accepted",
              pending_sync: 0,
              updated_at: new Date().toISOString(),
            });
          } catch { /* DB not ready */ }
        }
      }

      // Rehydrate sessions from Supabase into local SQLite (handles clear-data scenarios)
      void rehydrateSessions(supabase, session.user.id);

      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === "granted") {
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: "249966ac-85af-4933-83a7-365abd3ebea2",
          });
          await registerPushToken(supabase, session.user.id, tokenData.data);
        }
      } catch { /* push notifications are optional */ }
    })();
    return () => { cancelled = true; };
  }, [session.user.id]);

  useEffect(() => {
    void refreshAlertBadge();
    const interval = setInterval(() => void refreshAlertBadge(), 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id, session.user.email]);

  // Broadcast presence and sync onlineIds store for ConnectionTab
  useEffect(() => {
    const ch = supabase.channel("presence:drivers", {
      config: { presence: { key: session.user.id } },
    });
    ch.on("presence", { event: "sync" }, () => {
      setPresenceIds(new Set(Object.keys(ch.presenceState())));
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: session.user.id, online_at: new Date().toISOString() });
      }
    });
    return () => { void supabase.removeChannel(ch); };
  }, [session.user.id]);

  // Auto-sync EC from Supabase when connectivity is restored
  useEffect(() => {
    let wasOnline: boolean | null = null;
    const unsub = NetInfo.addEventListener((state) => {
      const isNowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (isNowOnline && wasOnline === false) {
        void (async () => {
          try {
            const ec = await getEmergencyContact(supabase, session.user.id);
            if (ec) {
              upsertLocalEC({
                id: ec.id,
                user_id: session.user.id,
                contact_name: ec.contact_name,
                contact_phone: ec.contact_phone ?? "",
                contact_email: ec.contact_email ?? "",
                my_phone: "",
                is_active: 1,
                status: ec.status ?? "accepted",
                pending_sync: 0,
                updated_at: new Date().toISOString(),
              });
            }
          } catch { /* silent */ }
        })();
      }
      wasOnline = isNowOnline;
    });
    return () => unsub();
  }, [session.user.id]);

  const navTheme = useMemo(() => ({
    ...NAV_DARK_THEME,
    colors: {
      ...NAV_DARK_THEME.colors,
      background: appTheme.background,
      card: appTheme.surfaceContainerLow,
      primary: appTheme.primary,
      text: appTheme.onSurface,
      border: appTheme.outlineVariant,
    },
  }), [appTheme]);

  const sharedScreenOptions = useMemo(() => ({
    headerStyle: {
      backgroundColor: appTheme.surfaceContainerLow,
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    headerTintColor: appTheme.onSurface,
    headerTitleStyle: { fontWeight: "800" as const, fontSize: 17 },
    tabBarStyle: {
      ...tabBarStyle,
      backgroundColor: appTheme.surfaceContainerLow,
      borderTopColor: appTheme.navBorder,
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const },
    tabBarActiveTintColor: appTheme.primary,
    tabBarInactiveTintColor: appTheme.onSurfaceVariant,
    headerLeft: () => (
      <Pressable
        onPress={() => openDrawerRef.current?.()}
        style={{ paddingHorizontal: 14, paddingVertical: 8 }}
        hitSlop={8}
      >
        <MaterialIcons name="menu" size={24} color={appTheme.onSurface} />
      </Pressable>
    ),
    headerRight: () => (
      <Pressable
        onPress={toggleTheme}
        style={{ paddingHorizontal: 14, paddingVertical: 8 }}
        hitSlop={8}
      >
        <MaterialIcons
          name={isDark ? "light-mode" : "dark-mode"}
          size={22}
          color={appTheme.onSurface}
        />
      </Pressable>
    ),
  }), [tabBarStyle, appTheme, isDark, toggleTheme]);

  void hasEmergencyContact; // suppress lint — read for side-effect (EC setup modal)

  return (
    <SessionProvider session={session}>
      {/* ── Themed session guard modal ── */}
      <ConfirmModal
        visible={guardVisible}
        icon="🚗"
        title="Session Active"
        body="You have an active driving session. Leaving will end it."
        confirmLabel="End Session & Leave"
        confirmDanger
        cancelLabel="Keep Driving"
        onConfirm={() => {
          endSessionFn.current?.();
          setGuardVisible(false);
          guardActionRef.current?.();
          guardActionRef.current = null;
        }}
        onCancel={() => {
          setGuardVisible(false);
          guardActionRef.current = null;
        }}
      />

      {/* ── Left navigation drawer ── */}
      <AppDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        session={session}
        superAdmin={superAdmin}
        onSignOut={onSignOut}
        onGuard={showSessionGuard}
      />

      <EmergencyContactSetupModal
        visible={showEcSetup}
        userId={session.user.id}
        onDone={() => { setShowEcSetup(false); setHasEmergencyContact(true); }}
        onSkip={() => setShowEcSetup(false)}
      />

      <NavigationContainer ref={navigationRef} theme={navTheme as typeof NAV_DARK_THEME}>
        <Tab.Navigator
          screenOptions={sharedScreenOptions}
          screenListeners={({ navigation, route }) => ({
            tabPress: (e) => {
              if (route.name !== "Drive" && drivingSessionActive.current) {
                e.preventDefault();
                showSessionGuard(() => navigation.navigate(route.name as never));
              }
            },
          })}
        >

          {/* ── Visible tabs — order: Home · Analytics · Drive (center) · Alerts · History ── */}
          <Tab.Screen
            name="Home"
            options={{
              title: "Home",
              tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
            }}
          >
            {() => <HomeScreen session={session} onSignOut={onSignOut} />}
          </Tab.Screen>

          <Tab.Screen
            name="Analytics"
            component={AnalyticsScreen}
            options={{
              title: "Analytics",
              tabBarIcon: ({ color, size }) => <MaterialIcons name="bar-chart" size={size} color={color} />,
            }}
          />

          <Tab.Screen
            name="Drive"
            component={DriveScreen}
            options={{
              title: "Drive",
              tabBarIcon: ({ color, size }) => <MaterialIcons name="directions-car" size={size} color={color} />,
            }}
          />

          <Tab.Screen
            name="Alerts"
            options={{
              title: "Alerts",
              tabBarIcon: ({ color, size }) => <MaterialIcons name="notifications" size={size} color={color} />,
              tabBarBadge: alertBadge,
            }}
            listeners={{ focus: () => void refreshAlertBadge() }}
          >
            {() => <EmergencyAlertMapScreen onActionDone={() => void refreshAlertBadge()} />}
          </Tab.Screen>

          <Tab.Screen
            name="History"
            component={HistoryScreen}
            options={{
              title: "History",
              tabBarIcon: ({ color, size }) => <MaterialIcons name="history" size={size} color={color} />,
            }}
          />

          {/* ── Hidden tabs — drawer-only, no tab bar slot ── */}
          <Tab.Screen
            name="EmergencyContact"
            options={{ title: "Emergency Contact", tabBarItemStyle: { display: "none" } }}
          >
            {() => <EmergencyContactScreen />}
          </Tab.Screen>

          <Tab.Screen
            name="Account"
            options={{ title: "Account", tabBarItemStyle: { display: "none" } }}
          >
            {() => <AccountScreen onSignOut={onSignOut} />}
          </Tab.Screen>

          <Tab.Screen
            name="IotDevices"
            component={IotDevicesScreen}
            options={{ title: "IoT Devices", tabBarItemStyle: { display: "none" } }}
          />

          <Tab.Screen
            name="About"
            component={AboutScreen}
            options={{ title: "About", tabBarItemStyle: { display: "none" } }}
          />

          <Tab.Screen
            name="Terms"
            component={TermsScreen}
            options={{ title: "Terms & Privacy", tabBarItemStyle: { display: "none" } }}
          />

          {superAdmin && (
            <Tab.Screen
              name="Admin"
              component={AdminScreen}
              options={{ title: "Admin Config", tabBarItemStyle: { display: "none" } }}
            />
          )}

        </Tab.Navigator>
      </NavigationContainer>
    </SessionProvider>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

function ThemedStatusBar() {
  const { isDark } = useThemeToggle();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

function AppInner() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useTheme();

  useEffect(() => {
    if (__DEV__) return;
    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch { /* non-fatal */ }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const OFFLINE_KEY = "offline_session";

    const init = async () => {
      let resolvedSession: Session | null = null;
      try {
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 5000)
          ),
        ]);
        resolvedSession = data.session;
      } catch { /* network error */ }

      if (resolvedSession) {
        try { setPref(OFFLINE_KEY, JSON.stringify(resolvedSession)); } catch { /* db not ready */ }
      } else {
        try {
          const raw = getPref(OFFLINE_KEY);
          if (raw) resolvedSession = JSON.parse(raw) as Session;
        } catch { /* no cache */ }
      }

      if (!cancelled) {
        setSession(resolvedSession);
        setLoading(false);
      }
    };

    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!cancelled) {
        setSession(next);
        try {
          if (next) setPref(OFFLINE_KEY, JSON.stringify(next));
          else setPref(OFFLINE_KEY, "");
        } catch { /* silent */ }
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: t.background }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  return session
    ? <MainApp session={session} onSignOut={() => setSession(null)} />
    : <LoginScreen onSignedIn={() => supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStatusBar />
        <AppInner />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
