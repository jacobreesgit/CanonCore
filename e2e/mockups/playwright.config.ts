/**
 * Unified Playwright config for the screenshot → mockup → webp pipeline.
 *
 * Projects:
 *   laptop  — 1152×745 @3x app screenshots
 *   mobile  — 390×844 @3x app screenshots
 *   mockups — 1280×900 headed, LS Graphics mockup generation (depends on laptop + mobile)
 *
 * Run: pnpm run mockups
 */
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: ".",
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "laptop",
      testMatch: "screenshots.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
        viewport: { width: 1152, height: 745 },
        deviceScaleFactor: 3,
      },
    },
    {
      name: "mobile",
      testMatch: "screenshots.spec.ts",
      use: {
        ...devices["Pixel 7"],
        baseURL,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
      },
    },
    {
      name: "mockups",
      testMatch: "mockups.spec.ts",
      dependencies: process.env.MOCKUP_ONLY ? [] : ["laptop", "mobile"],
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        viewport: { width: 1280, height: 900 },
        acceptDownloads: true,
        trace: "retain-on-failure",
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
