/**
 * E2E tests for edit mode toggle functionality.
 */

import { test, expect } from "../../fixtures";

test.describe("Edit Mode", () => {
  test.beforeEach(async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    await itemsPage.createItem("Test Folder 1");
    await itemsPage.createItem("Test Folder 2");
  });

  test("should toggle between view and edit mode", async ({ itemsPage }) => {
    // Start in view mode
    await expect(
      itemsPage.page.getByRole("button", { name: "Enter edit mode" })
    ).toBeVisible();

    // Enter edit mode
    await itemsPage.enterEditMode();

    // Should show Done button
    await expect(
      itemsPage.page.getByRole("button", { name: "Exit edit mode" })
    ).toBeVisible();

    // Exit edit mode
    await itemsPage.exitEditMode();

    // Should show Edit button again
    await expect(
      itemsPage.page.getByRole("button", { name: "Enter edit mode" })
    ).toBeVisible();
  });

  // "should exit edit mode when switching view modes" moved to heavy-serial.spec.ts
});

test.describe("Edit Mode Empty State", () => {
  test("should disable edit toggle when no items", async ({
    page,
    testUser,
  }) => {
    // Fresh user starts with no items - verify we're on profile page
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Edit button should be disabled when no items exist
    await expect(
      page.getByRole("button", { name: "Enter edit mode" })
    ).toBeDisabled();
  });
});
