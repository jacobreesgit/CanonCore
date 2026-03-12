/**
 * E2E tests for page transition loading states.
 * Verifies content loads correctly when navigating between pages.
 */
import { test, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

test.describe("Page transition loading states", () => {
  test("shows content when navigating to Explore", async ({
    page,
    nav,
    isMobile,
  }) => {
    // Start on My Items — wait for content to fully load
    await nav.gotoMyItems();
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });

    // Navigate to Explore
    if (isMobile) {
      await nav.tapExploreMobile();
    } else {
      await nav.openSidebar();
      await page.getByRole("link", { name: "Explore" }).click();
    }

    // Content should load after navigation
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  });

  test("shows content when navigating to My Items", async ({
    page,
    nav,
    isMobile,
  }) => {
    // Start on Explore
    await page.goto("/explore");
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });

    // Navigate to My Items
    if (isMobile) {
      await nav.tapMyItemsMobile();
    } else {
      await nav.openSidebar();
      await page.getByRole("link", { name: "My Items" }).click();
    }

    // Profile content loads
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  });
});
