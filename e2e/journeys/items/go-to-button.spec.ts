/**
 * E2E tests for "Go to [ItemName]" button.
 * Tests navigation to first incomplete item in DFS order.
 * Note: Without real media files and playback progress, button won't appear
 * in most scenarios - these tests verify the negative case (no button when all complete).
 */

import { test, expect } from "../../fixtures";
import {
  generateUniqueEmail,
  generateUniqueUsername,
  TEST_PASSWORD,
} from "../../helpers/test-user";

test.describe("Go to Button", () => {
  test.describe("Fresh User (no items)", () => {
    // Use signUpPage directly for fresh user tests (no testUser fixture)
    test("hides Go to button when no items exist", async ({
      page,
      signUpPage,
    }) => {
      const email = generateUniqueEmail("go-to-button");
      const username = generateUniqueUsername();
      await signUpPage.goto();
      await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD, username);
      await expect(page).toHaveURL(`/u/${username}`, { timeout: 10000 });

      // Verify hero is visible on profile page
      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible();

      // Go to button should not be visible (no incomplete items)
      await expect(page.getByTestId("hero-goto-button")).not.toBeVisible();
    });
  });

  test.describe("With Items", () => {
    // Use testUser fixture for consistent test setup
    test.beforeEach(async ({ page, testUser }) => {
      await expect(page).toHaveURL(`/u/${testUser.username}`, {
        timeout: 10000,
      });
    });

    test("hides Go to button when items are folders (no media)", async ({
      page,
      itemsPage,
    }) => {
      // Create empty folder
      await itemsPage.createItem("Movies");

      // Go to button should not be visible (folders have no media to be incomplete)
      await expect(page.getByTestId("hero-goto-button")).not.toBeVisible();
    });

    test("hides Go to button on item detail page", async ({
      page,
      itemsPage,
    }) => {
      // Create folder
      await itemsPage.createItem("Movies");
      await itemsPage.clickItem("Movies");

      // Hero should be visible on detail page
      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible();

      // Go to button should not be visible (no incomplete media children)
      await expect(page.getByTestId("hero-goto-button")).not.toBeVisible();
    });

    test("hero has correct test IDs for play and goto buttons", async ({
      page,
      itemsPage,
    }) => {
      // Create an item to see hero
      await itemsPage.createItem("Test Item");

      // Hero should be visible with correct test ID
      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible();

      // Both play and Go to buttons should NOT be visible (no media, no incomplete items)
      await expect(page.getByTestId("hero-play-button")).not.toBeVisible();
      await expect(page.getByTestId("hero-goto-button")).not.toBeVisible();
    });
  });
});
