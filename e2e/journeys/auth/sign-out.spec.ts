import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Sign Out Journey", () => {
  test("user can sign out from my-items", async ({
    page,
    signUpPage,
    myItemsPage,
  }) => {
    const email = generateUniqueEmail("signout");
    const password = TEST_PASSWORD;

    // Create account
    await signUpPage.goto();
    await signUpPage.signUp(email, password, password);

    // Wait for navigation to my-items
    await page.waitForURL((url) => url.pathname.includes("/my-items"), {
      timeout: 15000,
    });

    // Sign out
    await myItemsPage.signOut();

    // Should redirect to landing page after sign out
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("after sign out, accessing my-items redirects to sign in", async ({
    page,
    signUpPage,
    myItemsPage,
  }) => {
    const email = generateUniqueEmail("signout-redirect");
    const password = TEST_PASSWORD;

    // Create account
    await signUpPage.goto();
    await signUpPage.signUp(email, password, password);

    // Wait for navigation to my-items
    await page.waitForURL((url) => url.pathname.includes("/my-items"), {
      timeout: 15000,
    });

    // Sign out
    await myItemsPage.signOut();
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Try to access my-items directly
    await page.goto("/my-items");

    // Should be redirected to sign-in (protected route)
    await expect(page).toHaveURL("/sign-in", { timeout: 10000 });
  });
});
