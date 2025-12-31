# E2E & Playwright Code Review

**Date:** 2025-12-31
**Reviewer:** Claude Code
**Scope:** All E2E tests, page objects, fixtures, and helpers

---

## Summary

| Category       | Count |
| -------------- | ----- |
| 🎉 Strengths   | 10    |
| 🔴 Blocking    | 3     |
| 🟡 Important   | 4     |
| 💡 Suggestions | 5     |

**Verdict:** ✅ Approve after addressing blocking issues

---

## 🎉 Strengths (Praise)

### 1. Excellent Page Object Model Pattern

All pages have dedicated page objects (`e2e/pages/*.page.ts`) that encapsulate selectors and common actions. This makes tests readable and maintainable.

```typescript
// Good: Encapsulated page interactions
await signUpPage.signUp(email, password, password);
await itemsPage.createItem("Folder A");
```

### 2. Good Test Isolation

Each test uses `generateUniqueEmail()` with descriptive prefixes, ensuring complete test isolation:

```typescript
const email = generateUniqueEmail("items-crud"); // test-1735123456-abc123@example.com
```

### 3. Semantic Selectors

Consistent use of `data-testid`, `getByRole`, and `getByText` throughout:

```typescript
this.emailInput = page.getByTestId("sign-in-email-input");
this.viewToggleTree = page.getByRole("button", { name: /tree view/i });
```

### 4. Proper Fixture Architecture

- Custom fixtures extend base Playwright fixtures
- Database fixture handles user seeding and cleanup
- Auth fixture provides reusable authentication flows

### 5. Helpful Test Helpers

Well-designed helper functions for common operations:

- `toggleTheme()` - Uses keyboard interaction to avoid click issues
- `openSidebarIfClosed()` - Handles mobile vs desktop gracefully
- `waitForToastToDisappear()` - Moves mouse to prevent hover-pause

### 6. Good CI Configuration

```typescript
retries: process.env.CI ? 2 : 1,
workers: process.env.CI ? 1 : undefined,
trace: "on-first-retry",
screenshot: "only-on-failure",
```

### 7. JSDoc Documentation

Key files have proper JSDoc with `@param`, `@returns`, and `@example` tags:

```typescript
/**
 * Drags an item to another item's position using Playwright's dragTo.
 * @param sourceName - Name of the item to drag
 * @param targetName - Name of the item to drop onto
 */
```

### 8. Explicit Timeouts

Proper use of explicit timeouts instead of defaults:

```typescript
await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
await this.successMessage.waitFor({ state: "visible", timeout: 10000 });
```

### 9. Mobile Testing Support

Tests run on both desktop Chrome and iPhone 14, with proper handling for mobile-specific behavior.

### 10. Long Test Timeout Override

Proper use of `test.setTimeout()` for known slow tests:

```typescript
test.setTimeout(120000); // 2 minutes for max-depth test
```

---

## 🔴 Blocking Issues (Must Fix)

### 1. Hard-coded `waitForTimeout` in Grid Drag Tests

**File:** `e2e/journeys/items/items-grid-drag.spec.ts`
**Lines:** 63, 110, 124

```typescript
// ❌ Anti-pattern: Hard-coded waits are fragile
await page.waitForTimeout(500);
```

**Why it's bad:**

- Fragile on slower systems
- Wastes time on faster systems
- Non-deterministic race conditions

**Fix:**

```typescript
// ✅ Use network idle or visibility checks
await page.waitForLoadState("networkidle");
// or
await itemsPage.expectItemVisible("Grid Item 1");
```

### 2. CSS Selector Anti-patterns in items.page.ts

**File:** `e2e/pages/items.page.ts`
**Lines:** 41-42

```typescript
// ❌ Fragile CSS selectors tied to Tailwind classes
this.treeView = page.locator("ul.space-y-0\\.5");
this.gridView = page.locator(".grid.grid-cols-2");
```

**Why it's bad:**

- Breaks if Tailwind classes change
- Implementation detail, not semantic

