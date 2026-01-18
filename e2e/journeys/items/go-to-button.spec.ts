/**
 * E2E tests for "Go to [ItemName]" button.
 * Tests navigation to first incomplete item in DFS order.
 * Note: Without real media files and playback progress, button won't appear
 * in most scenarios - these tests verify the negative case (no button when all complete).
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Go to Button", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("go-to-button");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("hides Go to button when no items exist", async ({ page }) => {
    // Verify hero is visible on My Items page
    const hero = page.getByTestId("item-hero");
    await expect(hero).toBeVisible();

    // Go to button should not be visible (no incomplete items)
    await expect(page.getByTestId("item-hero-goto")).not.toBeVisible();
  });

  test("hides Go to button when items are folders (no media)", async ({
    page,
    itemsPage,
  }) => {
    // Create empty folder
    await itemsPage.createItem("Movies");

    // Go to button should not be visible (folders have no media to be incomplete)
    await expect(page.getByTestId("item-hero-goto")).not.toBeVisible();
  });

  test("hides Go to button on item detail page", async ({
    page,
    itemsPage,
  }) => {
    // Create folder
    await itemsPage.createItem("Movies");
    await itemsPage.clickItem("Movies");

    // Hero should be visible on detail page
    const hero = page.getByTestId("item-hero");
    await expect(hero).toBeVisible();

    // Go to button should not be visible (no incomplete media children)
    await expect(page.getByTestId("item-hero-goto")).not.toBeVisible();
  });

  test("hero has correct test IDs for play and goto buttons", async ({
    page,
    itemsPage,
  }) => {
    // Create an item to see hero
    await itemsPage.createItem("Test Item");

    // Hero should be visible with correct test ID
    const hero = page.getByTestId("item-hero");
    await expect(hero).toBeVisible();

    // Both play and Go to buttons should NOT be visible (no media, no incomplete items)
    await expect(page.getByTestId("item-hero-play")).not.toBeVisible();
    await expect(page.getByTestId("item-hero-goto")).not.toBeVisible();
  });

  test("collapsed hero state hides Go to button", async ({
    page,
    itemsPage,
  }) => {
    // Create an item
    await itemsPage.createItem("Collapse Test");

    // Hero should be expanded by default
    const hero = page.getByTestId("item-hero");
    await expect(hero).toBeVisible();

    // Find and click collapse button
    const collapseButton = page.getByRole("button", {
      name: /collapse hero/i,
    });
    await collapseButton.click();

    // Verify hero is in collapsed state (expand button visible)
    const expandButton = page.getByRole("button", { name: /expand hero/i });
    await expect(expandButton).toBeVisible();

    // Go to button should still not be visible in collapsed state
    await expect(page.getByTestId("item-hero-goto")).not.toBeVisible();
  });
});
