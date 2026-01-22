/**
 * Playwright test fixtures for E2E tests.
 * Composes all fixtures and provides page objects.
 */

import { test as base, expect } from "@playwright/test";
import {
  googleDriveFixture,
  type GoogleDriveFixture,
} from "./google-drive.fixture";
import type { TestUserWithId } from "./test-user.fixture";
import { LandingPage } from "../pages/landing.page";
import { SignInPage } from "../pages/sign-in.page";
import { SignUpPage } from "../pages/sign-up.page";
import { ForgotPasswordPage } from "../pages/forgot-password.page";
import { ResetPasswordPage } from "../pages/reset-password.page";
import { MyItemsPage } from "../pages/my-items.page";
import { ItemsPage } from "../pages/items.page";
import { DocsPage } from "../pages/docs.page";
import { MediaPage } from "../pages/media.page";
import { SettingsPage } from "../pages/settings.page";
import { PublicProfilePage } from "../pages/public-profile.page";

/**
 * Page object fixtures available in all tests.
 */
type PageObjectFixtures = {
  landingPage: LandingPage;
  signInPage: SignInPage;
  signUpPage: SignUpPage;
  forgotPasswordPage: ForgotPasswordPage;
  resetPasswordPage: ResetPasswordPage;
  myItemsPage: MyItemsPage;
  itemsPage: ItemsPage;
  docsPage: DocsPage;
  mediaPage: MediaPage;
  settingsPage: SettingsPage;
  publicProfilePage: PublicProfilePage;
};

/**
 * All fixtures available in tests.
 */
type AllFixtures = PageObjectFixtures &
  GoogleDriveFixture & {
    testUser: TestUserWithId;
  };

// Compose Google Drive fixture (includes testUser) with page objects
const composedTest = googleDriveFixture.extend<PageObjectFixtures>({
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
  myItemsPage: async ({ page, testUser }, use) => {
    await use(new MyItemsPage(page, testUser.username));
  },
  itemsPage: async ({ page, testUser }, use) => {
    await use(new ItemsPage(page, testUser.username));
  },
  docsPage: async ({ page }, use) => {
    await use(new DocsPage(page));
  },
  mediaPage: async ({ page, testUser }, use) => {
    await use(new MediaPage(page, testUser.username));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  publicProfilePage: async ({ page }, use) => {
    await use(new PublicProfilePage(page));
  },
});

export const test = composedTest;
export { expect };

// Re-export prisma for tests that need direct DB access
export { testPrisma as prisma } from "./test-user.fixture";
