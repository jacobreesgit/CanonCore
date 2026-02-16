/**
 * E2E tests for item visibility on public profiles.
 * Verifies that public items are shown using a self-contained public user fixture.
 */
import { publicTest, expect } from "../../fixtures";

publicTest.describe("Item Visibility", () => {
  publicTest(
    "should show public items on public profile",
    async ({ publicProfile, publicUser }) => {
      await publicProfile.goto(publicUser.username);
      await publicProfile.expectProfileVisible(publicUser.username);
      await publicProfile.expectLibraryVisible();
    }
  );
});
