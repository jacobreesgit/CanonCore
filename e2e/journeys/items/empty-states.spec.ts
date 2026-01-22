/**
 * E2E tests for empty state variants.
 * Tests different empty state messages based on context.
 */

import { test, expect } from "../../fixtures";
import {
  generateUniqueEmail,
  generateUniqueUsername,
  TEST_PASSWORD,
} from "../../helpers/test-user";

test.describe("Empty States", () => {
  test.describe("First-time User", () => {
    // These tests need a fresh user with no items, so we use signUpPage directly
    // and don't use itemsPage fixture (which would auto-create a testUser)
    test("should show first-time empty state when no items exist", async ({
      page,
      signUpPage,
    }) => {
      // Create new account with username (required for profile redirect)
      const email = generateUniqueEmail("empty-first");
      const username = generateUniqueUsername();
      await signUpPage.goto();
      await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD, username);
      await expect(page).toHaveURL(`/u/${username}`, { timeout: 10000 });

      // Wait for page to fully load
      await page.waitForLoadState("networkidle");

      // Should show first-time empty state
      await expect(page.getByText("No items yet")).toBeVisible({
        timeout: 10000,
      });
      await expect(
        page.getByText(/create your first item to start organizing/i)
      ).toBeVisible();
      // Toolbar and empty state both have Add Item buttons - check at least one is visible
      await expect(
        page.getByRole("button", { name: /add item/i }).first()
      ).toBeVisible();
    });

    test("should open add item dialog from empty state action", async ({
      page,
      signUpPage,
    }) => {
      const email = generateUniqueEmail("empty-action");
      const username = generateUniqueUsername();
      await signUpPage.goto();
      await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD, username);
      await expect(page).toHaveURL(`/u/${username}`, { timeout: 10000 });

      // Wait for page to fully load
      await page.waitForLoadState("networkidle");

      // Click the Add Item button (either toolbar or empty state)
      await expect(
        page.getByRole("button", { name: /add item/i }).first()
      ).toBeVisible({ timeout: 10000 });
      await page
        .getByRole("button", { name: /add item/i })
        .first()
        .click();

      // Add item dialog should open
      await expect(
        page.getByRole("dialog", { name: /create item/i })
      ).toBeVisible();
    });
  });

  test.describe("No Children", () => {
    // Use testUser fixture for consistent test setup
    test.beforeEach(async ({ page, testUser, itemsPage }) => {
      await expect(page).toHaveURL(`/u/${testUser.username}`, {
        timeout: 10000,
      });
      // Create a parent item with no children
      await itemsPage.createItem("Empty Parent");
    });

    test("should show no-children empty state on item detail page", async ({
      page,
      itemsPage,
    }) => {
      // Navigate to the item (which has no children)
      await itemsPage.clickItem("Empty Parent");

      // Should show no-children empty state
      await expect(page.getByText("No child items")).toBeVisible();
      await expect(
        page.getByText("Add child items to organize content")
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /add child/i })
      ).toBeVisible();
    });

    test("should open add item dialog from no-children action", async ({
      page,
      itemsPage,
    }) => {
      await itemsPage.clickItem("Empty Parent");

      // Click the Add Child button in empty state
      await page.getByRole("button", { name: /add child/i }).click();

      // Add item dialog should open
      await expect(
        page.getByRole("dialog", { name: /create item/i })
      ).toBeVisible();
    });
  });

  test.describe("Filter Empty", () => {
    // Use testUser fixture for consistent test setup
    test.beforeEach(async ({ page, testUser, itemsPage }) => {
      await expect(page).toHaveURL(`/u/${testUser.username}`, {
        timeout: 10000,
      });
      // Create items without files
      await itemsPage.createItem("Item Without Files");
    });

    test("should show filter-empty state when filter matches nothing", async ({
      page,
      itemsPage,
    }) => {
      // Apply filter that matches nothing (Has Files - but none have files)
      await itemsPage.selectFilterOption("Has Files");

      // Wait for filter to apply and empty state to appear
      await page.waitForLoadState("networkidle");

      // Should show filter-empty state
      await expect(page.getByText("No matching items")).toBeVisible({
        timeout: 10000,
      });
      await expect(
        page.getByText(/no items match your current filter/i)
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /clear filter/i })
      ).toBeVisible();
    });

    test("should clear filter from empty state action", async ({
      page,
      itemsPage,
    }) => {
      // Apply filter that matches nothing
      await itemsPage.selectFilterOption("Has Files");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText("No matching items")).toBeVisible({
        timeout: 10000,
      });

      // Click Clear Filter button
      await page.getByRole("button", { name: /clear filter/i }).click();

      // Filter should be cleared, items should be visible again
      await itemsPage.expectItemVisible("Item Without Files");
      await expect(page.getByText("No matching items")).not.toBeVisible();
    });
  });
});
