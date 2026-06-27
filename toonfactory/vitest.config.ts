import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests that need a database opt in via DATABASE_URL.
    testTimeout: 30_000,
    // Set before any app module loads so config picks these up.
    env: {
      PIPELINE_MODE: "mock",
      STORAGE_LOCAL_DIR: "./tests/.tmp-storage",
      APP_BASE_URL: "http://localhost:3000",
    },
  },
});
