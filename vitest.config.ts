import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Local vs. UTC date keys are a recurring source of off-by-one-day bugs, so
    // tests run in a fixed negative-offset zone rather than the machine's.
    env: { TZ: "America/Los_Angeles" },
    globals: true,
    css: true,
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
