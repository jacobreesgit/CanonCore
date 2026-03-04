/**
 * App screenshot capture for the unified mockup pipeline.
 * Captures 10 scenarios × 2 viewports (laptop + mobile) = 20 output PNGs.
 * Output: e2e/output/screenshots/{name}-{laptop|mobile}.png
 *
 * Media-stack images (03-item-detail, 07-explore-page) are also converted
 * inline to webp at laptop viewport → public/images/.
 *
 * Run: pnpm run mockups
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  signIn,
  captureScreenshot,
  waitForHero,
  goToCarouselSlide,
  openSpotlight,
  collapseSidebar,
} from "./screenshot.utils";
import { Timeouts } from "../config/timeouts";
import { slugify } from "../../lib/slugify";

const OUTPUT_DIR = path.resolve("e2e/output/screenshots");

test.beforeAll(async () => {
  if (process.env.CLEAN_SCREENSHOTS === "true" && fs.existsSync(OUTPUT_DIR)) {
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const file of files) {
      if (file.endsWith(".png")) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
      }
    }
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.keyboard.press("Escape");
});

test.describe("Screenshots", () => {
  // ── 01: Library Grid ───────────────────────────────────────

  test("01 — Library grid view", async ({ page }) => {
    await signIn(page, "demo");
    await waitForHero(page);
    await collapseSidebar(page);
    await captureScreenshot(page, "01-library-grid");
  });

  // ── 02: Tree View ──────────────────────────────────────────

  test("02 — Tree view with expanded season", async ({ page }) => {
    await signIn(page, "demo");
    const isMobile = page.viewportSize()!.width < 1024;

    const bbCard = page.getByTestId(
      `item-card-${slugify("Breaking Bad (2008)")}`
    );
    await bbCard.waitFor({ state: "visible", timeout: Timeouts.heavy });
    await bbCard.click();
    await page.waitForURL(/\/u\/demo\/[a-z0-9]+/, { timeout: Timeouts.heavy });

    const detailUrl = page.url();
    await page.goto(`${detailUrl}?view=tree`, {
      waitUntil: "domcontentloaded",
    });

    if (isMobile) {
      await page.waitForTimeout(2000);
    } else {
      const collapseButtons = page.locator(
        'button[aria-label="Collapse item"]'
      );
      await expect(collapseButtons.first()).toBeVisible({
        timeout: Timeouts.heavy,
      });

      let count = await collapseButtons.count();
      while (count > 0) {
        await collapseButtons.first().click();
        await page.waitForTimeout(150);
        count = await collapseButtons.count();
      }

      const season1Item = page
        .getByRole("listitem")
        .filter({ hasText: "Season 1" });
      await season1Item.locator('button[aria-label="Expand item"]').click();
      await page.waitForTimeout(300);
    }

    await collapseSidebar(page);

    if (isMobile) {
      await page.evaluate(() => window.scrollTo(0, 500));
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    const syncBtn = page.getByRole("button", { name: "Sync" });
    if (await syncBtn.isVisible()) {
      await syncBtn.click();
      await page.waitForTimeout(300);
    }

    await captureScreenshot(page, "02-tree-view");
  });

  // ── 03: Item Detail ─────────────────────────────────────────

  test("03 — Item detail page (The Sopranos)", async ({ page }) => {
    await signIn(page, "demo");

    const sopranosCard = page
      .getByTestId(`item-card-${slugify("The Sopranos (1999)")}`)
      .first();
    await sopranosCard.waitFor({ state: "visible", timeout: Timeouts.heavy });
    await sopranosCard.click();
    await page.waitForURL(/\/u\/demo\/[a-z0-9]+/, { timeout: Timeouts.heavy });

    await waitForHero(page);
    await collapseSidebar(page);

    await captureScreenshot(page, "03-item-detail");
  });

  // ── 04: TMDB Wizard ────────────────────────────────────────

  test("04 — TMDB metadata wizard", async ({ page }) => {
    await signIn(page, "demo");
    await collapseSidebar(page);

    await page.getByTestId("items-add-button").click();

    const nameInput = page.getByRole("combobox", { name: /item name/i });
    await nameInput.waitFor({ state: "visible", timeout: Timeouts.heavy });

    const searchInput = page.getByPlaceholder("Search movies & TV shows\u2026");
    await searchInput.waitFor({ state: "visible", timeout: Timeouts.api });
    await searchInput.fill("Dune");

    const duneResult = page
      .getByRole("listbox")
      .getByRole("option")
      .filter({ hasText: "Dune" });
    await duneResult.nth(0).waitFor({
      state: "visible",
      timeout: Timeouts.api,
    });
    await duneResult.nth(0).click();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: /poster/i })).toBeVisible({
      timeout: Timeouts.heavy,
    });

    await captureScreenshot(page, "04-tmdb-wizard");
  });

  // ── 06: Google Drive Sync (Tree View) ────────────────────

  test("06 — Google Drive sync tree view", async ({ page }) => {
    await signIn(page, "demo");

    const sopranosCard = page
      .getByTestId(`item-card-${slugify("The Sopranos (1999)")}`)
      .first();
    await sopranosCard.waitFor({ state: "visible", timeout: Timeouts.heavy });
    await sopranosCard.click();
    await page.waitForURL(/\/u\/demo\/[a-z0-9]+/, { timeout: Timeouts.heavy });

    const detailUrl = page.url();
    await page.goto(`${detailUrl}?view=tree`);
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.locator('button[aria-label="Collapse item"]').first()
    ).toBeVisible({ timeout: Timeouts.heavy });

    await collapseSidebar(page);
    await captureScreenshot(page, "06-google-drive-sync");
  });

  // ── 07: Explore Page ───────────────────────────────────────

  test("07 — Explore page with hero carousel", async ({ page }) => {
    await signIn(page, "filmfan");
    await page.goto("/explore?autoplay=false");
    await page.waitForLoadState("domcontentloaded");
    await waitForHero(page);

    await goToCarouselSlide(page, /squid game/i);
    await collapseSidebar(page);

    await captureScreenshot(page, "07-explore-page");
  });

  // ── 08: Spotlight Search ───────────────────────────────────

  test("08 — Spotlight search dialog", async ({ page }) => {
    await signIn(page, "demo");
    await collapseSidebar(page);

    await openSpotlight(page);

    await captureScreenshot(page, "08-spotlight-search");
  });

  // ── 09: Playlist Detail ───────────────────────────────────

  test("09 — Playlist detail (MCU Marathon)", async ({ page }) => {
    await signIn(page, "demo");

    await page.goto("/u/demo?tab=playlists");
    await page.waitForLoadState("domcontentloaded");

    const mcuPlaylist = page.getByRole("link", { name: /MCU Marathon/i });
    await mcuPlaylist.waitFor({ state: "visible", timeout: Timeouts.heavy });
    await mcuPlaylist.click();
    await page.waitForURL(/\/u\/demo\/playlists\//, {
      timeout: Timeouts.heavy,
    });

    await page.waitForLoadState("domcontentloaded");
    await collapseSidebar(page);

    await captureScreenshot(page, "09-playlist-detail");
  });

  // ── 32: Fork Dialog ────────────────────────────────────────

  test("32 — Fork destination dialog", async ({ page }) => {
    await signIn(page, "demo");
    await page.goto("/explore?autoplay=false");
    await page.waitForLoadState("domcontentloaded");
    await waitForHero(page);
    await collapseSidebar(page);

    const dotCount = await page
      .locator('[role="tab"][data-testid^="hero-dot"]')
      .count();
    for (let i = 0; i < dotCount; i++) {
      await page.locator(`[data-testid="hero-dot-${i + 1}"]`).click();
      await page.waitForTimeout(500);
      const forkBtn = page.getByTestId("hero-fork-button");
      if (await forkBtn.isVisible()) {
        await forkBtn.click();
        break;
      }
    }

    await page.waitForSelector('[role="dialog"]', { timeout: Timeouts.api });

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
