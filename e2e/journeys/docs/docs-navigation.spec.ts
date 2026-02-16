/**
 * E2E tests for documentation page navigation.
 * Verifies the docs page loads and displays content.
 */
import { publicTest, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

publicTest.describe("Docs Navigation", () => {
  publicTest("should load the docs page", async ({ page }) => {
    await page.goto("/docs");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("#main-content")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  });
});
