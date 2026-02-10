/**
 * Screenshot automation utilities.
 * Provides helpers for consistent screenshot capture across portfolio images.
 */

import { Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

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
  "05-progress-tracking",
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

  // Wait for all images to load
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll("img"));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = () => resolve(undefined);
          img.onerror = () => resolve(undefined); // Resolve even on error
        });
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
 * Signs in a user via the UI.
 *
 * @param page - Playwright page
 * @param user - User to sign in
 */
export async function signIn(page: Page, user: ScreenshotUser): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByTestId("sign-in-password-input").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(`/u/${user.username}`, { timeout: 15000 });
}

/**
 * Signs out the current user.
 * Handles both desktop (sidebar) and mobile (footer sheet) viewports.
 *
 * @param page - Playwright page
 */
export async function signOut(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  const isMobile = viewport && viewport.width < 1024;

  if (isMobile) {
    // Mobile: Open account sheet via footer nav, then sign out
    const accountButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /account/i });
    await accountButton.click();
    const sheet = page.getByRole("dialog", { name: /account/i });
    await sheet.waitFor({ state: "visible" });
    await sheet.getByRole("button", { name: /sign out/i }).click();
  } else {
    // Desktop: Use sidebar user menu dropdown
    await page.getByTestId("my-items-user-menu").click();
    await page.getByTestId("my-items-sign-out-button").click();
  }

  await page.waitForURL("/sign-in", { timeout: 10000 });
}

// =============================================================================
// Theme Helpers
// =============================================================================

/**
 * Verifies the app is in dark mode.
 * The app is now dark mode only - no light mode support.
 *
 * @param page - Playwright page
 */
export async function expectDarkMode(page: Page): Promise<void> {
  const html = page.locator("html");
  await html.waitFor({ state: "attached" });
  // Dark mode is now forced - just verify the class is present
  const isDark = await html.evaluate((el) => el.classList.contains("dark"));
  if (!isDark) {
    throw new Error("Expected dark mode but page is not in dark mode");
  }
}

/**
 * Sets up page for screenshot capture with sign-in.
 * Dark mode is now the only mode.
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
 * Switches to grid view.
 *
 * @param page - Playwright page
 */
export async function switchToGridView(page: Page): Promise<void> {
  // Wait for page to load items first (toolbar appears when items exist)
  await page.waitForLoadState("networkidle");
  // The button has aria-label="Grid view"
  const gridButton = page.getByLabel("Grid view");
  await gridButton.waitFor({ state: "visible", timeout: 5000 });
  await gridButton.click();
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

/**
 * Switches to tree view.
 *
 * @param page - Playwright page
 */
export async function switchToTreeView(page: Page): Promise<void> {
  // Wait for page to load items first (toolbar appears when items exist)
  await page.waitForLoadState("networkidle");
  // The button has aria-label="Tree view"
  const treeButton = page.getByLabel("Tree view");
  await treeButton.waitFor({ state: "visible", timeout: 5000 });
  await treeButton.click();
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

// =============================================================================
// Dialog Helpers
// =============================================================================

/**
 * Opens the settings dialog.
 * Handles both desktop (sidebar) and mobile (footer sheet) viewports.
 *
 * @param page - Playwright page
 */
export async function openSettings(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  const isMobile = viewport && viewport.width < 1024;

  if (isMobile) {
    // Mobile: Open account sheet via footer nav, then settings
    const accountButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /account/i });
    await accountButton.click();
    const sheet = page.getByRole("dialog", { name: /account/i });
    await sheet.waitFor({ state: "visible" });
    await sheet.getByRole("button", { name: /settings/i }).click();
  } else {
    // Desktop: Open sidebar if collapsed, then user menu
    const userMenu = page.getByTestId("my-items-user-menu");
    const isUserMenuVisible = await userMenu.isVisible().catch(() => false);

    if (!isUserMenuVisible) {
      await page.getByTestId("sidebar-trigger").click();
      await page.waitForTimeout(500); // Wait for sidebar animation
    }

    await userMenu.click();
    await page.getByTestId("my-items-settings-button").click();
  }

  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
}

