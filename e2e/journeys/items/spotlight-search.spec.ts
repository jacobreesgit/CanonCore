/**
 * E2E tests for Spotlight Search functionality.
 */

import { test, expect } from "../../fixtures";
import { SpotlightPage } from "../../pages/spotlight.page";
import { MobileFooterPage } from "../../pages/mobile-footer.page";
import { isMobileViewport } from "../../helpers/mobile-nav-helpers";

test.describe("Spotlight Search Journey", () => {
  let spotlightPage: SpotlightPage;

  test.beforeEach(async ({ page, testUser, itemsPage }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create test items for searching
    await itemsPage.createItem("Star Wars");
    await itemsPage.createItem("Empire Strikes Back");
    await itemsPage.createItem("Return of the Jedi");
    await itemsPage.createItem("Documentary Film", "nature wildlife");

    spotlightPage = new SpotlightPage(page);
  });

  test("opens spotlight with keyboard shortcut", async () => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();
  });

  test("opens spotlight via sidebar button", async ({ page }) => {
    // Skip on mobile - sidebar button doesn't exist on mobile
    const isMobile = await isMobileViewport(page);
    test.skip(isMobile, "Sidebar search button is only available on desktop");

    // Ensure sidebar is visible
    const searchButton = page.getByRole("button", { name: /search/i }).first();
    if (!(await searchButton.isVisible())) {
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
      // Wait for sidebar to open and search button to be visible
      await searchButton.waitFor({ state: "visible", timeout: 5000 });
    }

    await spotlightPage.openViaSidebar();
    await spotlightPage.expectOpen();
  });

  test("closes spotlight with Escape key", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();

    await page.keyboard.press("Escape");
    await spotlightPage.expectClosed();
  });

  test("finds items by name", async () => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.search("Star");

    await spotlightPage.expectResultVisible("Star Wars");
  });

  test("fuzzy matches with typos", async () => {
    await spotlightPage.openWithKeyboard();
    // cmdk's fuzzy filtering should match despite typo
    await spotlightPage.search("Satr");

    await spotlightPage.expectResultVisible("Star Wars");
  });

  test("finds items by description", async () => {
    await spotlightPage.openWithKeyboard();
    // Search by description text
    await spotlightPage.search("wildlife");

    await spotlightPage.expectResultVisible("Documentary Film");
  });

  test("shows no results for non-matching query", async () => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.search("xyznonexistent");

    await spotlightPage.expectNoResults();
  });

  test("navigates to item on selection", async ({ page, itemsPage }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();
    await spotlightPage.search("Empire");
    await spotlightPage.expectResultVisible("Empire Strikes Back");
    await spotlightPage.selectResult("Empire Strikes Back");

    // Should navigate to item detail page
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+\/[a-z0-9-]+/);
    // Check hero heading which shows item name
    await itemsPage.expectHeroVisible("Empire Strikes Back");
  });

  test("clears search when dialog reopens", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.search("Star");
    await page.keyboard.press("Escape");
    // Wait for dialog to fully close before reopening
    await spotlightPage.expectClosed();

    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();
    await expect(spotlightPage.searchInput).toHaveValue("");
  });

  test("keyboard navigation through results", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();
    // Search for unique item name to avoid matching seed data users/public items
    await spotlightPage.search("Empire Strikes Back");

    // Wait for results to appear
    await spotlightPage.expectResultVisible("Empire Strikes Back");

    // Use arrow keys to navigate and select
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Should navigate to selected item
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+\/[a-z0-9-]+/);
  });

  test("shows keyboard shortcut hint", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();

    // Should display keyboard shortcut hints in the footer
    await expect(page.getByText(/\/.*to search/i)).toBeVisible();
    await expect(page.getByText(/esc.*to close/i)).toBeVisible();
  });

  test("shows breadcrumb path for nested items", async ({
    page,
    itemsPage,
  }) => {
    // Create nested item structure: Parent > Child
    await itemsPage.createItem("Parent Folder");
    await itemsPage.clickItem("Parent Folder");
    await itemsPage.createItem("Nested Item");

    // Go back to root and open spotlight
    await itemsPage.goto();
    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();

    // Search for nested item
    await spotlightPage.search("Nested");
    await spotlightPage.expectResultVisible("Nested Item");

    // Verify breadcrumb path is shown
    await expect(page.getByText("Parent Folder").first()).toBeVisible();
  });
});

test.describe("Spotlight Search - Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("spotlight works on mobile via keyboard", async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    const spotlightPage = new SpotlightPage(page);

    // Use keyboard shortcut (works even on mobile)
    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();
  });

  test("opens search via mobile footer button", async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    const mobileFooter = new MobileFooterPage(page);

    // Open search via footer button
    await mobileFooter.openSearchSheet();

    // Verify search sheet is open with input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
  });

  test("can search and select result on mobile", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create a test item
    await itemsPage.createItem("Mobile Test Item");

    const mobileFooter = new MobileFooterPage(page);

    // Open search via footer
    await mobileFooter.openSearchSheet();

    // Search for the item
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("Mobile Test");

    // Verify result appears and click it
    const result = page.getByRole("option", { name: /mobile test item/i });
    await expect(result).toBeVisible();
    await result.click();

    // Should navigate to item
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+\/[a-z0-9-]+/);
  });
});
