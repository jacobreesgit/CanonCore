/**
 * Playwright config for demo video recording.
 * Runs headed so you can screen-record with macOS (Cmd+Shift+5).
 *
 * Usage:
 *   npx playwright test --config e2e/demo/playwright.demo.config.ts -g "Part 1"
 */
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: ".",
  timeout: 600_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    headless: false,
    trace: "off",
    screenshot: "off",
    video: "off",
    viewport: null,
    launchOptions: {
      args: ["--start-maximized"],
    },
  },
  webServer: {
    command: "pnpm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      BYPASS_RATE_LIMIT: "true",
    },
  },
});
