/**
 * Portfolio screenshot automation.
 * Captures 8 scenarios × 2 viewports (desktop + mobile) = 16 output PNGs.
 * Output: public/portfolio/{name}-{desktop|mobile}.png
 *
 * Run: npx playwright test --config=e2e/screenshots/playwright.config.ts
 */
import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  signIn,
  captureScreenshot,
  waitForHero,
  goToCarouselSlide,
  openSettings,
  openSpotlight,
  switchToTreeView,
} from "./utils";
import { SEED_USERS } from "../config/test-data";
import { Timeouts } from "../config/timeouts";
import { slugify } from "../../lib/slugify";

const OUTPUT_DIR = path.resolve("public/portfolio");

test.beforeAll(async () => {
  // Clean output directory when CLEAN_SCREENSHOTS=true
  if (process.env.CLEAN_SCREENSHOTS === "true" && fs.existsSync(OUTPUT_DIR)) {
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const file of files) {
      if (file.endsWith(".png")) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
      }
    }
  }
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  // Dismiss any leftover dialogs from previous tests
  await page.keyboard.press("Escape");
});

test.describe("Portfolio Screenshots", () => {
  // ── 01: Library Grid ───────────────────────────────────────

  test("01 — Library grid view", async ({ page }) => {
    await signIn(page, "demo");
    await waitForHero(page);
    await captureScreenshot(page, "01-library-grid");
  });

  // ── 02: Tree View ──────────────────────────────────────────

  test("02 — Tree view with expanded season", async ({ page }) => {
    await signIn(page, "demo");
    const isMobile = page.viewportSize()!.width < 1024;

    // Navigate to Breaking Bad detail page
    const bbCard = page
      .getByTestId(`item-card-${slugify("Breaking Bad (2008)")}`)
      .or(page.getByTestId(`item-tree-${slugify("Breaking Bad (2008)")}`));
    await bbCard.waitFor({ state: "visible", timeout: Timeouts.heavy });
    await bbCard.click();
    await page.waitForURL(/\/u\/demo\/[a-z0-9]+/, { timeout: Timeouts.heavy });

    // Force tree view via URL param
    const detailUrl = page.url();
    await page.goto(`${detailUrl}?view=tree`);
    await page.waitForLoadState("domcontentloaded");

    if (isMobile) {
      // Just wait for content to render
      await page.waitForTimeout(2000);
    } else {
      // Wait for tree items to render
      const collapseButtons = page.locator(
        'button[aria-label="Collapse item"]'
      );
      await expect(collapseButtons.first()).toBeVisible({
        timeout: Timeouts.heavy,
      });

      // Collapse all seasons, then expand only Season 2
      let count = await collapseButtons.count();
      while (count > 0) {
        await collapseButtons.first().click();
        await page.waitForTimeout(150);
        count = await collapseButtons.count();
      }

      // Expand Season 2
      const season2Item = page
        .getByRole("listitem")
        .filter({ hasText: "Season 2" });
      await season2Item.locator('button[aria-label="Expand item"]').click();
      await page.waitForTimeout(300);
    }

    await captureScreenshot(page, "02-tree-view");
  });

  // ── 04: TMDB Wizard ────────────────────────────────────────

  test("04 — TMDB metadata wizard", async ({ page }) => {
    await signIn(page, "demo");

    // Click the Add button to open the add item dialog/sheet
    await page.getByTestId("items-add-button").click();

    // Wait for the name input to be visible (dialog/sheet is open)
    const nameInput = page.getByRole("combobox", { name: /item name/i });
    await nameInput.waitFor({ state: "visible", timeout: Timeouts.heavy });

    // Search for "Dune" in the TMDB search combobox
    const searchInput = page.getByPlaceholder("Search movies & TV shows\u2026");
    await searchInput.waitFor({ state: "visible", timeout: Timeouts.api });
    await searchInput.fill("Dune");

    // Wait for search results and click a Dune result
    const duneResult = page
      .getByRole("listbox")
      .getByRole("option")
      .filter({ hasText: "Dune" });
    await duneResult.nth(0).waitFor({
      state: "visible",
      timeout: Timeouts.api,
    });
    await duneResult.nth(0).click();

    // Advance past text step to poster step
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: /poster/i })).toBeVisible({
      timeout: Timeouts.heavy,
    });

    await captureScreenshot(page, "04-tmdb-wizard");
  });

  // ── 06: Google Drive Sync (Activity Tab) ───────────────────

  test("06 — Google Drive sync settings", async ({ page }) => {
    await signIn(page, "demo");

    const settings = await openSettings(page);
    await settings.switchToTab("activity");

    // Wait for activity tab content to render
    const isMobile = page.viewportSize()!.width < 1024;
    const tabIndicator = isMobile
      ? page.getByTestId("settings-tab-select")
      : page.getByTestId("settings-tab-activity");
    await expect(tabIndicator).toBeVisible({ timeout: Timeouts.api });

    await captureScreenshot(page, "06-google-drive-sync");
  });

  // ── 07: Explore Page ───────────────────────────────────────

  test("07 — Explore page with hero carousel", async ({ page }) => {
    await signIn(page, "filmfan");
    await page.goto("/explore?autoplay=false");
    await page.waitForLoadState("domcontentloaded");
    await waitForHero(page);

    // Navigate to the Squid Game slide so both viewports show the same hero
    await goToCarouselSlide(page, /squid game/i);

    await captureScreenshot(page, "07-explore-page");
  });

  // ── 08: Spotlight Search ───────────────────────────────────

  test("08 — Spotlight search dialog", async ({ page }) => {
    await signIn(page, "demo");

    await openSpotlight(page);

    await captureScreenshot(page, "08-spotlight-search");
  });

  // ── 32: Fork Dialog ────────────────────────────────────────

  test("32 — Fork destination dialog", async ({ page }) => {
    await signIn(page, "demo");
    await page.goto("/explore?autoplay=false");
    await page.waitForLoadState("domcontentloaded");
    await waitForHero(page);

    // Navigate to the Squid Game slide so both viewports show the same hero
    await goToCarouselSlide(page, /squid game/i);

    // Click the hero Fork button
    const isMobile = page.viewportSize()!.width < 1024;
    const forkButton = page.getByTestId("hero-fork-button");
    await forkButton.waitFor({ state: "visible", timeout: Timeouts.heavy });
    await forkButton.click();

    // Wait for the fork destination dialog/sheet to appear
    const forkDialog = isMobile
      ? page.getByTestId("sheet-fork-destination")
      : page.getByTestId("dialog-fork-destination");
    await expect(forkDialog).toBeVisible({ timeout: Timeouts.api });

    await captureScreenshot(page, "32-fork-dialog");
  });

  // ── 36: Docs Page ──────────────────────────────────────────

  test("36 — Documentation page", async ({ page }) => {
    await page.goto("/docs");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("#main-content")).toBeVisible({
      timeout: Timeouts.navigation,
    });

    await captureScreenshot(page, "36-docs");
  });
});
