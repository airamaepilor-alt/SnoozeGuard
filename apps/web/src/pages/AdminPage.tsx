import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  type AlertMap,
  DEFAULT_ALERT_MAP,
  parseAlertMap,
} from "@snoozeguard/shared";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const ACTION_OPTIONS = ["voice", "vibration", "iot_led", "iot_buzzer"] as const;

const ACTION_ICONS: Record<string, string> = {
  voice: "record_voice_over",
  vibration: "vibration",
  iot_led: "lightbulb",
  iot_buzzer: "settings_input_antenna",
};

const LEVEL_META: Record<string, {
  numberColor: string;
  borderColor: string;
  severity: string;
  description: string;
  hasBgTint?: boolean;
}> = {
  "6": { numberColor: "text-emerald-500", borderColor: "border-emerald-500", severity: "Mild", description: "Early fatigue markers detected." },
  "7": { numberColor: "text-yellow-500", borderColor: "border-yellow-500", severity: "Moderate", description: "Repeated closing of eyes detected." },
  "8": { numberColor: "text-orange-500", borderColor: "border-orange-500", severity: "Severe", description: "Inattentiveness for > 3 seconds." },
  "9": { numberColor: "text-error", borderColor: "border-error", severity: "Severe pull-over", description: "Micro-sleep event confirmed by IR." },
  "10": { numberColor: "text-error", borderColor: "border-error", severity: "Critical stop", description: "Total system override. Device lockdown.", hasBgTint: true },
};

type Config = {
  yawn_threshold: number;
  head_movement_threshold: number;
  drowsiness_trigger_level: number;
  alert_map: unknown;
  score_reset_minutes?: number;
  sms_enabled?: boolean;
  sms_rate_limit_enabled?: boolean;
};

