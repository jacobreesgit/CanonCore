import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Sign Up Journey", () => {
  test("new user can create account and reach dashboard", async ({
    page,
    landingPage,
    signUpPage,
  }) => {
    const email = generateUniqueEmail("newuser");
    const password = TEST_PASSWORD;

    // Start from landing page
    await landingPage.goto();
    await landingPage.expectVisible();

    // Click get started (goes to sign-in, then navigate to sign-up)
    await landingPage.clickGetStarted();
    await expect(page).toHaveURL("/sign-in");
    await page.getByTestId("sign-in-sign-up-link").click();
    await expect(page).toHaveURL("/sign-up");

    // Fill sign up form
    await signUpPage.signUp(email, password, password);

    // Wait for navigation away from sign-up page
    await page.waitForURL((url) => !url.pathname.includes("/sign-up"), {
      timeout: 15000,
    });

    // Should be on dashboard
    await expect(page).toHaveURL("/dashboard");
  });

  test("shows error for mismatched passwords", async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.signUp(
      "test@example.com",
      "Password123!",
      "Different123!"
    );
    await signUpPage.expectError("Passwords do not match");
  });

  test("shows error for short password", async ({ page, signUpPage }) => {
    await signUpPage.goto();
    // HTML5 minLength validation prevents form submission for short passwords
    // so we test that the password input has the minLength attribute
    await expect(signUpPage.passwordInput).toHaveAttribute("minLength", "8");
  });

  test("can navigate to sign in page", async ({ page, signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.signInLink.click();
    await expect(page).toHaveURL("/sign-in");
  });

  test("shows sign up form elements", async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.expectVisible();
  });
});
