/**
 * E2E tests for the sign-up flow.
 * Covers successful sign-up, validation errors, and duplicate detection.
 */
import { publicTest, expect, prisma } from "../../fixtures";
import { testEmail, testUsername, TEST_PASSWORD } from "../../config/test-data";
import { Timeouts } from "../../config/timeouts";

publicTest.describe("Sign Up (happy path)", () => {
  publicTest(
    "should create account and redirect to profile",
    async ({ page, auth }) => {
      const email = testEmail();
      const username = testUsername();

      try {
        await auth.gotoSignUp();

        // Fill email and username first, then wait for async username
        // validation to complete before filling passwords and submitting.
        const emailInput = page.getByTestId("sign-up-email-input");
        await emailInput.waitFor({
          state: "visible",
          timeout: Timeouts.upload,
        });
        await emailInput.fill(email);
        await page.getByTestId("sign-up-username-input").fill(username);

        // Wait for username validation to resolve (success indicator appears)
        await expect(page.getByTestId("username-success")).toBeVisible({
          timeout: Timeouts.api,
        });

        // Now fill passwords and submit
        await page.getByTestId("sign-up-password-input").fill(TEST_PASSWORD);
        await page
          .getByTestId("sign-up-confirm-password-input")
          .fill(TEST_PASSWORD);
        await page.getByTestId("sign-up-submit-button").click();

        // Should redirect to the new user's profile page
        await expect(page).toHaveURL(`/u/${username}`, {
          timeout: Timeouts.upload,
        });
      } finally {
        // Clean up created user even if assertions fail
        await prisma.user.delete({ where: { email } }).catch(() => {});
      }
    }
  );
});

publicTest.describe("Sign Up (validation)", () => {
  publicTest("should show error for short password", async ({ auth }) => {
    await auth.gotoSignUp();
    await auth.signUp(testEmail(), "abc", "abc", testUsername());
    await auth.expectSignUpError("at least 8 characters");
  });

  publicTest("should show error for mismatched passwords", async ({ auth }) => {
    await auth.gotoSignUp();
    await auth.signUp(
      testEmail(),
      TEST_PASSWORD,
      "DifferentPassword456!",
      testUsername()
    );
    await auth.expectSignUpError("Passwords do not match");
  });
});

publicTest.describe("Sign Up (duplicate)", () => {
  publicTest("should show error for duplicate email", async ({ auth }) => {
    await auth.gotoSignUp();
    await auth.signUp("demo@canoncore.com", TEST_PASSWORD, TEST_PASSWORD);
    await auth.expectSignUpError("already exists");
  });
});
