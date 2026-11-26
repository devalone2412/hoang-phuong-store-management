import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";

/** Emulate a device profile in Chromium (WebKit isn't required; viewport, touch and UA are what we test). */
type Use = NonNullable<PlaywrightTestConfig["use"]>;
const emulate = (name: keyof typeof devices): Use => {
  const { defaultBrowserType: _ignored, ...rest } = devices[name];
  return rest;
};
const desktop = (width: number, height: number): Use => ({ viewport: { width, height } });

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // The tests share one seeded database and some of them delete and restore rows.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    storageState: "e2e/.auth/state.json",
    permissions: ["camera"],
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      // Point at an already-installed Chromium with PW_CHROMIUM_PATH, or run `npm run e2e:install`.
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      // Fake camera so the barcode scanner can open without hardware or a permission prompt.
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
  },
  projects: [
    { name: "iphone-se", use: emulate("iPhone SE") },
    { name: "iphone-se-landscape", use: emulate("iPhone SE landscape") },
    { name: "iphone-14-pro-max", use: emulate("iPhone 14 Pro Max") },
    { name: "pixel-7", use: emulate("Pixel 7") },
    { name: "galaxy-s9", use: emulate("Galaxy S9+") },
    { name: "ipad-mini", use: emulate("iPad Mini") },
    { name: "ipad-mini-landscape", use: emulate("iPad Mini landscape") },
    { name: "laptop", use: desktop(1366, 768) },
    { name: "desktop", use: desktop(1920, 1080) },
  ],
  webServer: {
    command: "npm run dev",
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
