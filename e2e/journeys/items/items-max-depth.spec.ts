/**
 * E2E tests for maximum nesting depth enforcement.
 * Verifies the 10-level depth limit is enforced in the UI.
 *
 * The application limits folder nesting to 10 levels (depth 0-9)
 * to prevent excessively deep hierarchies.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Items Max Depth Journey", () => {
  test("cannot create folder beyond max depth via UI", async ({
    page,
    signUpPage,
    itemsPage,
  }) => {
    // This test creates 10 levels of nesting - allow extra time
    test.setTimeout(120000);

    const email = generateUniqueEmail("items-max-depth");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
    await itemsPage.goto();

    // Create 9 levels of nesting (depth 0-8)
    // Each iteration creates a folder and navigates into it
    // Use unique names to avoid selector confusion
    for (let i = 1; i <= 9; i++) {
      await itemsPage.createItem(`Folder-${i}`);
      await itemsPage.waitForToastToDisappear();
      await itemsPage.clickItem(`Folder-${i}`);
      await expect(page).toHaveURL(/\/my-items\/[\w-]+/, { timeout: 10000 });
    }

    // Now inside Folder-9 (depth 8), create item at depth 9 (max allowed)
    await itemsPage.createItem("Deepest");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.expectItemVisible("Deepest");
    await itemsPage.clickItem("Deepest");
    await expect(page).toHaveURL(/\/my-items\/[\w-]+/, { timeout: 10000 });

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
    signUpPage,
    itemsPage,
  }) => {
    // Allow extra time for nested operations
    test.setTimeout(60000);
    test.info().annotations.push({
      type: "flaky",
      description: "Parallel execution timing",
    });
    const email = generateUniqueEmail("items-breadcrumb-depth");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
    await itemsPage.goto();

    // Create a 3-level hierarchy with toast waits for stability
    await itemsPage.createItem("Grandparent");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("Grandparent");
    // Wait for empty state to disappear and Add button to be stable
    await page.waitForTimeout(500);

    await itemsPage.createItem("Parent");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("Parent");
    // Wait for empty state to disappear and Add button to be stable
    await page.waitForTimeout(500);

    await itemsPage.createItem("Child");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("Child");

    // Verify breadcrumb trail shows all ancestors
    await itemsPage.expectBreadcrumb("Grandparent");
    await itemsPage.expectBreadcrumb("Parent");
    await itemsPage.expectBreadcrumb("Child");
  });

  test("can navigate to any level via breadcrumbs", async ({
    page,
    signUpPage,
    itemsPage,
  }) => {
    const email = generateUniqueEmail("items-breadcrumb-nav");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
    await itemsPage.goto();

    // Create a 3-level hierarchy with toast waits
    await itemsPage.createItem("Level A");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("Level A");

    await itemsPage.createItem("Level B");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("Level B");

    await itemsPage.createItem("Level C");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("Level C");

    // Navigate back to Level A via breadcrumb
    await itemsPage.clickBreadcrumb("Level A");
    await expect(page).toHaveURL(/\/my-items\/[\w-]+/);

    // Should see Level B in the list
    await itemsPage.expectItemVisible("Level B");
  });

  test("deeply nested folder shows correct depth in ancestors", async ({
    page,
    signUpPage,
    itemsPage,
  }) => {
    const email = generateUniqueEmail("items-deep-ancestors");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
    await itemsPage.goto();

    // Create 5 levels
    const levels = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
    for (const level of levels) {
      await itemsPage.createItem(level);
      await itemsPage.clickItem(level);
    }

    // Create a final item
    await itemsPage.createItem("Final");

    // Should be able to see ancestors in breadcrumbs
    for (const level of levels) {
      await itemsPage.expectBreadcrumb(level);
    }
  });
});
