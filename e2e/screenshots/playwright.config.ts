/**
 * Playwright config for screenshot automation.
 * Optimized for capturing portfolio images at 1920x1080.
 */

import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env.local for test configuration
config({ path: ".env.local" });

export default defineConfig({
  testDir: "./",
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false, // Run serially for consistent login state
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for screenshots
  workers: 1, // Single worker for serial execution
  reporter: [["list"]],

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "off",
    screenshot: "off", // We take manual screenshots
    video: "off",
  },

  projects: [
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  webServer: {
    command: "BYPASS_RATE_LIMIT=true pnpm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
