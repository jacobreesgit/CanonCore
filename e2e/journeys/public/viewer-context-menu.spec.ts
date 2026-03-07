/**
 * E2E tests for viewer more-options menu on another user's public items.
 * Covers Fork, Add to Playlist, and guest sign-in prompt.
 */
import { test, expect, publicTest } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";
import { openItemMoreMenu } from "../../config/item-locators";

test.describe("Viewer context menu on public items", () => {
  test("shows Add to Playlist and Fork on right-click", async ({
    page,
    itemsCrud,
    publicUser,
  }) => {
    // itemsCrud forces auth — navigate to the other user's profile
    await page.goto(`/u/${publicUser.username}`, {
      waitUntil: "domcontentloaded",
    });

    // Wait for item to appear
    await expect(
      page.getByRole("heading", { name: publicUser.itemName, level: 3 })
    ).toBeVisible({ timeout: Timeouts.api });

    // Open the more options dropdown via hover + click
    await openItemMoreMenu(page, publicUser.itemName);

    // Verify menu items
    await expect(page.getByText("Add to Playlist")).toBeVisible({
      timeout: Timeouts.animation,
    });
    await expect(page.getByText("Fork to Library")).toBeVisible({
      timeout: Timeouts.animation,
    });
  });
});

publicTest.describe("Guest viewer context menu", () => {
  publicTest(
    "shows Sign in to Fork for guests",
    async ({ page, publicUser }) => {
      await page.goto(`/u/${publicUser.username}`, {
        waitUntil: "domcontentloaded",
      });

      // Wait for item to appear
      await expect(
        page.getByRole("heading", { name: publicUser.itemName, level: 3 })
      ).toBeVisible({ timeout: Timeouts.api });

      // Open the more options dropdown via hover + click
      await openItemMoreMenu(page, publicUser.itemName);

      // Guest should see sign-in prompt
      await expect(page.getByText("Sign in to Fork")).toBeVisible({
        timeout: Timeouts.animation,
      });
    }
  );
});
