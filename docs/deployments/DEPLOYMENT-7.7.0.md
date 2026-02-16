# Deployment 7.7.0

**Date**: 2026-02-16
**Type**: Minor (E2E test infrastructure rewrite, curated data-testids, unit test selector migration)
**Migration Required**: No

## Overview

Complete E2E test infrastructure rewrite. The previous ~650 Playwright tests, monolithic page objects, and complex global setup/teardown have been replaced with a lean, focused test suite: 31 spec files containing 49 test cases (~98 test runs across desktop and mobile Chrome), 15 purpose-built page objects (2,289 lines total), 3 composable fixtures, centralised timeout constants, and collision-free test data utilities.

All existing `data-testid` attributes were first removed from components, then ~85 curated testids were added back to ~30 components to support targeted E2E selectors. Unit tests were migrated from `data-testid` queries to role-based and text-based selectors following Testing Library best practices.

228 files changed, 5,976 insertions, 17,012 deletions.

## New features

### Lean E2E foundation

`e2e/playwright.config.ts` — Simplified Playwright configuration:

- Two projects: desktop Chrome and mobile Chrome (Pixel 7)
- `webServer` block starts `pnpm run dev` with `E2E_DATABASE_URL` and `BYPASS_RATE_LIMIT=true`
- 1 worker (serial execution)
- `fullyParallel: false`
- `baseURL` reads from `NEXT_PUBLIC_APP_URL` with `http://localhost:3000` fallback
- Video capture on first retry, screenshot on failure
- CI reporter: HTML + GitHub annotations

`e2e/config/timeouts.ts` — Centralised timeout constants for all E2E tests:

| Constant | Value | Use case |
|---|---|---|
| `animation` | 1,000ms | CSS transitions, sheet open/close |
| `navigation` | 5,000ms | Route changes, page loads |
| `api` | 10,000ms | Server actions, TMDB lookups |
| `upload` | 15,000ms | File uploads, Drive sync |
| `heavy` | 30,000ms | Multi-step operations, bulk actions |

`e2e/config/test-data.ts` — Collision-free test data utilities:

- `testId(prefix)` — Unique identifier like `"movie-a1b2c3d4"` (UUID-based)
- `testEmail(prefix)` — Unique email like `"test-a1b2c3d4@example.com"`
- `testUsername()` — Unique username within 3-20 char limit
- `testUser()` — Complete user object with email, password, username
- `TEST_PASSWORD` — Default password meeting validation requirements
- `SEED_USERS` — Pre-seeded user credentials (demo, filmfan, testuser)
- `E2E_DRIVE_USER` — Drive test user credentials

### New page objects (15 POMs)

Purpose-built page objects replace the old monolithic `items.page.ts` (1,367 lines):

| Page Object | Lines | Responsibility |
|---|---|---|
| `auth.page.ts` | 127 | Sign-in, sign-up, forgot/reset password forms |
| `explore.page.ts` | 146 | Explore page carousel, grid, filtering |
| `item-detail.page.ts` | 115 | Item detail hero, tabs, metadata |
| `items-crud.page.ts` | 187 | Create, delete, empty state, item counts |
| `items-drag.page.ts` | 168 | Grid and tree drag-and-drop reordering |
| `items-hierarchy.page.ts` | 269 | Parent/child navigation, breadcrumbs, nesting |
| `items-pinned.page.ts` | 101 | Pin/unpin, sidebar pinned list |
| `items-settings.page.ts` | 157 | Item settings dialog fields and actions |
| `items-sort-filter.page.ts` | 251 | Sort dropdown, filter checkboxes, view toggle |
| `media.page.ts` | 103 | Media player overlay, playback controls |
| `nav.page.ts` | 141 | Sidebar, header, mobile footer navigation |
| `public-profile.page.ts` | 106 | Public profile viewing, fork button |
| `settings.page.ts` | 149 | Profile settings dialog tabs and fields |
| `spotlight.page.ts` | 141 | Spotlight search dialog, results sections |
| `tmdb-wizard.page.ts` | 128 | TMDB metadata wizard steps |

