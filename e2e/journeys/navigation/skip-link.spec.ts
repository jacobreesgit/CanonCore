/**
 * E2E tests for skip link accessibility feature.
 * Verifies keyboard users can bypass navigation to reach main content.
 */

import { test, expect } from "@playwright/test";

test.describe("Skip Link", () => {
  test("skip link becomes visible on focus and navigates to main content", async ({
    page,
  }) => {
    await page.goto("/");

    // Press Tab to focus skip link (first focusable element)
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeVisible();

    // Activate the skip link
    await skipLink.click();

    // Verify focus moved to main content (requires tabIndex="-1" to work)
    const main = page.locator("#main-content");
    await expect(main).toBeFocused();
  });

  test("skip link is hidden by default", async ({ page }) => {
    await page.goto("/");

    const skipLink = page.getByRole("link", { name: "Skip to main content" });

    // Should exist in DOM but be visually hidden (translated off-screen)
    await expect(skipLink).toBeAttached();
    await expect(skipLink).not.toBeInViewport();
  });

  test("skip link works on docs pages", async ({ page }) => {
    await page.goto("/docs");

    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeVisible();

    await skipLink.click();

    const main = page.locator("#main-content");
    await expect(main).toBeFocused();
  });
});
