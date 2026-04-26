import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

type IotDevice = {
  user_id: string;
  device_id: string;
  last_seen: string | null;
  created_at: string;
};

interface IotDeviceStatusProps {
  userId?: string;
  compact?: boolean;
  showManageLink?: boolean;
}

/**
 * Displays the current paired IoT device status (online/offline)
 * Used in Drive page or other locations to show device health
 */
export function IotDeviceStatus({ userId, compact = false, showManageLink = true }: IotDeviceStatusProps) {
  const [device, setDevice] = useState<IotDevice | null>(null);
  const [, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const loadDevice = async () => {
      try {
        setLoading(true);
        const { data } = await supabase
          .from("user_iot_devices")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        setDevice(data || null);
      } catch (e) {
        console.error("Failed to load IoT device:", e);
      } finally {
        setLoading(false);
      }
    };

    loadDevice();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`iot-device-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_iot_devices",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setDevice(null);
          } else {
            setDevice(payload.new as IotDevice);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const isConnected = useCallback((lastSeen: string | null): boolean => {
    if (!lastSeen) return false;
    const elapsed = Date.now() - new Date(lastSeen).getTime();
    return elapsed < 15_000; // Connected if seen within 15 seconds
  }, []);

  if (!userId || !device) {
    return null;
  }

  const online = isConnected(device.last_seen);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold">
        <div
          className={`w-2 h-2 rounded-full ${online ? "bg-success animate-pulse" : "bg-outline-variant"}`}
        />
        <span className="text-slate-400">{online ? "IoT" : "IoT Offline"}</span>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-lg border border-outline-variant/20 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${online ? "bg-success animate-pulse" : "bg-outline-variant"}`}
          />
          <div>
            <h3 className="font-headline font-bold text-sm">{device.device_id}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {online ? "● Online" : "○ Offline"}
            </p>
          </div>
        </div>

        {showManageLink && (
          <a
            href="/iot-devices"
            className="text-xs text-primary hover:underline font-semibold"
          >
            Manage
          </a>
        )}
      </div>
    </div>
  );
}
