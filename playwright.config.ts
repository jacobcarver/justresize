import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** Point the suite at an already-running server (e.g. `next dev`, or a deployed preview) instead of building one. */
const EXTERNAL_URL = process.env.E2E_BASE_URL;

/**
 * End-to-end tests run against the real production build (`next build` +
 * `next start`), because worker and WASM bundling can differ from dev.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: EXTERNAL_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Safari's engine has no native WebP encoder and differs in OffscreenCanvas
    // behaviour, so the core flows are exercised there too.
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: /@cross-browser/ },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: /@cross-browser/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: EXTERNAL_URL
    ? undefined
    : {
        // Built without the ad script (lib/ads.ts): the suite must not depend on, or send traffic to, Google's ad servers.
        command: `NEXT_PUBLIC_ADS=off npm run build && npm run start -- -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
