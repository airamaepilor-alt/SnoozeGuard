import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { supabase } from "../lib/supabase";
import { flushOutbox } from "../lib/offline/sync";

function BottomNavLink({
  to,
  label,
  icon,
  end,
}: {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-w-[4.25rem] flex-col items-center rounded-2xl px-4 py-2 transition-all duration-300 ease-out active:scale-90 ${
          isActive
            ? "bg-surface-container-high text-primary shadow-sg-primary"
            : "text-surface-bright hover:text-primary"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className="material-symbols-outlined text-[22px] leading-none"
            style={{ fontVariationSettings: isActive ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 400" }}
            aria-hidden
          >
            {icon}
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-widest">{label}</span>
        </>
      )}
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
    <div className="flex min-h-dvh flex-col bg-background font-body text-on-surface">
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-surface-container-low shadow-sg-header backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl" aria-hidden>
              security
            </span>
            <h1 className="font-headline text-lg font-black uppercase tracking-tighter text-primary">SnoozeGuard</h1>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xl border border-outline-variant/40 px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:border-primary/30 hover:bg-surface-container-high hover:text-on-surface"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-32 sm:px-6">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-primary/15 bg-background/85 shadow-sg-nav backdrop-blur-xl"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-end justify-around px-2 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-3">
          <BottomNavLink to="/" label="Dashboard" icon="dashboard" end />
          <BottomNavLink to="/drive" label="Drive" icon="directions_car" />
          <BottomNavLink to="/history" label="History" icon="history" />
          {isAdmin ? <BottomNavLink to="/admin" label="Admin" icon="admin_panel_settings" /> : null}
        </div>
      </nav>
    </div>
  );
}
