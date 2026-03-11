/**
 * E2E tests for the spotlight search dialog.
 * Covers keyboard shortcut, escape to close, searching items, and empty results.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Spotlight Search", () => {
  test("should open spotlight via keyboard shortcut", async ({
    itemsCrud,
    spotlight,
  }) => {
    await itemsCrud.goto();
    await spotlight.open();
    await spotlight.expectOpen();
  });

  test("should close spotlight with escape", async ({
    itemsCrud,
    spotlight,
  }) => {
    await itemsCrud.goto();
    await spotlight.open();
    await spotlight.expectOpen();

    await spotlight.close();
    await spotlight.expectClosed();
  });

  test("should search for items", async ({ itemsCrud, spotlight }) => {
    const name = testId("search-item");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    await spotlight.open();
    await spotlight.search(name);
    await spotlight.expectResultVisible(name);
  });

  test("should show no results for gibberish", async ({
    itemsCrud,
    spotlight,
  }) => {
    await itemsCrud.goto();
    await spotlight.open();
    await spotlight.search("zzxxyywwvv_nonexistent_query");
    await spotlight.expectNoResults();
  });
});
