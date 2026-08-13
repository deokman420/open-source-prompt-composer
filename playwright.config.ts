import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config.
 *
 * These tests exist mainly to cover what unit tests structurally cannot: the
 * vault's behaviour is a product of React state, an async save chain, and
 * IndexedDB, and its worst failure mode (silently writing plaintext) is
 * invisible to both `tsc` and the UI. It only shows up by driving the real app
 * and then reading the raw IndexedDB record back.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // shared origin + one IndexedDB per origin
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run build && npx next start -p 3100",
        url: "http://localhost:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
