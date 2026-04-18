/** @type {import('tailwindcss').Config} */
/** SnoozeGuard tokens — CSS-var backed for dark/light theming */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // All semantic tokens reference CSS variables so dark/light flips automatically
        background:                  "rgb(var(--sg-background) / <alpha-value>)",
        surface:                     "rgb(var(--sg-surface) / <alpha-value>)",
        "surface-container-lowest":  "rgb(var(--sg-surface-container-lowest) / <alpha-value>)",
        "surface-container":         "rgb(var(--sg-surface-container) / <alpha-value>)",
        "surface-container-low":     "rgb(var(--sg-surface-container-low) / <alpha-value>)",
        "surface-container-high":    "rgb(var(--sg-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--sg-surface-container-highest) / <alpha-value>)",
        "surface-bright":            "rgb(var(--sg-surface-bright) / <alpha-value>)",
        primary:                     "rgb(var(--sg-primary) / <alpha-value>)",
        "on-primary":                "rgb(var(--sg-on-primary) / <alpha-value>)",
        "primary-container":         "rgb(var(--sg-primary-container) / <alpha-value>)",
        "on-primary-container":      "rgb(var(--sg-on-primary-container) / <alpha-value>)",
        secondary:                   "rgb(var(--sg-secondary) / <alpha-value>)",
        "on-secondary":              "rgb(var(--sg-on-secondary) / <alpha-value>)",
        "secondary-container":       "rgb(var(--sg-secondary-container) / <alpha-value>)",
        "on-secondary-container":    "rgb(var(--sg-on-secondary-container) / <alpha-value>)",
        tertiary:                    "rgb(var(--sg-tertiary) / <alpha-value>)",
        "on-tertiary":               "rgb(var(--sg-on-tertiary) / <alpha-value>)",
        "tertiary-container":        "rgb(var(--sg-tertiary-container) / <alpha-value>)",
        "on-tertiary-container":     "rgb(var(--sg-on-tertiary-container) / <alpha-value>)",
        "on-surface":                "rgb(var(--sg-on-surface) / <alpha-value>)",
        "on-surface-variant":        "rgb(var(--sg-on-surface-variant) / <alpha-value>)",
        "outline-variant":           "rgb(var(--sg-outline-variant) / <alpha-value>)",
        error:                       "rgb(var(--sg-error) / <alpha-value>)",
        "error-container":           "rgb(var(--sg-error-container) / <alpha-value>)",
        "on-error":                  "rgb(var(--sg-on-error) / <alpha-value>)",
        "on-error-container":        "rgb(var(--sg-on-error-container) / <alpha-value>)",
      },
      fontFamily: {
        headline: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        body:     ["Inter",   "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "sg-header":  "0 20px 40px rgba(11, 19, 38, 0.45)",
        "sg-nav":     "0 -10px 30px rgba(11, 19, 38, 0.5)",
        "sg-primary": "0 0 24px rgba(123, 208, 255, 0.12)",
      },
    },
  },
  plugins: [],
};
