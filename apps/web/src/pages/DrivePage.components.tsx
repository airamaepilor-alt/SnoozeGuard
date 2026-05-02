import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// ─── IotDevicePanel ───────────────────────────────────────────────────────────

export function IotDevicePanel({
  userId,
  onDeviceBound,
}: {
  userId: string | undefined;
  onDeviceBound: (deviceId: string | null) => void;
}) {
  const [deviceId, setDeviceId] = useState("");
  const [savedDeviceId, setSavedDeviceId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isConnected = lastSeen !== null && Date.now() - new Date(lastSeen).getTime() < 15_000;

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("user_iot_devices")
      .select("device_id, last_seen")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setSavedDeviceId(data.device_id);
      setDeviceId(data.device_id);
      setLastSeen(data.last_seen ?? null);
      onDeviceBound(data.device_id);
    }
  }, [userId, onDeviceBound]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: refresh last_seen whenever the heartbeat updates the row
  useEffect(() => {
    if (!userId) return;
    channelRef.current = supabase
      .channel(`iot-device-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_iot_devices", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { device_id: string; last_seen: string | null };
          setLastSeen(row.last_seen ?? null);
        },
      )
      .subscribe();
    return () => {
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
    };
  }, [userId]);

  const linkDevice = async () => {
    if (!userId || !deviceId.trim()) return;
    setSaving(true);
    setLinkError(null);
    const { error } = await supabase.rpc("pair_iot_device", {
      p_device_id: deviceId.trim().toLowerCase(),
    });
    if (!error) {
      setSavedDeviceId(deviceId.trim().toLowerCase());
      onDeviceBound(deviceId.trim().toLowerCase());
    } else {
      setLinkError(error.message);
    }
    setSaving(false);
  };

  const unlinkDevice = async () => {
    if (!userId) return;
    await supabase.from("user_iot_devices").delete().eq("user_id", userId);
    setSavedDeviceId(null);
    setDeviceId("");
    setLastSeen(null);
    onDeviceBound(null);
  };

  return (
    <div className="border border-outline-variant/10 rounded-2xl p-4 bg-surface-container-lowest">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-bold text-on-surface-variant tracking-widest uppercase">
          IoT Buzzer Device
        </span>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              savedDeviceId
                ? isConnected
                  ? "bg-primary shadow-[0_0_6px_rgba(123,208,255,0.7)]"
                  : "bg-outline-variant"
                : "bg-outline-variant/40"
            }`}
          />
          <span className={`text-[9px] font-bold ${savedDeviceId ? (isConnected ? "text-primary" : "text-on-surface-variant") : "text-on-surface-variant/40"}`}>
            {savedDeviceId ? (isConnected ? "Connected" : "Disconnected") : "No device"}
          </span>
        </div>
      </div>

      {savedDeviceId ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface font-mono flex-1 truncate">{savedDeviceId}</span>
            <button
              onClick={() => void unlinkDevice()}
              className="text-[10px] font-bold text-on-surface-variant hover:text-tertiary transition-colors"
            >
              Unlink
            </button>
          </div>
          {!import.meta.env.VITE_API_URL && (
            <p className="text-[9px] text-secondary leading-tight">
              ⚠ VITE_API_URL not set — buzzer signal will not reach device.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="Device ID (e.g. esp32cam-001)"
              className="flex-1 bg-surface-container-high text-on-surface text-xs rounded-lg px-3 py-2 border border-outline-variant/20 outline-none focus:border-primary/40"
            />
            <button
              onClick={() => void linkDevice()}
              disabled={saving || !deviceId.trim()}
              className="px-3 py-2 bg-primary/10 text-primary text-xs font-bold rounded-lg border border-primary/20 hover:bg-primary/20 transition-all disabled:opacity-40"
            >
              {saving ? "…" : "Link"}
            </button>
          </div>
          {linkError && (
            <p className="text-[10px] text-error mt-1">{linkError}</p>
          )}
        </>
      )}
    </div>
  );
}

function getAlertHint(level: number): string {
  if (level === 6) return "Stay alert and active — you can continue driving.";
  if (level === 7) return "Consider pulling over and taking a rest break.";
  if (level === 8) return "Please pull over and rest now.";
  if (level === 9) return "Pull over immediately. Emergency contact will be notified.";
  if (level >= 10) return "EMERGENCY — Pull over and rest immediately!";
  return "Stay alert.";
}

export function DrowsinessAlertOverlay({
  open,
  level,
  title,
  actionsSummary,
  onDismiss,
  flash,
  emergencyContact,
  ecCountdown,
  ecSent,
  onNotifyNow,
}: {
  open: boolean;
  level: number;
  title: string;
  actionsSummary?: string;
  onDismiss: () => void;
  flash?: boolean;
  elapsedMs?: number;
  emergencyContact?: { contact_name: string; contact_phone: string | null } | null;
  ecCountdown?: number | null;
  ecSent?: boolean;
  onNotifyNow?: () => void;
}) {
  if (!open) return null;

  const hint = getAlertHint(level);
  const levelColor =
    level >= 10
      ? "text-red-400"
      : level >= 8
        ? "text-tertiary"
        : level >= 6
          ? "text-secondary"
          : "text-on-surface";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        flash ? "bg-tertiary/10" : "bg-black/85"
      }`}
    >
      {flash && (
        <>
          <div className="absolute top-0 left-0 right-0 h-2 bg-tertiary animate-pulse" />
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-tertiary animate-pulse" />
        </>
      )}

      <div className="bg-background rounded-3xl p-8 max-w-md w-full mx-4 text-center flex flex-col items-center gap-4 shadow-2xl border border-outline-variant/20">
        <p className="text-[10px] font-black tracking-[0.3em] text-tertiary uppercase">
          Drowsiness Alert
        </p>

        <p className={`text-8xl font-extrabold font-headline leading-none ${levelColor}`}>
          {level}
        </p>

        <div className="w-full h-px bg-outline-variant/20" />

        <p className="text-lg font-semibold text-primary w-full">{title}</p>
        <p className="text-sm text-on-surface-variant leading-relaxed">{hint}</p>

        {actionsSummary && (
          <p className="text-[10px] text-slate-500 font-mono">
            Actions: {actionsSummary}
          </p>
        )}

        {level >= 9 && (
          <div className="w-full bg-tertiary/10 border border-tertiary/30 rounded-2xl p-4 text-left">
            {ecCountdown !== null && ecCountdown !== undefined ? (
              <p className="text-sm font-bold text-tertiary text-center mb-3">
                Auto-notifying emergency contact in {ecCountdown}s
              </p>
            ) : ecSent ? (
              <p className="text-sm font-bold text-green-400 text-center mb-3">
                Emergency contact has been notified.
              </p>
            ) : null}
            {emergencyContact && (
              <div className="flex gap-2 flex-wrap">
                {emergencyContact.contact_phone && (
                  <a
                    href={`tel:${emergencyContact.contact_phone}`}
                    className="flex-1 text-center py-2 bg-green-500/20 border border-green-500/40 rounded-xl text-xs font-bold text-on-surface min-w-0"
                  >
                    📞 Call {emergencyContact.contact_name}
                  </a>
                )}
                {emergencyContact.contact_phone && (
                  <a
                    href={`sms:${emergencyContact.contact_phone}?body=URGENT: I triggered a drowsiness alert on SnoozeGuard. Please check on me or call me immediately.`}
                    className="flex-1 text-center py-2 bg-primary/20 border border-primary/40 rounded-xl text-xs font-bold text-on-surface min-w-0"
                  >
                    💬 SMS
                  </a>
                )}
                {onNotifyNow && (
                  <button
                    onClick={onNotifyNow}
                    className="flex-1 py-2 bg-tertiary/20 border border-tertiary/40 rounded-xl text-xs font-bold text-on-surface min-w-0"
                  >
                    🚨 Notify Now
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onDismiss}
          className="mt-2 w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-sm active:scale-95 transition-all hover:opacity-90"
        >
          I'm alert — dismiss
        </button>
      </div>
    </div>
  );
}
