/**
 * E2E tests for the landing page.
 * Covers page load, hero visibility, and navigation links.
 */
import { publicTest, expect } from "../../fixtures";

publicTest.describe("Landing Page", () => {
  publicTest("should display the landing page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  publicTest(
    "should have Get Started and Explore Collections CTAs",
    async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      await expect(
        page.getByRole("link", { name: /get started/i })
      ).toBeVisible();

      await expect(
        page.getByRole("link", { name: /explore collections/i })
      ).toBeVisible();
    }
  );
});
