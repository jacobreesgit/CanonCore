/**
 * Screenshot utility functions using new POMs and conventions.
 * Replaces old helpers that relied on waitForTimeout, networkidle, and .first().
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { AuthPage } from "../pages/auth.page";
import { SettingsPage } from "../pages/settings.page";
import { ItemsSortFilterPage } from "../pages/items-sort-filter.page";
import { SEED_USERS } from "../config/test-data";
import { Timeouts } from "../config/timeouts";

/** Type-safe screenshot names for compile-time validation. */
type ScreenshotName =
  | "01-library-grid"
  | "02-tree-view"
  | "04-tmdb-wizard"
  | "06-google-drive-sync"
  | "07-explore-page"
  | "08-spotlight-search"
  | "32-fork-dialog"
  | "36-docs";

type SeedUser = keyof typeof SEED_USERS;

/**
 * Sign in as a seed user and wait for navigation to complete.
 *
 * @param page - Playwright page
 * @param user - Seed user key (demo, filmfan, testuser)
 */
export async function signIn(page: Page, user: SeedUser): Promise<void> {
  const auth = new AuthPage(page);
  await auth.gotoSignIn();
  await auth.signIn(SEED_USERS[user].email, SEED_USERS[user].password);
  // Wait for redirect to items page after sign-in
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page.getByTestId("hero-carousel").or(page.getByTestId("items-empty-state"))
  ).toBeVisible({
    timeout: Timeouts.heavy,
  });
}

/**
 * Wait for all images on the page to finish loading.
 * Uses page.evaluate to check naturalWidth on all <img> elements.
 */
async function waitForImages(page: Page): Promise<void> {
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.querySelectorAll("img")).map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
          // Safety timeout for images that never fire events
          setTimeout(resolve, 10_000);
        });
      })
    );
  });
}

/**
 * Capture a high-quality screenshot with proper image loading.
 * Waits for DOM content, all images, and a brief animation settle.
 *
 * @param page - Playwright page
 * @param name - Type-safe screenshot name
 */
export async function captureScreenshot(
  page: Page,
  name: ScreenshotName
): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await waitForImages(page);

  // Hide Next.js dev error overlay so it doesn't appear in screenshots
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });

  const isMobile = page.viewportSize()!.width < 1024;
  const suffix = isMobile ? "mobile" : "desktop";

  // Brief settle for CSS animations before capture
  await page.waitForTimeout(Timeouts.animation);

  await page.screenshot({
    path: `public/portfolio/${name}-${suffix}.png`,
    fullPage: false,
  });
}

/**
 * Wait for the hero carousel to be fully loaded with images.
 *
 * @param page - Playwright page
 */
export async function waitForHero(page: Page): Promise<void> {
  await expect(page.getByTestId("hero-carousel")).toBeVisible({
    timeout: Timeouts.heavy,
  });
  await waitForImages(page);
}

/**
 * Navigate to a specific carousel slide by name.
 * Expects autoplay to be disabled via `?autoplay=false` query param.
 *
 * @param page - Playwright page
 * @param slideName - Regex to match in the dot's aria-label (e.g. /squid game/i)
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
 * Open the settings dialog/sheet using the appropriate method for viewport.
 *
 * @param page - Playwright page
 */
export async function openSettings(page: Page): Promise<SettingsPage> {
  const isMobile = page.viewportSize()!.width < 1024;
  const settings = new SettingsPage(page, isMobile);
  await settings.open();
  return settings;
}

/**
 * Open the spotlight search dialog using the button (works on both viewports).
 * Uses role-based selectors for resilience across viewport sizes.
 *
 * @param page - Playwright page
 */
export async function openSpotlight(page: Page): Promise<void> {
  const isMobile = page.viewportSize()!.width < 1024;

  if (isMobile) {
    const searchButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /search/i });
    await searchButton.click();
  } else {
    const searchButton = page.getByRole("button", { name: /search/i }).first();
    await searchButton.click();
  }

  await page.waitForSelector('[role="dialog"]', { timeout: Timeouts.api });
}

/**
 * Switch to tree view using the appropriate method for viewport.
 *
 * @param page - Playwright page
 * @param username - The username for the items page
 */
export async function switchToTreeView(
  page: Page,
  username: string
): Promise<void> {
  const isMobile = page.viewportSize()!.width < 1024;
  const sortFilter = new ItemsSortFilterPage(page, username, isMobile);
  await sortFilter.switchToTree();
}
