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

  test("existing user can sign in and reach my-items", async ({
    page,
    signUpPage,
    signInPage,
  }) => {
    // First create an account with a username
    const email = generateUniqueEmail("signin");
    const password = TEST_PASSWORD;
    // Username max is 20 chars, so use a short random suffix
    const username = `si_${Math.random().toString(36).slice(2, 10)}`;

    await signUpPage.goto();
    await signUpPage.signUp(email, password, password, username);
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 10000 });

    // Sign out by clearing session cookies
    await page.context().clearCookies();
    await page.goto("/sign-in");

    // Wait for sign-in page to be ready
    await expect(signInPage.emailInput).toBeVisible({ timeout: 10000 });

    // Now sign in with the same credentials
    await signInPage.signIn(email, password);

    // Should be on user's profile page (unified route)
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 15000 });
  });

  test("shows error with empty email", async ({ signInPage }) => {
    await signInPage.goto();
    await signInPage.signIn(ValidationTestData.emptyEmail, TEST_PASSWORD);
    // HTML5 validation will prevent form submission
    // The email input should have validation state
    await expect(signInPage.emailInput).toHaveAttribute("required");
  });
});
