import { defineConfig } from "@playwright/test";
const pagesPath = (
  process.env.NEXT_PUBLIC_BASE_PATH ?? "letterboxd-profile-analyzer"
).replace(/^\/+|\/+$/g, "");
const previewURL = `http://127.0.0.1:4173/${pagesPath}${pagesPath ? "/" : ""}`;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: previewURL,
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-proxy-server",
      ],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve.mjs",
    url: previewURL,
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});
