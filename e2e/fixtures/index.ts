import { test as base } from "@playwright/test";
import { LandingPage } from "../pages/landing.page";
import { SignInPage } from "../pages/sign-in.page";
import { SignUpPage } from "../pages/sign-up.page";
import { ForgotPasswordPage } from "../pages/forgot-password.page";
import { ResetPasswordPage } from "../pages/reset-password.page";
import { DashboardPage } from "../pages/dashboard.page";
import { generateTestUser, type TestUser } from "./db.fixture";

type TestFixtures = {
  landingPage: LandingPage;
  signInPage: SignInPage;
  signUpPage: SignUpPage;
  forgotPasswordPage: ForgotPasswordPage;
  resetPasswordPage: ResetPasswordPage;
  dashboardPage: DashboardPage;
  testUser: TestUser;
};

export const test = base.extend<TestFixtures>({
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },

  signInPage: async ({ page }, use) => {
    await use(new SignInPage(page));
  },

  signUpPage: async ({ page }, use) => {
    await use(new SignUpPage(page));
  },

  forgotPasswordPage: async ({ page }, use) => {
    await use(new ForgotPasswordPage(page));
  },

  resetPasswordPage: async ({ page }, use) => {
    await use(new ResetPasswordPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  testUser: async ({}, use) => {
    // Generate unique test user credentials for each test
    const user = generateTestUser();
    await use(user);
    // Cleanup happens via Stack Auth dashboard or is not needed
    // since we use unique emails per test
  },
});

export { expect } from "@playwright/test";
