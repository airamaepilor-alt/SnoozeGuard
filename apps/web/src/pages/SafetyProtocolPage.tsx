import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import Map, { Marker } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type AlertStatus = "active" | "alerted" | "dismissed";

type AlertEvent = {
  id: string;
  user_id: string;
  location_lat: number | null;
  location_lng: number | null;
  status: AlertStatus;
  created_at: string;
  acknowledged_at: string | null;
  driver_name: string;
  driver_phone: string | null;
};

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
  return <div className="w-2 h-2 bg-blue-300 rounded-full opacity-50" />;
}

export function SafetyProtocolPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AlertEvent | null>(null);
  const mapRef = useRef<any>(null);
  const loadingRef = useRef(false);

  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === "active"), [alerts]);
  const selectedAlert = selected || alerts[0] || null;

  const load = useCallback(async () => {
    if (!user?.id || loadingRef.current) return;
    loadingRef.current = true;

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
        setAlerts([]);
        setLoading(false);
        return;
      }

      // Fetch emergency alert events from those drivers (last 24h)
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: events } = await supabase
        .from("emergency_alert_events")
        .select("id, user_id, location_lat, location_lng, status, created_at, acknowledged_at")
        .in("user_id", driverIds)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (!events || events.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      // Dedupe: one entry per driver (most recent)
      const seenDrivers = new Set<string>();
      const deduped = (events as AlertEvent[]).filter((ev) => {
        if (seenDrivers.has(ev.user_id)) return false;
        seenDrivers.add(ev.user_id);
        return true;
      });

      // Enrich with driver profile (name + phone)
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

      // Sort: active first
      enriched.sort((a, b) => {
        const order: Record<AlertStatus, number> = { active: 0, alerted: 1, dismissed: 2 };
        return order[a.status] - order[b.status];
      });

      setAlerts(enriched);
      setSelected(enriched.find((a) => a.status === "active") || enriched[0] || null);
    } catch {
      // Keep last known state on error
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!user) return;
    void load();

    const interval = setInterval(() => void load(), 15000);

    const channel = supabase
      .channel("safety-protocol-alerts")
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

  // Fly to selected alert on map
  useEffect(() => {
    if (selectedAlert?.location_lat && selectedAlert?.location_lng && mapRef.current) {
      mapRef.current.flyTo({
        center: [selectedAlert.location_lng, selectedAlert.location_lat],
        zoom: 15,
        duration: 1500,
      });
    }
  }, [selectedAlert?.id]);

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">
            progress_activity
          </span>
          <p className="text-on-surface-variant">Loading safety protocol…</p>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <span
            className="material-symbols-outlined text-primary text-6xl block"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified_user
          </span>
          <div>
            <p className="text-on-surface font-bold text-lg">All drivers accounted for</p>
            <p className="text-on-surface-variant text-sm mt-2">No active alerts at this time.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden gap-6 p-6">
      {/* Left: Map */}
      <div className="flex-1 rounded-2xl overflow-hidden border border-outline-variant/20 shadow-xl min-h-96 lg:min-h-0">
        <Map
          ref={mapRef}
          mapLib={mapboxgl}
          initialViewState={{
            latitude: selectedAlert?.location_lat ?? 14.3,
            longitude: selectedAlert?.location_lng ?? 121.1,
            zoom: 12,
          }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
          style={{ width: "100%", height: "100%" }}
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
      </div>

      {/* Right: Safety Protocol */}
      <div className="w-full lg:w-96 flex flex-col gap-6">
        {/* Alert Status Card */}
        {selectedAlert && (
          <div
            className={`p-6 rounded-2xl border-2 ${
              selectedAlert.status === "active"
                ? "border-error bg-error/10"
                : "border-outline-variant/20 bg-surface-container-high"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-on-surface">{selectedAlert.driver_name}</h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  selectedAlert.status === "active"
                    ? "bg-error text-on-error"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {selectedAlert.status}
              </span>
            </div>
            {selectedAlert.driver_phone && (
              <p className="text-sm text-on-surface-variant mb-4">{selectedAlert.driver_phone}</p>
            )}
            {selectedAlert.location_lat && selectedAlert.location_lng && (
              <p className="text-xs font-mono text-on-surface-variant">
                {selectedAlert.location_lat.toFixed(4)}° N, {Math.abs(selectedAlert.location_lng).toFixed(4)}° E
              </p>
            )}
          </div>
        )}

        {/* Protocol Checklist */}
        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
          <h3 className="text-xl font-bold text-on-surface mb-6">Safety Protocol</h3>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className="relative p-4 bg-surface-container rounded-xl border border-outline-variant/20 hover:bg-surface-container-high transition-colors">
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary text-on-primary flex items-center justify-center rounded-full font-bold text-sm shadow-lg">
                1
              </div>
              <h4 className="font-bold text-on-surface mb-2 ml-6">Attempt Verbal Contact</h4>
              <p className="text-xs text-on-surface-variant ml-6">
                Use the call button below to initiate emergency contact with the driver.
              </p>
              {selectedAlert?.driver_phone && (
                <a
                  href={`tel:${selectedAlert.driver_phone}`}
                  className="mt-2 ml-6 inline-flex items-center gap-2 text-primary hover:underline text-xs font-bold"
                >
                  <span className="material-symbols-outlined text-sm">call</span>
                  Call Now
                </a>
              )}
            </div>

            {/* Step 2 */}
            <div className="relative p-4 bg-surface-container rounded-xl border border-outline-variant/20 hover:bg-surface-container-high transition-colors">
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-surface-bright text-on-surface flex items-center justify-center rounded-full font-bold text-sm shadow-lg">
                2
              </div>
              <h4 className="font-bold text-on-surface mb-2 ml-6">Verify GPS Location</h4>
              <p className="text-xs text-on-surface-variant ml-6">
                Review the map above. Note the vehicle's current position and surrounding area.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative p-4 bg-surface-container rounded-xl border border-outline-variant/20 hover:bg-surface-container-high transition-colors">
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-surface-bright text-on-surface flex items-center justify-center rounded-full font-bold text-sm shadow-lg">
                3
              </div>
              <h4 className="font-bold text-on-surface mb-2 ml-6">Contact Authorities</h4>
              <p className="text-xs text-on-surface-variant ml-6">
                If no response or unsafe location detected, contact emergency services with GPS coordinates above.
              </p>
              <button className="mt-2 ml-6 inline-flex items-center gap-2 text-error hover:text-error/80 text-xs font-bold">
                <span className="material-symbols-outlined text-sm">emergency_share</span>
                Emergency Dispatch
              </button>
            </div>
          </div>
        </div>

        {/* Other Alerts List */}
        {activeAlerts.length > 1 && (
          <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/10">
            <p className="text-xs font-bold text-on-surface-variant uppercase mb-3">Other Active Alerts</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {activeAlerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`w-full text-left p-3 rounded-lg transition-colors text-sm ${
                    selectedAlert?.id === a.id
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-container hover:bg-surface-container-high text-on-surface"
                  }`}
                >
                  <p className="font-bold">{a.driver_name}</p>
                  <p className="text-xs opacity-70">
                    {new Date(a.created_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
