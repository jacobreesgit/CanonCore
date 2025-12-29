import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Sign Out Journey", () => {
  test("user can sign out from dashboard", async ({
    page,
    signUpPage,
    dashboardPage,
  }) => {
    const email = generateUniqueEmail("signout");
    const password = TEST_PASSWORD;

    // Create account
    await signUpPage.goto();
    await signUpPage.signUp(email, password, password);

    // Wait for navigation to dashboard
    await page.waitForURL((url) => url.pathname.includes("/dashboard"), {
      timeout: 15000,
    });

    // Sign out
    await dashboardPage.signOut();

    // Should redirect to landing page after sign out
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("after sign out, accessing dashboard redirects to sign in", async ({
    page,
    signUpPage,
    dashboardPage,
  }) => {
    const email = generateUniqueEmail("signout-redirect");
    const password = TEST_PASSWORD;

    // Create account
    await signUpPage.goto();
    await signUpPage.signUp(email, password, password);

    // Wait for navigation to dashboard
    await page.waitForURL((url) => url.pathname.includes("/dashboard"), {
      timeout: 15000,
    });

    // Sign out
    await dashboardPage.signOut();
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Try to access dashboard directly
    await page.goto("/dashboard");

    // Should be redirected to sign-in (protected route)
    await expect(page).toHaveURL("/sign-in", { timeout: 10000 });
  });
});
