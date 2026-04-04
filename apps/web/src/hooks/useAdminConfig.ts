import { useEffect, useState } from "react";
import {
  type AlertMap,
  parseAlertMap,
} from "@snoozeguard/shared";
import { supabase } from "../lib/supabase";

export type AdminConfigState = {
  yawn_threshold: number;
  head_movement_threshold: number;
  drowsiness_trigger_level: number;
  alertMap: AlertMap;
};

const DEFAULT: AdminConfigState = {
  yawn_threshold: 3,
  head_movement_threshold: 20,
  drowsiness_trigger_level: 6,
  alertMap: parseAlertMap(undefined),
};

export function useAdminConfig() {
  const [config, setConfig] = useState<AdminConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase.from("admin_config").select("*").eq("id", 1).maybeSingle();
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setConfig(DEFAULT);
      } else if (data) {
        setConfig({
          yawn_threshold: Number(data.yawn_threshold) || DEFAULT.yawn_threshold,
          head_movement_threshold: Number(data.head_movement_threshold) || DEFAULT.head_movement_threshold,
          drowsiness_trigger_level: Number(data.drowsiness_trigger_level) || DEFAULT.drowsiness_trigger_level,
          alertMap: parseAlertMap(data.alert_map),
        });
      } else {
        setConfig(DEFAULT);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config: config ?? DEFAULT, loading, error, rawLoading: loading };
}
