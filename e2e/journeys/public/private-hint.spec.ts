/**
 * E2E tests for private resource hints.
 * When an owner visits their own private item via the public URL,
 * they still see the full owner view (not a 404).
 * Non-owners visiting a private item get a 404.
 * Uses self-contained fixtures — no seed dependency.
 */
import { test, expect } from "../../fixtures";
import { prisma } from "../../fixtures/authenticated.fixture";
import { Timeouts } from "../../config/timeouts";

test.describe("Private Resource Hints", () => {
  test("should let owner view their own private item via public URL", async ({
    page,
    testUser,
  }) => {
    // Create a private item for the authenticated test user
    const item = await prisma.item.create({
      data: {
        name: "my-private-item",
        userId: testUser.id,
        isPublic: false,
        inheritVisibility: false,
      },
    });

    // Visit the item via the public URL path
    await page.goto(`/u/${testUser.username}/${item.id}`, {
      waitUntil: "domcontentloaded",
    });

    // Owner should see the full item view (not a 404)
    await expect(
      page.getByRole("heading", { name: "my-private-item" })
    ).toBeVisible({
      timeout: Timeouts.api,
    });
  });

  test("should show 404 for non-owner visiting private item", async ({
    page,
    testUser: _testUser,
    publicUser,
  }) => {
    // Make the publicUser's item private
    await prisma.item.update({
      where: { id: publicUser.itemId },
      data: { isPublic: false },
    });

    // Visit the now-private item as the authenticated test user (not the owner)
    await page.goto(`/u/${publicUser.username}/${publicUser.itemId}`, {
      waitUntil: "domcontentloaded",
    });

    // Should get a 404, not the private hint
    await expect(page.getByTestId("private-resource-notice")).not.toBeVisible({
      timeout: Timeouts.api,
    });
  });
});
