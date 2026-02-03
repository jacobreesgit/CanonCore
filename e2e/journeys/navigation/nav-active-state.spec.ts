/**
 * E2E tests for sidebar navigation active state styling.
 * Verifies nav items are visually highlighted when their page is active.
 *
 * Note: Mobile uses footer nav instead of sidebar for main navigation.
 * Tests are viewport-aware and check appropriate navigation element.
 */

import { test, expect } from "../../fixtures";
import { isMobileViewport } from "../../helpers/mobile-nav-helpers";

// Helper to open sidebar on desktop (collapsed by default)
async function openSidebarIfDesktop(page: import("@playwright/test").Page) {
  const toggleButton = page.getByRole("button", { name: "Toggle Sidebar" });
  if (await toggleButton.isVisible()) {
    await toggleButton.click();
    // Wait for sidebar to animate open
    await page.waitForTimeout(300);
  }
}

test.describe("Navigation Active State", () => {
  test.describe("authenticated user", () => {
    test.beforeEach(async ({ page, testUser }) => {
      // Use testUser fixture for consistent test setup (compatible with itemsPage)
      await expect(page).toHaveURL(`/u/${testUser.username}`, {
        timeout: 10000,
      });
    });

    test("My Items nav is active on /u/[username]", async ({ page }) => {
      const isMobile = await isMobileViewport(page);

      if (isMobile) {
        // Mobile: Check footer nav for active state via aria-current
        const myItemsNav = page
          .getByRole("navigation", { name: /mobile navigation/i })
          .getByRole("link", { name: /my items/i });
        await expect(myItemsNav).toHaveAttribute("aria-current", "page");
      } else {
        // Desktop: Check sidebar nav for active state
        await openSidebarIfDesktop(page);
        const myItemsNav = page.locator('[data-slot="sidebar-menu-button"]', {
          hasText: "My Items",
        });
        await expect(myItemsNav).toHaveAttribute("data-active", "true");
      }
    });

    // Note: Google Drive connection is managed through the Settings dialog

    test("docs context shows docs tree navigation instead of footer nav", async ({
      page,
    }) => {
      const isMobile = await isMobileViewport(page);

      // Skip on mobile - docs layout uses fumadocs sidebar which has different mobile behavior
      test.skip(isMobile, "Docs sidebar behavior differs on mobile");

      await page.goto("/docs");
      await openSidebarIfDesktop(page);

      // Docs context doesn't show the footer nav with "Get Help" button
      // Instead it shows the Fumadocs tree navigation
      const getHelpNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Get Help",
      });
      await expect(getHelpNav).not.toBeVisible();

      // Verify docs tree is shown with the Documentation label in sidebar
      await expect(
        page.locator('[data-slot="sidebar-group-label"]', {
          hasText: "Documentation",
        })
      ).toBeVisible();

      // Verify docs tree has "Back to My Items" link (for authenticated users)
      await expect(
        page.getByRole("link", { name: /back to my items/i })
      ).toBeVisible();
    });
  });

  // Tests that use itemsPage fixture (requires testUser fixture, don't mix with signUpPage)
  test.describe("authenticated user with items", () => {
    test("My Items nav stays active on nested folder for section awareness", async ({
      page,
      testUser,
      itemsPage,
    }) => {
      // testUser fixture already logged us in and navigated to /u/[username]
      await expect(page).toHaveURL(`/u/${testUser.username}`, {
        timeout: 10000,
      });

      // Create item first (sidebar covers content on mobile)
      await itemsPage.createItem("Test Folder");
      await itemsPage.clickItem("Test Folder");

      const isMobile = await isMobileViewport(page);

      if (isMobile) {
        // Mobile: Check footer nav for active state via aria-current
        const myItemsNav = page
          .getByRole("navigation", { name: /mobile navigation/i })
          .getByRole("link", { name: /my items/i });
        await expect(myItemsNav).toHaveAttribute("aria-current", "page");
      } else {
        // Desktop: Check sidebar nav for active state
        await openSidebarIfDesktop(page);
        const myItemsNav = page.locator('[data-slot="sidebar-menu-button"]', {
          hasText: "My Items",
        });
        await expect(myItemsNav).toHaveAttribute("data-active", "true");
      }
    });
  });

  test.describe("guest user", () => {
    test("docs context shows docs tree navigation with Back to Home for guests", async ({
      page,
    }) => {
      const isMobile = await isMobileViewport(page);

      // Skip on mobile - docs layout uses fumadocs sidebar which has different mobile behavior
      test.skip(isMobile, "Docs sidebar behavior differs on mobile");

      await page.goto("/docs");
      await openSidebarIfDesktop(page);

      // Docs context doesn't show "Get Help" - shows docs tree navigation instead
      const getHelpNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Get Help",
      });
      await expect(getHelpNav).not.toBeVisible();

      // Verify docs tree is shown with the Documentation label in sidebar
      await expect(
        page.locator('[data-slot="sidebar-group-label"]', {
          hasText: "Documentation",
        })
      ).toBeVisible();

      // Verify docs tree has "Back to Home" link (for guests)
      await expect(
        page.getByRole("link", { name: /back to home/i })
      ).toBeVisible();
    });

    test("sign-in page does not have sidebar navigation", async ({ page }) => {
      await page.goto("/sign-in");

      // Sign-in page is a standalone auth page without sidebar
      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(sidebar).not.toBeVisible();

      // The sign-in form is visible
      await expect(page.getByTestId("sign-in-email-input")).toBeVisible();
    });

    test("Get Started nav is inactive on home page", async ({ page }) => {
      const isMobile = await isMobileViewport(page);

      // Skip on mobile - home page has different navigation (footer nav with Sign In, not Get Started)
      test.skip(isMobile, "Home page uses mobile footer nav on mobile");

      await page.goto("/");
      await openSidebarIfDesktop(page);

      const getStartedNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Get Started",
      });
      await expect(getStartedNav).toHaveAttribute("data-active", "false");
    });
  });
});
