import type { Page } from "@playwright/test";
import { SignInPage } from "../pages/sign-in.page";
import { SignUpPage } from "../pages/sign-up.page";
import type { TestUser } from "./db.fixture";
import { generateTestUser } from "./db.fixture";

/**
 * Creates a new test user account via the sign-up UI.
 * Returns user data including the generated username.
 */
export async function createTestUserViaUI(page: Page): Promise<TestUser> {
  const testUser = generateTestUser();
  const signUpPage = new SignUpPage(page);

  await signUpPage.goto();
  await signUpPage.signUp(testUser.email, testUser.password, testUser.password);

  // Wait for redirect to user profile (URL pattern matches /u/{username})
  await page.waitForURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 10000 });

  return testUser;
}

/**
 * Signs in an existing test user via the UI.
 *
 * @param page - Playwright page
 * @param testUser - Test user credentials (must include username for redirect verification)
 */
export async function signInTestUser(
  page: Page,
  testUser: TestUser
): Promise<void> {
  const signInPage = new SignInPage(page);

  await signInPage.goto();
  await signInPage.signIn(testUser.email, testUser.password);

  // Wait for redirect to user profile
  await page.waitForURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 10000 });
}

/**
 * Signs out the current user.
 */
export async function signOutUser(page: Page): Promise<void> {
  // Click user menu and sign out
  await page.getByTestId("my-items-user-menu").click();
  await page.getByTestId("my-items-sign-out-button").click();

  // Wait for redirect to sign-in page
  await page.waitForURL("/sign-in", { timeout: 10000 });
}
