/**
 * E2E tests for sidebar navigation active state styling.
 * Verifies nav items are visually highlighted when their page is active.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

// Helper to open sidebar on mobile (collapsed by default)
async function openSidebarIfMobile(page: import("@playwright/test").Page) {
  const toggleButton = page.getByRole("button", { name: "Toggle Sidebar" });
  if (await toggleButton.isVisible()) {
    await toggleButton.click();
    // Wait for sidebar to animate open
    await page.waitForTimeout(300);
  }
}

test.describe("Navigation Active State", () => {
  test.describe("authenticated user", () => {
    test.beforeEach(async ({ page, signUpPage }) => {
      const email = generateUniqueEmail("nav-active");
      await signUpPage.goto();
      await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
      await expect(page).toHaveURL("/my-items", { timeout: 10000 });
    });

    test("My Items nav is active on /my-items", async ({ page }) => {
      await openSidebarIfMobile(page);

      // Find the My Items nav button in sidebar
      const myItemsNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "My Items",
      });

      await expect(myItemsNav).toHaveAttribute("data-active", "true");
    });

    test("My Items nav is active on nested folder", async ({
      page,
      itemsPage,
    }) => {
      // Create item first (sidebar covers content on mobile)
      await itemsPage.createItem("Test Folder");
      await itemsPage.clickItem("Test Folder");

      // Now open sidebar to check nav state
      await openSidebarIfMobile(page);
      // Should still show My Items as active
      const myItemsNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "My Items",
      });
      await expect(myItemsNav).toHaveAttribute("data-active", "true");
    });

    test("Connections nav is active on /my-items/connections", async ({
      page,
    }) => {
      await page.goto("/my-items/connections");
      await openSidebarIfMobile(page);

      const connectionsNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Connections",
      });
      await expect(connectionsNav).toHaveAttribute("data-active", "true");
    });

    test("docs context shows docs tree navigation instead of footer nav", async ({
      page,
    }) => {
      await page.goto("/docs");
      await openSidebarIfMobile(page);

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

  test.describe("guest user", () => {
    test("Get Help nav is active on /docs", async ({ page }) => {
      await page.goto("/docs");

      const getHelpNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Get Help",
      });
      await expect(getHelpNav).toHaveAttribute("data-active", "true");
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
      await page.goto("/");

      const getStartedNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Get Started",
      });
      await expect(getStartedNav).toHaveAttribute("data-active", "false");
    });
  });
});
