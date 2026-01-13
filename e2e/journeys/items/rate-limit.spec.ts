/**
 * Rate Limiting E2E Test - Documentation Only
 *
 * This test documents expected rate limit behavior but is always skipped
 * in CI/E2E environments because BYPASS_RATE_LIMIT=true.
 *
 * To manually test rate limiting:
 * 1. Set BYPASS_RATE_LIMIT=false in .env.local
 * 2. Run: pnpm test:e2e e2e/journeys/items/rate-limit.spec.ts
 * 3. Restore BYPASS_RATE_LIMIT=true after testing
 *
 * Expected behavior when rate limit is enforced:
 * - itemDelete: 60 requests/minute
 * - After exceeding limit, user sees "Too many attempts" toast
 */

import { test, expect } from "../../fixtures";

test.describe("Rate Limiting", () => {
  test.skip(
    process.env.BYPASS_RATE_LIMIT === "true" || !process.env.BYPASS_RATE_LIMIT,
    "Rate limiting bypassed in E2E environment - this test documents expected behavior only"
  );

  test("shows rate limit error after too many rapid deletions", async ({
    itemsPage,
    page,
    testUser,
  }) => {
    // testUser fixture handles sign-in automatically
    await itemsPage.goto();

    // Create test items
    for (let i = 0; i < 65; i++) {
      await itemsPage.createItem(`Rate Test ${i}`);
    }

    // Rapidly delete items to trigger rate limit (limit is 60/minute)
    for (let i = 0; i < 65; i++) {
      await itemsPage.deleteItemViaContextMenu(`Rate Test ${i}`);
    }

    // Should see rate limit error
    await expect(page.getByText(/too many attempts/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
