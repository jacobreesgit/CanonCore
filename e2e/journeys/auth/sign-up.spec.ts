import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";
import { isMobileViewport } from "../../helpers/mobile-nav-helpers";

test.describe("Sign Up Journey", () => {
  test("new user can create account and reach my-items", async ({
    page,
    landingPage,
    signUpPage,
  }) => {
    const email = generateUniqueEmail("newuser");
    const password = TEST_PASSWORD;
    // Username is required for profile page redirect
    const username = `nu_${Math.random().toString(36).slice(2, 10)}`;

    // Start from landing page
    await landingPage.goto();
    await landingPage.expectVisible();

    const isMobile = await isMobileViewport(page);

    if (isMobile) {
      // Mobile: Use footer nav "Sign In" link, then navigate to sign-up
      const signInLink = page
        .getByRole("navigation", { name: /mobile navigation/i })
        .getByRole("link", { name: /sign in/i });
      await signInLink.click();
      await expect(page).toHaveURL("/sign-in");
    } else {
      // Desktop: Open sidebar if needed, then click "Get Started" in sidebar
      const sidebarTrigger = page.getByTestId("sidebar-trigger");
      const getStartedLink = page
        .locator('[data-slot="sidebar"]')
        .getByRole("link", { name: "Get Started" });

      if (!(await getStartedLink.isVisible())) {
        await sidebarTrigger.click();
        await expect(getStartedLink).toBeVisible({ timeout: 5000 });
      }

      await getStartedLink.click();
      await expect(page).toHaveURL("/sign-in");
    }

    // Navigate from sign-in to sign-up
    await page.getByTestId("sign-in-sign-up-link").click();
    await expect(page).toHaveURL("/sign-up");

    // Fill sign up form with username
    await signUpPage.signUp(email, password, password, username);

    // Wait for navigation away from sign-up page
    await page.waitForURL((url) => !url.pathname.includes("/sign-up"), {
      timeout: 15000,
    });

    // Should be on user profile
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/);
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
