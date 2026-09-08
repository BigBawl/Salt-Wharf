import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages sets BASE=/Salt-Wharf/ in CI. Local/dev and the play zip use "./"
// so assets work from a subfolder or a static server.
export default defineConfig({
  base: process.env.BASE || "./",
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
