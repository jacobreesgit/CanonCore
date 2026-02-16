/**
 * E2E tests for viewing a public user profile.
 * Covers profile page load and username visibility using a self-contained public user fixture.
 */
import { publicTest, expect } from "../../fixtures";

publicTest.describe("Public Profile", () => {
  publicTest(
    "should display a public user's profile",
    async ({ publicProfile, publicUser }) => {
      await publicProfile.goto(publicUser.username);
      await publicProfile.expectProfileVisible(publicUser.username);
    }
  );
});
