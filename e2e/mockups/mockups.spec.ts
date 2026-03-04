/**
 * LS Graphics mockup generation + inline webp conversion.
 *
 * Uploads app screenshots into LS Graphics mockup templates, downloads
 * the rendered device frames, and converts to webp inline.
 *
 * Run: pnpm run mockups
 * Single mockup: pnpm run mockups -- --grep "04-tmdb-wizard"
 */
import { test, type BrowserContext, type Page } from "@playwright/test";
import { ALL_MOCKUPS } from "./mockup-config";
import { loginToLsGraphics, generateMockup } from "./ls-graphics.utils";
import fs from "node:fs";

// Shared context — LS Graphics auth doesn't survive storageState round-trips,
// so we keep a single logged-in context alive across all serial tests.
let sharedContext: BrowserContext;
let sharedPage: Page;

test.describe("LS Graphics Mockups", () => {
  test.describe.configure({ mode: "serial" });

  // -------------------------------------------------------------------------
  // Login — beforeAll so it always runs, even with --grep filtering
  // -------------------------------------------------------------------------

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext({ acceptDownloads: true });
    sharedPage = await sharedContext.newPage();
    await loginToLsGraphics(sharedPage);
  });

  test.afterAll(async () => {
    await sharedContext?.close();
  });

  // -------------------------------------------------------------------------
  // Mockup generation — one test per entry for clear progress reporting
  // -------------------------------------------------------------------------

  for (const entry of ALL_MOCKUPS) {
    test(`generate mockup: ${entry.id}`, async () => {
      // Verify source screenshot exists before starting
      if (!fs.existsSync(entry.screenshotPath)) {
        test.skip(true, `Source screenshot not found: ${entry.screenshotPath}`);
        return;
      }

      await generateMockup(sharedPage, entry);
    });
  }
});
