import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  type AlertMap,
  DEFAULT_ALERT_MAP,
  parseAlertMap,
} from "@snoozeguard/shared";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const ACTION_OPTIONS = ["sound", "voice", "vibration", "flashlight", "alarm", "iot_led"] as const;

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
    <label className="block text-sm text-zinc-400">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono text-zinc-200">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-sky-500"
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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("admin_config").select("*").eq("id", 1).maybeSingle();
      if (!cancelled) {
        if (!error && data) {
          const c = data as Config;
          setCfg(c);
          setAlertMap(parseAlertMap(c.alert_map));
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    const { error } = await supabase
      .from("admin_config")
      .update({
        yawn_threshold: cfg.yawn_threshold,
        head_movement_threshold: cfg.head_movement_threshold,
        drowsiness_trigger_level: cfg.drowsiness_trigger_level,
        alert_map: alertMap,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", 1);
    setSaving(false);
    setMessage(error ? error.message : "Saved.");
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
    return <p className="text-zinc-400">Loading admin config…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Admin configuration</h1>
      <p className="text-sm text-zinc-500">
        Thresholds drive when drowsiness scoring counts as an event; alert map defines responses for bands 6–8 (aligned with BRD §13).
      </p>
      <form onSubmit={onSave} className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
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

        <div className="border-t border-zinc-800 pt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Alert map (levels 6–8)</h2>
            <button
              type="button"
              onClick={resetAlertMap}
              className="rounded-lg border border-zinc-600 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Reset defaults
            </button>
          </div>
          <div className="space-y-4">
            {levelKeys.map((k) => {
              const row = alertMap[k] ?? { label: "", actions: [] as string[] };
              return (
                <div key={k} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase text-sky-400">Level {k}</span>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        setAlertMap((prev) => ({
                          ...prev,
                          [k]: { ...row, label: e.target.value },
                        }))
                      }
                      className="min-w-[12rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
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
                            on ? "bg-sky-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
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

        {message ? <p className="text-sm text-amber-300">{message}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-sky-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
