/**
 * E2E tests for pinned items functionality.
 * Covers pinning and unpinning items via the more options menu.
 */
import { test } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Pinned Items", () => {
  test("should pin an item", async ({ itemsCrud, itemsPinned }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    await itemsPinned.pinItem(name);
    await itemsPinned.expectPinned(name);
  });

  test("should unpin an item", async ({ itemsCrud, itemsPinned }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    await itemsPinned.pinItem(name);
    await itemsPinned.expectPinned(name);

    await itemsPinned.unpinItem(name);
    await itemsPinned.expectNotPinned(name);
  });
});