export function AdminPage() {
  const { profile, user } = useAuth();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [alertMap, setAlertMap] = useState<AlertMap>(() => ({ ...DEFAULT_ALERT_MAP }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [editingLevel, setEditingLevel] = useState<string | null>(null);
  const [scoreResetMinutes, setScoreResetMinutes] = useState(2);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsRateLimitEnabled, setSmsRateLimitEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("admin_config").select("*").eq("id", 1).maybeSingle();
      if (!cancelled) {
        if (!error && data) {
          const c = data as Config;
          setCfg(c);
          setAlertMap(parseAlertMap(c.alert_map));
          setScoreResetMinutes(c.score_reset_minutes ?? 2);
          setSmsEnabled(c.sms_enabled ?? false);
          setSmsRateLimitEnabled(c.sms_rate_limit_enabled ?? true);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const levelKeys = useMemo(() => ["6", "7", "8", "9", "10"] as const, []);

  if (profile?.role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!cfg || !user) return;
    setSaving(true);
    setMessage(null);
    const lvl6 = alertMap["6"];
    const payload = {
      p_yawn_threshold: lvl6?.yawn_count ?? 1,
      p_head_movement_threshold: lvl6?.head_count ?? 20,
      p_drowsiness_trigger_level: 6,
      p_alert_map: alertMap,
      p_updated_by: user.id,
      p_score_reset_minutes: scoreResetMinutes,
      p_sms_enabled: smsEnabled,
      p_sms_rate_limit_enabled: smsRateLimitEnabled,
    };
    const { error } = await supabase.rpc("update_admin_config", payload);
    setSaving(false);
    if (error) {
      setMessage({ text: `Error: ${error.message}`, ok: false });
    } else {
      setMessage({ text: "Configuration deployed successfully.", ok: true });
    }
  }

  function resetAlertMap() {
    setAlertMap({ ...DEFAULT_ALERT_MAP });
    setMessage({ text: "Alert map reset to defaults — deploy to persist.", ok: true });
  }

  function toggleAction(levelKey: string, action: string) {
    setAlertMap((prev) => {
      const row = prev[levelKey] ?? { label: `Level ${levelKey}`, actions: [], yawn_count: 1, head_count: 20 };
      const set = new Set(row.actions);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      return { ...prev, [levelKey]: { ...row, actions: Array.from(set) } };
    });
  }

  function setLevelYawn(levelKey: string, value: number) {
    const clamped = Math.max(1, Math.min(99, value));
    setAlertMap((prev) => {
      const row = prev[levelKey] ?? { label: `Level ${levelKey}`, actions: [], yawn_count: 1, head_count: 20 };
      return { ...prev, [levelKey]: { ...row, yawn_count: clamped } };
    });
  }

  function setLevelHead(levelKey: string, value: number) {
    const clamped = Math.max(1, Math.min(999, value));
    setAlertMap((prev) => {
      const row = prev[levelKey] ?? { label: `Level ${levelKey}`, actions: [], yawn_count: 1, head_count: 20 };
      return { ...prev, [levelKey]: { ...row, head_count: clamped } };
    });
  }

  if (loading || !cfg) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-variant font-body">
        Loading admin config…
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="font-body text-on-surface max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface mb-2">
          Configuration <span className="text-primary">Console</span>
        </h1>
        <p className="text-on-surface-variant max-w-2xl text-sm">
          Modify global system behavior, alert thresholds, and integration parameters. All changes require a manual 'Deploy' to go live on sentinel devices.
        </p>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`rounded-xl px-5 py-3 text-sm font-medium ${message.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-error-container/30 text-error"}`}>
          {message.text}
        </div>
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Level-10 Score Reset */}
          <section className="bg-surface-container-low rounded-3xl p-7 sm:p-8 hover:bg-surface-container transition-colors">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-primary text-3xl">timer</span>
              <h2 className="font-headline text-xl font-bold text-on-surface">Score Reset</h2>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface-variant flex justify-between">
                  Reset drowsiness after (minutes)
                </label>
                <p className="text-[10px] text-on-surface-variant italic">
                  After the driver dismisses a level-10 alert and no new level-10 trigger fires within this time, all drowsiness accumulators reset to zero.
                </p>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={scoreResetMinutes}
                  onChange={(e) => setScoreResetMinutes(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                  className="w-full bg-surface-container-highest border-none rounded-xl text-on-surface px-4 py-3 focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Emergency SMS */}
          <section className="bg-surface-container-low rounded-3xl p-7 sm:p-8 hover:bg-surface-container transition-colors">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-primary text-3xl">cell_tower</span>
              <h2 className="font-headline text-xl font-bold text-on-surface">Emergency SMS</h2>
            </div>
            <div className="space-y-6">
              <p className="text-[10px] text-on-surface-variant">
                When enabled, an SMS is sent automatically to the emergency contact when a level 9/10 alert fires. API keys are configured in Supabase Edge Function secrets (TextBelt → Infobip → Semaphore fallback).
              </p>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-on-surface-variant">Enable auto SMS</label>
                <button
                  type="button"
                  onClick={() => setSmsEnabled(!smsEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsEnabled ? "bg-primary" : "bg-outline-variant/50"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-on-primary transition-transform ${smsEnabled ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-semibold text-on-surface-variant">Enable rate limit per user</label>
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    When enabled, only 1 SMS per phone number per day is sent. Disable if you don't need this limit.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSmsRateLimitEnabled(!smsRateLimitEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 flex-shrink-0 ${smsRateLimitEnabled ? "bg-primary" : "bg-outline-variant/50"}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-on-primary transition-transform ${smsRateLimitEnabled ? "translate-x-5" : "translate-x-0.5"}`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Action Library */}
          <section className="bg-primary-container rounded-3xl p-7 sm:p-8 border border-primary/10">
            <h3 className="font-label text-sm font-bold text-primary uppercase tracking-widest mb-6">Action Library</h3>
            <div className="flex flex-wrap gap-3">
              {ACTION_OPTIONS.map((action) => (
                <div
                  key={action}
                  className="flex items-center gap-2 bg-surface-container px-3 py-2 rounded-lg text-xs font-bold text-on-surface border border-outline-variant/20"
                >
                  <span className="material-symbols-outlined text-sm text-primary">{ACTION_ICONS[action]}</span>
                  {action}
                </div>
              ))}
            </div>
          </section>

          {/* Deploy Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[3.5rem] bg-primary text-on-primary-fixed font-headline font-extrabold text-base uppercase tracking-tight rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            {saving ? "Deploying…" : "Deploy Config"}
          </button>
        </div>

        {/* Right column: Alert Mapping */}
        <div className="lg:col-span-8">
          <section className="bg-surface-container-low rounded-3xl p-7 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-3xl">notifications_active</span>
                <h2 className="font-headline text-xl font-bold text-on-surface">Alert Mapping (Levels 6–10)</h2>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold bg-tertiary-container text-tertiary px-3 py-1 rounded-full">Vigilant v1.4</span>
                <button
                  type="button"
                  onClick={resetAlertMap}
                  className="text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant/30 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Reset defaults
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {levelKeys.map((k) => {
                const meta = LEVEL_META[k];
                const row = alertMap[k] ?? { label: `Level ${k}`, actions: [] as string[], yawn_count: 1, head_count: 20 };
                const isEditing = editingLevel === k;
                return (
                  <div
                    key={k}
                    className={`relative bg-surface-container-high p-4 sm:p-6 rounded-2xl hover:scale-[1.01] transition-transform border-l-4 ${meta.borderColor} ${meta.hasBgTint ? "overflow-hidden" : ""}`}
                  >
                    {meta.hasBgTint && (
                      <div className="absolute inset-0 bg-error/5 pointer-events-none" />
                    )}

                    {/* Top row: Level number, Label & description */}
                    <div className="flex gap-4 mb-3 relative">
                      {/* Level number */}
                      <div className="flex-shrink-0">
                        <span className={`text-lg sm:text-2xl font-black ${meta.numberColor} font-headline leading-none`}>
                          LVL {k}
                        </span>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase mt-0.5">{meta.severity}</p>
                      </div>

                      {/* Label & description */}
                      <div className="flex-1 space-y-1">
                        {isEditing ? (
                          <input
                            type="text"
                            value={row.label || `Level ${k}`}
                            onChange={(e) =>
                              setAlertMap((prev) => ({
                                ...prev,
                                [k]: { ...row, label: e.target.value },
                              }))
                            }
                            className="w-full bg-surface-container-highest rounded-lg px-2 py-1 text-xs text-on-surface border-none focus:ring-1 focus:ring-primary focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <p className="text-xs font-semibold text-on-surface truncate">{row.label || `Level ${k}`}</p>
                        )}
                        <p className="text-[10px] text-on-surface-variant">{meta.description}</p>
                      </div>
                    </div>

                    {/* Thresholds (when editing) */}
                    {isEditing && (
                      <div className="grid grid-cols-2 gap-4 px-4 py-3 bg-surface-container-highest rounded-lg mb-3 text-sm">
                        <div className="flex flex-col items-center gap-2">
                          <label className="text-[10px] font-semibold text-on-surface-variant">Yawns to reach</label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setLevelYawn(k, (row.yawn_count ?? 1) - 1)}
                              className="w-7 h-7 rounded bg-primary/20 text-primary font-bold hover:bg-primary/30 transition-colors"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-bold text-on-surface">{row.yawn_count ?? 1}</span>
                            <button
                              type="button"
                              onClick={() => setLevelYawn(k, (row.yawn_count ?? 1) + 1)}
                              className="w-7 h-7 rounded bg-primary/20 text-primary font-bold hover:bg-primary/30 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <label className="text-[10px] font-semibold text-on-surface-variant">Head moves to reach</label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setLevelHead(k, (row.head_count ?? 20) - 1)}
                              className="w-7 h-7 rounded bg-primary/20 text-primary font-bold hover:bg-primary/30 transition-colors"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-bold text-on-surface">{row.head_count ?? 20}</span>
                            <button
                              type="button"
                              onClick={() => setLevelHead(k, (row.head_count ?? 20) + 1)}
                              className="w-7 h-7 rounded bg-primary/20 text-primary font-bold hover:bg-primary/30 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bottom row: Actions and Edit button */}
                    <div className="flex items-end justify-between gap-4">
                      {/* Actions */}
                      <div className="flex flex-wrap gap-1.5">
                        {isEditing ? (
                          ACTION_OPTIONS.map((a) => {
                            const on = row.actions.includes(a);
                            return (
                              <button
                                key={a}
                                type="button"
                                onClick={() => toggleAction(k, a)}
                                title={a}
                                className={`p-1 rounded-lg transition-colors ${on ? "text-primary bg-primary/10" : "text-outline hover:text-on-surface hover:bg-surface-bright"}`}
                              >
                                <span className="material-symbols-outlined text-lg">{ACTION_ICONS[a]}</span>
                              </button>
                            );
                          })
                        ) : (
                          row.actions.map((a) => (
                            <span
                              key={a}
                              className="material-symbols-outlined text-primary text-lg"
                              title={a}
                            >
                              {ACTION_ICONS[a] ?? "notifications"}
                            </span>
                          ))
                        )}
                      </div>

                      {/* Edit toggle - Bottom right */}
                      <button
                        type="button"
                        onClick={() => setEditingLevel(isEditing ? null : k)}
                        className={`p-2 rounded-lg transition-all font-bold text-sm flex-shrink-0 ${isEditing ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 shadow-lg" : "text-outline hover:text-on-surface hover:bg-surface-bright"}`}
                        title={isEditing ? "Done editing" : "Edit level"}
                      >
                        {isEditing ? (
                          <span className="material-symbols-outlined text-xl">check_circle</span>
                        ) : (
                          <span className="material-symbols-outlined text-xl">edit</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom decorative strip */}
            <div className="mt-8 relative h-36 sm:h-44 rounded-2xl overflow-hidden bg-surface-container-high">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: "8rem" }}>shield</span>
              </div>
              <div className="absolute bottom-5 left-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
                  <span className="text-xs font-bold text-on-surface uppercase tracking-tighter">Real-time Node Coverage</span>
                </div>
                <p className="text-[10px] text-on-surface-variant">All alert thresholds synced with Sentinel Hardware Cluster.</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex flex-wrap justify-between items-center gap-4 opacity-60 px-2 pt-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-container rounded-lg flex items-center justify-center text-[10px] font-black text-primary border border-primary/20">
              SG
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">SnoozeGuard Corp.</span>
          </div>
          <div className="w-px h-4 bg-outline-variant/30" />
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-on-surface-variant">school</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sentinel Academy</span>
          </div>
        </div>
        <div className="text-[10px] text-outline font-medium">
          Firmware v1.4.2-stable | © 2024 SnoozeGuard
        </div>
      </footer>
    </form>
  );
}
