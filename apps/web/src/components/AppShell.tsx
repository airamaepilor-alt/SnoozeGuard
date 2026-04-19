import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useThemeToggle } from "../context/ThemeContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { supabase } from "../lib/supabase";
import { flushOutbox } from "../lib/offline/sync";

// ─── Nav item components ──────────────────────────────────────────────────────

function SideNavItem({
  to,
  icon,
  label,
  end,
  onNavigate,
}: {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 mx-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          isActive
            ? "text-primary font-bold bg-surface-container-high"
            : "text-slate-400 hover:text-white hover:bg-surface-container-high"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className="material-symbols-outlined shrink-0"
            style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
          >
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function PlaceholderNavItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mx-2 px-4 py-3 rounded-lg text-slate-600 cursor-not-allowed select-none">
      <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 0" }}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function TopNavLink({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        isActive
          ? "text-primary border-b-2 border-primary pb-1 font-semibold text-sm whitespace-nowrap"
          : "text-slate-400 hover:text-white transition-colors font-semibold text-sm whitespace-nowrap"
      }
    >
      {label}
    </NavLink>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  isAdmin,
  displayName,
  initials,
  roleLabel,
  onNavigate,
  onSignOut,
}: {
  isAdmin: boolean;
  displayName: string;
  initials: string;
  roleLabel: string;
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="px-6 mb-8 shrink-0">
        <h1 className="text-xl font-headline font-bold tracking-tighter text-primary">SnoozeGuard</h1>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Vigilant System</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden">
        <SideNavItem to="/" icon="dashboard" label="Dashboard" end onNavigate={onNavigate} />
        <SideNavItem to="/analytics" icon="bar_chart" label="Driver Analytics" onNavigate={onNavigate} />
        <SideNavItem to="/history" icon="history" label="Fatigue Logs" onNavigate={onNavigate} />
        <SideNavItem to="/account" icon="manage_accounts" label="Account" onNavigate={onNavigate} />
        <SideNavItem to="/guardians" icon="shield" label="Emergency Contact" onNavigate={onNavigate} />
        <SideNavItem to="/about" icon="info" label="About" onNavigate={onNavigate} />
        <SideNavItem to="/terms" icon="policy" label="Terms & Privacy" onNavigate={onNavigate} />
        <SideNavItem to="/safety-protocol" icon="security" label="Safety Protocol" onNavigate={onNavigate} />
        {isAdmin ? (
          <SideNavItem to="/admin" icon="admin_panel_settings" label="Admin Console" onNavigate={onNavigate} />
        ) : (
          <PlaceholderNavItem icon="admin_panel_settings" label="Admin Console" />
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-4 mt-6 space-y-3 shrink-0">
        <Link
          to="/drive"
          onClick={onNavigate}
          className="w-full bg-secondary text-on-primary py-3 rounded-xl font-headline font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity text-sm"
        >
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            warning
          </span>
          <span>SOS Monitor</span>
        </Link>

        <div className="border-t border-outline-variant/20 pt-3 space-y-0.5">
          {/* User row */}
          <div className="mx-2 px-4 py-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-on-surface truncate leading-tight">{displayName}</p>
              <p className="text-[10px] text-primary uppercase tracking-wider font-extrabold">{roleLabel}</p>
            </div>
          </div>

          <button
            onClick={onSignOut}
            className="text-slate-400 font-medium hover:text-white mx-2 px-4 py-2 flex items-center gap-3 transition-all rounded-lg w-full text-left text-sm"
          >
            <span className="material-symbols-outlined text-xl shrink-0">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell() {
  const { user, profile, signOut } = useAuth();
  const { isDark, toggleTheme } = useThemeToggle();
  const online = useOnlineStatus();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const isAdmin = profile?.role === "super_admin";
  const isFullscreen = location.pathname === "/safety-protocol" || location.pathname === "/drive";

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!user || !online) return;
    void flushOutbox(supabase, user.id);
  }, [user, online]);

  // Fetch active alerts count
  useEffect(() => {
    if (!user?.id) return;

    const loadActiveAlerts = async () => {
      try {
        // Find drivers who have the current user as their emergency contact
        const [byUserId, byEmail] = await Promise.all([
          supabase
            .from("emergency_contacts")
            .select("user_id")
            .eq("contact_user_id", user.id)
            .eq("status", "accepted"),
          supabase
            .from("emergency_contacts")
            .select("user_id")
            .ilike("contact_email", user.email ?? "__no_email__")
            .neq("status", "pending"),
        ]);

        const driverIds = Array.from(
          new Set([
            ...(byUserId.data ?? []).map((c) => c.user_id as string),
            ...(byEmail.data ?? []).map((c) => c.user_id as string),
          ]),
        );

        if (driverIds.length === 0) {
          setActiveAlertCount(0);
          return;
        }

        // Fetch ALL alert events for these drivers (last 24h)
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data: events } = await supabase
          .from("emergency_alert_events")
          .select("user_id, status, created_at")
          .in("user_id", driverIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false });

        // Dedupe: get most recent alert per driver
        const seenDrivers = new Set<string>();
        const mostRecentPerDriver = (events ?? []).filter((ev) => {
          if (seenDrivers.has(ev.user_id)) return false;
          seenDrivers.add(ev.user_id);
          return true;
        });

        // Count only those with status === "active" (exact match, like AlertCard)
        const activeCount = mostRecentPerDriver.filter((ev) => ev.status === "active").length;

        setActiveAlertCount(activeCount);
      } catch {
        // Silent fail
      }
    };

    void loadActiveAlerts();

    const interval = setInterval(() => void loadActiveAlerts(), 15000); // Check every 15s
    const channel = supabase
      .channel("active-alerts-header")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_alert_events" }, () =>
        void loadActiveAlerts(),
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, user?.email]);

  const displayName: string =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roleLabel = isAdmin ? "Fleet Manager" : "Driver";

  const closeSidebar = () => setSidebarOpen(false);
  const handleSignOut = () => void signOut();

  return (
    <div className="min-h-screen bg-background text-on-surface font-body">

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={closeSidebar}
          aria-hidden
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed left-0 top-0 h-full z-40 w-64 bg-surface-container-low flex flex-col py-6
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:bg-background
        `}
      >
        <SidebarContent
          isAdmin={isAdmin}
          displayName={displayName}
          initials={initials}
          roleLabel={roleLabel}
          onNavigate={closeSidebar}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* ── Top header ── */}
      <header className="fixed top-0 left-0 right-0 lg:left-64 z-20 h-16 lg:h-20 bg-background/90 backdrop-blur-xl flex items-center justify-between px-4 lg:px-10 gap-4 shadow-[0_1px_0_rgba(69,70,77,0.3)]">

        {/* Left: hamburger (mobile) + search + top nav (desktop) */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Hamburger — mobile only */}
          <button
            className="lg:hidden shrink-0 p-2 rounded-lg hover:bg-surface-container-high transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <span className="material-symbols-outlined text-on-surface-variant">menu</span>
          </button>

          {/* Logo — mobile only (sidebar hidden) */}
          <span className="lg:hidden font-headline font-bold text-primary text-lg tracking-tighter">
            SnoozeGuard
          </span>

          {/* Search — hidden on small mobile, shown md+ */}
          <div className="relative hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              className="bg-surface-container-low rounded-full py-2 pl-10 pr-6 text-sm w-52 xl:w-64 focus:ring-1 focus:ring-primary/60 placeholder:text-slate-500 text-on-surface outline-none"
              placeholder="Search..."
              type="text"
              readOnly
            />
          </div>

          {/* Top nav — desktop only */}
          <nav className="hidden lg:flex gap-5 xl:gap-6">
            <TopNavLink to="/" label="Dashboard" end />
            <TopNavLink to="/analytics" label="Analytics" />
            <TopNavLink to="/history" label="History" />
            <TopNavLink to="/drive" label="Drive" />
          </nav>
        </div>

        {/* Right: actions + user */}
        <div className="flex items-center gap-2 lg:gap-4 shrink-0">
          {/* Safety Protocol — hidden on small screens */}
          <Link to="/safety-protocol" className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-3 lg:px-4 py-2 rounded-lg font-bold text-xs lg:text-sm hover:bg-primary/20 transition-all border border-primary/20 whitespace-nowrap relative">
            Safety Protocol
            {activeAlertCount > 0 && (
              <span className="ml-1 flex items-center justify-center w-5 h-5 bg-error text-white rounded-full text-[10px] font-bold">
                !
              </span>
            )}
          </Link>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="hover:bg-surface-bright/50 rounded-full p-1.5 lg:p-2 transition-all"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span className="material-symbols-outlined text-on-surface-variant text-[20px] lg:text-[24px]">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>

          <button className="hover:bg-surface-bright/50 rounded-full p-1.5 lg:p-2 transition-all" title="Notifications">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px] lg:text-[24px]">notifications_active</span>
          </button>

          {/* User avatar */}
          <Link to="/account" className="flex items-center gap-2 lg:gap-3 ml-1 hover:opacity-80 transition-opacity">
            <div className="hidden lg:block text-right">
              <p className="text-sm font-bold leading-tight text-on-surface">{displayName}</p>
              <p className="text-[10px] text-primary uppercase tracking-wider font-extrabold">{roleLabel}</p>
            </div>
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-primary/20 ring-2 ring-primary/20 flex items-center justify-center font-bold text-primary text-xs lg:text-sm shrink-0">
              {initials}
            </div>
          </Link>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className={`lg:ml-64 pt-16 lg:pt-20 ${isFullscreen ? "h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)] overflow-hidden" : "min-h-screen"}`}>
        {isFullscreen ? (
          <Outlet />
        ) : (
          <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 pb-16">
            <Outlet />
          </div>
        )}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 lg:hidden bg-background/95 backdrop-blur-xl border-t border-outline-variant/20 flex justify-around items-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2">
        {[
          { to: "/", icon: "dashboard", label: "Home", end: true },
          { to: "/history", icon: "history", label: "History" },
          { to: "/drive", icon: "directions_car", label: "Drive" },
          { to: "/account", icon: "manage_accounts", label: "Account" },
        ].map(({ to, icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all min-w-[3rem] ${
                isActive ? "text-primary" : "text-slate-500"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {icon}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
