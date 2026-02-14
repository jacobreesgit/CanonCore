# E2E Test Suite Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completely rewrite the E2E test suite (~650 tests) with convention-based data-testid strategy, feature-based POMs, flat fixtures, centralized timeouts, and zero anti-patterns.

**Architecture:** Convention-over-configuration approach. Every testable element gets a unique `data-testid` following `{feature}-{element}-{identifier}` pattern. 14 feature-based POMs replace the 1,367-line monolith. Flat 2-layer fixture hierarchy (base → authenticated/drive/public) replaces 4-layer chain.

**Tech Stack:** Playwright, TypeScript, Next.js 16, Prisma, data-testid conventions

**Design Doc:** `docs/plans/2026-02-14-e2e-rewrite-design.md`

---

## Phase 1: Infrastructure

### Task 1: Create E2E Config Utilities

**Files:**
- Create: `e2e/config/timeouts.ts`
- Create: `e2e/config/test-data.ts`
- Create: `lib/slugify.ts`

**Step 1: Create centralized timeout config**

Create `e2e/config/timeouts.ts`:

```ts
/**
 * Centralized timeout constants for E2E tests.
 * Every timeout in POMs and tests MUST reference this object.
 */
export const Timeouts = {
  /** CSS transitions, sheet open/close, animation completion */
  animation: 1_000,
  /** Route changes, page loads, form submissions */
  navigation: 5_000,
  /** Server action responses, TMDB lookups, dialog interactions */
  api: 10_000,
  /** File uploads, Drive sync, large operations */
  upload: 15_000,
  /** Complex multi-step operations, bulk actions */
  heavy: 30_000,
} as const;
```

**Step 2: Create test data utilities**

Create `e2e/config/test-data.ts`:

```ts
/**
 * Test data generation utilities for E2E tests.
 * Provides collision-free identifiers and common test constants.
 */
import { randomUUID } from "crypto";

/** Default test password meeting validation requirements (8+ chars, uppercase, lowercase, number). */
export const TEST_PASSWORD = "TestPassword123!";

/** E2E Drive test user credentials (pre-created by setup:e2e-drive). */
export const E2E_DRIVE_USER = {
  email: "e2e-drive-test@canoncore.test",
  password: "TestPassword123",
} as const;

/**
 * Generates a collision-free test identifier.
 * Uses UUID prefix for uniqueness across parallel workers.
 *
 * @param prefix - Human-readable prefix (e.g., "movie", "folder")
 * @returns Unique identifier like "movie-a1b2c3d4"
 */
export function testId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/**
 * Generates a unique test email.
 *
 * @param prefix - Optional prefix (default: "test")
 * @returns Unique email like "test-a1b2c3d4@example.com"
 */
export function testEmail(prefix = "test"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

/**
 * Generates a unique test username within the 3-20 char limit.
 *
 * @returns Unique username like "tu_a1b2c3d4"
 */
export function testUsername(): string {
  return `tu_${randomUUID().slice(0, 8)}`;
}

/**
 * Generates a complete test user object.
 */
export function testUser() {
  return {
    email: testEmail(),
    password: TEST_PASSWORD,
    username: testUsername(),
  };
}
```

**Step 3: Create slugify utility**

Create `lib/slugify.ts`:

```ts
/**
 * Converts a string to a URL-safe slug for use in data-testid attributes.
 * Used by components to generate predictable, unique test IDs.
 *
 * @param text - The text to slugify
 * @returns Lowercase kebab-case string (e.g., "Star Wars" → "star-wars")
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars except spaces and hyphens
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}
```

**Step 4: Commit infrastructure**

```bash
git add e2e/config/timeouts.ts e2e/config/test-data.ts lib/slugify.ts
git commit -m "feat(e2e): add centralized timeouts, test data utils, and slugify"
```

---

### Task 2: Add data-testid Attributes to Components

This is the foundation — components need unique, predictable `data-testid` attributes so POMs can select them without `.first()` or CSS selectors.

**Guiding principles:**
- Static IDs on containers/landmarks: `data-testid="items-toolbar"`, `data-testid="dialog-create-item"`
- Dynamic IDs on repeated elements: `data-testid={`item-card-${slugify(name)}`}`
- Import `slugify` from `lib/slugify.ts` where dynamic IDs are needed
- Keep existing `data-testid` values that already follow the convention — only change/add where needed

**Files to modify (grouped by feature):**

#### Auth components (already good — mostly keep existing)
- `app/(auth)/sign-in/sign-in-form.tsx` — already has `sign-in-*` testids ✓
- `app/(auth)/sign-up/sign-up-form.tsx` — already has `sign-up-*` testids ✓
- `app/(auth)/forgot-password/forgot-password-form.tsx` — already has testids ✓
- `app/(auth)/reset-password/reset-password-form.tsx` — already has testids ✓

#### Items components (major changes needed)

**Step 1: Add unique testids to items-view and content-toolbar**

