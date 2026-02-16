/**
 * E2E tests for the site header auto-hide behavior.
 * Verifies the header hides on scroll down and reappears on scroll up.
 *
 * Note: The header uses -translate-y-full + opacity-0 to hide, not
 * display:none or visibility:hidden. Playwright's toBeVisible() doesn't
 * detect opacity-based hiding, so we assert on the CSS opacity value.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";
import { Timeouts } from "../../config/timeouts";

test.describe("Site Header Autohide", () => {
  test("should hide header on scroll down and show on scroll up", async ({
    page,
    itemsCrud,
    isMobile,
  }) => {
    test.skip(isMobile, "Site header is desktop only (hidden lg:flex)");

    // Create enough items to make the page scrollable past the hero
    const items = Array.from({ length: 12 }, () => testId("scroll"));
    for (const name of items) {
      await itemsCrud.createItem(name);
    }

    // The header element uses translate + opacity to auto-hide
    const header = page.getByTestId("nav-header");

    // Verify header is fully opaque before scrolling
    await expect(header).toHaveCSS("opacity", "1", {
      timeout: Timeouts.animation,
    });

    // Scroll down well past the 64px threshold to trigger auto-hide
    await page.evaluate(() => {
      const main = document.getElementById("main-content");
      if (main) main.scrollBy(0, 800);
    });

    // Header should fade out (opacity transitions to 0)
    await expect(header).toHaveCSS("opacity", "0", {
      timeout: Timeouts.api,
    });

    // Scroll back up to reveal header
    await page.evaluate(() => {
      const main = document.getElementById("main-content");
      if (main) main.scrollTo(0, 0);
    });

    // Header should fade back in
    await expect(header).toHaveCSS("opacity", "1", {
      timeout: Timeouts.api,
    });
  });
});
