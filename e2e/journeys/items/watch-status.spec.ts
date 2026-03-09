/**
 * E2E tests for watch status functionality.
 * Covers settings menu toggle, context menu watched/unwatched actions,
 * and "Mark All as Watched" for parent items.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";
import { openItemMoreMenu } from "../../config/item-locators";
import { Timeouts } from "../../config/timeouts";

/** Helper: open the detail settings menu with retry (handles hydration delay). */
async function openSettingsMenu(
  page: import("@playwright/test").Page,
  expectedTestId: string
) {
  const item = page.getByTestId(expectedTestId);
  await expect(async () => {
    await page.getByTestId("detail-settings-button").click();
    await expect(item).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: Timeouts.api });
}

test.describe("Watch Status", () => {
  test("should mark item as watched via settings menu", async ({
    itemsCrud,
    itemDetail,
    page,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);
    await itemDetail.goto(name);

    // Open settings dropdown and click "Mark as Watched"
    await openSettingsMenu(page, "menu-mark-watched");
    await page.getByTestId("menu-mark-watched").click();

    // Re-open dropdown and verify it now shows "Mark as Unwatched"
    await page.waitForTimeout(500);
    await openSettingsMenu(page, "menu-mark-unwatched");
    await expect(page.getByTestId("menu-mark-unwatched")).toBeVisible({
      timeout: Timeouts.api,
    });
  });

  test("should unwatch item via settings menu", async ({
    itemsCrud,
    itemDetail,
    page,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);
    await itemDetail.goto(name);

    // Mark as watched first
    await openSettingsMenu(page, "menu-mark-watched");
    await page.getByTestId("menu-mark-watched").click();
    await page.waitForTimeout(500);

    // Re-open and click "Mark as Unwatched"
    await openSettingsMenu(page, "menu-mark-unwatched");
    await page.getByTestId("menu-mark-unwatched").click();
    await page.waitForTimeout(500);

    // Re-open and verify it shows "Mark as Watched" again
    await openSettingsMenu(page, "menu-mark-watched");
    await expect(page.getByTestId("menu-mark-watched")).toBeVisible({
      timeout: Timeouts.api,
    });
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

    // Mark as watched via settings menu
    await openSettingsMenu(page, "menu-mark-watched");
    await page.getByTestId("menu-mark-watched").click();
    await page.waitForTimeout(500);

    // Reload and verify persistence
    await page.reload();
    await openSettingsMenu(page, "menu-mark-unwatched");
    await expect(page.getByTestId("menu-mark-unwatched")).toBeVisible({
      timeout: Timeouts.api,
    });
  });
});
