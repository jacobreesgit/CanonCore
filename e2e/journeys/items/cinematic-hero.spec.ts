/**
 * E2E tests for the cinematic hero section on item detail pages.
 * Verifies the hero carousel is displayed when navigating to an item.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Cinematic Hero", () => {
  test("should show hero when navigating to item detail", async ({
    itemsCrud,
    itemDetail,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    await itemDetail.goto(name);
    await itemDetail.expectHeroVisible();
  });
});
