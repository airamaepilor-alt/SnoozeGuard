import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  type AlertMap,
  DEFAULT_ALERT_MAP,
  parseAlertMap,
} from "@snoozeguard/shared";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const ACTION_OPTIONS = ["voice", "vibration", "alarm", "iot_led", "iot_buzzer"] as const;

type Config = {
  yawn_threshold: number;
  head_movement_threshold: number;
  drowsiness_trigger_level: number;
  alert_map: unknown;
};

function SliderRow(props: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const { label, min, max, value, onChange } = props;
  return (
    <label className="block text-sm text-on-surface-variant">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono text-on-surface">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
      />
    </label>
  );
}

export function AdminPage() {
  const { profile, user } = useAuth();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [alertMap, setAlertMap] = useState<AlertMap>(() => ({ ...DEFAULT_ALERT_MAP }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      console.log("[AdminPage] loading config…");
      const { data, error } = await supabase.from("admin_config").select("*").eq("id", 1).maybeSingle();
      console.log("[AdminPage] load result:", { data, error });
      if (!cancelled) {
        if (!error && data) {
          const c = data as Config;
          setCfg(c);
          setAlertMap(parseAlertMap(c.alert_map));
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const levelKeys = useMemo(() => ["6", "7", "8"] as const, []);

  if (profile?.role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!cfg || !user) return;
    setSaving(true);
    setMessage(null);

    const payload = {
      p_yawn_threshold: cfg.yawn_threshold,
      p_head_movement_threshold: cfg.head_movement_threshold,
      p_drowsiness_trigger_level: cfg.drowsiness_trigger_level,
      p_alert_map: alertMap,
      p_updated_by: user.id,
    };
    console.log("[AdminPage] saving config via RPC:", payload);
    console.log("[AdminPage] current user id:", user.id, "role:", profile?.role);

    const { data, error } = await supabase.rpc("update_admin_config", payload);
    console.log("[AdminPage] RPC result:", { data, error });

    setSaving(false);
    if (error) {
      console.error("[AdminPage] save failed:", error.code, error.message, error.details, error.hint);
      setMessage({ text: `Error: ${error.message}`, ok: false });
    } else {
      setMessage({ text: "Saved successfully.", ok: true });
    }
  }

  function resetAlertMap() {
    setAlertMap({ ...DEFAULT_ALERT_MAP });
    setMessage("Alert map reset to defaults (save to persist).");
  }

  function toggleAction(levelKey: string, action: string) {
    setAlertMap((prev) => {
      const row = prev[levelKey] ?? { label: `Level ${levelKey}`, actions: [] };
      const set = new Set(row.actions);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      return {
        ...prev,
        [levelKey]: { ...row, actions: Array.from(set) },
      };
    });
  }

  if (loading || !cfg) {
    return <p className="text-on-surface-variant">Loading admin config…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 font-body text-on-surface">
      <h1 className="font-headline text-2xl font-extrabold text-on-surface">Admin configuration</h1>
      <p className="text-sm text-on-surface-variant">
        Thresholds drive when drowsiness scoring counts as an event; alert map defines responses for bands 6–8 (aligned with BRD §13).
      </p>
      <form onSubmit={onSave} className="space-y-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low/90 p-6 shadow-sm shadow-black/20">
        <div className="space-y-5">
          <SliderRow
            label="Yawn threshold"
            min={1}
            max={20}
            value={cfg.yawn_threshold}
            onChange={(n) => setCfg({ ...cfg, yawn_threshold: n })}
          />
          <SliderRow
            label="Head movement threshold"
            min={1}
            max={100}
            value={cfg.head_movement_threshold}
            onChange={(n) => setCfg({ ...cfg, head_movement_threshold: n })}
          />
          <SliderRow
            label="Drowsiness trigger level"
            min={1}
            max={10}
            value={cfg.drowsiness_trigger_level}
            onChange={(n) => setCfg({ ...cfg, drowsiness_trigger_level: n })}
          />
        </div>

        <div className="border-t border-outline-variant/20 pt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Alert map (levels 6–8)</h2>
            <button
              type="button"
              onClick={resetAlertMap}
              className="rounded-lg border border-outline-variant/40 px-3 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high"
            >
              Reset defaults
            </button>
          </div>
          <div className="space-y-4">
            {levelKeys.map((k) => {
              const row = alertMap[k] ?? { label: "", actions: [] as string[] };
              return (
                <div key={k} className="rounded-xl border border-outline-variant/15 bg-surface-container/80 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase text-primary">Level {k}</span>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        setAlertMap((prev) => ({
                          ...prev,
                          [k]: { ...row, label: e.target.value },
                        }))
                      }
                      className="min-w-[12rem] flex-1 rounded-lg border border-outline-variant/40 bg-background/60 px-3 py-1.5 text-sm text-on-surface"
                      placeholder="Label shown in alerts"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ACTION_OPTIONS.map((a) => {
                      const on = row.actions.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => toggleAction(k, a)}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            on ? "bg-primary text-on-primary shadow-md shadow-primary/20" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-bright"
                          }`}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {message ? (
          <p className={`rounded-lg px-4 py-2 text-sm font-medium ${message.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {message.text}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-gradient-to-br from-primary to-on-primary-container py-3 font-headline font-bold text-on-primary shadow-lg shadow-primary/15 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </form>
    </div>
  );
}
