import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    passWithNoTests: false,
    setupFiles: ["./src/test-setup.ts"],
    // SH-F.2 — kill machine-flakiness (phantom "regressions") without touching any
    // app test. Slow jsdom render tests were bursting vitest's 5s default timeout
    // under CPU saturation (parallel worktrees). Two levers, least-invasive first:
    //   1. testTimeout 5000 → 15000ms: gives slow renders headroom.
    //   2. maxWorkers cap (~half of the cores): removes the ROOT cause — worker
    //      contention on a saturated CPU — instead of only papering over the symptom.
    // fileParallelism:false is the heavier fallback (serializes files) if a cap of
    // half-cores ever proves insufficient across 3 runs; not needed here.
    testTimeout: 15000,
    maxWorkers: 5,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