/**
 * Closes any open dialog.
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
 * Also waits for hero image to fully load.
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
        img.onerror = resolve; // Resolve even on error to avoid hanging
      });
    });
  }

  await page.waitForTimeout(300); // Additional settle time for any CSS transitions
}

/**
 * Opens spotlight search via sidebar button.
 * On mobile, opens sidebar first if needed.
 *
 * @param page - Playwright page
 */
export async function openSpotlight(page: Page): Promise<void> {
  const searchButton = page.getByRole("button", { name: /search/i }).first();
  const isSearchButtonVisible = await searchButton
    .isVisible()
    .catch(() => false);

  if (!isSearchButtonVisible) {
    // Click sidebar trigger to open sidebar on mobile
    await page.getByTestId("sidebar-trigger").click();
    await page.waitForTimeout(500); // Wait for sidebar animation
  }

  await searchButton.click();
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
 * Handles both tree view (listitem) and grid view (button) elements.
 *
 * @param page - Playwright page
 * @param name - Item name to click
 */
export async function clickItem(page: Page, name: string): Promise<void> {
  // Tree view: items are in listitem elements
  const treeItem = page.getByRole("listitem").getByText(name, { exact: true });
  // Grid view: items are buttons with the item name
  const gridButton = page.getByRole("button", { name, exact: true });
  // Grid view: unique title element (no hover overlay duplicate)
  const gridItem = page
    .locator('[data-testid="grid-item-title"]')
    .filter({ hasText: name });

  await treeItem.or(gridButton).or(gridItem).first().click();
  await page.waitForLoadState("networkidle");
}

/**
 * Opens the more options menu for an item by hovering and clicking the "..." button.
 *
 * @param page - Playwright page
 * @param name - Item name to open menu for
 */
export async function openContextMenu(page: Page, name: string): Promise<void> {
  const mainContent = page.getByRole("main");
  const treeContainer = mainContent
    .getByRole("listitem")
    .filter({ hasText: name });
  const gridContainer = mainContent
    .locator("[data-id]")
    .filter({ hasText: name });
  const container = treeContainer.or(gridContainer).first();

  await container.scrollIntoViewIfNeeded();
  await container.hover();
  const moreButton = container.getByRole("button", {
    name: /more options/i,
  });
  await moreButton.click();
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

/**
 * Deletes an item by name via context menu.
 * Used for test cleanup.
 *
 * @param page - Playwright page
 * @param name - Item name to delete
 */
export async function deleteItem(page: Page, name: string): Promise<void> {
  await openContextMenu(page, name);
  await page.getByRole("menuitem", { name: /delete/i }).click();
  const confirmButton = page.getByRole("button", { name: /confirm|delete/i });
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }
  await page.waitForTimeout(NETWORK_SETTLE_MS);
}

// =============================================================================
// Toolbar Helpers
// =============================================================================

/**
 * Opens the sort dropdown.
 *
 * @param page - Playwright page
 */
export async function openSortDropdown(page: Page): Promise<void> {
  // Button text is the current sort label (e.g., "Custom Order" when at default)
  const sortButton = page.getByRole("button", { name: /custom order/i });
  await sortButton.click();
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

/**
 * Opens the filter dropdown.
 *
 * @param page - Playwright page
 */
export async function openFilterDropdown(page: Page): Promise<void> {
  // Button text is the current filter label (e.g., "All Items" when at default)
  const filterButton = page.getByRole("button", { name: /all items/i });
  await filterButton.click();
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

/**
 * Selects a filter option.
 *
 * @param page - Playwright page
 * @param option - Filter option text
 */
export async function selectFilter(page: Page, option: string): Promise<void> {
  await openFilterDropdown(page);
  // FilterDropdown uses DropdownMenuRadioItem which has role="menuitemradio"
  await page.getByRole("menuitemradio", { name: option }).click();
  await page.waitForTimeout(NETWORK_SETTLE_MS);
}
