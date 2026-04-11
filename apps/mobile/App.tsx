import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { NavigationContainer, DarkTheme, useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { SessionProvider } from "./context/SessionContext";
import { supabase } from "./lib/supabase";
import type { MainTabParamList } from "./navigation/types";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { DriveScreen } from "./screens/DriveScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { EmergencyAlertMapScreen } from "./screens/EmergencyAlertMapScreen";
import { EmergencyContactSetupModal } from "./screens/EmergencyContactSetupModal";
import { getEmergencyContact, registerPushToken } from "./lib/emergencyNotify";
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

const navTheme = {
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

// ─── Burger menu ─────────────────────────────────────────────────────────────

function HeaderMenu({ superAdmin, onSignOut }: { superAdmin: boolean; onSignOut: () => void }) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={menuStyles.trigger}
        hitSlop={8}
      >
        <MaterialIcons name="menu" size={24} color={theme.onSurface} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={menuStyles.overlay} onPress={() => setOpen(false)}>
          <View style={menuStyles.sheet}>
            <Text style={menuStyles.sheetTitle}>Menu</Text>

            <Pressable
              style={menuStyles.item}
              onPress={() => { setOpen(false); navigation.navigate("Profile"); }}
            >
              <MaterialIcons name="person" size={22} color={theme.onSurface} />
              <Text style={menuStyles.itemText}>Profile & Emergency Contact</Text>
            </Pressable>

            {superAdmin && (
              <Pressable
                style={menuStyles.item}
                onPress={() => { setOpen(false); navigation.navigate("Admin"); }}
              >
                <MaterialIcons name="admin-panel-settings" size={22} color={theme.onSurface} />
                <Text style={menuStyles.itemText}>Admin Config</Text>
              </Pressable>
            )}

            <View style={menuStyles.divider} />

            <Pressable
              style={menuStyles.item}
              onPress={() => { setOpen(false); onSignOut(); }}
            >
              <MaterialIcons name="logout" size={22} color={theme.tertiary} />
              <Text style={[menuStyles.itemText, { color: theme.tertiary }]}>Sign out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const menuStyles = StyleSheet.create({
  trigger: { paddingHorizontal: 14, paddingVertical: 8 },
  overlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-start", alignItems: "flex-end" },
  sheet: {
    marginTop: 56,
    marginRight: 12,
    backgroundColor: theme.surfaceContainerLow,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minWidth: 230,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}44`,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetTitle: { color: theme.onSurfaceVariant, fontSize: 11, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 6, textTransform: "uppercase" },
  item: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 16 },
  itemText: { color: theme.onSurface, fontSize: 15, fontWeight: "600" },
  divider: { height: 1, backgroundColor: `${theme.outlineVariant}44`, marginVertical: 4, marginHorizontal: 10 },
});

// ─── Main app ─────────────────────────────────────────────────────────────────

function MainApp({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [superAdmin, setSuperAdmin] = useState(false);
  const [hasEmergencyContact, setHasEmergencyContact] = useState<boolean | null>(null);
  const [showEcSetup, setShowEcSetup] = useState(false);
  const [alertBadge, setAlertBadge] = useState<number | undefined>(undefined);
  const insets = useSafeAreaInsets();

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
    setAlertBadge(totalBadge > 0 ? totalBadge : undefined);
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
      }

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

  const sharedScreenOptions = useMemo(() => ({
    headerStyle: {
      backgroundColor: theme.surfaceContainerLow,
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    headerTintColor: theme.onSurface,
    headerTitleStyle: { fontWeight: "800" as const, fontSize: 17 },
    tabBarStyle,
    tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const },
    tabBarActiveTintColor: theme.primary,
    tabBarInactiveTintColor: theme.onSurfaceVariant,
    headerRight: () => <HeaderMenu superAdmin={superAdmin} onSignOut={onSignOut} />,
  }), [tabBarStyle, superAdmin, onSignOut]);

  return (
    <SessionProvider session={session}>
      <EmergencyContactSetupModal
        visible={showEcSetup}
        userId={session.user.id}
        onDone={() => { setShowEcSetup(false); setHasEmergencyContact(true); }}
        onSkip={() => setShowEcSetup(false)}
      />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator screenOptions={sharedScreenOptions}>

          {/* ── Visible tabs ── */}
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
            name="Drive"
            component={DriveScreen}
            options={{
              title: "Drive",
              tabBarIcon: ({ color, size }) => <MaterialIcons name="directions-car" size={size} color={color} />,
            }}
          />

          <Tab.Screen
            name="History"
            component={HistoryScreen}
            options={{
              title: "History",
              tabBarIcon: ({ color, size }) => <MaterialIcons name="history" size={size} color={color} />,
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

          {/* ── Hidden tabs — accessible via burger menu, no tab bar slot ── */}
          <Tab.Screen
            name="Profile"
            options={{
              title: "Profile",
              tabBarItemStyle: { display: "none" },
            }}
          >
            {() => <ProfileScreen session={session} onSignOut={onSignOut} />}
          </Tab.Screen>

          {superAdmin && (
            <Tab.Screen
              name="Admin"
              component={AdminScreen}
              options={{
                title: "Admin Config",
                tabBarItemStyle: { display: "none" },
              }}
            />
          )}

        </Tab.Navigator>
      </NavigationContainer>
    </SessionProvider>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : session ? (
        <MainApp session={session} onSignOut={() => setSession(null)} />
      ) : (
        <LoginScreen onSignedIn={() => supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))} />
      )}
    </SafeAreaProvider>
  );
}
