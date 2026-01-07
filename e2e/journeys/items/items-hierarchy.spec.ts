/**
 * E2E tests for hierarchical tree display.
 * Tests that full hierarchy is displayed with collapse/expand functionality.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Items Hierarchy Journey", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    // Create account and sign in
    const email = generateUniqueEmail("items-hierarchy");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("displays full hierarchy in tree view", async ({ itemsPage }) => {
    await itemsPage.goto();

    // Create hierarchy: Parent > Child > Grandchild
    await itemsPage.createItem("Parent");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.clickItem("Parent");
    await itemsPage.createItem("Child");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.clickItem("Child");
    await itemsPage.createItem("Grandchild");
    await itemsPage.waitForToastToDisappear();

    // Navigate to root and verify all items visible
    await itemsPage.goto();
    await itemsPage.switchToTreeView();

    // All three levels should be visible
    await itemsPage.expectItemVisible("Parent");
    await itemsPage.expectItemVisible("Child");
    await itemsPage.expectItemVisible("Grandchild");
  });

  test("can collapse and expand items in tree", async ({ itemsPage }) => {
    await itemsPage.goto();

    // Create hierarchy: Parent > Child
    await itemsPage.createItem("Collapsible Parent");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.clickItem("Collapsible Parent");
    await itemsPage.createItem("Nested Child");
    await itemsPage.waitForToastToDisappear();

    // Navigate to root
    await itemsPage.goto();
    await itemsPage.switchToTreeView();

    // Both items should be visible
    await itemsPage.expectItemVisible("Collapsible Parent");
    await itemsPage.expectItemVisible("Nested Child");

    // Collapse parent
    await itemsPage.collapseItem("Collapsible Parent");

    // Child should now be hidden
    await itemsPage.expectItemNotVisible("Nested Child");

    // Expand parent
    await itemsPage.expandItem("Collapsible Parent");

    // Child should be visible again
    await itemsPage.expectItemVisible("Nested Child");
  });
});
