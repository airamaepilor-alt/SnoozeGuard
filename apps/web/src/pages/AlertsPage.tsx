import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { supabase } from "../lib/supabase";
import Map, { Marker } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertStatus = "active" | "alerted" | "dismissed";

type AlertEvent = {
  id: string;
  user_id: string;
  location_lat: number | null;
  location_lng: number | null;
  status: AlertStatus;
  created_at: string;
  acknowledged_at: string | null;
  dismissed_at: string | null;
  driver_name: string;
  driver_phone: string | null;
};

const VISIBLE_MS = 24 * 60 * 60 * 1000;

function isAlertVisible(ev: AlertEvent): boolean {
  if (ev.status === "active") return true;
  const resolvedAt = ev.dismissed_at ?? ev.acknowledged_at ?? ev.created_at;
  return Date.now() - new Date(resolvedAt).getTime() < VISIBLE_MS;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status: AlertStatus): string {
  if (status === "active") return "NEEDS ATTENTION";
  if (status === "alerted") return "ALERTED";
  return "RESOLVED";
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
}

function nameInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ─── Marker UI Component ──────────────────────────────────────────────────

function MarkerUI({ status }: { status: AlertStatus }) {
  if (status === "active") {
    return (
      <div className="relative">
        <div className="absolute inset-0 animate-ping bg-red-400 rounded-full opacity-75" />
        <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_20px_rgba(255,0,0,0.8)]" />
      </div>
    );
  }
  if (status === "alerted") {
    return (
      <div className="w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_12px_rgba(255,200,0,0.7)]" />
    );
  }
  return (
    <div className="w-2 h-2 bg-blue-300 rounded-full opacity-50" />
  );
}

// ─── Map Visualization ────────────────────────────────────────────────────

