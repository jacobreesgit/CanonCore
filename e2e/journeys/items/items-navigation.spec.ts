/**
 * E2E tests for items navigation.
 * Tests folder navigation, breadcrumbs, and nested folder creation.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Items Navigation Journey", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("items-nav");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("can navigate into a folder by clicking", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Parent Folder");
    await itemsPage.clickItem("Parent Folder");

    // Should navigate to item detail page
    await expect(page).toHaveURL(/\/dashboard\/[a-z0-9]+/i);
    // Breadcrumb should show the folder name
    await itemsPage.expectBreadcrumb("Parent Folder");
  });

  test("can navigate back via breadcrumbs", async ({ page, itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Parent Folder");
    await itemsPage.clickItem("Parent Folder");

    // Navigate back via home breadcrumb
    await itemsPage.breadcrumbHome.click();
    await expect(page).toHaveURL("/dashboard");
    await itemsPage.expectItemVisible("Parent Folder");
  });

  test("can create nested folders and navigate", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();

    // Create parent
    await itemsPage.createItem("Level 1");
    await itemsPage.clickItem("Level 1");

    // Create child
    await itemsPage.createItem("Level 2");
    await itemsPage.expectItemVisible("Level 2");

    // Navigate to child
    await itemsPage.clickItem("Level 2");
    await itemsPage.expectBreadcrumb("Level 1");
    await itemsPage.expectBreadcrumb("Level 2");
  });
});