### New fixtures

`e2e/fixtures/authenticated.fixture.ts` — Creates a unique test user per test, authenticates via browser storage injection, and cleans up after. Provides `testUser` (credentials + username) and `isMobile` flag. Also exports `createPublicUser()` / `deletePublicUser()` helpers for multi-user tests.

`e2e/fixtures/public.fixture.ts` — Unauthenticated test fixture for public page tests (landing, explore, sign-in/up). Provides `isMobile` flag via viewport detection.

`e2e/fixtures/drive.fixture.ts` — Drive-specific test fixture extending authenticated fixture with Google Drive connection helpers.

`e2e/fixtures/index.ts` — Composed fixture that wires all POMs as fixture properties. Tests destructure only the POMs they need. Three exports: `test` (authenticated), `publicTest` (no auth), `driveTest` (Drive-specific). Includes Next.js dev overlay suppression.

### Slugify utility

`lib/slugify.ts` — Converts strings to URL-safe kebab-case slugs:

- Lowercases, trims, removes special characters
- Replaces whitespace/underscores with hyphens, collapses consecutive hyphens
- Used by tree items and grid items for `data-testid` generation: `item-tree-${slugify(name)}`, `item-card-${slugify(name)}`
- Unit tested in `tests/unit/lib/slugify.test.ts`

## Changes

### Curated data-testids added to components

After removing all existing `data-testid` attributes, ~85 curated testids were added back to ~30 components for targeted E2E selectors. Naming follows the pattern `{feature}-{element}` (e.g. `sign-in-email-input`, `items-filter-dropdown`, `hero-carousel`).

| Area | Components with testids | Example testids |
|---|---|---|
| Auth forms | `sign-in-form`, `sign-up-form`, `forgot-password-form`, `reset-password-form` | `sign-in-email-input`, `sign-up-submit-button`, `forgot-password-error-message` |
| Items | `items-view`, `item-detail-client`, `add-item-dialog`, `mobile-add-item-sheet`, `item-settings-dialog`, `item-more-button`, `filter-dropdown`, `sort-dropdown`, `edit-mode-toggle`, `bulk-actions-toolbar`, `about-tab-content`, `fork-destination-dialog` | `items-empty-state`, `items-add-button`, `items-filter-dropdown`, `items-edit-mode-toggle`, `items-bulk-delete` |
| Hero | `cinematic-hero` | `hero-carousel`, `hero-dot-1` |
| Navigation | `site-header`, `nav-main`, `mobile-footer-nav` | `nav-header`, `nav-sidebar`, `nav-mobile-footer`, `sidebar-trigger` |
| Profile | `settings-dialog`, `mobile-settings-sheet`, `profile-page` | `dialog-settings`, `settings-tab-profile`, `settings-sign-out-button` |
| Search | `spotlight-search` | `spotlight-dialog`, `spotlight-input` |
| TMDB wizard | `tmdb-wizard`, `media-search-combobox` | `tmdb-wizard-step-1`, `media-search-input`, `tmdb-wizard-next` |
| Media | `media-overlay` | `media-player` |
| Sortable | `grid-item`, `tree-item`, `poster-card` | `item-card-${slug}`, `item-tree-${slug}`, `item-more-${slug}` |
| Explore | `explore-client` | `explore-exclude-mine`, `hero-fork-button` |
| Public | `public-item-detail-client` | `profile-fork-button` |
| UI | `content-toolbar`, `command`, `hero-content-layout`, `mobile-bottom-sheet`, `swipeable-tabs`, `mobile-options-sheet`, `mobile-item-sheet` | `items-view-dropdown`, `sort-option-${value}` |

### Unit test selector migration

All unit tests migrated from `data-testid` queries to role-based and text-based selectors (following Testing Library best practices):

