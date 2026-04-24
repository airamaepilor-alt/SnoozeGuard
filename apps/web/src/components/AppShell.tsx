import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useThemeToggle } from "../context/ThemeContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { supabase } from "../lib/supabase";
import { flushOutbox } from "../lib/offline/sync";

// ─── Types ───────────────────────────────────────────────────────────────────

type NotifItem = {
  id: string;
  type: "alert" | "request";
  name: string;
  created_at: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

// ─── Nav item components ──────────────────────────────────────────────────────

function SideNavItem({
  to,
  icon,
  label,
  end,
  badge,
  onNavigate,
}: {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
  badge?: boolean;
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
          <span className="truncate flex-1">{label}</span>
          {badge && (
            <span className="flex items-center justify-center w-4 h-4 bg-error text-white rounded-full text-[9px] font-black shrink-0">
              !
            </span>
          )}
        </>
      )}
    </NavLink>
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
        <SideNavItem to="/simulation" icon="directions_car" label="Drive Simulation" onNavigate={onNavigate} />
        {isAdmin && (
          <SideNavItem to="/admin" icon="admin_panel_settings" label="Admin Console" onNavigate={onNavigate} />
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
  const [_activeAlertCount, setActiveAlertCount] = useState(0);
  const [_pendingEcCount, setPendingEcCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<NotifItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const isAdmin = profile?.role === "super_admin";
  const isFullscreen = location.pathname === "/safety-protocol" || location.pathname === "/drive";
  const isDrivePage = location.pathname === "/drive" || location.pathname === "/simulation";

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
        const [pendById, pendByEmail, byUserId, byEmail] = await Promise.all([
          supabase.from("emergency_contacts").select("id, user_id, created_at")
            .eq("contact_user_id", user.id).eq("status", "pending"),
          supabase.from("emergency_contacts").select("id, user_id, created_at")
            .ilike("contact_email", user.email ?? "__no_email__").eq("status", "pending"),
          supabase.from("emergency_contacts").select("user_id")
            .eq("contact_user_id", user.id).eq("status", "accepted"),
          supabase.from("emergency_contacts").select("user_id")
            .ilike("contact_email", user.email ?? "__no_email__").neq("status", "pending"),
        ]);

        // Deduplicate pending rows by id
        const seenPend = new Set<string>();
        const pendRows = [...(pendById.data ?? []), ...(pendByEmail.data ?? [])].filter((r) => {
          if (seenPend.has(r.id as string)) return false;
          seenPend.add(r.id as string);
          return true;
        }) as Array<{ id: string; user_id: string; created_at: string }>;

        setPendingEcCount(pendRows.length);

        // Enrich pending requests with driver names
        const requestNotifs: NotifItem[] = await Promise.all(
          pendRows.map(async (row) => {
            const { data: p } = await supabase.from("profiles")
              .select("full_name").eq("id", row.user_id).maybeSingle();
            return {
              id: row.id,
              type: "request" as const,
              name: (p as { full_name?: string } | null)?.full_name ?? "A SnoozeGuard user",
              created_at: row.created_at,
            };
          }),
        );

        const driverIds = Array.from(
          new Set([
            ...(byUserId.data ?? []).map((c) => c.user_id as string),
            ...(byEmail.data ?? []).map((c) => c.user_id as string),
          ]),
        );

        if (driverIds.length === 0) {
          setActiveAlertCount(0);
          setNotifItems(requestNotifs);
          return;
        }

        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data: events } = await supabase
          .from("emergency_alert_events")
          .select("id, user_id, status, created_at")
          .in("user_id", driverIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false });

        const seenDrivers = new Set<string>();
        const mostRecentPerDriver = (events ?? []).filter((ev) => {
          if (seenDrivers.has(ev.user_id as string)) return false;
          seenDrivers.add(ev.user_id as string);
          return true;
        });

        const activeEvents = mostRecentPerDriver.filter((ev) => ev.status === "active");
        setActiveAlertCount(activeEvents.length);

        // Enrich active alerts with driver names
        const alertNotifs: NotifItem[] = await Promise.all(
          activeEvents.map(async (ev) => {
            const { data: p } = await supabase.from("profiles")
              .select("full_name").eq("id", ev.user_id).maybeSingle();
            return {
              id: ev.id as string,
              type: "alert" as const,
              name: (p as { full_name?: string } | null)?.full_name ?? "Driver",
              created_at: ev.created_at as string,
            };
          }),
        );

        setNotifItems([...alertNotifs, ...requestNotifs]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_contacts" }, () =>
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

  // Close notification panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      <header className={`fixed top-0 left-0 right-0 lg:left-64 z-20 h-16 lg:h-20 bg-background/90 backdrop-blur-xl flex items-center justify-between px-4 lg:px-10 gap-4 shadow-[0_1px_0_rgba(69,70,77,0.3)] ${isDrivePage ? "max-lg:hidden" : ""}`}>

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
            <TopNavLink to="/simulation" label="Simulation" />
          </nav>
        </div>

        {/* Right: actions + user */}
        <div className="flex items-center gap-2 lg:gap-4 shrink-0">
          {/* Safety Protocol — hidden on small screens */}
          <Link to="/safety-protocol" className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-3 lg:px-4 py-2 rounded-lg font-bold text-xs lg:text-sm hover:bg-primary/20 transition-all border border-primary/20 whitespace-nowrap">
            Safety Protocol
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

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative hover:bg-surface-bright/50 rounded-full p-1.5 lg:p-2 transition-all"
              title="Notifications"
            >
              <span
                className="material-symbols-outlined text-on-surface-variant text-[20px] lg:text-[24px]"
                style={{ fontVariationSettings: notifItems.length > 0 ? "'FILL' 1" : "'FILL' 0" }}
              >
                {notifItems.length > 0 ? "notifications_active" : "notifications"}
              </span>
              {notifItems.length > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-error text-white rounded-full text-[9px] font-black flex items-center justify-center leading-none">
                  {notifItems.length > 9 ? "9+" : notifItems.length}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-low border border-outline-variant/20 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-outline-variant/10 flex justify-between items-center">
                  <p className="text-sm font-bold text-on-surface">Notifications</p>
                  <Link
                    to="/safety-protocol"
                    onClick={() => setNotifOpen(false)}
                    className="text-[10px] text-primary font-bold hover:underline"
                  >
                    View all
                  </Link>
                </div>

                {notifItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-on-surface-variant text-sm">
                    No new notifications
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-outline-variant/10">
                    {notifItems.map((item) => (
                      <Link
                        key={item.id}
                        to="/safety-protocol"
                        onClick={() => setNotifOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-surface-container-high transition-colors"
                      >
                        <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.type === "alert" ? "bg-error/20" : "bg-primary/20"}`}>
                          <span
                            className={`material-symbols-outlined text-sm ${item.type === "alert" ? "text-error" : "text-primary"}`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {item.type === "alert" ? "warning" : "person_add"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-on-surface truncate">{item.name}</p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5">
                            {item.type === "alert" ? "Fatigue alert — needs attention" : "Wants you as emergency guardian"}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1">{relativeTime(item.created_at)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="px-4 py-3 border-t border-outline-variant/10">
                  <Link
                    to="/safety-protocol"
                    onClick={() => setNotifOpen(false)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">security</span>
                    Open Safety Protocol
                  </Link>
                </div>
              </div>
            )}
          </div>

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
      <main className={`lg:ml-64 ${
        isDrivePage
          ? "pt-0 lg:pt-20 h-dvh lg:h-[calc(100vh-5rem)] overflow-hidden"
          : isFullscreen
            ? "pt-16 lg:pt-20 h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)] overflow-hidden"
            : "pt-16 lg:pt-20 min-h-screen"
      }`}>
        {isFullscreen ? (
          <Outlet />
        ) : (
          <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 pb-16">
            <Outlet />
          </div>
        )}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className={`fixed bottom-0 left-0 right-0 z-20 lg:hidden bg-background/95 backdrop-blur-xl border-t border-outline-variant/20 flex justify-around items-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 ${isDrivePage ? "hidden" : ""}`}>
        {[
          { to: "/", icon: "dashboard", label: "Home", end: true },
          { to: "/analytics", icon: "bar_chart", label: "Analytics" },
          { to: "/drive", icon: "directions_car", label: "Drive" },
          { to: "/safety-protocol", icon: "security", label: "Alerts" },
          { to: "/history", icon: "history", label: "History" },
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
