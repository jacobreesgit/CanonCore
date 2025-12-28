# Playwright E2E Testing Design

## Overview

End-to-end testing infrastructure using Playwright with journey-based test organization, Page Object Models, and database fixtures.

## Directory Structure

```
e2e/
├── journeys/                    # User journey tests
│   └── auth/
│       ├── sign-up.spec.ts
│       ├── sign-in.spec.ts
│       ├── forgot-password.spec.ts
│       └── sign-out.spec.ts
├── pages/                       # Page Object Models
│   ├── landing.page.ts
│   ├── sign-in.page.ts
│   ├── sign-up.page.ts
│   ├── forgot-password.page.ts
│   ├── reset-password.page.ts
│   └── dashboard.page.ts
├── fixtures/                    # Playwright fixtures
│   ├── auth.fixture.ts
│   ├── db.fixture.ts
│   └── index.ts
├── helpers/
│   └── test-user.ts
├── .auth/                       # Stored auth states (gitignored)
└── playwright.config.ts
```

## Playwright Configuration

```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './journeys',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'teardown',
      testMatch: /global\.teardown\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Page Object Model Pattern

```typescript
// e2e/pages/sign-in.page.ts
import { Page, Locator, expect } from '@playwright/test';

export class SignInPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId('sign-in-email-input');
    this.passwordInput = page.getByTestId('sign-in-password-input');
    this.submitButton = page.getByTestId('sign-in-submit-button');
    this.errorMessage = page.getByTestId('sign-in-error-message');
    this.forgotPasswordLink = page.getByTestId('sign-in-forgot-password-link');
  }

  async goto() {
    await this.page.goto('/sign-in');
  }

  async signIn(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}
```

## Fixtures

```typescript
// e2e/fixtures/index.ts
import { test as base } from '@playwright/test';
import { SignInPage } from '../pages/sign-in.page';
import { SignUpPage } from '../pages/sign-up.page';
import { DashboardPage } from '../pages/dashboard.page';
import { seedTestUser, cleanupTestUser } from './db.fixture';

type TestFixtures = {
  signInPage: SignInPage;
  signUpPage: SignUpPage;
  dashboardPage: DashboardPage;
  testUser: { email: string; password: string };
};

export const test = base.extend<TestFixtures>({
  signInPage: async ({ page }, use) => {
    await use(new SignInPage(page));
  },
  signUpPage: async ({ page }, use) => {
    await use(new SignUpPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  testUser: async ({}, use) => {
    const user = await seedTestUser();
    await use(user);
    await cleanupTestUser(user.email);
  },
});

export { expect } from '@playwright/test';
```

```typescript
// e2e/fixtures/db.fixture.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedTestUser() {
  const email = `test-${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  return { email, password };
}

export async function cleanupTestUser(email: string) {
  await prisma.user.deleteMany({ where: { email } });
}
```

## Journey Test Example

```typescript
// e2e/journeys/auth/sign-up.spec.ts
import { test, expect } from '../../fixtures';

test.describe('Sign Up Journey', () => {
  test('new user can create account and reach dashboard', async ({
    page,
    signUpPage,
    dashboardPage,
  }) => {
    const email = `newuser-${Date.now()}@example.com`;
    const password = 'SecurePass123!';

    await page.goto('/');
    await expect(page.getByTestId('landing-hero-title')).toBeVisible();
    await page.getByTestId('landing-get-started-button').click();
    await expect(page).toHaveURL('/sign-up');

    await signUpPage.signUp(email, password, password);

    await expect(page).toHaveURL('/dashboard');
    await expect(dashboardPage.welcomeMessage).toBeVisible();
  });

  test('shows error for mismatched passwords', async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.signUp('test@example.com', 'Password1!', 'Different1!');
    await signUpPage.expectError('Passwords do not match');
  });

  test('shows error for existing email', async ({ signUpPage, testUser }) => {
    await signUpPage.goto();
    await signUpPage.signUp(testUser.email, testUser.password, testUser.password);
    await signUpPage.expectError('already exists');
  });
});
```

## Test ID Naming Convention

Pattern: `[page/component]-[element]-[type]` (kebab-case)

| Page | Test IDs |
|------|----------|
| Landing | `landing-hero-title`, `landing-get-started-button`, `landing-sign-in-button` |
| Sign In | `sign-in-email-input`, `sign-in-password-input`, `sign-in-submit-button`, `sign-in-error-message`, `sign-in-forgot-password-link` |
| Sign Up | `sign-up-email-input`, `sign-up-password-input`, `sign-up-confirm-password-input`, `sign-up-submit-button`, `sign-up-error-message` |
| Forgot Password | `forgot-password-email-input`, `forgot-password-submit-button`, `forgot-password-success-message` |
| Dashboard | `dashboard-welcome-message`, `dashboard-user-menu`, `dashboard-sign-out-button` |

## NPM Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test --config=e2e/playwright.config.ts",
    "test:e2e:ui": "playwright test --config=e2e/playwright.config.ts --ui",
    "test:e2e:debug": "playwright test --config=e2e/playwright.config.ts --debug",
    "test:e2e:report": "playwright show-report e2e/playwright-report"
  }
}
```

## Setup

```bash
# Install Playwright
pnpm add -D @playwright/test

# Install browsers
pnpm exec playwright install chromium
```

## Gitignore Additions

```gitignore
# Playwright
e2e/.auth/
e2e/playwright-report/
e2e/test-results/
```
