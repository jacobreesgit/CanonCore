/**
 * E2E tests for maximum nesting depth enforcement.
 * Verifies the 10-level depth limit is enforced in the UI.
 *
 * The application limits item nesting to 10 levels (depth 0-9)
 * to prevent excessively deep hierarchies.
 *
 * Note: Breadcrumb-related tests are desktop-only as breadcrumbs are hidden on mobile.
 */

import { test, expect } from "../../fixtures";
import { isMobileViewport } from "../../helpers/mobile-nav-helpers";

test.describe("Items Max Depth Journey", () => {
  test("cannot create item beyond max depth via UI", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    // This test creates 10 levels of nesting - allow extra time
    test.setTimeout(120000);

    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create 9 levels of nesting (depth 0-8)
    // Each iteration creates an item and navigates into it
    // Use unique names to avoid selector confusion
    for (let i = 1; i <= 9; i++) {
      await itemsPage.createItem(`Folder-${i}`);
      await itemsPage.clickItem(`Folder-${i}`);
      await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+\/[\w-]+/, {
        timeout: 10000,
      });
    }

    // Now inside Folder-9 (depth 8), create item at depth 9 (max allowed)
    await itemsPage.createItem("Deepest");
    await itemsPage.expectItemVisible("Deepest");
    await itemsPage.clickItem("Deepest");
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+\/[\w-]+/, {
      timeout: 10000,
    });

    // Now inside "Deepest" at depth 9 (max), try to create child
    // This should fail with an error toast
    await itemsPage.createItemExpectError("Too Deep");

    // Should see error toast about max depth
    await itemsPage.expectErrorToast("Maximum nesting depth reached");

    // "Too Deep" should NOT be created (dialog still open after error)
    // Close the dialog and verify item doesn't exist
    await itemsPage.addFolderCancel.click();
    await itemsPage.expectItemNotVisible("Too Deep");
  });

  test("breadcrumbs show full hierarchy path", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    const isMobile = await isMobileViewport(page);
    test.skip(isMobile, "Breadcrumbs are hidden on mobile");

    // Allow extra time for nested operations
    test.setTimeout(60000);
    test.info().annotations.push({
      type: "flaky",
      description: "Parallel execution timing",
    });
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create a 3-level hierarchy with toast waits for stability
    await itemsPage.createItem("Grandparent");
    await itemsPage.clickItem("Grandparent");
    // Wait for empty state to disappear and Add button to be stable
    await page.waitForTimeout(500);

    await itemsPage.createItem("Parent");
    await itemsPage.clickItem("Parent");
    // Wait for empty state to disappear and Add button to be stable
    await page.waitForTimeout(500);

    await itemsPage.createItem("Child");
    await itemsPage.clickItem("Child");

    // Verify breadcrumb trail shows all ancestors
    await itemsPage.expectBreadcrumb("Grandparent");
    await itemsPage.expectBreadcrumb("Parent");
    await itemsPage.expectBreadcrumb("Child");
  });

  test("can navigate to any level via breadcrumbs", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    const isMobile = await isMobileViewport(page);
    test.skip(isMobile, "Breadcrumbs are hidden on mobile");

    test.setTimeout(60000); // Increase timeout for nested navigation
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create a 3-level hierarchy with toast waits
    await itemsPage.createItem("Level A");
    await itemsPage.clickItem("Level A");

    await itemsPage.createItem("Level B");
    await itemsPage.clickItem("Level B");

    await itemsPage.createItem("Level C");
    await itemsPage.clickItem("Level C");

    // Navigate back to Level A via breadcrumb
    await itemsPage.clickBreadcrumb("Level A");
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+\/[\w-]+/);

    // Should see Level B in the list
    await itemsPage.expectItemVisible("Level B");
  });

  test("deeply nested item shows correct depth in ancestors", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    const isMobile = await isMobileViewport(page);
    test.skip(isMobile, "Breadcrumbs are hidden on mobile");

    test.setTimeout(60000); // Increase timeout for deep nesting
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create 5 levels with toast waits for stability
    const levels = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
    for (const level of levels) {
      await itemsPage.createItem(level);
      await itemsPage.clickItem(level);
    }

    // Create a final item
    await itemsPage.createItem("Final");

    // Should be able to see ancestors in breadcrumbs (toast doesn't matter for this check)
    for (const level of levels) {
      await itemsPage.expectBreadcrumb(level);
    }
  });
});
