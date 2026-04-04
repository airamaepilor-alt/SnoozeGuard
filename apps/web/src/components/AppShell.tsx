import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { supabase } from "../lib/supabase";
import { flushOutbox } from "../lib/offline/sync";

function BottomNavLink({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-w-[4.5rem] flex-col items-center rounded-2xl px-4 py-2 transition-colors ${
          isActive ? "bg-[#222a3d] text-sky-300" : "text-zinc-500 hover:text-sky-200/80"
        }`
      }
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">{label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const { user, profile, signOut } = useAuth();
  const online = useOnlineStatus();
  const isAdmin = profile?.role === "super_admin";

  useEffect(() => {
    if (!user || !online) return;
    void flushOutbox(supabase, user.id);
  }, [user, online]);

  return (
    <div className="flex min-h-dvh flex-col bg-[#0b1326] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-sky-500/10 bg-[#0b1326]/90 shadow-[0_12px_40px_rgba(11,19,38,0.45)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-lg font-black tracking-tight text-sky-300">SnoozeGuard</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xl border border-zinc-600/80 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800/80"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-sky-500/15 bg-[#0b1326]/90 backdrop-blur-xl"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-end justify-around px-2 pb-4 pt-2">
          <BottomNavLink to="/" label="Dashboard" end />
          <BottomNavLink to="/drive" label="Drive" />
          <BottomNavLink to="/history" label="History" />
          {isAdmin ? <BottomNavLink to="/admin" label="Admin" /> : null}
        </div>
      </nav>
    </div>
  );
}
