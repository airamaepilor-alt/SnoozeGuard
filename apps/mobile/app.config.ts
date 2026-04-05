import type { ExpoConfig } from "expo/config";

/** Set after `eas init` (Expo dashboard project ID). Optional for local `expo prebuild` only. */
const easProjectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: "SnoozeGuard",
  slug: "snoozeguard",
  scheme: "snoozeguard",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0b1326",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.snoozeguard.app",
    infoPlist: {
      NSCameraUsageDescription: "SnoozeGuard uses the camera for driver monitoring while a session is active.",
      NSMotionUsageDescription: "SnoozeGuard uses device motion as a signal for head-movement heuristics (on-device ML path).",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0b1326",
    },
    package: "com.snoozeguard.app",
    minSdkVersion: 26,
    permissions: ["CAMERA"],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-dev-client",
    [
      "react-native-vision-camera",
      {
        cameraPermissionText: "SnoozeGuard uses the camera for driver monitoring.",
        enableMicrophonePermission: false,
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