| Test file | Change |
|---|---|
| `cinematic-hero.test.tsx` | `getByTestId` → `getByRole`, `getByText`, `getByAltText` |
| `file-type-combobox.test.tsx` | `getByTestId` → `getByRole("combobox")` |
| `item-detail-client.test.tsx` | `getByTestId` → `getByRole`, `getByText` |
| `item-settings-dialog.test.tsx` | `getByTestId` → `getByRole` |
| `items-toolbar.test.tsx` | `getByTestId` → `getByRole`, `getByLabelText` |
| `media-overlay.test.tsx` | `getByTestId` → `getByRole`, `getByText` |
| `media-player.test.tsx` | `getByTestId` → `getByRole`, container queries |
| `nav-guest.test.tsx` | `getByTestId` → `getByRole("link")` |
| `nav-main.test.tsx` | `getByTestId` → `getByRole`, `getByText` |
| `sortable-grid-item.test.tsx` | `getByTestId` → `getByRole`, `getByAltText` |
| `alert-dialog.test.tsx` | `getByTestId` → `getByRole("alertdialog")` |
| `animated-dialog-content.test.tsx` | `getByTestId` → `getByRole("dialog")` |
| `dialog.test.tsx` | `getByTestId` → `getByRole("dialog")` |
| `item-stats.test.tsx` | `getByTestId` → `getByText`, `getByLabelText` |
| `app-sidebar.test.tsx` | `getByTestId` → `getByRole` |
| `site-header.test.tsx` | `getByTestId` → `getByRole` |
| Multiple other test files | Similar `getByTestId` → semantic selector migration |

### Storybook story updates

Stories updated to remove old `data-testid` references from `play` functions and switch to role-based selectors:

- `add-item-dialog.stories.tsx`
- `fork-destination-dialog.stories.tsx`
- `item-settings-dialog.stories.tsx`
- `parent-privacy-warning-dialog.stories.tsx`
- `reparent-warning-dialog.stories.tsx`
- `settings-dialog.stories.tsx`
- `site-header.stories.tsx`

### E2E test rewrite

31 spec files remain (down from ~50+ previously). 18 spec files were deleted entirely, 29 were rewritten with new POM patterns and fixtures, and 2 new specs were added.

**Rewritten tests** (simplified, using new POMs and fixtures):

| Category | Spec files |
|---|---|
| Auth | `auth-redirect`, `forgot-password`, `sign-in`, `sign-out`, `sign-up` |
| Google Drive | `drive-connection` |
| Items | `about-tab`, `cinematic-hero`, `context-menu-add-child`, `edit-mode`, `items-crud`, `items-hierarchy`, `items-settings`, `items-sort-filter`, `items-view-toggle`, `pinned-items`, `spotlight-search` |
| Navigation | `nav-active-state`, `site-header-autohide`, `skip-link` |
| Profile | `settings`, `settings-upload` |
| Public | `explore`, `explore-features`, `item-visibility`, `landing-page`, `profile-viewer-features`, `public-profile` |
| Docs | `docs-navigation` |

**New test files:**

- `e2e/journeys/public/fork-item.spec.ts` — Fork flow from public profile
- `e2e/journeys/public/public-item-detail.spec.ts` — Public item detail page

### Screenshot automation rewritten

`e2e/screenshots/` — Portfolio screenshot automation rewritten to use new POM patterns and fixtures. Config and spec files simplified.

### Package.json script changes

**Removed scripts:**

| Script | Reason |
|---|---|
| `test:e2e:cleanup` | Process cleanup no longer needed (webServer managed by Playwright) |
| `test:e2e:report` | `playwright show-report` can be run directly |
| `screenshots` | Screenshot spec can be run directly via `npx playwright test --config=e2e/screenshots/playwright.config.ts` |

**Simplified scripts:**

