/**
 * Screenshot utility functions for the unified mockup pipeline.
 *
 * Captures app screenshots to e2e/output/screenshots/ as intermediate PNGs.
 * Media-stack images (03-item-detail, 07-explore-page) are also converted
 * inline to webp and saved to public/images/.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { AuthPage } from "../pages/auth.page";
import { SettingsPage } from "../pages/settings.page";
import { ItemsSortFilterPage } from "../pages/items-sort-filter.page";
import { SEED_USERS } from "../config/test-data";
import { Timeouts } from "../config/timeouts";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve("e2e/output/screenshots");
const IMAGES_DIR = path.resolve("public/images");

/** Media-stack screenshots that get converted directly to webp (no mockup). */
const MEDIA_STACK_IDS = new Set(["03-item-detail", "07-explore-page"]);

/** Type-safe screenshot names for compile-time validation. */
type ScreenshotName =
  | "01-library-grid"
  | "02-tree-view"
  | "03-item-detail"
  | "04-tmdb-wizard"
  | "05-item-grid"
  | "06-google-drive-sync"
  | "07-explore-page"
  | "08-spotlight-search"
  | "09-playlist-detail"
  | "32-fork-dialog"
  | "36-docs";

type SeedUser = keyof typeof SEED_USERS;

/**
 * Sign in as a seed user and wait for navigation to complete.
 */
export async function signIn(page: Page, user: SeedUser): Promise<void> {
  const auth = new AuthPage(page);
  await auth.gotoSignIn();
  await auth.signIn(SEED_USERS[user].email, SEED_USERS[user].password);
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page.getByTestId("hero-carousel").or(page.getByTestId("items-empty-state"))
  ).toBeVisible({
    timeout: Timeouts.heavy,
  });
}

/**
 * Wait for all images on the page to finish loading.
 */
async function waitForImages(page: Page): Promise<void> {
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.querySelectorAll("img")).map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
          setTimeout(resolve, 10_000);
        });
      })
    );
  });
}

/**
 * Capture a screenshot and save to e2e/output/screenshots/.
 * For laptop-viewport media-stack images, also converts to webp in public/images/.
 */
export async function captureScreenshot(
  page: Page,
  name: ScreenshotName
): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await waitForImages(page);

  // Hide Next.js dev error overlay
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });

  const width = page.viewportSize()!.width;
  const suffix = width < 1024 ? "mobile" : "laptop";

  await page.waitForTimeout(Timeouts.animation);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const pngPath = path.join(OUTPUT_DIR, `${name}-${suffix}.png`);
  await page.screenshot({ path: pngPath, fullPage: false });

  // For media-stack images at laptop viewport, convert to webp
  if (suffix === "laptop" && MEDIA_STACK_IDS.has(name)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    const webpPath = path.join(IMAGES_DIR, `${name}.webp`);
    await sharp(pngPath).webp({ quality: 82 }).toFile(webpPath);
    console.log(`  WEBP → ${path.relative(process.cwd(), webpPath)}`);
  }
}

/**
 * Wait for the hero carousel to be fully loaded with images.
 */
export async function waitForHero(page: Page): Promise<void> {
  await expect(page.getByTestId("hero-carousel").first()).toBeVisible({
    timeout: Timeouts.heavy,
  });
  await waitForImages(page);
}

/**
 * Navigate to a specific carousel slide by name.
 */
export async function goToCarouselSlide(
  page: Page,
  slideName: RegExp
): Promise<void> {
  const dot = page.getByRole("tab", { name: slideName });
  await dot.waitFor({ state: "visible", timeout: Timeouts.heavy });
  await dot.click();
  await expect(dot).toHaveAttribute("aria-selected", "true", {
    timeout: Timeouts.animation,
  });
}

/**
 * Open the settings dialog/sheet.
 */
export async function openSettings(page: Page): Promise<SettingsPage> {
  const isMobile = page.viewportSize()!.width < 1024;
  const settings = new SettingsPage(page, isMobile);
  await settings.open();
  return settings;
}

/**
 * Open the spotlight search dialog.
 */
export async function openSpotlight(page: Page): Promise<void> {
  const isMobile = page.viewportSize()!.width < 1024;

  if (isMobile) {
    const searchButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /search/i });
    await searchButton.click();
  } else {
    await page.keyboard.press("/");
  }

  await page.waitForSelector('[role="dialog"]', { timeout: Timeouts.api });
}

/**
 * Switch to tree view.
 */
export async function switchToTreeView(
  page: Page,
  username: string
): Promise<void> {
  const isMobile = page.viewportSize()!.width < 1024;
  const sortFilter = new ItemsSortFilterPage(page, username, isMobile);
  await sortFilter.switchToTree();
}

/**
 * Collapse the desktop sidebar. No-op on mobile viewports.
 */
export async function collapseSidebar(page: Page): Promise<void> {
  const isMobile = page.viewportSize()!.width < 1024;
  if (isMobile) return;
  const sidebarWrapper = page.locator('[data-slot="sidebar"]');
  const state = await sidebarWrapper.getAttribute("data-state");
  if (state === "expanded") {
    await page.getByTestId("sidebar-trigger").click();
    await expect(sidebarWrapper).toHaveAttribute("data-state", "collapsed", {
      timeout: Timeouts.animation,
    });
  }
}
