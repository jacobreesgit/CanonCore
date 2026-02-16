/**
 * E2E tests for authenticated Explore features.
 * Covers the "Exclude Mine" toggle which requires an authenticated user.
 * Uses publicUser fixture to ensure public items exist for the hero.
 */
import { test, expect } from "../../fixtures";

test.describe("Explore Features", () => {
  test("should toggle exclude mine filter", async ({
    itemsCrud,
    explore,
    publicUser,
  }) => {
    // itemsCrud forces auth fixture to run (signs in the test user)
    await explore.goto();
    await explore.expectHeroVisible();
    await explore.toggleExcludeMine();
  });
});
