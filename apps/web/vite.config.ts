import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    // Avoid lightningcss native addon issues on some Windows installs (Vite 8 default).
    cssMinify: false,
  },
});
