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
  testDir: "./journeys",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
      timeout: 5 * 60 * 1000, // 5 minutes for large file uploads
      teardown: "teardown",
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["iPhone 14"] },
      dependencies: ["setup"],
    },
    {
      name: "teardown",
      testMatch: /global\.teardown\.ts/,
    },
  ],

  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    env: {
      ...process.env,
      DATABASE_URL: process.env.E2E_DATABASE_URL!,
      BYPASS_RATE_LIMIT: "true",
    },
  },
});
