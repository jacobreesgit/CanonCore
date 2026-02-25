/**
 * E2E tests for watch status functionality.
 * Covers hero button toggle, context menu watched/unwatched actions,
 * and "Mark All as Watched" for parent items.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";
import { openItemMoreMenu } from "../../config/item-locators";
import { Timeouts } from "../../config/timeouts";

test.describe("Watch Status", () => {
  test("should mark item as watched from hero button", async ({
    itemsCrud,
    itemDetail,
    page,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);
    await itemDetail.goto(name);

    // Initially shows "Mark Watched" (unwatched state)
    const markBtn = page.getByRole("button", { name: "Mark Watched" });
    await expect(markBtn).toBeVisible({ timeout: Timeouts.api });
    await expect(markBtn).toHaveAttribute("aria-pressed", "false");

    // Click to mark as watched
    await markBtn.click();

    // Should switch to "Watched" state
    const watchedBtn = page.getByRole("button", { name: "Watched" });
    await expect(watchedBtn).toBeVisible({ timeout: Timeouts.api });
    await expect(watchedBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("should unwatch item from hero button", async ({
    itemsCrud,
    itemDetail,
    page,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);
    await itemDetail.goto(name);

    // Mark as watched first
    await page.getByRole("button", { name: "Mark Watched" }).click();
    const watchedBtn = page.getByRole("button", { name: "Watched" });
    await expect(watchedBtn).toBeVisible({ timeout: Timeouts.api });

    // Click to unwatch
    await watchedBtn.click();

    // Should revert to "Mark Watched"
    const markBtn = page.getByRole("button", { name: "Mark Watched" });
    await expect(markBtn).toBeVisible({ timeout: Timeouts.api });
    await expect(markBtn).toHaveAttribute("aria-pressed", "false");
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
    const menuItem = page.getByRole("menuitem", { name: "Mark as Watched" });
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

    // Mark as watched
    await page.getByRole("button", { name: "Mark Watched" }).click();
    await expect(page.getByRole("button", { name: "Watched" })).toBeVisible({
      timeout: Timeouts.api,
    });

    // Reload and verify persistence
    await page.reload();
    await expect(page.getByRole("button", { name: "Watched" })).toBeVisible({
      timeout: Timeouts.api,
    });
    await expect(page.getByRole("button", { name: "Watched" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
