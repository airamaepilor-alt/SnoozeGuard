import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  role: "driver" | "super_admin";
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(userId: string) {
      const { data } = await supabase.from("profiles").select("id, full_name, role").eq("id", userId).maybeSingle();
      if (!cancelled && data) {
        setProfile(data as Profile);
      }
    }

    async function upsertAndLoadProfile(user: User) {
      await supabase.from("profiles").upsert({
        id: user.id,
        email: (user.user_metadata?.email as string) || user.email || null,
        full_name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      await loadProfile(user.id);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      if (data.session?.user) {
        void loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, next) => {
      setSession(next);
      if (next?.user) {
        if (event === "SIGNED_IN") {
          void upsertAndLoadProfile(next.user);
        } else {
          void loadProfile(next.user.id);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Auth hook lives next to provider for a single import surface. */
// eslint-disable-next-line react-refresh/only-export-components -- intentional hook export
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
