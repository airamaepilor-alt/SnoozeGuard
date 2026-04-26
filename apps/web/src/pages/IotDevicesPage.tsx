import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

type IotDevice = {
  user_id: string;
  device_id: string;
  last_seen: string | null;
  created_at: string;
};

export function IotDevicesPage() {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  const [devices, setDevices] = useState<IotDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDeviceId, setNewDeviceId] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Load devices
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

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`iot-devices-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_iot_devices",
          filter: `user_id=eq.${user.id}`,
        },
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

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const isConnected = useCallback((lastSeen: string | null): boolean => {
    if (!lastSeen) return false;
    const elapsed = Date.now() - new Date(lastSeen).getTime();
    return elapsed < 15_000; // Connected if seen within 15 seconds
  }, []);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newDeviceId.trim()) {
      setError("Device ID cannot be empty");
      return;
    }

    const trimmedId = newDeviceId.trim().toLowerCase();

    try {
      setAdding(true);
      setError(null);
      setMessage(null);

      // Check if device already exists
      if (devices.some((d) => d.device_id.toUpperCase() === trimmedId)) {
        setError("This device is already paired");
        return;
      }

      // Upsert device
      const { error: err } = await supabase.from("user_iot_devices").upsert(
        {
          user_id: user.id,
          device_id: trimmedId,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (err) throw err;

      setMessage({ text: `Device "${trimmedId}" paired successfully!`, ok: true });
      setNewDeviceId("");
    } catch (e) {
      console.error("Failed to add device:", e);
      setError(e instanceof Error ? e.message : "Failed to pair device");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!user) return;

    try {
      const { error: err } = await supabase
        .from("user_iot_devices")
        .delete()
        .eq("user_id", user.id)
        .eq("device_id", deviceId);

      if (err) throw err;
      setMessage({ text: `Device "${deviceId}" removed.`, ok: true });
    } catch (e) {
      console.error("Failed to remove device:", e);
      setError(e instanceof Error ? e.message : "Failed to remove device");
    }
  };

  return (
    <div className="min-h-dvh bg-surface text-on-surface pt-6">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-headline font-bold tracking-tighter mb-2">IoT Device Management</h1>
          <p className="text-slate-400">Connect and manage your SnoozeGuard IoT buzzer devices</p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-4 bg-error/10 text-error rounded-lg border border-error/20">
            <span className="material-symbols-outlined text-sm align-text-bottom mr-2">error</span>
            {error}
          </div>
        )}
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg border ${
              message.ok
                ? "bg-success/10 text-success border-success/20"
                : "bg-error/10 text-error border-error/20"
            }`}
          >
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

        {/* Add Device Form */}
        <div className="bg-surface-container rounded-xl border border-outline-variant/20 p-6 mb-8">
          <h2 className="text-xl font-headline font-bold mb-4">Pair New Device</h2>
          <form onSubmit={handleAddDevice} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Device ID</label>
              <input
                type="text"
                value={newDeviceId}
                onChange={(e) => setNewDeviceId(e.target.value)}
                placeholder="e.g., esp32cam-001"
                disabled={adding || !isOnline}
                className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter the unique device ID printed on your IoT device or shown in its status LED display.
              </p>
            </div>

            <button
              type="submit"
              disabled={adding || !newDeviceId.trim() || !isOnline}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-headline font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                add
              </span>
              {adding ? "Pairing..." : "Pair Device"}
            </button>
          </form>
        </div>

        {/* Devices List */}
        <div>
          <h2 className="text-xl font-headline font-bold mb-4">Your Devices</h2>

          {loading ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-slate-400 animate-spin inline-block mb-2">
                refresh
              </span>
              <p className="text-slate-400">Loading devices...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12 bg-surface-container rounded-xl border border-outline-variant/20">
              <span className="material-symbols-outlined text-5xl text-slate-500 mb-2">devices_other</span>
              <p className="text-slate-400 mb-2">No devices paired yet</p>
              <p className="text-xs text-slate-500">Start by entering your device ID above to pair your first buzzer.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
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
                      {/* Status Indicator */}
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            online ? "bg-success animate-pulse" : "bg-outline-variant"
                          }`}
                        />
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                          {online ? "Online" : "Offline"}
                        </span>
                      </div>

                      {/* Device Info */}
                      <div className="flex-1">
                        <h3 className="font-headline font-bold text-base">{device.device_id}</h3>
                        <div className="flex gap-4 text-xs text-slate-400 mt-1">
                          <span>
                            <span className="material-symbols-outlined text-[12px] align-text-bottom mr-1">
                              schedule
                            </span>
                            Last seen: {lastSeenTime}
                          </span>
                          <span>
                            <span className="material-symbols-outlined text-[12px] align-text-bottom mr-1">
                              calendar_today
                            </span>
                            Paired: {new Date(device.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Remove Button */}
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

        {/* Info Section */}
        <div className="mt-8 bg-primary/5 rounded-xl border border-primary/20 p-6">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-primary mt-1 shrink-0">info</span>
            <div>
              <h3 className="font-semibold mb-2">How to find your Device ID</h3>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Check the physical label on your IoT device enclosure</li>
                <li>• Look at the LED status display during device startup</li>
                <li>• Check your device configuration screen (if applicable)</li>
                <li>• Contact your fleet manager for device assignments</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
