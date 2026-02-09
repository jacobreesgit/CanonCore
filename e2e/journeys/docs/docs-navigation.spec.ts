/**
 * E2E tests for Fumadocs documentation navigation.
 * Tests accessing docs via Get Help link and navigation features.
 */

import { test, expect } from "../../fixtures";
import { openSidebarIfClosed } from "../../helpers/sidebar-helpers";
import {
  isMobileViewport,
  openHelpSheetIfClosed,
} from "../../helpers/mobile-nav-helpers";

test.describe("Documentation Navigation", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("can navigate to docs via Get Help link", async ({ page }) => {
    const isMobile = await isMobileViewport(page);

    if (isMobile) {
      // Mobile: Help is accessed via footer nav → help sheet → docs link
      await openHelpSheetIfClosed(page);
      // Click "Browse All Documentation" link in help sheet
      const docsLink = page.getByRole("link", {
        name: /browse all documentation/i,
      });
      await docsLink.click();
    } else {
      // Desktop: Click Get Help link in sidebar
      await openSidebarIfClosed(page);
      const getHelpLink = page.getByRole("link", { name: "Get Help" });
      await getHelpLink.click();
    }

    // Should be on docs page
    await expect(page).toHaveURL("/docs");
  });

  test("docs page renders with heading", async ({ page, docsPage }) => {
    await docsPage.goto();
    await docsPage.expectVisible();

    // Check for Welcome heading
    await expect(
      page.getByRole("heading", { name: "Welcome to CanonCore" })
    ).toBeVisible();
  });

  test("can navigate back to my items from docs", async ({
    page,
    docsPage,
  }) => {
    const isMobile = await isMobileViewport(page);

    // Skip on mobile - docs layout uses fumadocs sidebar which has different mobile behavior
    // The "Back to My Items" link may not be accessible in the same way on mobile
    test.skip(isMobile, "Docs navigation back to My Items has different UX on mobile");

    await docsPage.goto();

    // Open sidebar if collapsed - Back to My Items is in our sidebar
    await openSidebarIfClosed(page);

    // Click the back link in sidebar
    const backLink = page.getByRole("link", { name: "Back to My Items" });
    await backLink.click();

    // Should be on user profile page
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/);
  });

  test("docs page is accessible without authentication", async ({ page }) => {
    // Sign out first by clearing cookies
    await page.context().clearCookies();

    // Navigate directly to docs
    await page.goto("/docs");

    // Should be able to view docs without being redirected
    await expect(page).toHaveURL("/docs");
    await expect(
      page.getByRole("heading", { name: "Welcome to CanonCore" })
    ).toBeVisible();
  });
});