`components/items/items-view.tsx`:
- Add `data-testid="items-tree-view"` to tree container (already exists ✓)
- Add `data-testid="items-grid-view"` to grid container (already exists ✓)
- Add `data-testid="items-empty-state"` to empty state container

`components/ui/content-toolbar.tsx`:
- Add `data-testid="items-add-button"` to the Add button
- Add `data-testid="items-edit-mode-enter"` and `items-edit-mode-exit"` to edit toggle
- Add `data-testid="items-view-dropdown"` to the ViewDropdown trigger
- Add `data-testid={`items-sort-option-${slugify(option.label)}`}` to each sort menuitemradio
- Add `data-testid="items-sort-dropdown"` to sort dropdown trigger
- Add `data-testid="items-filter-dropdown"` to filter dropdown trigger

`components/items/filter-dropdown.tsx`:
- Add `data-testid={`items-filter-option-${slugify(option.label)}`}` to each filter menuitemcheckbox
- Add `data-testid="items-filter-clear"` to clear button

**Step 2: Add unique testids to poster-card and tree-item**

`components/items/poster-card.tsx`:
- Change to: `data-testid={`item-card-${slugify(item.name)}`}`
- Add `data-testid={`item-card-${slugify(item.name)}-title`}` to the title element
- Add `data-testid={`item-card-${slugify(item.name)}-menu`}` to the more button

`components/sortable-tree/components/tree-item/tree-item.tsx`:
- Add `data-testid={`item-tree-${slugify(name)}`}` to the list item
- Keep existing `data-testid="tree-item-drag-handle"` but make unique: `data-testid={`item-tree-${slugify(name)}-drag`}`
- Keep existing `data-testid="tree-item-collapse-toggle"` but make unique: `data-testid={`item-tree-${slugify(name)}-collapse`}`

`components/items/item-more-button.tsx`:
- Already has `data-testid="item-more-button"` — make unique: `data-testid={`item-more-${slugify(itemName)}`}`

**Step 3: Add unique testids to dialogs and sheets**

`components/items/items-view.tsx` (or wherever create dialog is rendered):
- Add `data-testid="dialog-create-item"` to the create item dialog wrapper

`components/items/mobile-item-sheet.tsx`:
- Add `data-testid="sheet-item-options"` to the sheet wrapper
- Add `data-testid="mobile-sort-group"` to sort radiogroup
- Add `data-testid="mobile-filter-group"` to filter section
- Add `data-testid="mobile-view-group"` to view listbox

`components/items/mobile-options-sheet.tsx`:
- Add `data-testid="sheet-mobile-options"` to the sheet wrapper
- Keep existing `data-testid="mobile-options-trigger"` but make unique per context

**Step 4: Add unique testids to hero and detail components**

`components/hero/cinematic-hero.tsx`:
- Keep existing `data-testid="hero-carousel"` ✓
- Keep existing `data-testid="hero-settings-button"` ✓

`components/items/about-tab-content.tsx`:
- Keep existing `data-testid="about-tab-content"`, `about-cast-section"`, etc. ✓
- Add `data-testid="about-section-filter"` to the filter dropdown trigger (eliminates `.first()`)

`components/ui/underline-tabs.tsx`:
- Keep existing `data-testid="tab-contents"`, `data-testid="tab-about"` ✓

**Step 5: Add unique testids to navigation components**

`components/site-header.tsx`:
- Add `data-testid="nav-header"` to header
- Add `data-testid="nav-breadcrumb"` to breadcrumb nav

`components/nav-main.tsx`:
- Add `data-testid="nav-sidebar"` to sidebar
- Keep existing `data-testid="sidebar-trigger"` ✓
- Keep existing `data-testid="my-items-user-menu"` ✓
- Add `data-testid="nav-search-button"` to the search button (eliminates `.first()` in spotlight)

`components/mobile/mobile-footer-nav.tsx` (or equivalent):
- Add `data-testid="nav-mobile-footer"` to the footer nav
- Add `data-testid="nav-mobile-my-items"` to My Items link
- Add `data-testid="nav-mobile-explore"` to Explore link
- Add `data-testid="nav-mobile-account"` to Account button
- Add `data-testid="nav-mobile-help"` to Help button

**Step 6: Add unique testids to settings components**

`components/profile/settings-dialog.tsx`:
- Add `data-testid="dialog-settings"` to the dialog wrapper
- Add `data-testid="settings-tab-profile"`, `settings-tab-account"`, `settings-tab-connections"`, `settings-tab-activity"` to tabs

`components/profile/mobile-settings-sheet.tsx`:
- Add `data-testid="sheet-settings"` to the sheet wrapper

**Step 7: Add unique testids to public/explore components**

`app/(public)/explore/explore-client.tsx`:
- Add `data-testid="explore-sort-dropdown"` to sort trigger
- Add `data-testid="explore-exclude-mine"` to exclude-mine toggle
- Add `data-testid={`explore-item-${slugify(item.name)}`}` to each explore item card

`app/(public)/u/[username]/page.tsx` or its client component:
- Add `data-testid="profile-fork-button"` to fork button
- Add `data-testid="profile-library-section"` to library section