**Fix:**

```typescript
// ✅ Add data-testid to components
this.treeView = page.getByTestId("items-tree-view");
this.gridView = page.getByTestId("items-grid-view");
```

### 3. Duplicate Test User Logic

**Files:** `e2e/fixtures/db.fixture.ts` and `e2e/helpers/test-user.ts`

Both files have overlapping functionality:

```typescript
// db.fixture.ts
export function generateTestUser(): TestUser { ... }

// test-user.ts
export function generateTestUserData() { ... }
```

**Fix:** Consolidate into a single source of truth, use re-exports if needed.

---

## 🟡 Important Issues (Should Fix)

### 1. Missing JSDoc on Page Objects

**Files:** `sign-in.page.ts`, `sign-up.page.ts`, `dashboard.page.ts`

These files lack file-level JSDoc comments. Per CLAUDE.md standards, all files should have headers.

**Fix:**

```typescript
/**
 * Page object for sign-in page.
 * Provides methods for authentication and form interaction.
 */
```

### 2. Inconsistent Error Handling in tests

**File:** `e2e/journeys/docs/docs-navigation.spec.ts:50`

```typescript
const isBackLinkVisible = await backLink.isVisible().catch(() => false);
```

Using `.catch(() => false)` silently swallows errors. This can hide real issues.

**Suggestion:** Use Playwright's `isVisible()` which doesn't throw, or be explicit about expected behavior.

### 3. Unused `testUser` Fixture

**File:** `e2e/fixtures/index.ts:57-63`

The `testUser` fixture is defined but never used in any tests. All tests use `generateUniqueEmail()` directly.

**Fix:** Either use the fixture consistently or remove it.

### 4. `addItemCancel` Locator Uses Non-Semantic Selector

**File:** `e2e/pages/items.page.ts:37-39`

```typescript
// ❌ Uses SVG class name
this.addItemCancel = page.locator("button").filter({
  has: page.locator("svg.tabler-icon-x"),
});
```

**Fix:** Add `data-testid="add-item-cancel"` to the button.

---

## 💡 Suggestions (Nice to Have)

### 1. Consider `expect.poll()` for Flaky Assertions

For assertions that may need retries:

```typescript
// Current
await expect(itemsPage.gridView).toBeVisible();

// Alternative for flaky cases
await expect.poll(() => itemsPage.gridView.isVisible()).toBe(true);
```

### 2. Add Flaky Test Annotations

For known flaky tests, add annotations for visibility:

```typescript
test.info().annotations.push({
  type: "flaky",
  description: "Parallel execution timing",
});
```

This is already done in `items-max-depth.spec.ts:62-65` - consider adding where needed.

### 3. Consider `toPass()` for Retry Logic

For operations that may need multiple attempts:

```typescript
await expect(async () => {
  await itemsPage.dragItemTo("Folder A", "Folder C");
  await itemsPage.expectItemOrder(["Folder C", "Folder A"]);
}).toPass({ timeout: 5000 });
```

### 4. Add Visual Regression Tests

Consider adding screenshot comparison for key UI states:

```typescript
await expect(page).toHaveScreenshot("dashboard-empty-state.png");
```

### 5. Consider Parallel Test Sharding

For faster CI runs, consider sharding:

```typescript
// playwright.config.ts
{
  shard: process.env.CI ? { total: 4, current: 1 } : undefined,
}
```

---

## Files Reviewed

### Configuration

- `e2e/playwright.config.ts` ✅

### Fixtures

- `e2e/fixtures/index.ts` ✅
- `e2e/fixtures/db.fixture.ts` ✅
- `e2e/fixtures/auth.fixture.ts` ✅

### Page Objects

- `e2e/pages/sign-in.page.ts` ✅
- `e2e/pages/sign-up.page.ts` ✅
- `e2e/pages/dashboard.page.ts` ✅
- `e2e/pages/items.page.ts` ✅
- `e2e/pages/docs.page.ts` ✅
- `e2e/pages/landing.page.ts` (not reviewed)
- `e2e/pages/forgot-password.page.ts` (not reviewed)
- `e2e/pages/reset-password.page.ts` (not reviewed)

