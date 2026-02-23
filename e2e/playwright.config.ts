/**
 * Playwright configuration for E2E tests.
 * Two projects: desktop Chrome and mobile Chrome (Pixel 7).
 *
 * Uses a dedicated port (3001) so the E2E server runs against
 * E2E_DATABASE_URL without colliding with the dev server on 3000.
 */
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

const E2E_PORT = 3001;
const baseURL = process.env.CI
  ? (process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${E2E_PORT}`)
  : `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./journeys",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "on-failure" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  webServer: {
    command: "pnpm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(E2E_PORT),
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      BYPASS_RATE_LIMIT: "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