**Step 8: Add unique testids to spotlight components**

`components/search/spotlight-search.tsx`:
- Add `data-testid="spotlight-dialog"` to the dialog
- Add `data-testid="spotlight-input"` to the search input
- Add `data-testid={`spotlight-result-${slugify(name)}`}` to each search result

**Step 9: Commit all data-testid additions**

```bash
git add -A
git commit -m "feat(e2e): add unique data-testid attributes to all testable components"
```

---

## Phase 2: Fixtures

### Task 3: Rewrite Fixture Architecture

Replace the 4-layer fixture hierarchy with flat 2-layer design.

**Files:**
- Create: `e2e/fixtures/authenticated.fixture.ts`
- Create: `e2e/fixtures/drive.fixture.ts`
- Create: `e2e/fixtures/public.fixture.ts`
- Rewrite: `e2e/fixtures/index.ts`
- Delete: `e2e/fixtures/auth.fixture.ts` (functionality merged into authenticated)
- Delete: `e2e/fixtures/test-user.fixture.ts` (replaced by authenticated)
- Keep: `e2e/fixtures/db.fixture.ts` (low-level DB operations, used by global teardown)
- Keep: `e2e/fixtures/google-drive.fixture.ts` (Drive-specific utilities, wrapped by drive fixture)

**Step 1: Create authenticated fixture**

Create `e2e/fixtures/authenticated.fixture.ts`:

```ts
/**
 * Authenticated test fixture.
 * Creates a test user via DB, signs in via UI, provides userId + POMs.
 * Cleans up user on teardown.
 */
import { test as base } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { config } from "dotenv";
import { testUser as generateTestUser } from "../config/test-data";
import { Timeouts } from "../config/timeouts";

config({ path: ".env.local" });

const globalForPrisma = globalThis as unknown as {
  e2ePrisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.e2ePrisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    });
    globalForPrisma.e2ePrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.e2ePrisma;
}

export const prisma = getPrismaClient();

export interface TestUserInfo {
  id: string;
  email: string;
  password: string;
  username: string;
}

export const authenticatedFixture = base.extend<{
  testUser: TestUserInfo;
  isMobile: boolean;
}>({
  isMobile: async ({ page }, use) => {
    const viewport = page.viewportSize();
    await use(viewport ? viewport.width < 1024 : false);
  },

  testUser: async ({ page }, use) => {
    const userData = generateTestUser();
    const passwordHash = await hash(userData.password, 10);

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        username: userData.username,
      },
    });

    const testUserInfo: TestUserInfo = {
      id: user.id,
      email: userData.email,
      password: userData.password,
      username: userData.username,
    };

    // Sign in via UI
    await page.goto("/sign-in");
    const emailInput = page.getByTestId("sign-in-email-input");
    await emailInput.waitFor({ state: "visible", timeout: Timeouts.upload });
    await emailInput.fill(testUserInfo.email);
    await page.getByTestId("sign-in-password-input").fill(testUserInfo.password);
    await page.getByTestId("sign-in-submit-button").click();
    await page.waitForURL(`/u/${testUserInfo.username}`, {
      timeout: Timeouts.upload,
    });

    await use(testUserInfo);

    // Cleanup
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  },
});
```

**Step 2: Create public fixture**

Create `e2e/fixtures/public.fixture.ts`:

```ts
/**
 * Public (unauthenticated) test fixture.
 * No user creation — for explore, public profiles, landing page tests.
 */
import { test as base } from "@playwright/test";

export const publicFixture = base.extend<{
  isMobile: boolean;
}>({
  isMobile: async ({ page }, use) => {
    const viewport = page.viewportSize();
    await use(viewport ? viewport.width < 1024 : false);
  },
});
```

**Step 3: Create drive fixture**

Create `e2e/fixtures/drive.fixture.ts`:

```ts
/**
 * Google Drive test fixture.
 * Extends authenticated fixture with Drive connection setup/cleanup.
 */
import { authenticatedFixture, prisma } from "./authenticated.fixture";
import { Timeouts } from "../config/timeouts";
import { E2E_DRIVE_USER } from "../config/test-data";

// Re-export for Drive tests that need DB access
export { prisma };

export interface E2eDriveUser {
  id: string;
  email: string;
  password: string;
  username: string;
}

export const driveFixture = authenticatedFixture.extend<{
  e2eDriveUser: E2eDriveUser;
}>({
  e2eDriveUser: async ({ page }, use) => {
    const user = await prisma.user.findUnique({
      where: { email: E2E_DRIVE_USER.email },
    });

    if (!user || !user.username) {
      throw new Error(
        `E2E Drive user not found: ${E2E_DRIVE_USER.email}\nRun: pnpm run setup:e2e-drive`
      );
    }

    const e2eDriveUser: E2eDriveUser = {
      id: user.id,
      email: E2E_DRIVE_USER.email,
      password: E2E_DRIVE_USER.password,
      username: user.username,
    };

    // Sign in the Drive user
    await page.goto("/sign-in");
    const emailInput = page.getByTestId("sign-in-email-input");
    await emailInput.waitFor({ state: "visible", timeout: Timeouts.upload });
    await emailInput.fill(e2eDriveUser.email);
    await page.getByTestId("sign-in-password-input").fill(e2eDriveUser.password);
    await page.getByTestId("sign-in-submit-button").click();
    await page.waitForURL(`/u/${e2eDriveUser.username}`, {
      timeout: Timeouts.upload,
    });

    await use(e2eDriveUser);
  },
});
```