function MapVisualization({
  alerts,
  pollCountdown,
  online,
  targetLocation,
}: {
  alerts: AlertEvent[];
  pollCountdown: number;
  online: boolean;
  targetLocation?: { lat: number; lng: number } | null;
}) {
  // Find first active alert or use default Philippines coordinates
  const firstActive = useMemo(() => alerts.find((a) => a.status === "active"), [alerts]);
  const mapRef = useRef<any>(null);

  // Fly to target location when it changes
  useEffect(() => {
    if (targetLocation && mapRef.current) {
      mapRef.current.flyTo({
        center: [targetLocation.lng, targetLocation.lat],
        zoom: 15,
        duration: 1500,
      });
    }
  }, [targetLocation]);

  return (
    <div className="h-80 sm:h-96 lg:h-full relative overflow-hidden">
      {/* 🌍 REAL MAP */}
      <Map
        ref={mapRef}
        mapLib={mapboxgl}
        initialViewState={{
          latitude: firstActive?.location_lat ?? 14.3,
          longitude: firstActive?.location_lng ?? 121.1,
          zoom: 12,
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        style={{ width: "100%", height: "100%" }}
        onLoad={(event) => {
          mapRef.current = event.target;
        }}
      >
        {alerts.map((a) =>
          a.location_lat != null && a.location_lng != null ? (
            <Marker
              key={a.id}
              latitude={a.location_lat}
              longitude={a.location_lng}
            >
              <div className="flex flex-col items-center">
                <MarkerUI status={a.status} />
                <div className="mt-1 px-2 py-1 bg-black/70 backdrop-blur text-[10px] rounded border border-white/10 whitespace-nowrap">
                  {a.status.toUpperCase()}: {a.driver_name.split(" ")[0]}
                </div>
              </div>
            </Marker>
          ) : null
        )}
      </Map>

      {/* ✨ Glow + premium overlays (KEEP YOUR STYLE) */}
      <div className="absolute inset-0 pointer-events-none">
        {/* center glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,150,255,0.15),transparent_60%)]" />

        {/* vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.8))]" />
      </div>

      {/* 🔄 Polling pill (unchanged) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="bg-surface-container-high/90 backdrop-blur-xl border border-outline-variant/10 px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl">
          <div className="relative flex h-2 w-2 shrink-0">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                online ? "bg-primary" : "bg-secondary"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                online ? "bg-primary" : "bg-secondary"
              }`}
            />
          </div>
          <span className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase whitespace-nowrap">
            {online ? `Live · refreshes in ${pollCountdown}s` : "Offline · Last known data"}
          </span>
        </div>
      </div>

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center space-y-3">
            <span
              className="material-symbols-outlined text-primary text-5xl block"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified_user
            </span>
            <p className="text-on-surface-variant text-sm font-medium">All drivers accounted for</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onDismiss,
  dismissing,
  onCenter,
}: {
  alert: AlertEvent;
  onDismiss: (id: string) => void;
  dismissing: boolean;
  onCenter?: (lat: number, lng: number) => void;
}) {
  const isCritical = alert.status === "active";
  const isResolved = alert.status === "dismissed";
  const initials = nameInitials(alert.driver_name);

  const callHref = alert.driver_phone ? `tel:${alert.driver_phone}` : null;
  const smsBody = encodeURIComponent(
    `SnoozeGuard Alert: ${alert.driver_name} triggered a fatigue alert at ${formatTime(alert.created_at)}. Please respond.`,
  );
  const smsHref = alert.driver_phone ? `sms:${alert.driver_phone}?body=${smsBody}` : null;

  if (isResolved) {
    return (
      <div className="bg-surface-container-high/40 rounded-xl p-4 sm:p-5 flex items-center justify-between gap-3 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-slate-500 text-sm shrink-0">
            {initials}
          </div>
          <div>
            <h3 className="font-bold text-slate-300 text-sm sm:text-base">{alert.driver_name}</h3>
            <p className="text-[10px] font-medium text-slate-500 tracking-widest uppercase">
              {formatRelative(alert.created_at)}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black text-primary shrink-0">RESOLVED</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl p-4 sm:p-5 space-y-4 shadow-lg transition-colors ${
        isCritical
          ? "bg-error-container/20 border-l-4 border-error hover:bg-error-container/30"
          : "bg-surface-container-high hover:bg-surface-bright border border-outline-variant/5"
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 ${
              isCritical
                ? "border-error bg-error/20 text-error"
                : "border-secondary bg-secondary/20 text-secondary"
            }`}
          >
            {initials}
          </div>
          <div className="flex-1">
            <h3
              className={`font-bold text-sm sm:text-base ${isCritical ? "text-error" : "text-on-surface"}`}
            >
              {alert.driver_name}
            </h3>
            {alert.driver_phone && (
              <p className="text-[10px] font-medium text-slate-500 tracking-wider">
                {alert.driver_phone}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <span
            className={`text-[10px] font-black uppercase block ${
              isCritical ? "text-error animate-pulse" : "text-secondary"
            }`}
          >
            {statusLabel(alert.status)}
          </span>
          <p className="text-[10px] text-slate-500 mt-0.5">{formatRelative(alert.created_at)}</p>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 text-[10px]">
        <div className="space-y-1">
          <p className="text-slate-500 uppercase tracking-widest">Time</p>
          <p className="text-on-surface font-mono">{formatTime(alert.created_at)}</p>
        </div>
        {alert.location_lat != null && alert.location_lng != null ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-slate-500 uppercase tracking-widest">Location</p>
              <button
                onClick={() => onCenter?.(alert.location_lat!, alert.location_lng!)}
                className="p-1 hover:bg-surface-container-high rounded transition-colors"
                title="Center on map"
              >
                <span className="material-symbols-outlined text-sm text-primary">location_on</span>
              </button>
            </div>
            <p className="text-on-surface font-mono text-[9px]">
              {alert.location_lat.toFixed(4)}° N, {Math.abs(alert.location_lng).toFixed(4)}°{" "}
              {alert.location_lng < 0 ? "W" : "E"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-slate-500 uppercase tracking-widest">Status</p>
            <p className="text-on-surface font-mono capitalize">{alert.status}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1">
        {callHref ? (
          <a
            href={callHref}
            className={`flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-lg font-bold text-[10px] sm:text-xs active:scale-95 transition-all ${
              isCritical ? "bg-error text-on-error" : "bg-secondary text-on-secondary"
            }`}
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
              call
            </span>
            {isCritical ? "CALL DRIVER" : "CONTACT"}
          </a>
        ) : (
          <Link
            to="/history"
            className={`flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-lg font-bold text-[10px] sm:text-xs active:scale-95 transition-all ${
              isCritical ? "bg-error text-on-error" : "bg-secondary text-on-secondary"
            }`}
          >
            <span className="material-symbols-outlined text-sm">history</span>
            VIEW LOG
          </Link>
        )}
        {smsHref ? (
          <a
            href={smsHref}
            className="flex items-center justify-center gap-1.5 bg-surface-bright text-on-surface py-2 sm:py-2.5 rounded-lg font-bold text-[10px] sm:text-xs border border-outline-variant/10 active:scale-95 transition-all hover:bg-surface-container-highest"
          >
            <span className="material-symbols-outlined text-sm">chat</span>
            SEND SMS
          </a>
        ) : (
          <button
            disabled={dismissing}
            onClick={() => onDismiss(alert.id)}
            className="flex items-center justify-center gap-1.5 bg-surface-bright text-on-surface py-2 sm:py-2.5 rounded-lg font-bold text-[10px] sm:text-xs border border-outline-variant/10 active:scale-95 transition-all hover:bg-surface-container-highest disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">check</span>
            {isCritical ? "ACKNOWLEDGE" : "NUDGE"}
          </button>
        )}
      </div>

      {/* Dismiss (secondary action for critical) */}
      {isCritical && (
        <button
          disabled={dismissing}
          onClick={() => onDismiss(alert.id)}
          className="w-full py-2 text-[10px] font-bold text-slate-500 hover:text-on-surface transition-colors disabled:opacity-50"
        >
          {dismissing ? "Dismissing…" : "Mark as Resolved"}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_SEC = 15;

export function AlertsPage() {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [pollCountdown, setPollCountdown] = useState(POLL_INTERVAL_SEC);
  const [noEcLinked, setNoEcLinked] = useState(false);
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number } | null>(null);
  const loadingRef = useRef(false);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === "active"), [alerts]);
  const alertedAlerts = useMemo(() => alerts.filter((a) => a.status === "alerted"), [alerts]);
  const resolvedAlerts = useMemo(() => alerts.filter((a) => a.status === "dismissed"), [alerts]);

  // ── Data fetch ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id || loadingRef.current) return;
    loadingRef.current = true;

    try {
      // 1. Find drivers who have the current user as their emergency contact
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
        setNoEcLinked(true);
        setAlerts([]);
        setLoading(false);
        return;
      }
      setNoEcLinked(false);

      // 2. Fetch emergency alert events from those drivers (48h window so recently-dismissed
      //    alerts that were created near the boundary are included; client filters to 24h-from-resolution)
      const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const { data: events } = await supabase
        .from("emergency_alert_events")
        .select("id, user_id, location_lat, location_lng, status, created_at, acknowledged_at, dismissed_at")
        .in("user_id", driverIds)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (!events || events.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      // Dedupe: one entry per driver (most recent), then apply 24h-from-resolution visibility filter
      const seenDrivers = new Set<string>();
      const deduped = (events as AlertEvent[])
        .filter((ev) => {
          if (seenDrivers.has(ev.user_id)) return false;
          seenDrivers.add(ev.user_id);
          return true;
        })
        .filter(isAlertVisible);

      // 3. Enrich with driver profile (name + phone)
      const enriched: AlertEvent[] = await Promise.all(
        deduped.map(async (ev) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", ev.user_id)
            .maybeSingle();
          const p = profile as { full_name?: string; phone?: string } | null;
          return {
            ...ev,
            driver_name: p?.full_name ?? "Driver",
            driver_phone: p?.phone ?? null,
          };
        }),
      );

      // Sort: active first, then alerted, then dismissed
      enriched.sort((a, b) => {
        const order: Record<AlertStatus, number> = { active: 0, alerted: 1, dismissed: 2 };
        return order[a.status] - order[b.status];
      });

      setAlerts(enriched);
    } catch {
      // Keep last known state on error
    } finally {
      setLoading(false);
      loadingRef.current = false;
      setPollCountdown(POLL_INTERVAL_SEC);
    }
  }, [user?.id, user?.email]);

  // Initial load + 15s polling (matching mobile) + Supabase Realtime
  useEffect(() => {
    if (!user) return;
    void load();

    const interval = setInterval(() => void load(), POLL_INTERVAL_SEC * 1000);

    const channel = supabase
      .channel("emergency-alerts-web")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_alert_events" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_contacts" },
        () => void load(),
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [user, load]);

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => {
      setPollCountdown((n) => (n <= 1 ? POLL_INTERVAL_SEC : n - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // ── Dismiss handler ───────────────────────────────────────────────────────
  const handleDismiss = async (id: string) => {
    setDismissingId(id);
    await supabase
      .from("emergency_alert_events")
      .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
      .eq("id", id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "dismissed" as AlertStatus, dismissed_at: new Date().toISOString() } : a)),
    );
    setDismissingId(null);
  };

  const allVisible = [...activeAlerts, ...alertedAlerts, ...resolvedAlerts];
  const activeCount = activeAlerts.length;

  // ── Center alert on map ────────────────────────────────────────────────
  const handleCenterAlert = useCallback((lat: number, lng: number) => {
    setTargetLocation({ lat, lng });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden">

      {/* ── Map / Visualization panel ── */}
      <div className="h-80 sm:h-96 lg:flex-1 lg:h-full">
        <MapVisualization
          alerts={allVisible}
          pollCountdown={pollCountdown}
          online={online}
          targetLocation={targetLocation}
        />
      </div>

      {/* ── Alert sidebar and fleet overview container ── */}
      <div className="flex flex-col lg:flex-none w-full lg:w-96 xl:w-[420px] min-h-0 lg:overflow-hidden overflow-y-auto">
        {/* ── Alert sidebar ── */}
        <section className="flex flex-col lg:flex-1 w-full bg-surface-container-low/95 backdrop-blur-2xl border-t lg:border-t-0 lg:border-l border-outline-variant/10 lg:min-h-0 lg:overflow-hidden">

        {/* Header */}
        <div className="p-5 sm:p-6 lg:p-8 border-b border-outline-variant/5 flex-shrink-0">
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-xl sm:text-2xl font-headline font-black tracking-tight text-on-surface">
              Live Alerts
            </h2>
            <span
              className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                activeCount > 0
                  ? "bg-error/10 text-error"
                  : alertedAlerts.length > 0
                    ? "bg-secondary/10 text-secondary"
                    : "bg-primary/10 text-primary"
              }`}
            >
              {loading
                ? "…"
                : activeCount > 0
                  ? `${activeCount} Active`
                  : allVisible.length > 0
                    ? `${allVisible.length} Total`
                    : "All Clear"}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant font-medium">
            Real-time fatigue monitoring
          </p>
        </div>

        {/* Alert list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-4 lg:space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-on-surface-variant text-sm gap-2">
              <span className="material-symbols-outlined animate-spin text-primary">
                progress_activity
              </span>
              Loading alerts…
            </div>
          ) : noEcLinked ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">
                  contacts
                </span>
              </div>
              <div>
                <p className="font-headline font-bold text-on-surface text-sm">
                  No drivers linked
                </p>
                <p className="text-xs text-on-surface-variant mt-1 max-w-[220px]">
                  You'll see alerts here when a driver adds you as their emergency contact.
                </p>
              </div>
              <Link
                to="/drive"
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1 mt-1"
              >
                Go to Drive screen
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
          ) : allVisible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-primary text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
              </div>
              <div>
                <p className="font-headline font-bold text-on-surface text-sm">All Clear</p>
                <p className="text-xs text-on-surface-variant mt-1">
                  No fatigue alerts in the last 24 hours.
                </p>
              </div>
            </div>
          ) : (
            allVisible.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                onDismiss={(id) => void handleDismiss(id)}
                dismissing={dismissingId === a.id}
                onCenter={handleCenterAlert}
              />
            ))
          )}
        </div>

        {/* Footer stats - only show on lg+ screens */}
        <div className="hidden lg:flex lg:flex-col p-4 sm:p-5 lg:p-6 bg-surface-container-low border-t border-outline-variant/10 flex-shrink-0">
          <div className="flex items-center justify-between text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-3">
            <span>Fleet Overview</span>
            <button
              onClick={() => void load()}
              className="flex items-center gap-1 text-primary hover:text-on-surface transition-colors"
              title="Refresh now"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-container-high p-2.5 sm:p-3 rounded-xl flex flex-col items-center">
              <span className="text-base sm:text-lg font-headline font-black text-primary">
                {loading ? "…" : String(allVisible.length).padStart(2, "0")}
              </span>
              <span className="text-[8px] text-slate-500 uppercase tracking-wide mt-0.5">Total</span>
            </div>
            <div
              className={`bg-surface-container-high p-2.5 sm:p-3 rounded-xl flex flex-col items-center ${activeCount > 0 ? "border border-error/20" : ""}`}
            >
              <span
                className={`text-base sm:text-lg font-headline font-black ${activeCount > 0 ? "text-error" : "text-on-surface-variant"}`}
              >
                {loading ? "…" : String(activeCount).padStart(2, "0")}
              </span>
              <span className="text-[8px] text-slate-500 uppercase tracking-wide mt-0.5">Active</span>
            </div>
            <div className="bg-surface-container-high p-2.5 sm:p-3 rounded-xl flex flex-col items-center">
              <span
                className={`text-base sm:text-lg font-headline font-black ${resolvedAlerts.length > 0 ? "text-primary" : "text-on-surface-variant"}`}
              >
                {loading ? "…" : String(resolvedAlerts.length).padStart(2, "0")}
              </span>
              <span className="text-[8px] text-slate-500 uppercase tracking-wide mt-0.5">Resolved</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-outline-variant/5 flex gap-2">
            <Link
              to="/history"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-surface-container-high text-on-surface-variant hover:text-on-surface text-xs font-bold rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined text-sm">history</span>
              Log
            </Link>
            <Link
              to="/analytics"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-surface-container-high text-on-surface-variant hover:text-on-surface text-xs font-bold rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
              Analytics
            </Link>
            <Link
              to="/drive"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined text-sm">directions_car</span>
              Drive
            </Link>
          </div>
        </div>
      </section>

      {/* ── Mobile fleet overview footer (outside sidebar) ── */}
      <div className="lg:hidden flex flex-col p-4 sm:p-5 bg-surface-container-low border-t border-outline-variant/10 flex-shrink-0">
        <div className="flex items-center justify-between text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-3">
          <span>Fleet Overview</span>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1 text-primary hover:text-on-surface transition-colors"
            title="Refresh now"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-surface-container-high p-2 rounded-xl flex flex-col items-center">
            <span className="text-sm font-headline font-black text-primary">
              {loading ? "…" : String(allVisible.length).padStart(2, "0")}
            </span>
            <span className="text-[7px] text-slate-500 uppercase tracking-wide mt-0.5">Total</span>
          </div>
          <div
            className={`bg-surface-container-high p-2 rounded-xl flex flex-col items-center ${activeCount > 0 ? "border border-error/20" : ""}`}
          >
            <span
              className={`text-sm font-headline font-black ${activeCount > 0 ? "text-error" : "text-on-surface-variant"}`}
            >
              {loading ? "…" : String(activeCount).padStart(2, "0")}
            </span>
            <span className="text-[7px] text-slate-500 uppercase tracking-wide mt-0.5">Active</span>
          </div>
          <div className="bg-surface-container-high p-2 rounded-xl flex flex-col items-center">
            <span
              className={`text-sm font-headline font-black ${resolvedAlerts.length > 0 ? "text-primary" : "text-on-surface-variant"}`}
            >
              {loading ? "…" : String(resolvedAlerts.length).padStart(2, "0")}
            </span>
            <span className="text-[7px] text-slate-500 uppercase tracking-wide mt-0.5">Resolved</span>
          </div>
        </div>

        <div className="flex gap-1.5">
          <Link
            to="/history"
            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-surface-container-high text-on-surface-variant hover:text-on-surface text-[10px] font-bold rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xs">history</span>
          </Link>
          <Link
            to="/analytics"
            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-surface-container-high text-on-surface-variant hover:text-on-surface text-[10px] font-bold rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xs">bar_chart</span>
          </Link>
          <Link
            to="/drive"
            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xs">directions_car</span>
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
