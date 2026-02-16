/**
 * E2E tests for the sign-in flow.
 * Covers form visibility, invalid credentials, and successful sign-in redirect.
 */
import { test, publicTest, expect } from "../../fixtures";
import { testEmail, TEST_PASSWORD } from "../../config/test-data";

publicTest.describe("Sign In (unauthenticated)", () => {
  publicTest("should show sign-in form", async ({ auth }) => {
    await auth.gotoSignIn();
    await auth.expectSignInVisible();
  });

  publicTest("should show error for invalid credentials", async ({ auth }) => {
    await auth.gotoSignIn();
    await auth.signIn(testEmail(), "WrongPassword123!");
    await auth.expectSignInError("Invalid email or password");
  });
});

test.describe("Sign In (authenticated)", () => {
  test("should redirect to profile after sign-in", async ({
    page,
    testUser,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`);
  });
});
