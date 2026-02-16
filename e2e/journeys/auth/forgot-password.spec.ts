/**
 * E2E tests for the forgot password flow.
 * Covers submitting the email form and verifying the success message.
 */
import { publicTest } from "../../fixtures";
import { testEmail } from "../../config/test-data";

publicTest.describe("Forgot Password", () => {
  publicTest(
    "should show success message after submitting email",
    async ({ auth }) => {
      await auth.gotoForgotPassword();
      await auth.requestPasswordReset(testEmail());
      await auth.expectForgotPasswordSuccess();
    }
  );
});
