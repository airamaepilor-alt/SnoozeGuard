import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    https: true,
    host: true,
  },
  build: {
    // Avoid lightningcss native addon issues on some Windows installs (Vite 8 default).
    cssMinify: false,
  },
});
