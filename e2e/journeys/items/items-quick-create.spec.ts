/**
 * E2E tests for Quick Create sidebar functionality.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Quick Create Journey", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("quick-create");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("Quick Create button opens add item dialog", async ({ page }) => {
    await page.getByRole("button", { name: /quick create/i }).click();
    await expect(
      page.getByRole("dialog", { name: /create item/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("can create item via Quick Create", async ({ page, itemsPage }) => {
    await page.getByRole("button", { name: /quick create/i }).click();
    await page.getByLabel(/item name/i).fill("Quick Created Item");
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for dialog to close (confirms create completed)
    await expect(
      page.getByRole("dialog", { name: /create item/i })
    ).not.toBeVisible({ timeout: 5000 });

    // Wait for success toast (confirms server action succeeded)
    await itemsPage.expectSuccessToast('Created "Quick Created Item"');

    // Wait for page content to update after router.refresh()
    await page.waitForLoadState("networkidle");

    await itemsPage.expectItemVisible("Quick Created Item");
  });

  test("Quick Create dialog can be cancelled", async ({ page }) => {
    await page.getByRole("button", { name: /quick create/i }).click();
    await expect(
      page.getByRole("dialog", { name: /create item/i })
    ).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(
      page.getByRole("dialog", { name: /create item/i })
    ).not.toBeVisible();
  });

  test("Quick Create dialog has description field", async ({ page }) => {
    await page.getByRole("button", { name: /quick create/i }).click();
    await expect(
      page.getByRole("dialog", { name: /create item/i })
    ).toBeVisible();

    // Verify description field exists
    await expect(page.getByLabel(/description/i)).toBeVisible();
    await expect(page.getByText("0/200 characters")).toBeVisible();
  });

  test("can create item with description via Quick Create", async ({
    page,
    itemsPage,
  }) => {
    await page.getByRole("button", { name: /quick create/i }).click();
    await page.getByLabel(/item name/i).fill("Item With Description");
    await page.getByLabel(/description/i).fill("This is my test description");
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for dialog to close
    await expect(
      page.getByRole("dialog", { name: /create item/i })
    ).not.toBeVisible({ timeout: 5000 });

    // Wait for page to update
    await page.waitForLoadState("networkidle");

    await itemsPage.expectItemVisible("Item With Description");
  });
});
