/**
 * E2E tests for the skip link accessibility feature.
 * Verifies that pressing Tab then Enter skips to main content.
 */
import { test, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

test.describe("Skip Link", () => {
  test("should skip to main content when Tab+Enter pressed", async ({
    page,
    nav,
    testUser,
    isMobile,
  }) => {
    test.skip(isMobile, "Skip link Tab focus unreliable on mobile viewports");

    await nav.gotoMyItems();

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    const mainContent = page.locator("#main-content");
    await expect(mainContent).toBeFocused({ timeout: Timeouts.animation });
  });
});