**Step 4: Rewrite fixture index with POM composition**

Rewrite `e2e/fixtures/index.ts`:

```ts
/**
 * Composed test fixtures for E2E tests.
 * Provides POMs as fixture properties — tests destructure what they need.
 */
import { expect } from "@playwright/test";
import { authenticatedFixture } from "./authenticated.fixture";
import { publicFixture } from "./public.fixture";
import { driveFixture } from "./drive.fixture";

// Import all POMs (these will be created in Phase 3)
import { ItemsCrudPage } from "../pages/items-crud.page";
import { ItemsSortFilterPage } from "../pages/items-sort-filter.page";
import { ItemsSettingsPage } from "../pages/items-settings.page";
import { ItemsPinnedPage } from "../pages/items-pinned.page";
import { ItemsDragPage } from "../pages/items-drag.page";
import { ItemsHierarchyPage } from "../pages/items-hierarchy.page";
import { ItemDetailPage } from "../pages/item-detail.page";
import { ExplorePage } from "../pages/explore.page";
import { PublicProfilePage } from "../pages/public-profile.page";
import { AuthPage } from "../pages/auth.page";
import { SettingsPage } from "../pages/settings.page";
import { SpotlightPage } from "../pages/spotlight.page";
import { MediaPage } from "../pages/media.page";
import { NavPage } from "../pages/nav.page";

// Authenticated test with all POMs
export const test = authenticatedFixture.extend<{
  itemsCrud: ItemsCrudPage;
  itemsSortFilter: ItemsSortFilterPage;
  itemsSettings: ItemsSettingsPage;
  itemsPinned: ItemsPinnedPage;
  itemsDrag: ItemsDragPage;
  itemsHierarchy: ItemsHierarchyPage;
  itemDetail: ItemDetailPage;
  explore: ExplorePage;
  publicProfile: PublicProfilePage;
  auth: AuthPage;
  settings: SettingsPage;
  spotlight: SpotlightPage;
  media: MediaPage;
  nav: NavPage;
}>({
  // Suppress Next.js dev error overlay
  page: async ({ page }, use) => {
    const hideOverlay = async () => {
      await page
        .addStyleTag({
          content:
            "nextjs-portal { display: none !important; pointer-events: none !important; }",
        })
        .catch(() => {});
    };
    await hideOverlay();
    page.on("load", hideOverlay);
    await use(page);
  },
  itemsCrud: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsCrudPage(page, testUser.username, isMobile));
  },
  itemsSortFilter: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsSortFilterPage(page, testUser.username, isMobile));
  },
  itemsSettings: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsSettingsPage(page, testUser.username, isMobile));
  },
  itemsPinned: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsPinnedPage(page, testUser.username, isMobile));
  },
  itemsDrag: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsDragPage(page, testUser.username, isMobile));
  },
  itemsHierarchy: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsHierarchyPage(page, testUser.username, isMobile));
  },
  itemDetail: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemDetailPage(page, testUser.username, isMobile));
  },
  explore: async ({ page, isMobile }, use) => {
    await use(new ExplorePage(page, isMobile));
  },
  publicProfile: async ({ page, isMobile }, use) => {
    await use(new PublicProfilePage(page, isMobile));
  },
  auth: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  settings: async ({ page, isMobile }, use) => {
    await use(new SettingsPage(page, isMobile));
  },
  spotlight: async ({ page, isMobile }, use) => {
    await use(new SpotlightPage(page, isMobile));
  },
  media: async ({ page, testUser, isMobile }, use) => {
    await use(new MediaPage(page, testUser.username, isMobile));
  },
  nav: async ({ page, testUser, isMobile }, use) => {
    await use(new NavPage(page, testUser.username, isMobile));
  },
});

// Public test (no auth) with relevant POMs
export const publicTest = publicFixture.extend<{
  explore: ExplorePage;
  publicProfile: PublicProfilePage;
  auth: AuthPage;
  nav: NavPage;
  spotlight: SpotlightPage;
}>({
  explore: async ({ page, isMobile }, use) => {
    await use(new ExplorePage(page, isMobile));
  },
  publicProfile: async ({ page, isMobile }, use) => {
    await use(new PublicProfilePage(page, isMobile));
  },
  auth: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  nav: async ({ page, isMobile }, use) => {
    await use(new NavPage(page, "", isMobile));
  },
  spotlight: async ({ page, isMobile }, use) => {
    await use(new SpotlightPage(page, isMobile));
  },
});

// Drive test with Drive-specific fixtures + POMs
export const driveTest = driveFixture;

export { expect };
export { prisma } from "./authenticated.fixture";
```

