import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@routeguard/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@routeguard/graph": path.resolve(__dirname, "../../packages/graph/src/index.ts"),
      "@routeguard/positioning": path.resolve(__dirname, "../../packages/positioning/src/index.ts")
    }
  },
  server: {
    port: 3000,
    host: true
  }
});
