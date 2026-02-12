/**
 * Screenshot automation utilities.
 * Reuses E2E page objects and helpers for consistent behavior.
 */

import { expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

import { SignInPage } from "../pages/sign-in.page";
import { isMobileViewport } from "../helpers/mobile-nav-helpers";

// =============================================================================
// Timing Constants
// =============================================================================

/** Animation settle time for UI transitions (ms). */
const ANIMATION_SETTLE_MS = 300;

/** Network idle wait time after navigation (ms). */
const NETWORK_SETTLE_MS = 500;

// =============================================================================
// Screenshot Names (Type-Safe)
// =============================================================================

/** All valid screenshot names for compile-time validation. */
export const SCREENSHOT_NAMES = [
  "01-library-grid",
  "02-tree-view",
  "04-tmdb-wizard",
  "06-google-drive-sync",
  "07-explore-page",
  "08-spotlight-search",
  "32-fork-dialog",
  "36-docs",
] as const;

/** Type-safe screenshot name. */
export type ScreenshotName = (typeof SCREENSHOT_NAMES)[number];

// =============================================================================
// Configuration
// =============================================================================

/** Screenshot output directory. */
export const SCREENSHOT_DIR = path.join(process.cwd(), "public", "portfolio");

/** Seeded user credentials. All users share this password. */
export const SEED_PASSWORD = "SeedPassword123!";

/** User configuration for screenshots. */
export interface ScreenshotUser {
  email: string;
  username: string;
}

/** Available seeded users. */
export const USERS: Record<string, ScreenshotUser> = {
  demo: { email: "demo@canoncore.com", username: "demo" },
  filmfan: { email: "filmfan@canoncore.com", username: "filmfan" },
};

// =============================================================================
// Directory Management (Cached)
// =============================================================================

/** Module-level flag to avoid repeated fs.existsSync calls. */
let dirEnsured = false;

/**
 * Ensures the screenshot directory exists.
 * Cached to avoid repeated filesystem checks.
 */
export function ensureScreenshotDir(): void {
  if (dirEnsured) return;
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  dirEnsured = true;
}

// =============================================================================
// Core Screenshot Functions
// =============================================================================

/**
 * Captures a screenshot with consistent settings.
 * Waits for all images to load before taking the screenshot.
 *
 * @param page - Playwright page
 * @param name - Screenshot filename (type-safe, without extension)
 */
export async function captureScreenshot(
  page: Page,
  name: ScreenshotName
): Promise<void> {
  ensureScreenshotDir();
  await page.waitForLoadState("networkidle");

  // Hide Next.js dev error overlay so it doesn't appear in screenshots
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });

  // Wait for all images to load (with 15s timeout per image)
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll("img"));
    const timeout = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return Promise.race([
          new Promise((resolve) => {
            img.onload = () => resolve(undefined);
            img.onerror = () => resolve(undefined);
          }),
          timeout(15000),
        ]);
      })
    );
  });

  await page.waitForTimeout(NETWORK_SETTLE_MS);

  // Detect desktop vs mobile based on viewport width
  const viewport = page.viewportSize();
  const isDesktop = viewport && viewport.width === 1920;
  const isMobile = viewport && viewport.width === 390;
  const suffix = isDesktop ? "-desktop" : isMobile ? "-mobile" : "";

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}${suffix}.png`),
    fullPage: false,
  });
}

// =============================================================================
// Authentication Helpers
// =============================================================================

/**
 * Signs in a user via the SignInPage page object.
 *
 * @param page - Playwright page
 * @param user - User to sign in
 */
export async function signIn(page: Page, user: ScreenshotUser): Promise<void> {
  const signInPage = new SignInPage(page);
  await signInPage.goto();
  await signInPage.signIn(user.email, SEED_PASSWORD);
  await page.waitForURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 15000 });
}

/**
 * Signs out the current user.
 * Handles both desktop (sidebar) and mobile (footer sheet) viewports.
 *
 * @param page - Playwright page
 */
export async function signOut(page: Page): Promise<void> {
  const isMobile = await isMobileViewport(page);

  if (isMobile) {
    // Mobile: Open settings sheet via footer Account button, then Account tab → Sign out
    const accountButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /account/i });
    await accountButton.click();
    await expect(page.getByRole("dialog", { name: /settings/i })).toBeVisible();
    await page.getByRole("tab", { name: /account/i }).click();
    await page.getByRole("button", { name: /sign out/i }).click();
  } else {
    // Desktop: Use sidebar user menu dropdown
    await page.getByTestId("my-items-user-menu").click();
    await page.getByTestId("my-items-sign-out-button").click();
  }

  await page.waitForURL("/sign-in", { timeout: 10000 });
}

// =============================================================================
// Setup
// =============================================================================

/**
 * Sets up page for screenshot capture with sign-in.
 *
 * @param page - Playwright page
 * @param user - User to sign in
 */
export async function setupForScreenshot(
  page: Page,
  user: ScreenshotUser
): Promise<void> {
  await signIn(page, user);
}

// =============================================================================
// View Mode Helpers
// =============================================================================

/**
 * Switches to grid view. Handles both desktop and mobile.
 *
 * @param page - Playwright page
 */
export async function switchToGridView(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await selectViewOption(page, "Grid");
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

/**
 * Switches to tree view. Handles both desktop and mobile.
 *
 * @param page - Playwright page
 */
export async function switchToTreeView(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await selectViewOption(page, "Tree");
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

/**
 * Selects a view option (Grid or Tree).
 * Desktop: Opens ViewDropdown and clicks menuitemradio.
 * Mobile: Opens MobileOptionsSheet, clicks option, closes sheet.
 * Follows the same pattern as PublicProfilePage.selectViewOption.
 */
async function selectViewOption(page: Page, label: string): Promise<void> {
  const mobileOptionsButton = page.getByRole("button", {
    name: "Options",
    exact: true,
  });

  // Desktop: ViewDropdown trigger shows current view name (Grid/Tree)
  const viewDropdown = page
    .getByRole("button", { name: /^(Grid|Tree)$/i })
    .first();

  await expect(mobileOptionsButton.or(viewDropdown).first()).toBeVisible({
    timeout: 10000,
  });

  const isMobile = await mobileOptionsButton.isVisible();

  if (isMobile) {
    await mobileOptionsButton.click();
    await expect(
      page.getByRole("dialog", { name: /(view|item) options/i })
    ).toBeVisible();
    const option = page.getByRole("option", {
      name: new RegExp(label, "i"),
    });
    await option.click();
    await expect(option).toHaveAttribute("aria-selected", "true");
    // Close sheet via overlay
    const overlay = page.locator("[data-vaul-overlay]");
    await overlay.click({ force: true, position: { x: 10, y: 10 } });
    await expect(
      page.getByRole("dialog", { name: /(view|item) options/i })
    ).not.toBeVisible({ timeout: 5000 });
  } else {
    await viewDropdown.click();
    await page
      .getByRole("menuitemradio", { name: new RegExp(label, "i") })
      .click();
  }
}

// =============================================================================
// Dialog Helpers
// =============================================================================

/**
 * Opens the settings dialog/sheet.
 * Desktop: sidebar user menu → settings button.
 * Mobile: footer Account button → settings sheet (opens directly).
 *
 * @param page - Playwright page
 */
export async function openSettings(page: Page): Promise<void> {
  const isMobile = await isMobileViewport(page);

  if (isMobile) {
    // Mobile: Account button opens MobileSettingsSheet directly
    const accountButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /account/i });
    await accountButton.click();
    await expect(page.getByRole("dialog", { name: /settings/i })).toBeVisible();
  } else {
    // Desktop: Open sidebar if collapsed, then user menu → settings
    const userMenu = page.getByTestId("my-items-user-menu");
    const isUserMenuVisible = await userMenu.isVisible().catch(() => false);

    if (!isUserMenuVisible) {
      await page.getByTestId("sidebar-trigger").click();
      await page.waitForTimeout(500);
    }

    await userMenu.click();
    await page.getByTestId("my-items-settings-button").click();
  }

  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
}

/**
 * Closes any open dialog or sheet.
 *
 * @param page - Playwright page
 */
export async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

// =============================================================================
// Navigation Helpers
// =============================================================================

/**
 * Waits for hero carousel to be visible and loaded.
 *
 * @param page - Playwright page
 */
export async function waitForHero(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="hero-carousel"]', {
    timeout: 10000,
  });
  await page.waitForLoadState("networkidle");

  // Wait for hero image to load
  const heroImage = page.locator('[data-testid="hero-carousel"] img').first();
  if ((await heroImage.count()) > 0) {
    await heroImage.evaluate((img: HTMLImageElement) => {
      if (img.complete) return;
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
  }

  await page.waitForTimeout(300);
}

/**
 * Opens spotlight search.
 * Desktop: clicks search button in sidebar.
 * Mobile: clicks search button in footer nav.
 *
 * @param page - Playwright page
 */
export async function openSpotlight(page: Page): Promise<void> {
  const isMobile = await isMobileViewport(page);

  if (isMobile) {
    // Mobile: Use footer search button
    const searchButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /search/i });
    await searchButton.click();
  } else {
    // Desktop: Use sidebar search button
    const searchButton = page.getByRole("button", { name: /search/i }).first();
    const isSearchVisible = await searchButton.isVisible().catch(() => false);

    if (!isSearchVisible) {
      await page.getByTestId("sidebar-trigger").click();
      await page.waitForTimeout(500);
    }

    await searchButton.click();
  }

  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await page.waitForTimeout(NETWORK_SETTLE_MS);
}

/**
 * Enters edit mode.
 *
 * @param page - Playwright page
 */
export async function enterEditMode(page: Page): Promise<void> {
  const editButton = page.getByRole("button", { name: /^edit$/i });
  if (await editButton.isVisible()) {
    await editButton.click();
    await page.waitForTimeout(ANIMATION_SETTLE_MS);
  }
}

// =============================================================================
// Item Interaction Helpers
// =============================================================================

/**
 * Clicks on an item by name.
 * Handles both tree view (listitem) and grid view (button/title) elements.
 *
 * @param page - Playwright page
 * @param name - Item name to click
 */
export async function clickItem(page: Page, name: string): Promise<void> {
  const treeItem = page.getByRole("listitem").getByText(name, { exact: true });
  const gridItem = page
    .locator('[data-testid="grid-item-title"]')
    .filter({ hasText: name });
  const gridButton = page.getByRole("button", { name, exact: true });

  await treeItem.or(gridButton).or(gridItem).first().click();
  await page.waitForLoadState("networkidle");
}
