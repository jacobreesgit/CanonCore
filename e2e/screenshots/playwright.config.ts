/**
 * Playwright config for screenshot automation.
 * Desktop: 3456x2234, Mobile: 1170x2532
 */

import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env.local for test configuration
config({ path: ".env.local" });

export default defineConfig({
  testDir: "./",
  timeout: 180000, // Increased timeout for high-res screenshots
  expect: {
    timeout: 20000,
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
        viewport: { width: 1920, height: 1241 }, // Laptop size with 3456:2234 aspect ratio
        deviceScaleFactor: 3, // 3x for maximum quality (1920x3=5760, 1241x3=3723)
      },
    },
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 }, // Below 768px to trigger mobile layout
        deviceScaleFactor: 3, // 3x for high quality (390x3=1170, 844x3=2532)
        isMobile: true,
        hasTouch: true,
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