### Helpers

- `e2e/helpers/test-user.ts` ✅
- `e2e/helpers/theme-helpers.ts` ✅
- `e2e/helpers/sidebar-helpers.ts` ✅

### Test Specs

- `e2e/journeys/auth/sign-in.spec.ts` ✅
- `e2e/journeys/auth/sign-up.spec.ts` ✅
- `e2e/journeys/auth/sign-out.spec.ts` ✅
- `e2e/journeys/auth/forgot-password.spec.ts` ✅
- `e2e/journeys/items/items-crud.spec.ts` ✅
- `e2e/journeys/items/items-navigation.spec.ts` ✅
- `e2e/journeys/items/items-view-toggle.spec.ts` ✅
- `e2e/journeys/items/items-tree-drag.spec.ts` ✅
- `e2e/journeys/items/items-grid-drag.spec.ts` ✅
- `e2e/journeys/items/items-max-depth.spec.ts` ✅
- `e2e/journeys/docs/docs-navigation.spec.ts` ✅
- `e2e/journeys/theme/dark-mode.spec.ts` ✅

---

## Action Items

| Priority  | Item                                         | Status   |
| --------- | -------------------------------------------- | -------- |
| 🔴 High   | Fix `waitForTimeout(500)` in grid-drag tests | ✅ Fixed |
| 🔴 High   | Add data-testid to tree/grid view containers | ✅ Fixed |
| 🟡 Medium | Add JSDoc headers to page objects            | ✅ Fixed |
| 🟡 Medium | Consolidate test user generation functions   | ✅ Fixed |
| 🟡 Medium | Fix addItemCancel selector                   | ✅ Fixed |
| 💡 Low    | Remove unused testUser fixture               | ✅ Fixed |

---

## Applied Fixes

### 1. Replaced `waitForTimeout(500)` in grid-drag tests

**File:** `e2e/journeys/items/items-grid-drag.spec.ts`

```typescript
// Before
await page.waitForTimeout(500);

// After
await page.waitForLoadState("networkidle");
```

### 2. Added data-testid to view containers

**Files:** `components/sortable-tree/SortableTree.tsx`, `components/sortable-grid/SortableGrid.tsx`

```typescript
// Tree view
<ul data-testid="items-tree-view" className="space-y-0.5">

// Grid view
<div data-testid="items-grid-view" className="grid grid-cols-2 ...">
```

### 3. Fixed addItemCancel selector

**File:** `components/items/add-item-button.tsx`

```typescript
<Button data-testid="add-item-cancel" ...>
```

**File:** `e2e/pages/items.page.ts`

```typescript
// Before
this.addItemCancel = page
  .locator("button")
  .filter({ has: page.locator("svg.tabler-icon-x") });

// After
this.addItemCancel = page.getByTestId("add-item-cancel");
```

### 4. Added JSDoc headers to page objects

**Files:** `e2e/pages/sign-in.page.ts`, `e2e/pages/sign-up.page.ts`, `e2e/pages/dashboard.page.ts`, `e2e/fixtures/index.ts`

```typescript
/**
 * Page object for sign-in page.
 * Provides methods for authentication and error handling.
 */
```

### 5. Consolidated test user generation functions

**File:** `e2e/fixtures/db.fixture.ts`

```typescript
// Before: Duplicate logic
export function generateTestUser(): TestUser {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return { email: `test-${timestamp}-${random}@example.com`, password: "..." };
}

// After: Delegates to shared helper
import { generateTestUserData } from "../helpers/test-user";

export function generateTestUser(): TestUser {
  return generateTestUserData();
}
```

### 6. Removed unused testUser fixture

**File:** `e2e/fixtures/index.ts`

Removed the unused `testUser` fixture that was never referenced in any tests. Tests use `generateUniqueEmail()` directly instead.
