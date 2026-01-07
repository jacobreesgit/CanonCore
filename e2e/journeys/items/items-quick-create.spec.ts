/**
 * E2E tests for Quick Create sidebar functionality.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

// Helper to get the add item dialog (excludes mobile sidebar which is also a dialog)
const getAddItemDialog = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="dialog-content"]');

// Helper to ensure sidebar is open (for accessing Quick Create button)
async function ensureSidebarOpen(page: import("@playwright/test").Page) {
  const quickCreateBtn = page.getByRole("button", { name: /quick create/i });
  // If Quick Create is already visible, sidebar is open
  if (await quickCreateBtn.isVisible()) {
    return;
  }
  // Otherwise click toggle to open sidebar
  const toggleButton = page.getByRole("button", { name: "Toggle Sidebar" });
  if (await toggleButton.isVisible()) {
    await toggleButton.click();
    await page.waitForTimeout(300);
  }
}

test.describe("Quick Create Journey", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("quick-create");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("Quick Create button opens add item dialog", async ({ page }) => {
    await ensureSidebarOpen(page);
    await page.getByRole("button", { name: /quick create/i }).click();
    await expect(getAddItemDialog(page)).toBeVisible({ timeout: 5000 });
  });

  test("can create item via Quick Create", async ({ page, itemsPage }) => {
    await ensureSidebarOpen(page);
    await page.getByRole("button", { name: /quick create/i }).click();
    await page.getByLabel(/item name/i).fill("Quick Created Item");
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for dialog to close (confirms create completed)
    await expect(getAddItemDialog(page)).not.toBeVisible({ timeout: 5000 });

    // Wait for success toast (confirms server action succeeded)
    await itemsPage.expectSuccessToast('Created "Quick Created Item"');

    // Wait for page content to update after router.refresh()
    await page.waitForLoadState("networkidle");

    await itemsPage.expectItemVisible("Quick Created Item");
  });

  test("Quick Create dialog can be cancelled", async ({ page }) => {
    await ensureSidebarOpen(page);
    await page.getByRole("button", { name: /quick create/i }).click();
    await expect(getAddItemDialog(page)).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(getAddItemDialog(page)).not.toBeVisible();
  });

  test("Quick Create dialog has description field", async ({ page }) => {
    await ensureSidebarOpen(page);
    await page.getByRole("button", { name: /quick create/i }).click();
    await expect(getAddItemDialog(page)).toBeVisible();

    // Verify description field exists
    await expect(page.getByLabel(/description/i)).toBeVisible();
    await expect(page.getByText("0/200 characters")).toBeVisible();
  });

  test("can create item with description via Quick Create", async ({
    page,
    itemsPage,
  }) => {
    await ensureSidebarOpen(page);
    await page.getByRole("button", { name: /quick create/i }).click();
    await page.getByLabel(/item name/i).fill("Item With Description");
    await page.getByLabel(/description/i).fill("This is my test description");
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for dialog to close
    await expect(getAddItemDialog(page)).not.toBeVisible({ timeout: 5000 });

    // Wait for page to update
    await page.waitForLoadState("networkidle");

    await itemsPage.expectItemVisible("Item With Description");
  });
});
