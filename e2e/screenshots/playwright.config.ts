/**
 * Playwright config for screenshot automation.
 * Desktop: 3456x2234, Mobile: 1170x2532
 */

import { execSync } from "child_process";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load .env.local for test configuration
config({ path: ".env.local" });

// Use dedicated E2E database to avoid destroying dev/seed data
if (!process.env.E2E_DATABASE_URL) {
  throw new Error("E2E_DATABASE_URL is required — set it in .env.local");
}
process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;

// Kill any existing process on port 3000 so the E2E webServer
// always starts fresh with the E2E database.
// Guard: only run in the coordinator process, not in spawned workers
// (workers re-import this config module and would kill the webServer).
if (!process.env.__PW_CONFIG_LOADED) {
  process.env.__PW_CONFIG_LOADED = "1";
  try {
    execSync("lsof -ti:3000 | xargs kill -9 2>/dev/null", { stdio: "ignore" });
  } catch {
    // Nothing running on 3000 — that's fine
  }
}

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
    command: "pnpm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      DATABASE_URL: process.env.E2E_DATABASE_URL!,
      BYPASS_RATE_LIMIT: "true",
    },
  },
});
