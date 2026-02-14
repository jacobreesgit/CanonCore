# E2E Test Suite Rewrite Design

**Date:** 2026-02-14
**Status:** Approved
**Scope:** Complete rewrite of ~650 E2E tests with full parity

## Problem

The current E2E suite has accumulated significant technical debt:

- **Slow:** Single-worker CI (30-60 min), `heavy-serial.spec.ts` forced serial, 15+ `test.slow()` marks
- **Fragile:** `.first()` used throughout, debounce timing coupling, mixed CSS/testid selectors
- **Unmaintainable:** `items.page.ts` is 1,367 lines, 4-layer fixture hierarchy, scattered magic timeout numbers
- **Inconsistent:** Multiple user creation patterns, hidden mobile/desktop branching in POMs, no centralized mock library

## Approach: Convention-Over-Configuration

Strict naming conventions eliminate ambiguity. Every testable element gets a `data-testid` following a predictable pattern. POMs are thin, focused wrappers that compose these IDs.

## Test ID Convention

```
{feature}-{element}                    → static (e.g., "items-toolbar", "auth-submit")
{feature}-{element}-{identifier}       → dynamic (e.g., "item-card-star-wars", "sort-option-name-asc")
{feature}-{element}-{identifier}-{sub} → nested (e.g., "item-card-star-wars-menu")
```

**Rules:**

- kebab-case always
- Feature prefix groups related IDs: `items`, `auth`, `settings`, `explore`, `profile`, `nav`, `spotlight`, `media`
- Dynamic identifiers use slugified item/user names — never array indices
- If you need `.first()`, the test ID is wrong — add a more specific ID
- `getByRole()` used only for a11y assertions, never as primary selectors

**Example component additions:**

```tsx
// PosterCard
<div data-testid={`item-card-${slugify(item.name)}`}>

// Sort option
<button data-testid={`sort-option-${option.value}`}>

// Dialog
<div data-testid="dialog-create-item">
```

## Feature-Based POM Architecture

Replacing the monolith `items.page.ts` (1,367 lines) with focused POMs:

| POM File | Lines (est) | Responsibility |
|----------|-------------|----------------|
| `items-crud.page.ts` | ~150 | Create, rename, delete items |
| `items-sort-filter.page.ts` | ~120 | Sort options, content filters, view mode toggle |
| `items-settings.page.ts` | ~150 | Item settings dialog, TMDB display options |
| `items-pinned.page.ts` | ~100 | Pin/unpin, pinned sidebar grid |
| `items-drag.page.ts` | ~100 | Drag-and-drop in tree/grid, edit mode |
| `items-hierarchy.page.ts` | ~100 | Parent/child relationships, context menu add child |
| `item-detail.page.ts` | ~120 | Detail view, hero, tabs, about section |
| `explore.page.ts` | ~100 | Explore page, sort, exclude-mine |
| `public-profile.page.ts` | ~150 | Public profiles, forking, visibility |
| `auth.page.ts` | ~100 | Sign in, sign up, forgot/reset password (merged from 4 POMs) |
| `settings.page.ts` | ~150 | Profile settings, account, connections |
| `spotlight.page.ts` | ~80 | Spotlight search |
| `media.page.ts` | ~80 | Media player, hero stats |
| `nav.page.ts` | ~100 | Sidebar, header, mobile footer, skip link |

**POM rules:**

- Each POM takes `page: Page` and `isMobile: boolean` in constructor
- Explicit separate methods for mobile vs desktop when flows differ — no hidden `if (this.isMobile)` branching inside action methods
- All selectors use `data-testid` — defined as readonly properties at top of class
- No `.first()`, no `.nth()`, no CSS selectors
- Methods return `void` or assertion results — never raw locators
- JSDoc on every public method

## Fixture Architecture

**Flat 2-layer hierarchy:**

```
base Playwright test
  ├── authenticatedTest  → creates user, signs in, provides userId + page objects
  ├── driveTest          → extends authenticated, sets up Drive connection
  └── publicTest         → no auth, for explore/public profile/landing tests
```