**Step 5: Commit fixture rewrite**

```bash
git add e2e/fixtures/
git commit -m "feat(e2e): rewrite fixture architecture to flat 2-layer design"
```

---

## Phase 3: Page Object Models

Each POM follows these rules:
- Constructor takes `page: Page`, `username: string` (where applicable), `isMobile: boolean`
- All selectors use `data-testid` via `page.getByTestId()`
- No `.first()`, `.nth()`, CSS selectors, or `getByRole()` as primary selectors
- Explicit mobile vs desktop methods — no hidden branching
- All timeouts use `Timeouts.*`
- JSDoc on every public method

### Task 4: Create Auth POM

**Files:**
- Create: `e2e/pages/auth.page.ts`

Merges the existing 4 auth POMs (sign-in, sign-up, forgot-password, reset-password) into one. These are already well-structured with testids — just consolidate.

```ts
/**
 * Page object for authentication flows.
 * Covers sign-in, sign-up, forgot password, and reset password.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class AuthPage {
  constructor(private page: Page) {}

  // ── Sign In ──────────────────────────────────────────────

  /** Navigate to sign-in page. */
  async gotoSignIn() {
    await this.page.goto("/sign-in");
  }

  /** Fill and submit sign-in form. */
  async signIn(email: string, password: string) {
    const emailInput = this.page.getByTestId("sign-in-email-input");
    await emailInput.waitFor({ state: "visible", timeout: Timeouts.upload });
    await emailInput.fill(email);
    await this.page.getByTestId("sign-in-password-input").fill(password);
    await this.page.getByTestId("sign-in-submit-button").click();
  }

  /** Expect sign-in form is visible. */
  async expectSignInVisible() {
    await expect(this.page.getByTestId("sign-in-email-input")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  /** Expect sign-in error message. */
  async expectSignInError(message: string) {
    await expect(this.page.getByTestId("sign-in-error-message")).toContainText(
      message
    );
  }

  // ── Sign Up ──────────────────────────────────────────────

  /** Navigate to sign-up page. */
  async gotoSignUp() {
    await this.page.goto("/sign-up");
  }

  /** Fill and submit sign-up form. */
  async signUp(
    email: string,
    password: string,
    confirmPassword: string,
    username?: string
  ) {
    const emailInput = this.page.getByTestId("sign-up-email-input");
    await emailInput.waitFor({ state: "visible", timeout: Timeouts.upload });
    await emailInput.fill(email);
    if (username) {
      await this.page.getByTestId("sign-up-username-input").fill(username);
    }
    await this.page.getByTestId("sign-up-password-input").fill(password);
    await this.page
      .getByTestId("sign-up-confirm-password-input")
      .fill(confirmPassword);
    await this.page.getByTestId("sign-up-submit-button").click();
  }

  /** Expect sign-up error message. */
  async expectSignUpError(message: string) {
    await expect(this.page.getByTestId("sign-up-error-message")).toContainText(
      message
    );
  }

  // ── Forgot Password ─────────────────────────────────────

  /** Navigate to forgot password page. */
  async gotoForgotPassword() {
    await this.page.goto("/forgot-password");
  }

  /** Submit forgot password form. */
  async requestPasswordReset(email: string) {
    await this.page.getByTestId("forgot-password-email-input").fill(email);
    await this.page.getByTestId("forgot-password-submit-button").click();
  }

  /** Expect forgot password success. */
  async expectForgotPasswordSuccess() {
    await expect(
      this.page.getByTestId("forgot-password-success-message")
    ).toBeVisible({ timeout: Timeouts.api });
  }

  // ── Reset Password ──────────────────────────────────────

  /** Navigate to reset password page. */
  async gotoResetPassword(code?: string) {
    const url = code ? `/reset-password?code=${code}` : "/reset-password";
    await this.page.goto(url);
  }

  /** Submit reset password form. */
  async resetPassword(password: string, confirmPassword: string) {
    await this.page.getByTestId("reset-password-password-input").fill(password);
    await this.page
      .getByTestId("reset-password-confirm-password-input")
      .fill(confirmPassword);
    await this.page.getByTestId("reset-password-submit-button").click();
  }

  /** Expect reset password success. */
  async expectResetPasswordSuccess() {
    await expect(
      this.page.getByTestId("reset-password-success-message")
    ).toBeVisible({ timeout: Timeouts.api });
  }
}
```

**Commit:**
```bash
git add e2e/pages/auth.page.ts
git commit -m "feat(e2e): add auth POM consolidating sign-in/up/forgot/reset"
```

### Task 5: Create Nav POM

**Files:**
- Create: `e2e/pages/nav.page.ts`

