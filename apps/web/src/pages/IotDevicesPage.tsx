import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

type IotDevice = {
  user_id: string;
  device_id: string;
  last_seen: string | null;
  created_at: string;
  status: "pending" | "accepted";
  requested_email: string | null;
};

export function IotDevicesPage() {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  const [devices, setDevices] = useState<IotDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadDevices = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from("user_iot_devices")
          .select("*")
          .eq("user_id", user.id);
        if (err) throw err;
        setDevices(data || []);
      } catch (e) {
        console.error("Failed to load IoT devices:", e);
        setError("Failed to load devices");
      } finally {
        setLoading(false);
      }
    };

    loadDevices();

    const channel = supabase
      .channel(`iot-devices-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_iot_devices", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setDevices((prev) => prev.filter((d) => d.device_id !== payload.old.device_id));
          } else if (payload.eventType === "INSERT") {
            setDevices((prev) => [...prev, payload.new as IotDevice]);
          } else if (payload.eventType === "UPDATE") {
            setDevices((prev) =>
              prev.map((d) => (d.device_id === payload.new.device_id ? (payload.new as IotDevice) : d))
            );
          }
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const isConnected = useCallback((lastSeen: string | null): boolean => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 15_000;
  }, []);

  const handleAccept = async (deviceId: string) => {
    try {
      setAccepting(deviceId);
      setError(null);
      setMessage(null);
      const { error: err } = await supabase.rpc("accept_device_link", { p_device_id: deviceId });
      if (err) throw err;
      setMessage({ text: `Device "${deviceId}" linked successfully!`, ok: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept link request");
    } finally {
      setAccepting(null);
    }
  };

  const handleReject = async (deviceId: string) => {
    if (!user) return;
    try {
      setError(null);
      const { error: err } = await supabase
        .from("user_iot_devices")
        .delete()
        .eq("user_id", user.id)
        .eq("device_id", deviceId);
      if (err) throw err;
      setMessage({ text: `Link request from "${deviceId}" rejected.`, ok: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject link request");
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!user) return;
    try {
      setError(null);
      const { error: err } = await supabase
        .from("user_iot_devices")
        .delete()
        .eq("user_id", user.id)
        .eq("device_id", deviceId);
      if (err) throw err;
      setMessage({ text: `Device "${deviceId}" removed.`, ok: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove device");
    }
  };

  const pending  = devices.filter((d) => d.status === "pending");
  const accepted = devices.filter((d) => d.status === "accepted");

  return (
    <div className="min-h-dvh bg-surface text-on-surface pt-6">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-headline font-bold tracking-tighter mb-2">IoT Device Management</h1>
          <p className="text-slate-400">Manage your SnoozeGuard IoT buzzer devices</p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-4 bg-error/10 text-error rounded-lg border border-error/20">
            <span className="material-symbols-outlined text-sm align-text-bottom mr-2">error</span>
            {error}
          </div>
        )}
        {message && (
          <div className={`mb-4 p-4 rounded-lg border ${message.ok ? "bg-success/10 text-success border-success/20" : "bg-error/10 text-error border-error/20"}`}>
            <span className="material-symbols-outlined text-sm align-text-bottom mr-2">
              {message.ok ? "check_circle" : "error"}
            </span>
            {message.text}
          </div>
        )}
        {!isOnline && (
          <div className="mb-4 p-4 bg-warning/10 text-warning rounded-lg border border-warning/20">
            <span className="material-symbols-outlined text-sm align-text-bottom mr-2">cloud_off</span>
            You are offline. Device list may be outdated.
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-slate-400 animate-spin inline-block mb-2">refresh</span>
            <p className="text-slate-400">Loading devices...</p>
          </div>
        ) : (
          <>
            {/* Pending Link Requests */}
            {pending.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-headline font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-warning">device_unknown</span>
                  Pending Link Requests
                  <span className="ml-auto text-xs font-sans font-normal bg-warning/10 text-warning border border-warning/20 px-2 py-0.5 rounded-full">
                    {pending.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {pending.map((device) => (
                    <div
                      key={device.device_id}
                      className="bg-surface-container rounded-xl border border-warning/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-headline font-bold text-base font-mono">{device.device_id}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            <span className="material-symbols-outlined text-[12px] align-text-bottom mr-1">mail</span>
                            Requested via {device.requested_email ?? "unknown email"}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            <span className="material-symbols-outlined text-[12px] align-text-bottom mr-1">schedule</span>
                            {new Date(device.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleAccept(device.device_id)}
                            disabled={accepting === device.device_id || !isOnline}
                            className="px-3 py-1.5 bg-success/10 text-success border border-success/20 rounded-lg text-xs font-bold hover:bg-success/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {accepting === device.device_id ? "Accepting..." : "Accept"}
                          </button>
                          <button
                            onClick={() => handleReject(device.device_id)}
                            disabled={!isOnline}
                            className="px-3 py-1.5 bg-error/10 text-error border border-error/20 rounded-lg text-xs font-bold hover:bg-error/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accepted Devices */}
            <div>
              <h2 className="text-xl font-headline font-bold mb-4">Your Devices</h2>
              {accepted.length === 0 ? (
                <div className="text-center py-12 bg-surface-container rounded-xl border border-outline-variant/20">
                  <span className="material-symbols-outlined text-5xl text-slate-500 mb-2">devices_other</span>
                  <p className="text-slate-400 mb-1">No devices linked yet</p>
                  <p className="text-xs text-slate-500">Power on your IoT device and follow the setup steps below.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accepted.map((device) => {
                    const online = isConnected(device.last_seen);
                    const lastSeenTime = device.last_seen
                      ? new Date(device.last_seen).toLocaleTimeString()
                      : "Never";
                    return (
                      <div
                        key={device.device_id}
                        className="bg-surface-container rounded-xl border border-outline-variant/20 p-4 flex items-center justify-between hover:border-outline-variant/40 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`w-3 h-3 rounded-full ${online ? "bg-success animate-pulse" : "bg-outline-variant"}`} />
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                              {online ? "Online" : "Offline"}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-headline font-bold text-base">{device.device_id}</h3>
                            <div className="flex gap-4 text-xs text-slate-400 mt-1">
                              <span>
                                <span className="material-symbols-outlined text-[12px] align-text-bottom mr-1">schedule</span>
                                Last seen: {lastSeenTime}
                              </span>
                              <span>
                                <span className="material-symbols-outlined text-[12px] align-text-bottom mr-1">calendar_today</span>
                                Linked: {new Date(device.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveDevice(device.device_id)}
                          disabled={!isOnline}
                          className="ml-4 p-2 text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove device"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Setup Instructions */}
        <div className="mt-8 bg-primary/5 rounded-xl border border-primary/20 p-6">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-primary mt-1 shrink-0">info</span>
            <div>
              <h3 className="font-semibold mb-2">How to link your IoT device</h3>
              <ol className="text-sm text-slate-400 space-y-1 list-none">
                <li>1. Power on your SnoozeGuard IoT device</li>
                <li>2. Connect your phone to the <span className="font-mono text-slate-300">SG-…</span> WiFi hotspot it creates</li>
                <li>3. Open <span className="font-mono text-slate-300">192.168.4.1</span> in your browser</li>
                <li>4. Enter <strong>your account email</strong>, your WiFi credentials, and save</li>
                <li>5. A link request will appear above — tap <strong>Accept</strong></li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