- `authenticatedTest`: Creates user via DB (not UI), sets auth cookie directly, cleans up on teardown
- `driveTest`: Adds encrypted Drive tokens, cleans up Drive items
- `publicTest`: No user creation, just page objects for public routes
- Each fixture provides relevant POMs as properties (no importing separately)

## Centralized Timeout Config

```ts
export const Timeouts = {
  animation: 1_000,      // CSS transitions, sheet open/close
  navigation: 5_000,     // Route changes, page loads
  api: 10_000,           // Server action responses, TMDB lookups
  upload: 15_000,        // File uploads, Drive sync
  heavy: 30_000,         // Complex operations (bulk, serial)
} as const;
```

Every `timeout` in every POM and test references this object — no magic numbers.

## Test Data Generation

```ts
// Deterministic, collision-free
function testId(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}
```

## File Structure

```
e2e/
  config/
    timeouts.ts              # Centralized timeout config
    test-data.ts             # Test data generation utilities
  fixtures/
    authenticated.fixture.ts # Auth + cleanup
    drive.fixture.ts         # Drive connection
    public.fixture.ts        # Unauthenticated
    index.ts                 # Exports composed test objects
  pages/
    items-crud.page.ts
    items-sort-filter.page.ts
    items-settings.page.ts
    items-pinned.page.ts
    items-drag.page.ts
    items-hierarchy.page.ts
    item-detail.page.ts
    explore.page.ts
    public-profile.page.ts
    auth.page.ts
    settings.page.ts
    spotlight.page.ts
    media.page.ts
    nav.page.ts
  helpers/
    mobile.ts                # Mobile-specific utilities
    assertions.ts            # Reusable assertion helpers
  journeys/
    auth/                    # Sign in, sign up, forgot/reset password
    items/                   # CRUD, sort-filter, pinned, drag, hierarchy, settings
    public/                  # Explore, profiles, forking, visibility
    google-drive/            # Connection, sync, media
    navigation/              # Sidebar, header, skip link
    profile/                 # Settings, uploads
```

## Hard Rules (Enforced by Code Review)

| Rule | Rationale |
|------|-----------|
| Never `.first()` or `.nth()` | Means your test ID is wrong |
| Never `waitForTimeout()` | Use assertion-based waits only |
| Never `{ force: true }` | Fix the UI, not the test |
| Never hardcoded timeout numbers | Use `Timeouts.*` |
| Never `test.describe.configure({ mode: "serial" })` | Tests must be independent |
| Never test-to-test state dependency | Each test creates its own data |
| No `networkidle` waits | Use specific element visibility assertions |
| Mobile/desktop: explicit methods | No hidden `if (isMobile)` in action logic |

## Test Style Convention

```ts
test("should create an item with TMDB metadata", async ({ itemsCrud, itemsSettings }) => {
  const name = testId("movie");
  await itemsCrud.createItem(name);
  await itemsCrud.expectItemVisible(name);
  await itemsSettings.openSettings(name);
  await itemsSettings.searchTmdb("Inception");
  await itemsSettings.expectTmdbApplied();
});
```

## Current Anti-Patterns Being Eliminated

| Current Problem | New Solution |
|----------------|-------------|
| `items.page.ts` 1,367 lines | 14 focused POMs, ~100-150 lines each |
| `.first()` on multi-match selectors | Unique `data-testid` on every element |
| Magic timeout numbers (3000, 5000, 10000...) | `Timeouts.animation`, `Timeouts.navigation`, etc. |
| 4-layer fixture hierarchy | Flat 2-layer: base → authenticated/drive/public |
| `test.describe.configure({ mode: "serial" })` | Independent tests with own data |
| Hidden `if (isMobile)` branching in POMs | Explicit `createItemDesktop()` / `createItemMobile()` |
| Multiple user creation patterns | Single `authenticatedTest` fixture |
| `networkidle` waits | Specific element visibility assertions |
| `{ force: true }` clicks | Fix underlying UI layout issues |
| `test.slow()` scattered everywhere | Optimized tests + `Timeouts.heavy` for genuinely heavy ops |
