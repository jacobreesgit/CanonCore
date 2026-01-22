/**
 * E2E tests for auth page redirect behavior.
 * Verifies authenticated users are redirected away from auth pages.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Auth Page Redirects", () => {
  test("redirects authenticated user from /sign-in to profile", async ({
    page,
    testUser,
  }) => {
    // testUser fixture already authenticated
    // Try to visit sign-in page
    await page.goto("/sign-in");

    // Should redirect back to user profile
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 5000 });
  });

  test("redirects authenticated user from /sign-up to profile", async ({
    page,
    testUser,
  }) => {
    // testUser fixture already authenticated
    // Try to visit sign-up page
    await page.goto("/sign-up");

    // Should redirect back to user profile
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 5000 });
  });

  test("redirects authenticated user from /forgot-password to profile", async ({
    page,
    testUser,
  }) => {
    // testUser fixture already authenticated
    // Try to visit forgot-password page
    await page.goto("/forgot-password");

    // Should redirect back to user profile
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 5000 });
  });

  test("allows unauthenticated user to access /sign-in", async ({ page }) => {
    await page.goto("/sign-in");

    // Should stay on sign-in page
    await expect(page).toHaveURL("/sign-in");
    await expect(page.getByTestId("sign-in-email-input")).toBeVisible();
  });

  test("allows unauthenticated user to access /sign-up", async ({ page }) => {
    await page.goto("/sign-up");

    // Should stay on sign-up page
    await expect(page).toHaveURL("/sign-up");
    await expect(page.getByTestId("sign-up-email-input")).toBeVisible();
  });
});
