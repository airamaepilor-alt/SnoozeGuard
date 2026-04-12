import type { ExpoConfig } from "expo/config";

const easProjectId = process.env.EAS_PROJECT_ID ?? "dca0364e-600b-452d-993d-1ba6e3da8c3b";

const config: ExpoConfig = {
  name: "SnoozeGuard",
  slug: "snoozeguard",
  scheme: "snoozeguard",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  updates: {
    url: `https://u.expo.dev/${easProjectId}`,
    enabled: true,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: "1.0.0",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0b1326",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.airamae.snoozeguard",
    infoPlist: {
      NSCameraUsageDescription: "SnoozeGuard uses the camera for driver monitoring while a session is active.",
      NSMotionUsageDescription: "SnoozeGuard uses device motion as a signal for head-movement heuristics (on-device ML path).",
      NSLocationWhenInUseUsageDescription: "SnoozeGuard captures your location during emergency alerts to share with your emergency contact.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0b1326",
    },
    package: "com.snoozeguard.app",
    // @ts-expect-error minSdkVersion is a valid Expo Android config field; type definition gap in SDK 54 types
    minSdkVersion: 26,
    permissions: ["CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    intentFilters: [
      {
        action: "android.intent.action.VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "snoozeguard",
            host: "*",
          },
        ],
        category: ["android.intent.category.BROWSABLE", "android.intent.category.DEFAULT"],
      },
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-updates",
    "expo-dev-client",
    [
      "react-native-vision-camera",
      {
        cameraPermissionText: "SnoozeGuard uses the camera for driver monitoring.",
        enableMicrophonePermission: false,
        enableFrameProcessors: true,
      },
    ],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "SnoozeGuard captures your location during emergency alerts.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#0b1326",
        sounds: [],
      },
    ],
  ],
  ...(easProjectId
    ? {
        extra: {
          eas: {
            projectId: easProjectId,
          },
        },
      }
    : {}),
};

export default config;