```ts
/**
 * Page object for navigation elements.
 * Covers sidebar, header, mobile footer, skip link.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class NavPage {
  constructor(
    private page: Page,
    private username: string,
    private isMobile: boolean
  ) {}

  // ── Navigation ──────────────────────────────────────────

  /** Navigate to the user's items page. */
  async gotoMyItems() {
    await this.page.goto(`/u/${this.username}`);
  }

  // ── Desktop Sidebar ─────────────────────────────────────

  /** Open sidebar if closed (desktop only). */
  async openSidebar() {
    const sidebar = this.page.getByTestId("nav-sidebar");
    if (!(await sidebar.isVisible())) {
      await this.page.getByTestId("sidebar-trigger").click();
      await expect(sidebar).toBeVisible({ timeout: Timeouts.animation });
    }
  }

  /** Close sidebar if open (desktop only). */
  async closeSidebar() {
    const sidebar = this.page.getByTestId("nav-sidebar");
    if (await sidebar.isVisible()) {
      await this.page.getByTestId("sidebar-trigger").click();
      await expect(sidebar).not.toBeVisible({ timeout: Timeouts.animation });
    }
  }

  /** Open user menu dropdown (desktop). */
  async openUserMenuDesktop() {
    await this.openSidebar();
    await this.page.getByTestId("my-items-user-menu").click();
  }

  /** Sign out via desktop sidebar. */
  async signOutDesktop() {
    await this.openUserMenuDesktop();
    await this.page.getByTestId("my-items-sign-out-button").click();
  }

  /** Open settings via desktop sidebar. */
  async openSettingsDesktop() {
    await this.openUserMenuDesktop();
    await this.page.getByTestId("my-items-settings-button").click();
  }

  // ── Mobile Footer ───────────────────────────────────────

  /** Navigate to My Items via mobile footer. */
  async tapMyItemsMobile() {
    await this.page.getByTestId("nav-mobile-my-items").click();
  }

  /** Navigate to Explore via mobile footer. */
  async tapExploreMobile() {
    await this.page.getByTestId("nav-mobile-explore").click();
  }

  /** Open account/settings sheet via mobile footer. */
  async tapAccountMobile() {
    await this.page.getByTestId("nav-mobile-account").click();
    await expect(
      this.page.getByTestId("sheet-settings")
    ).toBeVisible({ timeout: Timeouts.animation });
  }

  /** Sign out via mobile settings sheet. */
  async signOutMobile() {
    await this.tapAccountMobile();
    // Navigate to Account tab via select dropdown
    const selectTrigger = this.page.getByTestId("settings-tab-select");
    await selectTrigger.click();
    await this.page.getByTestId("settings-tab-option-account").click();
    await this.page.getByTestId("settings-sign-out-button").click();
  }

  // ── Convenience ─────────────────────────────────────────

  /** Sign out (dispatches to mobile or desktop). */
  async signOut() {
    if (this.isMobile) {
      await this.signOutMobile();
    } else {
      await this.signOutDesktop();
    }
  }

  // ── Header ──────────────────────────────────────────────

  /** Scroll to top to reveal auto-hiding header. */
  async revealHeader() {
    await this.page.evaluate(() => {
      const main = document.getElementById("main-content");
      (main ?? window).scrollTo(0, 0);
    });
    await expect(this.page.getByTestId("nav-breadcrumb")).toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  /** Click a breadcrumb link. */
  async clickBreadcrumb(name: string) {
    await this.revealHeader();
    await this.page.getByTestId("nav-breadcrumb")
      .getByRole("link", { name, exact: true })
      .click();
  }

  /** Expect breadcrumb with given name is visible. */
  async expectBreadcrumb(name: string) {
    await this.revealHeader();
    await expect(
      this.page.getByTestId("nav-breadcrumb")
        .getByRole("link", { name, exact: true })
    ).toBeVisible({ timeout: Timeouts.api });
  }

  // ── Skip Link ───────────────────────────────────────────

  /** Tab to skip link and activate it. */
  async useSkipLink() {
    await this.page.keyboard.press("Tab");
    await this.page.keyboard.press("Enter");
  }
}
```

### Task 6: Create Items CRUD POM

**Files:**
- Create: `e2e/pages/items-crud.page.ts`

Covers: create item, rename item, delete item, expect item visible/not visible, click item, empty state, toasts.

This POM extracts the CRUD methods from the old `items.page.ts` monolith with all anti-patterns fixed.

### Task 7: Create Items Sort/Filter POM

**Files:**
- Create: `e2e/pages/items-sort-filter.page.ts`

Covers: select sort option, toggle filter, clear filters, get current sort/filter, switch view mode (tree/grid).

Desktop and mobile have explicit separate methods.

### Task 8: Create Items Settings POM

**Files:**
- Create: `e2e/pages/items-settings.page.ts`

Covers: open settings dialog/sheet, rename via settings, update description, TMDB search, file type sections, close settings.

### Task 9: Create Items Pinned POM

**Files:**
- Create: `e2e/pages/items-pinned.page.ts`

Covers: pin/unpin via context menu, expect pinned in sidebar, pinned grid on profile page.

