import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: "autoUpdate", manifest: { name: "Spoons", short_name: "Spoons", start_url: "/", scope: "/", display: "standalone", theme_color: "#2c3a1b", background_color: "#2c3a1b", icons: [{ src: "/pwa-192.png", sizes: "192x192", type: "image/png" }, { src: "/pwa-512.png", sizes: "512x512", type: "image/png" }, { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] } })]
});
