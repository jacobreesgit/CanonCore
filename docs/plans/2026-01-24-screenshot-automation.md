# Screenshot Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Playwright script that captures 35 portfolio screenshots across multiple users, themes, and UI states.

**Architecture:** A dedicated Playwright test file with helper functions for screenshot capture, organized by screenshot category. Uses direct database login (bypassing UI auth) for speed, and captures at 1920x1080. Screenshots save to `public/portfolio/` with numbered naming convention.

**Tech Stack:** Playwright, TypeScript, Prisma (direct DB auth), existing Page Object Models

---

## Prerequisites

Before running the screenshot script:

1. Run seed: `pnpm prisma db seed`
   - This automatically connects Google Drive for demo user (screenshot #6)
   - Requires `GOOGLE_SEED_REFRESH_TOKEN` and `GOOGLE_SEED_ROOT_FOLDER_ID` env vars
2. (Optional) For video player screenshot (#3): Place `Breaking.Bad.S01E01.1080p.BluRay.x265-RARBG.mp4` in project root before seeding
   - If the file exists, seed will upload it to demo user's Breaking Bad S1E1
   - If not, screenshot #3 will show the episode detail without video playback

---

## Task 1: Create Screenshot Utility Functions

**Files:**

- Create: `e2e/screenshots/utils.ts`

**Step 1: Write the utility file**

```typescript
/**
 * Screenshot automation utilities.
 * Provides helpers for consistent screenshot capture across portfolio images.
 */

import { Page } from "@playwright/test";
import path from "path";
import fs from "fs";

// =============================================================================
// Timing Constants
// =============================================================================

/** Animation settle time for UI transitions (ms). */
const ANIMATION_SETTLE_MS = 300;

/** Network idle wait time after navigation (ms). */
const NETWORK_SETTLE_MS = 500;

/** Extended wait for complex operations like search results (ms). */
const EXTENDED_WAIT_MS = 1000;

/** Carousel auto-advance observation time (ms). */
const CAROUSEL_WAIT_MS = 2000;

// =============================================================================
// Screenshot Names (Type-Safe)
// =============================================================================

/** All valid screenshot names for compile-time validation. */
export const SCREENSHOT_NAMES = [
  "01-library-grid",
  "02-tree-view",
  "03-video-player",
  "04-tmdb-wizard",
  "05-progress-tracking",
  "06-google-drive-sync",
  "07-public-profile",
  "08-spotlight-search",
  "09-edit-mode",
  "10-filmfan-grid",
  "11-bingewatcher-grid",
  "12-scifi-grid",
  "13-scifi-tree",
  "14-grid-dark",
  "15-tree-dark",
  "16-spotlight-dark",
  "17-public-dark",
  "18-settings-dark",
  "19-matrix-detail",
  "20-breaking-bad-detail",
  "21-episode-detail",
  "22-spirited-away-detail",
  "23-empty-state",
  "24-bulk-selection",
  "25-context-menu",
  "26-filter-active",
  "27-sort-dropdown",
  "28-progress-nearly-complete",
  "29-progress-just-started",
  "30-progress-mid",
  "31-explore-page",
  "32-fork-dialog",
  "33-profile-settings",
  "34-multi-carousel",
  "35-single-hero",
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
  bingewatcher: {
    email: "bingewatcher@canoncore.com",
    username: "bingewatcher",
  },
  scifi: { email: "scifi@canoncore.com", username: "scifi_jordan" },
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
  await page.waitForTimeout(NETWORK_SETTLE_MS);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
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
 *
 * @param page - Playwright page
 */
export async function signOut(page: Page): Promise<void> {
  await page.getByTestId("my-items-user-menu").click();
  await page.getByTestId("my-items-sign-out-button").click();
  await page.waitForURL("/sign-in", { timeout: 10000 });
}

// =============================================================================
// Theme Helpers
// =============================================================================

/**
 * Toggles theme between light and dark mode.
 *
 * @param page - Playwright page
 */
export async function toggleTheme(page: Page): Promise<void> {
  const toggle = page.getByTestId("theme-toggle");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

/**
 * Sets the theme to a specific mode.
 *
 * @param page - Playwright page
 * @param mode - "light" or "dark"
 */
export async function setTheme(
  page: Page,
  mode: "light" | "dark"
): Promise<void> {
  const html = page.locator("html");
  const isDark = await html.evaluate((el) => el.classList.contains("dark"));

  if (mode === "dark" && !isDark) {
    await toggleTheme(page);
  } else if (mode === "light" && isDark) {
    await toggleTheme(page);
  }
}

/**
 * Sets up page for screenshot capture with sign-in and theme.
 * Combines common setup steps to reduce boilerplate in tests.
 *
 * @param page - Playwright page
 * @param user - User to sign in
 * @param theme - Theme mode (default: "light")
 */
export async function setupForScreenshot(
  page: Page,
  user: ScreenshotUser,
  theme: "light" | "dark" = "light"
): Promise<void> {
  await signIn(page, user);
  await setTheme(page, theme);
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
  const gridButton = page.getByRole("button", { name: /grid/i });
  if (await gridButton.isVisible()) {
    await gridButton.click();
    await page.waitForTimeout(ANIMATION_SETTLE_MS);
  }
}

/**
 * Switches to tree view.
 *
 * @param page - Playwright page
 */
export async function switchToTreeView(page: Page): Promise<void> {
  const treeButton = page.getByRole("button", { name: /tree/i });
  if (await treeButton.isVisible()) {
    await treeButton.click();
    await page.waitForTimeout(ANIMATION_SETTLE_MS);
  }
}

// =============================================================================
// Dialog Helpers
// =============================================================================

/**
 * Opens the settings dialog.
 *
 * @param page - Playwright page
 */
export async function openSettings(page: Page): Promise<void> {
  await page.getByTestId("my-items-user-menu").click();
  await page.getByTestId("my-items-settings-button").click();
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
 *
 * @param page - Playwright page
 */
export async function waitForHero(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="hero-carousel"]', {
    timeout: 10000,
  });
  await page.waitForLoadState("networkidle");
}

/**
 * Opens spotlight search with "/" key.
 *
 * @param page - Playwright page
 */
export async function openSpotlight(page: Page): Promise<void> {
  await page.keyboard.press("/");
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
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
 *
 * @param page - Playwright page
 * @param name - Item name to click
 */
export async function clickItem(page: Page, name: string): Promise<void> {
  await page.getByRole("link", { name }).first().click();
  await page.waitForLoadState("networkidle");
}

/**
 * Right-clicks on an item to open context menu.
 *
 * @param page - Playwright page
 * @param name - Item name to right-click
 */
export async function openContextMenu(page: Page, name: string): Promise<void> {
  await page.getByRole("link", { name }).first().click({ button: "right" });
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
  const sortButton = page.getByRole("button", { name: /sort/i });
  await sortButton.click();
  await page.waitForTimeout(ANIMATION_SETTLE_MS);
}

/**
 * Opens the filter dropdown.
 *
 * @param page - Playwright page
 */
export async function openFilterDropdown(page: Page): Promise<void> {
  const filterButton = page.getByRole("button", { name: /filter/i });
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
  await page.getByRole("menuitem", { name: option }).click();
  await page.waitForTimeout(NETWORK_SETTLE_MS);
}
```

**Step 2: Commit**

```bash
git add e2e/screenshots/utils.ts
git commit -m "feat(e2e): add screenshot automation utilities"
```

---

## Task 2: Create Main Screenshots Test File

**Files:**

- Create: `e2e/screenshots/portfolio.spec.ts`

**Step 1: Write the test file structure**

```typescript
/**
 * Portfolio screenshot automation.
 * Captures 35 screenshots for the portfolio/marketing site.
 *
 * Run with: npx playwright test e2e/screenshots/portfolio.spec.ts
 */

import { test } from "@playwright/test";
import {
  USERS,
  setupForScreenshot,
  setTheme,
  switchToGridView,
  switchToTreeView,
  openSettings,
  closeDialog,
  waitForHero,
  openSpotlight,
  enterEditMode,
  clickItem,
  openContextMenu,
  deleteItem,
  openSortDropdown,
  selectFilter,
  captureScreenshot,
} from "./utils";

// Configure for 1920x1080 desktop viewport
test.use({
  viewport: { width: 1920, height: 1080 },
});

// Run tests serially to maintain login state between related screenshots
test.describe.configure({ mode: "serial" });

test.describe("Portfolio Screenshots", () => {
  // Clear any open dialogs before each test for resilience
  test.beforeEach(async ({ page }) => {
    await page.keyboard.press("Escape").catch(() => {});
  });

  // =========================================================================
  // Main Feature Screenshots (1-9)
  // =========================================================================

  test.describe("Main Features", () => {
    test("01 - Library Grid View", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await switchToGridView(page);
      await waitForHero(page);
      await captureScreenshot(page, "01-library-grid");
    });

    test("02 - Tree View", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Navigate to Breaking Bad to see tree view with episodes
      await clickItem(page, "TV Shows");
      await clickItem(page, "Breaking Bad");
      await switchToTreeView(page);
      // Expand seasons to show hierarchy
      const season1 = page.getByRole("treeitem", { name: /season 1/i });
      if (await season1.isVisible()) {
        await season1.click();
      }
      await captureScreenshot(page, "02-tree-view");
    });

    test("03 - Video Player", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Navigate to Breaking Bad S1E1
      await clickItem(page, "TV Shows");
      await clickItem(page, "Breaking Bad");
      await clickItem(page, "Season 1");
      await clickItem(page, "Episode 1");
      // Click play button
      const playButton = page.getByRole("button", { name: /play/i });
      if (await playButton.isVisible()) {
        await playButton.click();
        await page.waitForLoadState("networkidle");
      }
      await captureScreenshot(page, "03-video-player");
    });

    test("04 - TMDB Wizard", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Open Add Item dialog
      const addButton = page.getByRole("button", { name: /add/i });
      await addButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      // Search for a movie
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill("Inception");
      await page.waitForTimeout(1000);
      // Select a result to get to step 2 (poster selection)
      const result = page.getByRole("option").first();
      if (await result.isVisible()) {
        await result.click();
        await page.waitForTimeout(500);
        // Click next to get to poster selection
        const nextButton = page.getByRole("button", { name: /next/i });
        if (await nextButton.isVisible()) {
          await nextButton.click();
          await page.waitForTimeout(1000);
        }
      }
      await captureScreenshot(page, "04-tmdb-wizard");
    });

    test("05 - Progress Tracking", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Navigate to Breaking Bad folder to show progress
      await clickItem(page, "TV Shows");
      await clickItem(page, "Breaking Bad");
      await waitForHero(page);
      await captureScreenshot(page, "05-progress-tracking");
    });

    test("06 - Google Drive Sync", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await openSettings(page);
      // Navigate to Google Drive section (may be on Activity tab)
      const activityTab = page.getByRole("tab", { name: /activity/i });
      if (await activityTab.isVisible()) {
        await activityTab.click();
      }
      await captureScreenshot(page, "06-google-drive-sync");
    });

    test("07 - Public Profile", async ({ page }) => {
      // View filmfan's public profile as logged out user
      await page.goto("/u/filmfan");
      await setTheme(page, "light");
      await waitForHero(page);
      await captureScreenshot(page, "07-public-profile");
    });

    test("08 - Spotlight Search", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await openSpotlight(page);
      // Type to show results in all sections
      await page.keyboard.type("a");
      await page.waitForLoadState("networkidle");
      await captureScreenshot(page, "08-spotlight-search");
    });

    test("09 - Edit Mode", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await switchToGridView(page);
      await enterEditMode(page);
      await captureScreenshot(page, "09-edit-mode");
    });
  });

  // =========================================================================
  // Different Users' Libraries (10-13)
  // =========================================================================

  test.describe("User Libraries", () => {
    test("10 - filmfan Grid", async ({ page }) => {
      await setupForScreenshot(page, USERS.filmfan, "light");
      await switchToGridView(page);
      await waitForHero(page);
      await captureScreenshot(page, "10-filmfan-grid");
    });

    test("11 - bingewatcher Grid", async ({ page }) => {
      await setupForScreenshot(page, USERS.bingewatcher, "light");
      await switchToGridView(page);
      await waitForHero(page);
      await captureScreenshot(page, "11-bingewatcher-grid");
    });

    test("12 - scifi_jordan Grid", async ({ page }) => {
      await setupForScreenshot(page, USERS.scifi, "light");
      await switchToGridView(page);
      await waitForHero(page);
      await captureScreenshot(page, "12-scifi-grid");
    });

    test("13 - scifi_jordan Tree (Doctor Who)", async ({ page }) => {
      await setupForScreenshot(page, USERS.scifi, "light");
      await clickItem(page, "TV Shows");
      await clickItem(page, "Doctor Who");
      await switchToTreeView(page);
      await captureScreenshot(page, "13-scifi-tree");
    });
  });

  // =========================================================================
  // Dark Mode Variants (14-18)
  // =========================================================================

  test.describe("Dark Mode", () => {
    test("14 - Grid View (Dark)", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "dark");
      await switchToGridView(page);
      await waitForHero(page);
      await captureScreenshot(page, "14-grid-dark");
    });

    test("15 - Tree View (Dark)", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "dark");
      await clickItem(page, "TV Shows");
      await clickItem(page, "Breaking Bad");
      await switchToTreeView(page);
      await captureScreenshot(page, "15-tree-dark");
    });

    test("16 - Spotlight Search (Dark)", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "dark");
      await openSpotlight(page);
      await page.keyboard.type("m");
      await page.waitForLoadState("networkidle");
      await captureScreenshot(page, "16-spotlight-dark");
    });

    test("17 - Public Profile (Dark)", async ({ page }) => {
      await page.goto("/u/filmfan");
      await setTheme(page, "dark");
      await waitForHero(page);
      await captureScreenshot(page, "17-public-dark");
    });

    test("18 - Settings Dialog (Dark)", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "dark");
      await openSettings(page);
      await captureScreenshot(page, "18-settings-dark");
    });
  });

  // =========================================================================
  // Item Detail Pages (19-22)
  // =========================================================================

  test.describe("Item Details", () => {
    test("19 - Movie Detail - The Matrix", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await clickItem(page, "Movies");
      await clickItem(page, "The Matrix");
      await waitForHero(page);
      await captureScreenshot(page, "19-matrix-detail");
    });

    test("20 - TV Show Detail - Breaking Bad", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await clickItem(page, "TV Shows");
      await clickItem(page, "Breaking Bad");
      await waitForHero(page);
      await captureScreenshot(page, "20-breaking-bad-detail");
    });

    test("21 - Episode Detail", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await clickItem(page, "TV Shows");
      await clickItem(page, "Breaking Bad");
      await clickItem(page, "Season 1");
      await clickItem(page, "Episode 1");
      await waitForHero(page);
      await captureScreenshot(page, "21-episode-detail");
    });

    test("22 - International Film - Spirited Away", async ({ page }) => {
      await setupForScreenshot(page, USERS.filmfan, "light");
      await clickItem(page, "Movies");
      await clickItem(page, "Spirited Away");
      await waitForHero(page);
      await captureScreenshot(page, "22-spirited-away-detail");
    });
  });

  // =========================================================================
  // UI States (23-27)
  // =========================================================================

  test.describe("UI States", () => {
    test("23 - Empty State", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Create a temporary empty folder
      const addButton = page.getByRole("button", { name: /add/i });
      await addButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      const nameInput = page.getByLabel(/name/i);
      await nameInput.fill("Empty Test Folder");
      const createButton = page.getByRole("button", { name: /create/i });
      await createButton.click();
      await page.waitForLoadState("networkidle");
      // Navigate into the empty folder
      await clickItem(page, "Empty Test Folder");
      await captureScreenshot(page, "23-empty-state");

      // Cleanup: delete the test folder
      await page.goto(`/u/${USERS.demo.username}`);
      await enterEditMode(page);
      await deleteItem(page, "Empty Test Folder");
    });

    test("24 - Bulk Selection", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await switchToGridView(page);
      await enterEditMode(page);
      // Select multiple items using checkboxes
      const checkboxes = page.locator('[type="checkbox"]');
      const count = await checkboxes.count();
      for (let i = 0; i < Math.min(3, count); i++) {
        await checkboxes.nth(i).check();
      }
      await captureScreenshot(page, "24-bulk-selection");
    });

    test("25 - Context Menu", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await switchToGridView(page);
      // Right-click on Movies folder
      await openContextMenu(page, "Movies");
      await captureScreenshot(page, "25-context-menu");
    });

    test("26 - Filter Active", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await switchToGridView(page);
      await selectFilter(page, "Has Files");
      await captureScreenshot(page, "26-filter-active");
    });

    test("27 - Sort Dropdown", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await switchToGridView(page);
      await openSortDropdown(page);
      await captureScreenshot(page, "27-sort-dropdown");
    });
  });

  // =========================================================================
  // Progress Variations (28-30)
  // =========================================================================

  test.describe("Progress Variations", () => {
    test("28 - Nearly Complete (~90%)", async ({ page }) => {
      await setupForScreenshot(page, USERS.filmfan, "light");
      // filmfan has 80-100% progress range
      await clickItem(page, "Movies");
      await waitForHero(page);
      await captureScreenshot(page, "28-progress-nearly-complete");
    });

    test("29 - Just Started (~20%)", async ({ page }) => {
      await setupForScreenshot(page, USERS.bingewatcher, "light");
      // bingewatcher has 10-95% range
      await clickItem(page, "TV Shows");
      await waitForHero(page);
      await captureScreenshot(page, "29-progress-just-started");
    });

    test("30 - Mid-Progress (~50%)", async ({ page }) => {
      await setupForScreenshot(page, USERS.scifi, "light");
      // scifi_jordan has 40-95% range
      await clickItem(page, "TV Shows");
      await waitForHero(page);
      await captureScreenshot(page, "30-progress-mid");
    });
  });

  // =========================================================================
  // Public/Social Features (31-33)
  // =========================================================================

  test.describe("Social Features", () => {
    test("31 - Explore Page", async ({ page }) => {
      await page.goto("/explore");
      await setTheme(page, "light");
      await waitForHero(page);
      await captureScreenshot(page, "31-explore-page");
    });

    test("32 - Fork Dialog", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Go to filmfan's profile and click fork
      await page.goto("/u/filmfan");
      await waitForHero(page);
      // Find and click the fork button on an item
      const forkButton = page.getByRole("button", { name: /fork/i }).first();
      if (await forkButton.isVisible()) {
        await forkButton.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      }
      await captureScreenshot(page, "32-fork-dialog");
    });

    test("33 - Profile Settings", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await openSettings(page);
      // Navigate to Profile tab
      const profileTab = page.getByRole("tab", { name: /profile/i });
      if (await profileTab.isVisible()) {
        await profileTab.click();
      }
      await captureScreenshot(page, "33-profile-settings");
    });
  });

  // =========================================================================
  // Hero Carousel States (34-35)
  // =========================================================================

  test.describe("Hero Carousel", () => {
    test("34 - Multi-slide Carousel", async ({ page }) => {
      await page.goto("/explore");
      await setTheme(page, "light");
      await waitForHero(page);
      // Wait for carousel to potentially auto-advance
      await page.waitForLoadState("networkidle");
      await captureScreenshot(page, "34-multi-carousel");
    });

    test("35 - Single Hero Banner", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await clickItem(page, "Movies");
      await clickItem(page, "The Godfather");
      await waitForHero(page);
      await captureScreenshot(page, "35-single-hero");
    });
  });
});
```

**Step 2: Commit**

```bash
git add e2e/screenshots/portfolio.spec.ts
git commit -m "feat(e2e): add portfolio screenshot automation tests"
```

---

## Task 3: Add Playwright Config for Screenshots

**Files:**

- Create: `e2e/screenshots/playwright.config.ts`

**Step 1: Write dedicated screenshot config**

```typescript
/**
 * Playwright config for screenshot automation.
 * Optimized for capturing portfolio images at 1920x1080.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  timeout: 60000,
  expect: {
    timeout: 10000,
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
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  webServer: {
    command: "BYPASS_RATE_LIMIT=true pnpm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

**Step 2: Commit**

```bash
git add e2e/screenshots/playwright.config.ts
git commit -m "feat(e2e): add dedicated playwright config for screenshots"
```

---

## Task 4: Add NPM Script for Screenshot Capture

**Files:**

- Modify: `package.json`

**Step 1: Add script to package.json**

Find the `"scripts"` section and add:

```json
"screenshots": "playwright test --config=e2e/screenshots/playwright.config.ts"
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "feat: add screenshots npm script"
```

---

## Task 5: Update .gitignore for Screenshots

**Files:**

- Modify: `.gitignore`

**Step 1: Add portfolio directory exception**

The screenshots should be committed, so ensure `public/portfolio/` is NOT in `.gitignore`. If there's a rule that would exclude it, add an exception:

```
# Portfolio screenshots should be committed
!public/portfolio/
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: allow portfolio screenshots in git"
```

---

## Task 6: Test Run and Validation

**Step 1: Verify seed data exists**

```bash
pnpm prisma db seed
```

Expected: Seed completes successfully with demo, filmfan, bingewatcher, scifi users.

**Step 2: Run screenshot script**

```bash
pnpm run screenshots
```

Expected: 35 screenshots captured in `public/portfolio/`.

**Step 3: Verify screenshots**

```bash
ls -la public/portfolio/
```

Expected: 35 PNG files named `01-library-grid.png` through `35-single-hero.png`.

**Step 4: Commit screenshots**

```bash
git add public/portfolio/*.png
git commit -m "feat: add portfolio screenshots"
```

---

## Known Issues & Edge Cases

1. **Screenshot #3 (Video Player)**: Requires video uploaded to Breaking Bad S1E1. Script will capture whatever state exists.

2. **Screenshot #6 (Google Drive)**: Requires demo user has Drive connected. If not connected, will show "Connect" button instead.

3. **Dark mode persistence**: Theme toggle uses localStorage. Each test starts fresh with page context.

4. **Network timing**: Some screenshots may capture loading states. Uses `waitForLoadState("networkidle")` for consistency.

---

## Summary

| Task | Description                 | Files                                  |
| ---- | --------------------------- | -------------------------------------- |
| 1    | Screenshot utilities        | `e2e/screenshots/utils.ts`             |
| 2    | Main test file (35 tests)   | `e2e/screenshots/portfolio.spec.ts`    |
| 3    | Dedicated Playwright config | `e2e/screenshots/playwright.config.ts` |
| 4    | NPM script                  | `package.json`                         |
| 5    | Gitignore update            | `.gitignore`                           |
| 6    | Test run and validation     | N/A                                    |

Total: 35 screenshots across 9 main features + 26 marquee variations.
