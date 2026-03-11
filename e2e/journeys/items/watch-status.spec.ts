/**
 * E2E tests for watch status functionality.
 * Covers settings menu toggle, context menu watched/unwatched actions,
 * and persistence across page reload.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";
import { openItemMoreMenu } from "../../config/item-locators";
import { Timeouts } from "../../config/timeouts";

test.describe("Watch Status", () => {
  test("should mark item as watched via settings menu", async ({
    itemsCrud,
    itemDetail,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);
    await itemDetail.goto(name);

    await itemDetail.markAsWatched();
    await itemDetail.expectUnwatchedMenuAvailable();
  });

  test("should unwatch item via settings menu", async ({
    itemsCrud,
    itemDetail,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);
    await itemDetail.goto(name);

    await itemDetail.markAsWatched();
    await itemDetail.markAsUnwatched();
    await itemDetail.expectWatchedMenuAvailable();
  });

  test("should show Mark as Watched in context menu for grid item", async ({
    itemsCrud,
    page,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    // Open more options menu on the grid card
    await openItemMoreMenu(page, name);

    // "Mark as Watched" should be visible
    const menuItem = page.getByTestId("menu-mark-watched");
    await expect(menuItem).toBeVisible({ timeout: Timeouts.animation });
  });

  test("should persist watched state across page reload", async ({
    itemsCrud,
    itemDetail,
    page,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);
    await itemDetail.goto(name);

    await itemDetail.markAsWatched();

    // Reload and verify persistence
    await page.reload();
    await itemDetail.expectUnwatchedMenuAvailable();
  });
});
