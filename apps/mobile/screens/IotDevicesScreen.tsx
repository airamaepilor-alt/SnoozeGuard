import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "../context/ThemeContext";
import { useSession } from "../context/SessionContext";
import { supabase } from "../lib/supabase";
import type { Theme } from "../theme";

type IotDevice = {
  user_id: string;
  device_id: string;
  last_seen: string | null;
  created_at: string;
};

export function IotDevicesScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { user } = useSession();
  const insets = useSafeAreaInsets();

  const [devices, setDevices] = useState<IotDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDeviceId, setNewDeviceId] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Track online status
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsub();
  }, []);

  // Load devices
  useEffect(() => {
    if (!user?.id) return;

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
    return elapsed < 15_000;
  }, []);

  const handleAddDevice = async () => {
    if (!user?.id || !newDeviceId.trim()) {
      setError("Device ID cannot be empty");
      return;
    }

    const trimmedId = newDeviceId.trim().toLowerCase();

    try {
      setAdding(true);
      setError(null);
      setMessage(null);

      if (devices.some((d) => d.device_id.toUpperCase() === trimmedId)) {
        setError("This device is already paired");
        return;
      }

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
    if (!user?.id) return;

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
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.title}>IoT Device Management</Text>
        <Text style={styles.subtitle}>Connect and manage your SnoozeGuard IoT buzzer devices</Text>

        {/* Status Messages */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {message && (
          <View style={[styles.messageBox, message.ok ? styles.successBox : styles.errorBox]}>
            <Text style={[styles.messageText, message.ok ? styles.successText : styles.errorText]}>
              {message.text}
            </Text>
          </View>
        )}

        {!isOnline && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>You are offline. Device list may be outdated.</Text>
          </View>
        )}

        {/* Add Device Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Pair New Device</Text>

          <Text style={styles.label}>Device ID</Text>
          <TextInput
            style={styles.input}
            value={newDeviceId}
            onChangeText={setNewDeviceId}
            placeholder="e.g., esp32cam-001"
            placeholderTextColor="#64748b"
            editable={!adding && isOnline}
            maxLength={50}
          />
          <Text style={styles.helperText}>
            Enter the unique device ID printed on your IoT device or shown in its status LED display.
          </Text>

          <Pressable
            style={[styles.button, { opacity: adding || !newDeviceId.trim() || !isOnline ? 0.5 : 1 }]}
            onPress={handleAddDevice}
            disabled={adding || !newDeviceId.trim() || !isOnline}
          >
            {adding ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Pair Device</Text>
            )}
          </Pressable>
        </View>

        {/* Devices List */}
        <Text style={[styles.formTitle, { marginTop: 24 }]}>Your Devices</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00a8e8" />
            <Text style={styles.loadingText}>Loading devices...</Text>
          </View>
        ) : devices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No devices paired yet</Text>
            <Text style={styles.emptyText}>Start by entering your device ID above to pair your first buzzer.</Text>
          </View>
        ) : (
          <View style={styles.devicesList}>
            {devices.map((device) => {
              const online = isConnected(device.last_seen);
              const lastSeenTime = device.last_seen
                ? new Date(device.last_seen).toLocaleTimeString()
                : "Never";

              return (
                <View key={device.device_id} style={styles.deviceCard}>
                  <View style={styles.deviceHeader}>
                    <View style={styles.statusIndicator}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: online ? "#10b981" : "#cbd5e1" },
                        ]}
                      />
                      <Text style={styles.statusText}>{online ? "Online" : "Offline"}</Text>
                    </View>

                    <Pressable
                      onPress={() => handleRemoveDevice(device.device_id)}
                      disabled={!isOnline}
                      style={[styles.deleteButton, { opacity: !isOnline ? 0.5 : 1 }]}
                    >
                      <Text style={styles.deleteText}>Remove</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.deviceId}>{device.device_id}</Text>

                  <View style={styles.deviceMeta}>
                    <Text style={styles.metaText}>Last seen: {lastSeenTime}</Text>
                    <Text style={styles.metaText}>Paired: {new Date(device.created_at).toLocaleDateString()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How to find your Device ID</Text>
          <Text style={styles.infoItem}>• Check the physical label on your IoT device enclosure</Text>
          <Text style={styles.infoItem}>• Look at the LED status display during device startup</Text>
          <Text style={styles.infoItem}>• Check your device configuration screen (if applicable)</Text>
          <Text style={styles.infoItem}>• Contact your fleet manager for device assignments</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.surface,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: t.onSurface,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: t.onSurfaceVariant,
      marginBottom: 20,
    },
    errorBox: {
      backgroundColor: t.error + "20",
      borderColor: t.error + "40",
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    errorText: {
      color: t.error,
      fontSize: 14,
      fontWeight: "500",
    },
    successBox: {
      backgroundColor: "#10b98120",
      borderColor: "#10b98140",
      borderWidth: 1,
    },
    successText: {
      color: "#10b981",
    },
    warningBox: {
      backgroundColor: "#f59e0b20",
      borderColor: "#f59e0b40",
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    warningText: {
      color: "#f59e0b",
      fontSize: 14,
      fontWeight: "500",
    },
    messageBox: {
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    messageText: {
      fontSize: 14,
      fontWeight: "500",
    },
    formCard: {
      backgroundColor: t.surfaceContainer,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: t.outlineVariant + "40",
    },
    formTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: t.onSurface,
      marginBottom: 12,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: t.onSurface,
      marginBottom: 8,
    },
    input: {
      backgroundColor: t.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: t.outlineVariant,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: t.onSurface,
      fontFamily: "monospace",
      marginBottom: 8,
    },
    helperText: {
      fontSize: 12,
      color: t.onSurfaceVariant,
      marginBottom: 12,
    },
    button: {
      backgroundColor: t.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    buttonText: {
      color: t.onPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    loadingContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
    },
    loadingText: {
      color: t.onSurfaceVariant,
      fontSize: 14,
      marginTop: 12,
    },
    emptyContainer: {
      backgroundColor: t.surfaceContainer,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.outlineVariant + "40",
      alignItems: "center",
      paddingVertical: 40,
      paddingHorizontal: 16,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: t.onSurface,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 13,
      color: t.onSurfaceVariant,
      textAlign: "center",
    },
    devicesList: {
      gap: 12,
    },
    deviceCard: {
      backgroundColor: t.surfaceContainer,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.outlineVariant + "40",
      padding: 12,
    },
    deviceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    statusIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "600",
      color: t.onSurfaceVariant,
      textTransform: "uppercase",
    },
    deleteButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    deleteText: {
      fontSize: 12,
      fontWeight: "600",
      color: t.error,
    },
    deviceId: {
      fontSize: 14,
      fontWeight: "700",
      color: t.onSurface,
      marginBottom: 8,
      fontFamily: "monospace",
    },
    deviceMeta: {
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      color: t.onSurfaceVariant,
    },
    infoBox: {
      backgroundColor: t.primary + "15",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.primary + "40",
      padding: 16,
      marginTop: 24,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: t.onSurface,
      marginBottom: 10,
    },
    infoItem: {
      fontSize: 13,
      color: t.onSurfaceVariant,
      marginBottom: 6,
    },
  });
