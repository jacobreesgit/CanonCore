/**
 * Playwright configuration for portfolio screenshot automation.
 * Separate from the main E2E config — longer timeouts, serial execution,
 * high-DPI capture for marketing materials.
 */
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1241 },
        deviceScaleFactor: 3,
      },
    },
    {
      name: "laptop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1152, height: 745 },
        deviceScaleFactor: 3,
      },
    },
    {
      name: "laptop-lg",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1690, height: 960 },
        deviceScaleFactor: 3,
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: `lsof -ti:${new URL(baseURL).port} | xargs kill -9 2>/dev/null; pnpm run dev`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: process.env.SCREENSHOT_DATABASE_URL ?? "",
      BYPASS_RATE_LIMIT: "true",
    },
  },
});
