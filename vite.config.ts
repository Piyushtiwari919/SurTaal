import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "audio/harmonium/*.wav"],
      manifest: {
        name: "SurTaal — Your Pocket Harmonium",
        short_name: "SurTaal",
        description:
          "Playful, realistic Indian harmonium with Sargam learning and Song Studio.",
        theme_color: "#2c1e16",
        background_color: "#faf6f0",
        display: "standalone",
        orientation: "any",
        icons: [
          {
            src: "icons/icon.svg",
            sizes: "192x192 512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,wav,ogg}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "e2e/**"],
  },
});
