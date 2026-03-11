/**
 * E2E tests for browsing a public profile.
 * Covers viewing a public user's profile, seeing their items,
 * and clicking into an item detail page.
 */
import { publicTest, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";
import { slugify } from "../../../lib/slugify";

publicTest.describe("Public Profile Browse", () => {
  publicTest(
    "should display public profile with items",
    async ({ page, publicProfile, publicUser }) => {
      await publicProfile.goto(publicUser.username);
      await publicProfile.expectProfileVisible(publicUser.username);
      await publicProfile.expectLibraryVisible();

      // The public item should be visible as an h3 heading in the card grid
      await expect(
        page.getByRole("heading", { name: publicUser.itemName, level: 3 })
      ).toBeVisible({ timeout: Timeouts.api });
    }
  );

  publicTest(
    "should navigate to item detail from public profile",
    async ({ page, publicProfile, publicUser }) => {
      await publicProfile.goto(publicUser.username);
      await publicProfile.expectLibraryVisible();

      // Click the item card (uses testid since cards may not be links)
      const slug = slugify(publicUser.itemName);
      await page.getByTestId(`item-card-${slug}`).click();

      // Should be on the item detail page
      await expect(page.getByTestId("item-detail-container")).toBeVisible({
        timeout: Timeouts.navigation,
      });
    }
  );
});
