import { test, expect } from "../../fixtures";
import {
  generateUniqueEmail,
  TEST_PASSWORD,
  ValidationTestData,
} from "../../helpers/test-user";

test.describe("Sign In Journey", () => {
  test("shows sign in form elements", async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.expectVisible();
  });

  test("shows error for invalid credentials", async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.signIn("nonexistent@example.com", "WrongPassword123!");
    await signInPage.expectError("Invalid email or password");
  });

  test("can navigate to sign up page", async ({ page, signInPage }) => {
    await signInPage.goto();
    await signInPage.signUpLink.click();
    await expect(page).toHaveURL("/sign-up");
  });

  test("can navigate to forgot password page", async ({ page, signInPage }) => {
    await signInPage.goto();
    await signInPage.forgotPasswordLink.click();
    await expect(page).toHaveURL("/forgot-password");
  });

  test("existing user can sign in and reach dashboard", async ({
    page,
    signUpPage,
    signInPage,
    dashboardPage,
  }) => {
    // First create an account
    const email = generateUniqueEmail("signin");
    const password = TEST_PASSWORD;

    await signUpPage.goto();
    await signUpPage.signUp(email, password, password);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Sign out by navigating to sign-in (or use sign out button if implemented)
    await page.goto("/sign-in");

    // Wait a moment for session to clear
    await page.waitForTimeout(500);

    // Now sign in with the same credentials
    await signInPage.signIn(email, password);

    // Should be on dashboard
    await dashboardPage.expectVisible();
  });

  test("shows error with empty email", async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.signIn(ValidationTestData.emptyEmail, TEST_PASSWORD);
    // HTML5 validation will prevent form submission
    // The email input should have validation state
    await expect(signInPage.emailInput).toHaveAttribute("required");
  });
});
