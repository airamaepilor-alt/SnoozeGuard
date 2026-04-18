export const darkTheme = {
  background: "#0b1326",
  surface: "#0b1326",
  surfaceContainer: "#171f33",
  surfaceContainerLow: "#131b2e",
  surfaceContainerHigh: "#222a3d",
  surfaceBright: "#31394d",
  primary: "#7bd0ff",
  onPrimary: "#00354a",
  primaryContainer: "#001a27",
  onPrimaryContainer: "#008abb",
  secondary: "#ffb95f",
  tertiary: "#ffb3ad",
  onSurface: "#dae2fd",
  onSurfaceVariant: "#c6c6cd",
  outlineVariant: "#45464d",
  error: "#ffb4ab",
  navBorder: "rgba(123, 208, 255, 0.22)",
} as const;

export const lightTheme = {
  background: "#f4f7ff",
  surface: "#f4f7ff",
  surfaceContainer: "#e5eaf5",
  surfaceContainerLow: "#edf0fa",
  surfaceContainerHigh: "#dce2f0",
  surfaceBright: "#ffffff",
  primary: "#005b87",
  onPrimary: "#ffffff",
  primaryContainer: "#c8e6ff",
  onPrimaryContainer: "#003a57",
  secondary: "#8a5500",
  tertiary: "#8c1d18",
  onSurface: "#1a1d27",
  onSurfaceVariant: "#44475a",
  outlineVariant: "#bcc0ce",
  error: "#ba1a1a",
  navBorder: "rgba(0, 91, 135, 0.20)",
} as const;

/** Static dark theme kept for files not yet using ThemeContext */
export const theme = darkTheme;
export type Theme = typeof darkTheme;