### Task 10: Create Items Drag POM

**Files:**
- Create: `e2e/pages/items-drag.page.ts`

Covers: enter/exit edit mode, drag item to position, drag to nest, expect item order, bulk select, bulk delete.

### Task 11: Create Items Hierarchy POM

**Files:**
- Create: `e2e/pages/items-hierarchy.page.ts`

Covers: add child item via context menu, collapse/expand tree nodes, expect parent/child relationships.

### Task 12: Create Item Detail POM

**Files:**
- Create: `e2e/pages/item-detail.page.ts`

Covers: hero section, tabs (Contents/About), about tab sections, section filter, breadcrumb navigation.

### Task 13: Create Explore POM

**Files:**
- Create: `e2e/pages/explore.page.ts`

Covers: explore page navigation, sort, exclude-mine toggle, hero carousel, item cards.

### Task 14: Create Public Profile POM

**Files:**
- Create: `e2e/pages/public-profile.page.ts`

Covers: view public profile, fork item, visibility checks, library stats.

### Task 15: Create Settings POM

**Files:**
- Create: `e2e/pages/settings.page.ts`

Covers: profile settings dialog/sheet, tab navigation, avatar/hero upload, account operations, Drive connections.

### Task 16: Create Spotlight POM

**Files:**
- Create: `e2e/pages/spotlight.page.ts`

Covers: open via keyboard/button, search, select result, empty state.

### Task 17: Create Media POM

**Files:**
- Create: `e2e/pages/media.page.ts`

Covers: media player, hero stats, file navigation.

**Commit after all POMs:**
```bash
git add e2e/pages/
git commit -m "feat(e2e): add 14 feature-based POMs replacing monolith"
```

---

## Phase 4: Spec File Rewrites

Each spec file follows this pattern:
- Import `test` (or `publicTest`/`driveTest`) and `expect` from `e2e/fixtures`
- Import `testId` from `e2e/config/test-data`
- Destructure only needed POMs from fixtures
- Each test creates its own data — no shared state between tests
- No `.first()`, `waitForTimeout()`, `{ force: true }`, hardcoded timeouts, `networkidle`, or `test.describe.configure({ mode: "serial" })`

### Task 18: Rewrite Auth Specs

**Files:**
- Rewrite: `e2e/journeys/auth/sign-in.spec.ts`
- Rewrite: `e2e/journeys/auth/sign-up.spec.ts`
- Rewrite: `e2e/journeys/auth/forgot-password.spec.ts`
- Rewrite: `e2e/journeys/auth/sign-out.spec.ts`
- Rewrite: `e2e/journeys/auth/auth-redirect.spec.ts`

**Example pattern:**

```ts
import { test, expect } from "../../fixtures";
import { testId, testEmail, TEST_PASSWORD } from "../../config/test-data";

test.describe("Sign In", () => {
  test("should sign in with valid credentials", async ({ auth, testUser }) => {
    // testUser fixture already signed us in — verify we landed on profile
    await expect(auth.page).toHaveURL(`/u/${testUser.username}`);
  });

  test("should show error for invalid password", async ({ auth }) => {
    await auth.gotoSignIn();
    await auth.signIn("test@example.com", "WrongPassword123!");
    await auth.expectSignInError("Invalid email or password");
  });
});
```

### Task 19: Rewrite Navigation Specs

**Files:**
- Rewrite: `e2e/journeys/navigation/skip-link.spec.ts`
- Rewrite: `e2e/journeys/navigation/header-autohide.spec.ts`
- Rewrite: `e2e/journeys/navigation/nav-active-state.spec.ts`

### Task 20: Rewrite Items CRUD Specs

**Files:**
- Rewrite: `e2e/journeys/items/items-crud.spec.ts`
- Rewrite: `e2e/journeys/items/items-rename.spec.ts`
- Rewrite: `e2e/journeys/items/items-delete.spec.ts`

### Task 21: Rewrite Items Sort/Filter Specs

**Files:**
- Rewrite: `e2e/journeys/items/items-sort-filter.spec.ts`
- Rewrite: `e2e/journeys/items/items-view-toggle.spec.ts`

### Task 22: Rewrite Items Settings Specs

**Files:**
- Rewrite: `e2e/journeys/items/items-settings.spec.ts`
- Rewrite: `e2e/journeys/items/media-lookup.spec.ts`
- Rewrite: `e2e/journeys/items/tmdb-display-options.spec.ts`

### Task 23: Rewrite Items Pinned Specs

**Files:**
- Rewrite: `e2e/journeys/items/pinned-items.spec.ts`

### Task 24: Rewrite Items Drag/Hierarchy Specs

**Files:**
- Rewrite: `e2e/journeys/items/items-drag-tree.spec.ts`
- Rewrite: `e2e/journeys/items/items-drag-grid.spec.ts`
- Rewrite: `e2e/journeys/items/items-hierarchy.spec.ts`
- Rewrite: `e2e/journeys/items/context-menu-add-child.spec.ts`
- Rewrite: `e2e/journeys/items/heavy-serial.spec.ts` → eliminate serial mode, make tests independent

