/**
 * E2E tests for "Add Child Item" via context menu.
 * This option only appears in tree view (grid view disables it).
 * Desktop only — mobile uses sheets instead of context menus.
 */

import { test, expect } from "../../fixtures";

test.describe("Context Menu Add Child Item", () => {
  test.beforeEach(async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, {
      timeout: 10000,
    });
    await itemsPage.createItem("Parent Folder");
  });

  test("can add child item via context menu in tree view", async ({
    page,
    itemsPage,
    isMobile,
  }) => {
    test.skip(isMobile, "Context menu is desktop-only (mobile uses sheets)");

    // Navigate into parent and create a child
    await itemsPage.clickItem("Parent Folder");
    await itemsPage.createItem("First Child");

    // Switch to tree view (Add Child Item only available in tree view)
    await itemsPage.switchToTreeView();

    // Open context menu on the child item in tree view
    await itemsPage.openContextMenu("First Child");

    // "Add Child Item" should be visible in tree view context menu
    await expect(
      page.getByRole("menuitem", { name: /add child item/i })
    ).toBeVisible();

    // Click "Add Child Item"
    await page.getByRole("menuitem", { name: /add child item/i }).click();

    // Add item dialog should open
    await expect(
      page.getByRole("dialog", { name: /create item/i })
    ).toBeVisible({ timeout: 5000 });

    // Fill in the child name and create
    await page.getByLabel(/item name/i).fill("Grandchild Item");

    // Wait for TMDB popover to appear (if it does), then dismiss
    const tmdbPopover = page.getByTestId("tmdb-search-popover");
    await tmdbPopover
      .waitFor({ state: "visible", timeout: 1500 })
      .then(async () => {
        await page.keyboard.press("Escape");
        await expect(tmdbPopover).not.toBeVisible({ timeout: 3000 });
      })
      .catch(() => {});

    const createButton = page.getByRole("button", { name: /^create$/i });
    await expect(createButton).toBeEnabled({ timeout: 5000 });
    await createButton.click({ force: true });
    await expect(
      page.getByRole("dialog", { name: /create item/i })
    ).not.toBeVisible({ timeout: 15000 });

    // Grandchild should be visible in tree view (nested under First Child)
    await itemsPage.expectItemVisible("Grandchild Item");
  });

  test("Add Child Item not shown in grid view context menu", async ({
    page,
    itemsPage,
    isMobile,
  }) => {
    test.skip(isMobile, "Context menu is desktop-only (mobile uses sheets)");

    // On root page (grid view), open context menu
    await itemsPage.openContextMenu("Parent Folder");

    // "Add Child Item" should NOT be visible in grid view
    await expect(
      page.getByRole("menuitem", { name: /add child item/i })
    ).not.toBeVisible();
  });
});
