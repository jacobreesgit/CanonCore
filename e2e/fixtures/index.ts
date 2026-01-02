/**
 * Playwright test fixtures for E2E tests.
 * Provides page objects and SFTP configuration for parallel test execution.
 */

import { test as base } from "@playwright/test";
import { LandingPage } from "../pages/landing.page";
import { SignInPage } from "../pages/sign-in.page";
import { SignUpPage } from "../pages/sign-up.page";
import { ForgotPasswordPage } from "../pages/forgot-password.page";
import { ResetPasswordPage } from "../pages/reset-password.page";
import { DashboardPage } from "../pages/dashboard.page";
import { ItemsPage } from "../pages/items.page";
import { DocsPage } from "../pages/docs.page";
import { ConnectionsPage } from "../pages/connections.page";
import { getSftpConfigForWorker, SftpTestConfig } from "./sftp.fixture";

type TestFixtures = {
  landingPage: LandingPage;
  signInPage: SignInPage;
  signUpPage: SignUpPage;
  forgotPasswordPage: ForgotPasswordPage;
  resetPasswordPage: ResetPasswordPage;
  dashboardPage: DashboardPage;
  itemsPage: ItemsPage;
  docsPage: DocsPage;
  connectionsPage: ConnectionsPage;
  sftpConfig: SftpTestConfig;
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

  itemsPage: async ({ page }, use) => {
    await use(new ItemsPage(page));
  },

  docsPage: async ({ page }, use) => {
    await use(new DocsPage(page));
  },

  connectionsPage: async ({ page }, use) => {
    await use(new ConnectionsPage(page));
  },

  sftpConfig: async ({}, use, testInfo) => {
    const config = getSftpConfigForWorker(testInfo.parallelIndex);
    await use(config);
  },
});

export { expect } from "@playwright/test";
