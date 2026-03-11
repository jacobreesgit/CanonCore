/**
 * E2E tests for the sign-in flow.
 * Covers form visibility and invalid credentials.
 */
import { publicTest, expect } from "../../fixtures";
import { testEmail, TEST_PASSWORD } from "../../config/test-data";

publicTest.describe("Sign In", () => {
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
