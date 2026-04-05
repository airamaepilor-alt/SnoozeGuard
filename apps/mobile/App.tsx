import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { SessionProvider } from "./context/SessionContext";
import { supabase } from "./lib/supabase";
import type { MainTabParamList } from "./navigation/types";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { DriveScreen } from "./screens/DriveScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { theme } from "./theme";

WebBrowser.maybeCompleteAuthSession();

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

function MainApp({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [superAdmin, setSuperAdmin] = useState(false);
  const insets = useSafeAreaInsets();

  const tabBarStyle = useMemo(
    () => {
      const bottom = Math.max(insets.bottom, 8);
      return {
        backgroundColor: theme.surfaceContainerLow,
        borderTopWidth: 1,
        borderTopColor: theme.navBorder,
        paddingTop: 6,
        paddingBottom: bottom,
        height: TAB_BAR_CONTENT_HEIGHT + 6 + bottom,
      };
    },
    [insets.bottom],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (!cancelled) setSuperAdmin(data?.role === "super_admin");
    })();
    return () => {
      cancelled = true;
    };
  }, [session.user.id]);

  return (
    <SessionProvider session={session}>
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.surfaceContainerLow,
              shadowColor: "#000",
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 8,
            },
            headerTintColor: theme.onSurface,
            headerTitleStyle: { fontWeight: "800", fontSize: 17 },
            tabBarStyle,
            tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: theme.onSurfaceVariant,
          }}
        >
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
            name="Admin"
            component={AdminScreen}
            options={{
              title: "Admin",
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="admin-panel-settings" size={size} color={color} />
              ),
              ...(superAdmin ? {} : { tabBarButton: () => null }),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SessionProvider>
  );
}

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