### Task 25: Rewrite Items Progress/Visibility Specs

**Files:**
- Rewrite: `e2e/journeys/items/items-progress.spec.ts`
- Rewrite: `e2e/journeys/items/items-visibility.spec.ts`

### Task 26: Rewrite Public Specs

**Files:**
- Rewrite: `e2e/journeys/public/landing.spec.ts`
- Rewrite: `e2e/journeys/public/explore-features.spec.ts`
- Rewrite: `e2e/journeys/public/profile-viewer-features.spec.ts`
- Rewrite: `e2e/journeys/public/item-visibility.spec.ts`
- Rewrite: `e2e/journeys/public/forking.spec.ts`

### Task 27: Rewrite Profile Specs

**Files:**
- Rewrite: `e2e/journeys/profile/settings.spec.ts`
- Rewrite: `e2e/journeys/profile/upload.spec.ts`

### Task 28: Rewrite Google Drive Specs

**Files:**
- Rewrite: `e2e/journeys/google-drive/drive-connection.spec.ts`
- Rewrite: `e2e/journeys/google-drive/drive-sync.spec.ts`
- Rewrite: `e2e/journeys/google-drive/drive-media.spec.ts`
- Rewrite: `e2e/journeys/google-drive/cloud-to-web.spec.ts`
- Rewrite: `e2e/journeys/google-drive/web-to-cloud.spec.ts`

### Task 29: Rewrite Remaining Specs

**Files:**
- Rewrite: `e2e/journeys/docs/docs.spec.ts`
- Rewrite: `e2e/journeys/security/headers.spec.ts`

---

## Phase 5: Cleanup & Verification

### Task 30: Delete Old Files

**Files to delete:**
- `e2e/pages/items.page.ts` (replaced by 7 POMs)
- `e2e/pages/sign-in.page.ts` (merged into auth.page.ts)
- `e2e/pages/sign-up.page.ts` (merged into auth.page.ts)
- `e2e/pages/forgot-password.page.ts` (merged into auth.page.ts)
- `e2e/pages/reset-password.page.ts` (merged into auth.page.ts)
- `e2e/pages/my-items.page.ts` (merged into nav.page.ts)
- `e2e/pages/landing.page.ts` (minimal, merged into explore or nav)
- `e2e/pages/docs.page.ts` (minimal, can be a simple class in the spec or in nav)
- `e2e/pages/mobile-footer.page.ts` (merged into nav.page.ts)
- `e2e/pages/about-tab.page.ts` (merged into item-detail.page.ts)
- `e2e/fixtures/auth.fixture.ts` (replaced by authenticated.fixture.ts)
- `e2e/fixtures/test-user.fixture.ts` (replaced by authenticated.fixture.ts)
- `e2e/helpers/mobile-nav-helpers.ts` (functionality in nav.page.ts)
- `e2e/helpers/sidebar-helpers.ts` (functionality in nav.page.ts)
- `e2e/helpers/test-user.ts` (replaced by config/test-data.ts)

```bash
git rm e2e/pages/items.page.ts e2e/pages/sign-in.page.ts e2e/pages/sign-up.page.ts \
  e2e/pages/forgot-password.page.ts e2e/pages/reset-password.page.ts \
  e2e/pages/my-items.page.ts e2e/pages/landing.page.ts e2e/pages/docs.page.ts \
  e2e/pages/mobile-footer.page.ts e2e/pages/about-tab.page.ts \
  e2e/fixtures/auth.fixture.ts e2e/fixtures/test-user.fixture.ts \
  e2e/helpers/mobile-nav-helpers.ts e2e/helpers/sidebar-helpers.ts \
  e2e/helpers/test-user.ts
git commit -m "chore(e2e): remove old POMs, fixtures, and helpers"
```

### Task 31: Run Full E2E Suite and Fix Failures

**Step 1:** Run desktop tests
```bash
pnpm run test:e2e --project=chromium
```

**Step 2:** Run mobile tests
```bash
pnpm run test:e2e --project=mobile-chrome
```

**Step 3:** Fix any failing tests, iterating until all pass.

**Step 4:** Final commit
```bash
git add -A
git commit -m "fix(e2e): resolve all test failures after rewrite"
```

### Task 32: Update Documentation

**Files:**
- Modify: `CLAUDE.md` — update E2E testing section
- Modify: `docs/plans/2026-02-14-e2e-rewrite-design.md` — mark as implemented

Update CLAUDE.md E2E section to reference:
- New POM architecture (14 feature-based POMs)
- New fixture imports (`test`, `publicTest`, `driveTest` from `e2e/fixtures`)
- Centralized timeouts (`e2e/config/timeouts.ts`)
- Test data utilities (`e2e/config/test-data.ts`)
- Hard rules (no `.first()`, no magic numbers, etc.)

```bash
git add CLAUDE.md docs/plans/
git commit -m "docs: update E2E testing documentation for rewritten suite"
```
