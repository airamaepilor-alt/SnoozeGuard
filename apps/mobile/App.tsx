import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "./context/SessionContext";
import { supabase } from "./lib/supabase";
import type { RootStackParamList } from "./screens/HomeScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { DriveScreen } from "./screens/DriveScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#09090b",
    card: "#09090b",
    primary: "#7dd3fc",
    text: "#fafafa",
    border: "#27272a",
  },
};

function MainApp({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  return (
    <SessionProvider session={session}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator>
          <Stack.Screen name="Home" options={{ title: "SnoozeGuard" }}>
            {() => <HomeScreen session={session} onSignOut={onSignOut} />}
          </Stack.Screen>
          <Stack.Screen name="Drive" component={DriveScreen} options={{ title: "Driving" }} />
        </Stack.Navigator>
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#09090b" }}>
        <ActivityIndicator color="#7dd3fc" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {session ? (
        <MainApp session={session} onSignOut={() => setSession(null)} />
      ) : (
        <LoginScreen onSignedIn={() => supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))} />
      )}
    </>
  );
}
