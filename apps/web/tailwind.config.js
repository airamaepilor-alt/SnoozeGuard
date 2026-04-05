/** @type {import('tailwindcss').Config} */
/** SnoozeGuard tokens aligned with `UI/*.html` prototypes */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0b1326",
        surface: "#0b1326",
        "surface-container": "#171f33",
        "surface-container-low": "#131b2e",
        "surface-container-high": "#222a3d",
        "surface-container-highest": "#2d3449",
        "surface-bright": "#31394d",
        primary: "#7bd0ff",
        "on-primary": "#00354a",
        "primary-container": "#001a27",
        "on-primary-container": "#008abb",
        secondary: "#ffb95f",
        tertiary: "#ffb3ad",
        "on-surface": "#dae2fd",
        "on-surface-variant": "#c6c6cd",
        "outline-variant": "#45464d",
        error: "#ffb4ab",
      },
      fontFamily: {
        headline: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "sg-header": "0 20px 40px rgba(11, 19, 38, 0.45)",
        "sg-nav": "0 -10px 30px rgba(11, 19, 38, 0.5)",
        "sg-primary": "0 0 24px rgba(123, 208, 255, 0.12)",
      },
    },
  },
  plugins: [],
};
