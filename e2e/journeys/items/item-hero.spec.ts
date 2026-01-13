/**
 * E2E tests for ItemHero collapse and description expand features.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Item Hero", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("item-hero");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  // Cleanup localStorage after each test to reset collapse state
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("canon-hero-collapsed");
    });
  });

  test.describe("collapse/expand", () => {
    test("should collapse and expand hero on My Items page", async ({
      page,
    }) => {
      // Hero should be visible and expanded
      const hero = page.getByTestId("item-hero");
      await expect(hero).toBeVisible();

      // Find and click collapse button
      const collapseButton = page.getByRole("button", {
        name: /collapse hero/i,
      });
      await expect(collapseButton).toBeVisible();
      await collapseButton.click();

      // Hero should now be collapsed (smaller height)
      const expandButton = page.getByRole("button", { name: /expand hero/i });
      await expect(expandButton).toBeVisible();

      // Click to expand
      await expandButton.click();

      // Collapse button should be back
      await expect(collapseButton).toBeVisible();
    });

    test("should persist collapsed state across navigation", async ({
      page,
    }) => {
      // Collapse the hero
      await page.getByRole("button", { name: /collapse hero/i }).click();

      // Navigate away and back
      await page.goto("/docs");
      await page.goto("/my-items");

      // Should still be collapsed
      await expect(
        page.getByRole("button", { name: /expand hero/i })
      ).toBeVisible();
    });
  });

  test.describe("description Read More", () => {
    const longDescription =
      "This is a very long description that exceeds 150 characters to trigger the Read More button. " +
      "It contains enough text to demonstrate the expand and collapse functionality properly.";

    test("should expand and collapse long description", async ({
      page,
      itemsPage,
    }) => {
      // Create item with long description
      await itemsPage.createItem("Hero Test", longDescription);
      await itemsPage.clickItem("Hero Test");

      // Should see Read More button
      const readMoreButton = page.getByTestId("hero-read-more");
      await expect(readMoreButton).toBeVisible();
      await expect(readMoreButton).toHaveText(/read more/i);

      // Click to expand
      await readMoreButton.click();
      await expect(readMoreButton).toHaveText(/show less/i);

      // Click to collapse
      await readMoreButton.click();
      await expect(readMoreButton).toHaveText(/read more/i);

      // Cleanup
      await itemsPage.breadcrumbHome.click();
      await itemsPage.deleteItemViaContextMenu("Hero Test");
    });
  });
});
