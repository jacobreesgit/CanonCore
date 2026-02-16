/**
 * E2E tests for viewing a public item's detail page.
 * Covers unauthenticated access to public item detail via direct URL.
 */
import { publicTest, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

publicTest.describe("Public Item Detail", () => {
  publicTest(
    "should display public item detail page",
    async ({ page, publicUser }) => {
      // Navigate directly to the public item's detail page
      await page.goto(`/u/${publicUser.username}/${publicUser.itemId}`, {
        waitUntil: "domcontentloaded",
      });

      // Hero carousel should be visible (public item detail uses cinematic hero)
      await expect(page.getByTestId("hero-carousel")).toBeVisible({
        timeout: Timeouts.navigation,
      });

      // Item name should appear as the page heading
      await expect(
        page.getByRole("heading", { name: publicUser.itemName })
      ).toBeVisible({ timeout: Timeouts.api });
    }
  );

  publicTest(
    "should not show edit controls on public item",
    async ({ page, publicUser }) => {
      await page.goto(`/u/${publicUser.username}/${publicUser.itemId}`, {
        waitUntil: "domcontentloaded",
      });

      // Add button should not be visible for unauthenticated viewers
      await expect(page.getByTestId("items-add-button")).not.toBeVisible({
        timeout: Timeouts.animation,
      });
    }
  );
});
