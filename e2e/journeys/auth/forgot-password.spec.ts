import { test, expect } from "../../fixtures";
import { generateUniqueEmail } from "../../helpers/test-user";

test.describe("Forgot Password Journey", () => {
  test("shows forgot password form elements", async ({
    forgotPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.expectVisible();
  });

  test("shows success message after submitting valid email", async ({
    forgotPasswordPage,
  }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.requestPasswordReset(
      generateUniqueEmail("forgot")
    );
    // Wait for API call to complete
    await forgotPasswordPage.successMessage.waitFor({
      state: "visible",
      timeout: 10000,
    });
    await forgotPasswordPage.expectSuccess();
  });

  test("shows success message even for non-existent email", async ({
    forgotPasswordPage,
  }) => {
    // For security, the same message is shown regardless of whether
    // the email exists in the system
    await forgotPasswordPage.goto();
    await forgotPasswordPage.requestPasswordReset("nonexistent@example.com");
    // Wait for API call to complete
    await forgotPasswordPage.successMessage.waitFor({
      state: "visible",
      timeout: 10000,
    });
    await forgotPasswordPage.expectSuccess();
  });

  test("can navigate back to sign in", async ({ page, forgotPasswordPage }) => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.backToSignInLink.click();
    await expect(page).toHaveURL("/sign-in");
  });
});
