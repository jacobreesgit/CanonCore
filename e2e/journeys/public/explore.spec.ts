/**
 * E2E tests for the public Explore page.
 * Covers page load, hero carousel visibility, and sorting.
 * Uses publicUser fixture to ensure public items exist for the hero.
 */
import { publicTest, expect } from "../../fixtures";

publicTest.describe("Explore Page", () => {
  publicTest(
    "should display explore page with hero",
    async ({ explore, publicUser }) => {
      await explore.goto();
      await explore.expectHeroVisible();
    }
  );

  publicTest("should allow sorting items", async ({ explore, publicUser }) => {
    await explore.goto();
    await explore.expectHeroVisible();
    await explore.selectSort("name-asc");
  });
});
