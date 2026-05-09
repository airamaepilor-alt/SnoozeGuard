import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Map, { Marker } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertData = {
  driver_name: string;
  location_lat: number | null;
  location_lng: number | null;
  status: string;
  created_at: string;
  driver_phone: string | null;
};

type PageState = "loading" | "active" | "resolved" | "not_found" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nameInitials(name: string): string {
  return name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlertViewPage() {
  const [params] = useSearchParams();
  const alertId = params.get("id");

  const [state, setState] = useState<PageState>("loading");
  const [alert, setAlert] = useState<AlertData | null>(null);
  const [resolving, setResolving] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const resolveAlert = async () => {
    if (!alertId || resolving) return;
    setResolving(true);
    try {
      await supabase.rpc("resolve_alert_by_id", { p_alert_id: alertId });
      setState("resolved");
      setAlert((prev) => prev ? { ...prev, status: "dismissed" } : prev);
    } finally {
      setResolving(false);
    }
  };

  const load = async () => {
    if (!alertId) { setState("not_found"); return; }

    const { data, error } = await supabase.rpc("get_alert_view_data", { p_alert_id: alertId });
    if (error || !data || (data as unknown[]).length === 0) {
      setState("not_found");
      return;
    }

    const row = (data as AlertData[])[0];
    setAlert(row);
    setState(row.status === "dismissed" ? "resolved" : "active");
  };

  useEffect(() => {
    void load();
    // Poll every 5s so driver-side dismiss reflects on the guardian's screen quickly
    const interval = setInterval(() => void load(), 5_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId]);

  // Realtime subscription for instant dismiss detection
  useEffect(() => {
    if (!alertId) return;
    const ch = supabase
      .channel(`alert-view-${alertId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "emergency_alert_events", filter: `id=eq.${alertId}` },
        (payload) => {
          const row = payload.new as { status?: string };
          if (row.status === "dismissed") {
            setState("resolved");
            setAlert((prev) => prev ? { ...prev, status: "dismissed" } : prev);
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId]);

  // Fly to location when alert loads
  useEffect(() => {
    if (alert?.location_lat && alert?.location_lng && mapRef.current) {
      mapRef.current.flyTo({
        center: [alert.location_lng, alert.location_lat],
        zoom: 15,
        duration: 1200,
      });
    }
  }, [alert]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading alert…</p>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────

  if (state === "not_found" || !alert) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto">
            <span className="text-3xl">🔍</span>
          </div>
          <h1 className="text-xl font-bold text-white">Alert not found</h1>
          <p className="text-slate-400 text-sm">
            This link may have expired or the alert has been removed.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[9px] font-black text-white">SG</div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">SnoozeGuard</span>
          </div>
        </div>
      </div>
    );
  }

  const isActive = state === "active";
  const hasLocation = alert.location_lat != null && alert.location_lng != null;
  const mapsUrl = hasLocation
    ? `https://maps.google.com/?q=${alert.location_lat!.toFixed(6)},${alert.location_lng!.toFixed(6)}`
    : null;
  const callHref = alert.driver_phone ? `tel:${alert.driver_phone}` : null;
  const smsHref = alert.driver_phone
    ? `sms:${alert.driver_phone}?body=${encodeURIComponent("SnoozeGuard Alert: I received your emergency alert. Are you OK? Please respond.")}`
    : null;

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={`px-5 py-4 flex items-center justify-between ${isActive ? "bg-red-950/60 border-b border-red-900/40" : "bg-[#1a1a1a] border-b border-white/5"}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black text-white">SG</div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase">SnoozeGuard</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isActive && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? "text-red-400" : "text-slate-500"}`}>
            {isActive ? "Active Alert" : "Resolved"}
          </span>
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────────────────────── */}
      <div className="relative h-64 sm:h-80 flex-shrink-0">
        {hasLocation ? (
          <>
            <Map
              mapLib={mapboxgl}
              initialViewState={{
                latitude: alert.location_lat!,
                longitude: alert.location_lng!,
                zoom: 14,
              }}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
              style={{ width: "100%", height: "100%" }}
              onLoad={(e) => { mapRef.current = e.target; }}
            >
              <Marker latitude={alert.location_lat!} longitude={alert.location_lng!}>
                <div className="relative flex items-center justify-center">
                  {isActive && (
                    <div className="absolute w-12 h-12 rounded-full bg-red-500/30 animate-ping" />
                  )}
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black shadow-lg ${isActive ? "bg-red-600 border-red-400 text-white shadow-red-500/50" : "bg-slate-600 border-slate-400 text-white"}`}>
                    {nameInitials(alert.driver_name)}
                  </div>
                </div>
              </Marker>
            </Map>
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.6))]" />
          </>
        ) : (
          <div className="h-full bg-[#1a1a1a] flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">📍</span>
            <p className="text-slate-500 text-sm">Location unavailable</p>
          </div>
        )}
      </div>

      {/* ── Card ───────────────────────────────────────────────────────── */}
      <div className="flex-1 p-5 space-y-4 max-w-md mx-auto w-full">

        {/* Driver info */}
        <div className="bg-[#1a1a1a] rounded-2xl p-4 flex items-center gap-4 border border-white/5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base shrink-0 ${isActive ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-slate-300"}`}>
            {nameInitials(alert.driver_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base truncate">{alert.driver_name}</p>
            <p className={`text-xs font-semibold ${isActive ? "text-red-400" : "text-slate-500"}`}>
              {isActive ? "🚨 Needs immediate attention" : "✓ Alert resolved"}
            </p>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1a1a1a] rounded-xl p-3 border border-white/5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">Time</p>
            <p className="text-white text-xs font-mono">{formatTime(alert.created_at)}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-3 border border-white/5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">Status</p>
            <p className={`text-xs font-bold ${isActive ? "text-red-400" : "text-slate-400"}`}>
              {isActive ? "Active" : "Resolved"}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          {callHref && (
            <a
              href={callHref}
              className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm ${isActive ? "bg-red-600 text-white" : "bg-slate-700 text-white"}`}
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
              Call {alert.driver_name.split(" ")[0]}
            </a>
          )}
          {smsHref && (
            <a
              href={smsHref}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm bg-[#1e1e1e] text-slate-300 border border-white/10"
            >
              <span className="material-symbols-outlined text-lg">chat</span>
              Send SMS
            </a>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm bg-[#1e1e1e] text-blue-400 border border-blue-900/40"
            >
              <span className="material-symbols-outlined text-lg">open_in_new</span>
              Open in Google Maps
            </a>
          )}
        </div>

        {/* Mark as Resolved */}
        {isActive && (
          <button
            onClick={() => void resolveAlert()}
            disabled={resolving}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm bg-[#1e1e1e] text-emerald-400 border border-emerald-900/40 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            {resolving ? "Marking as resolved…" : "Mark as Resolved — Driver is Safe"}
          </button>
        )}

        {/* Auto-refresh note */}
        {isActive && (
          <p className="text-center text-[10px] text-slate-600">
            This page refreshes automatically every 5 seconds.
          </p>
        )}

        <p className="text-center text-[10px] text-slate-700 pb-2">
          SnoozeGuard — Driver Safety System
        </p>
      </div>
    </div>
  );
}