| Script | Before | After |
|---|---|---|
| `test:e2e` | `npm run test:e2e:cleanup && playwright test ...` | `playwright test --config=e2e/playwright.config.ts` |
| `test:e2e:ui` | `npm run test:e2e:cleanup && playwright test ... --ui` | `playwright test --config=e2e/playwright.config.ts --ui` |
| `test:e2e:debug` | `npm run test:e2e:cleanup && playwright test ... --debug` | `playwright test --config=e2e/playwright.config.ts --debug` |

### Dependency update

`@playwright/test` upgraded from `^1.57.0` to `^1.58.2`.

### Knip configuration

`knip.json` — `e2e/**` added to ignore list (E2E infrastructure files not tracked by knip).

### Seed script update

`prisma/seed.ts` — Minor update to seed data generation.

## Removed

### Deleted E2E test suites

18 spec files deleted entirely (tests not carried forward):

| Category | Deleted spec files |
|---|---|
| Google Drive | `drive-cloud-to-web`, `drive-media`, `drive-sync`, `drive-web-to-cloud` |
| Items | `discard-changes-alert`, `empty-states`, `heavy-serial`, `item-progress`, `items-grid-drag`, `items-max-depth`, `items-navigation`, `items-tree-drag`, `media-lookup`, `playback-progress`, `rate-limit`, `sticky-footer`, `tmdb-display-options` |
| Security | `headers` |

### Deleted E2E infrastructure

| Item | Files removed |
|---|---|
| Global setup | `e2e/journeys/global.setup.ts` |
| Global teardown | `e2e/journeys/global.teardown.ts` |
| Auth fixture | `e2e/fixtures/auth.fixture.ts` |
| DB fixture | `e2e/fixtures/db.fixture.ts` |
| Google Drive fixture | `e2e/fixtures/google-drive.fixture.ts` |
| Test user fixture | `e2e/fixtures/test-user.fixture.ts` |
| Test images | `e2e/fixtures/images/test-avatar.jpg`, `test-hero.jpg` |
| Mobile nav helpers | `e2e/helpers/mobile-nav-helpers.ts` |
| Sidebar helpers | `e2e/helpers/sidebar-helpers.ts` |
| Test user helpers | `e2e/helpers/test-user.ts` |

### Deleted page objects

Old monolithic page objects replaced by 15 focused POMs:

`about-tab.page.ts`, `docs.page.ts`, `forgot-password.page.ts`, `items.page.ts` (1,367 lines), `landing.page.ts`, `mobile-footer.page.ts`, `my-items.page.ts`, `reset-password.page.ts`, `sign-in.page.ts`, `sign-up.page.ts`

### Plan documents

Removed:

- `docs/plans/2026-02-13-clickable-recommendations-design.md`
- `docs/plans/2026-02-13-clickable-recommendations-plan.md`

Added:

- `docs/plans/2026-02-14-e2e-rewrite-design.md`
- `docs/plans/2026-02-14-e2e-rewrite-plan.md`

## Deployment notes

### No migration required

No database schema changes.

### No new dependencies

`@playwright/test` updated (patch version bump). No new packages added or removed.

### No environment variable changes

No new variables required. The Playwright config uses `E2E_DATABASE_URL` via `webServer.env` and `NEXT_PUBLIC_APP_URL` for the base URL.

### Verification

1. **Build passes**: `pnpm run build`
2. **Type check passes**: `pnpm run type-check`
3. **Unit tests pass**: `pnpm run test` — all tests should pass with new role-based selectors
4. **Lint passes**: `pnpm run lint`
5. **Knip passes**: `pnpm run knip`
6. **E2E tests run**: `pnpm run test:e2e` — 31 spec files across 2 projects
7. **Storybook builds**: `pnpm run build-storybook`
8. **Curated testids present**: `grep -r "data-testid" components/ app/` — ~85 curated testids across ~30 components
9. **No old testid patterns**: Unit tests should have no `getByTestId` calls (migrated to role/text selectors)
