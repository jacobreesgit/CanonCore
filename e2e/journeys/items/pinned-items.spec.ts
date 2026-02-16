/**
 * E2E tests for pinned items functionality.
 * Covers pinning and unpinning items to/from the sidebar.
 * Desktop-only: pinning uses the sidebar which is not available on mobile.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Pinned Items", () => {
  test("should pin an item to sidebar", async ({
    isMobile,
    itemsCrud,
    itemsPinned,
  }) => {
    test.skip(isMobile, "Pinning requires desktop sidebar");

    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    await itemsPinned.pinItem(name);
    await itemsPinned.expectPinnedInSidebar(name);
  });

  test("should unpin an item from sidebar", async ({
    isMobile,
    itemsCrud,
    itemsPinned,
  }) => {
    test.skip(isMobile, "Pinning requires desktop sidebar");

    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    await itemsPinned.pinItem(name);
    await itemsPinned.expectPinnedInSidebar(name);

    await itemsPinned.unpinItem(name);
    await itemsPinned.expectNotPinnedInSidebar(name);
  });
});
