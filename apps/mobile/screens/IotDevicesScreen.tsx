import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
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
  status: "pending" | "accepted";
  requested_email: string | null;
};

export function IotDevicesScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { user } = useSession();
  const insets = useSafeAreaInsets();

  const [devices, setDevices] = useState<IotDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsub();
  }, []);

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
    if (!user?.id) return;
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
    if (!user?.id) return;
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
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.title}>IoT Device Management</Text>
        <Text style={styles.subtitle}>Manage your SnoozeGuard IoT buzzer devices</Text>

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

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={t.primary} />
            <Text style={styles.loadingText}>Loading devices...</Text>
          </View>
        ) : (
          <>
            {/* Pending Link Requests */}
            {pending.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Pending Link Requests</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pending.length}</Text>
                  </View>
                </View>
                <View style={styles.devicesList}>
                  {pending.map((device) => (
                    <View key={device.device_id} style={styles.pendingCard}>
                      <Text style={styles.deviceId}>{device.device_id}</Text>
                      <Text style={styles.metaText}>
                        Requested via {device.requested_email ?? "unknown email"}
                      </Text>
                      <Text style={styles.metaText}>
                        {new Date(device.created_at).toLocaleString()}
                      </Text>
                      <View style={styles.pendingActions}>
                        <Pressable
                          onPress={() => handleAccept(device.device_id)}
                          disabled={accepting === device.device_id || !isOnline}
                          style={[styles.acceptButton, { opacity: accepting === device.device_id || !isOnline ? 0.5 : 1 }]}
                        >
                          {accepting === device.device_id ? (
                            <ActivityIndicator size="small" color="#10b981" />
                          ) : (
                            <Text style={styles.acceptText}>Accept</Text>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => handleReject(device.device_id)}
                          disabled={!isOnline}
                          style={[styles.rejectButton, { opacity: !isOnline ? 0.5 : 1 }]}
                        >
                          <Text style={styles.rejectText}>Reject</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Accepted Devices */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Devices</Text>
              {accepted.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No devices linked yet</Text>
                  <Text style={styles.emptyText}>
                    Power on your IoT device and follow the setup steps below.
                  </Text>
                </View>
              ) : (
                <View style={styles.devicesList}>
                  {accepted.map((device) => {
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
                          <Text style={styles.metaText}>
                            Linked: {new Date(device.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        {/* Setup Instructions */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How to link your IoT device</Text>
          <Text style={styles.infoItem}>1. Power on your SnoozeGuard IoT device</Text>
          <Text style={styles.infoItem}>2. Connect your phone to the SG-… WiFi hotspot it creates</Text>
          <Text style={styles.infoItem}>3. Open 192.168.4.1 in your browser</Text>
          <Text style={styles.infoItem}>4. Enter your account email, your WiFi credentials, and save</Text>
          <Text style={styles.infoItem}>5. A link request will appear above — tap Accept</Text>
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
      borderRadius: 8,
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
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: t.onSurface,
    },
    badge: {
      backgroundColor: "#f59e0b20",
      borderColor: "#f59e0b40",
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#f59e0b",
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
    pendingCard: {
      backgroundColor: t.surfaceContainer,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#f59e0b50",
      padding: 12,
    },
    pendingActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    acceptButton: {
      flex: 1,
      backgroundColor: "#10b98115",
      borderColor: "#10b98140",
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 36,
    },
    acceptText: {
      color: "#10b981",
      fontSize: 13,
      fontWeight: "700",
    },
    rejectButton: {
      flex: 1,
      backgroundColor: t.error + "15",
      borderColor: t.error + "40",
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: "center",
    },
    rejectText: {
      color: t.error,
      fontSize: 13,
      fontWeight: "700",
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
      marginBottom: 6,
      fontFamily: "monospace",
    },
    deviceMeta: {
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      color: t.onSurfaceVariant,
      marginBottom: 2,
    },
    infoBox: {
      backgroundColor: t.primary + "15",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.primary + "40",
      padding: 16,
      marginTop: 8,
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
