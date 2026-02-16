/**
 * E2E tests for navigation active state indicators.
 * Verifies breadcrumb displays "My Items" on the user's profile page.
 */
import { test, expect } from "../../fixtures";

test.describe("Nav Active State", () => {
  test("should show breadcrumb with My Items label", async ({
    nav,
    isMobile,
  }) => {
    test.skip(isMobile, "Breadcrumb header is desktop only (hidden lg:flex)");

    await nav.gotoMyItems();
    await nav.expectBreadcrumb("My Items");
  });
});
