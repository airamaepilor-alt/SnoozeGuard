/** Aligned with `UI/*.html` + `apps/web/tailwind.config.js` */
export const theme = {
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

export type Theme = typeof theme;
