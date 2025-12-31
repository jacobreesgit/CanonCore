# Code Quality Patterns Design

**Date:** 2025-12-31
**Status:** Analysis Complete

## Overview

This document analyzes code patterns in the CanonCore codebase, focusing on:

1. `router.refresh()` usage in client components
2. Server action mutation patterns
3. Playwright E2E test anti-patterns

## Executive Summary

The codebase demonstrates generally sound patterns with a few areas for improvement:

| Area                 | Status           | Action               |
| -------------------- | ---------------- | -------------------- |
| Auth page refresh    | **Correct**      | No changes needed    |
| Items view refresh   | **Acceptable**   | Optional improvement |
| E2E hard-coded waits | **Anti-pattern** | Should fix           |
| Page Object Model    | **Excellent**    | No changes needed    |

---

## 1. router.refresh() Analysis

### Current Usage

Found in 3 locations:

| File                              | Line | Context                          |
| --------------------------------- | ---- | -------------------------------- |
| `app/(auth)/sign-in/page.tsx`     | 44   | After successful login           |
| `app/(auth)/sign-up/page.tsx`     | 65   | After successful signup          |
| `components/items/items-view.tsx` | 50   | Inside `refetchItems()` callback |

### Auth Pages: sign-in and sign-up

**Pattern:**

```typescript
router.push("/dashboard");
router.refresh();
```

**Verdict: CORRECT**

This is the recommended Next.js App Router pattern when session state changes. The `router.refresh()` ensures server components re-render with the new authenticated session. Removing this would cause stale session data.

### Items View: refetchItems()

**Pattern:**

```typescript
const refetchItems = useCallback(() => {
  router.refresh();
}, [router]);

// Called after mutations:
startTransition(() => refetchItems());
```

**Verdict: ACCEPTABLE (with optional improvement)**

The current pattern:

- Works correctly
- Uses `startTransition` for non-blocking updates
- Refetches entire page which ensures consistency

**Optional Improvement:** Add `revalidatePath()` to server actions instead:

```typescript
// In lib/item-actions.ts
export async function createItem(parentId: string | null, name: string) {
  // ... create logic ...
  revalidatePath("/dashboard", "layout");
  return { success: true, data: item };
}
```

This moves cache invalidation to the server side, which is the recommended Next.js pattern. However, the current client-side approach is functional and not an anti-pattern.

---

## 2. Playwright E2E Anti-Patterns

### Anti-Pattern: Hard-Coded Waits

**Found in:**

| File                                         | Line | Code                              |
| -------------------------------------------- | ---- | --------------------------------- |
| `e2e/journeys/items/items-tree-drag.spec.ts` | 45   | `await page.waitForTimeout(500);` |
| `e2e/journeys/items/items-tree-drag.spec.ts` | 94   | `await page.waitForTimeout(500);` |
| `e2e/journeys/items/items-tree-drag.spec.ts` | 108  | `await page.waitForTimeout(500);` |
| `e2e/journeys/auth/sign-in.spec.ts`          | 50   | `await page.waitForTimeout(500);` |

**Why this is an anti-pattern:**

- Fragile: May fail on slower systems
- Slow: Adds unnecessary wait time on faster systems
- Non-deterministic: Race conditions can still occur

**Recommended Fix:**

Replace with explicit wait conditions:

```typescript
// Instead of:
await page.waitForTimeout(500);

// Use:
await page.waitForLoadState("networkidle");
// or
await expect(locator).toBeVisible();
// or
await page.waitForResponse((response) => response.url().includes("/api/"));
```

**Specific fixes:**

For tree-drag tests (waiting for reorder to persist):

```typescript
// Replace:
await page.waitForTimeout(500);

// With:
await page.waitForLoadState("networkidle");
await itemsPage.expectItemVisible("Folder A");
```

For sign-in test (waiting for session to clear):

```typescript
// Replace:
await page.waitForTimeout(500);

// With:
await expect(signInPage.emailInput).toBeVisible();
```

### Good Patterns Found

The codebase demonstrates excellent E2E patterns:

1. **Page Object Model** - All pages have dedicated page objects
2. **Fixtures** - Proper test fixtures for setup/teardown
3. **Semantic Selectors** - Good use of `getByRole`, `getByText`, `data-testid`
4. **Explicit Timeouts** - `toBeVisible({ timeout: 10000 })` is correct
5. **Network Waits** - `waitForLoadState("networkidle")` used in page objects

---

## 3. Server Action Mutation Patterns

### Current Pattern

```typescript
// items-view.tsx
const handleCreateItem = useCallback(
  async (name: string) => {
    const result = await createItem(parentId, name);
    if (result.success && result.data) {
      setItems((prev) => [...prev, newItem]); // Optimistic local update
      startTransition(() => refetchItems()); // Server sync
      toast.success(`Created "${name}"`);
    }
  },
  [parentId, refetchItems]
);
```

**Verdict: GOOD**

This pattern:

- Updates local state immediately (optimistic)
- Syncs with server via `refetchItems()`
- Uses `startTransition` for non-blocking refresh
- Shows user feedback via toast

### Optional Enhancement: React 19 useOptimistic

For even better UX, consider React 19's `useOptimistic`:

```typescript
const [optimisticItems, addOptimisticItem] = useOptimistic(
  items,
  (state, newItem: Item) => [...state, newItem]
);

const handleCreateItem = async (name: string) => {
  const tempItem = { id: `temp-${Date.now()}`, name, ... };
  addOptimisticItem(tempItem);  // Instant UI update

  const result = await createItem(parentId, name);
  if (!result.success) {
    // Rollback happens automatically when items updates
    toast.error(result.error);
  }
};
```

This is optional - the current pattern is acceptable.

---

## 4. Recommendations Summary

### Must Fix

| Item                                             | Priority | Effort |
| ------------------------------------------------ | -------- | ------ |
| Replace `waitForTimeout(500)` in tree-drag tests | High     | Low    |
| Replace `waitForTimeout(500)` in sign-in test    | High     | Low    |

### Optional Improvements

| Item                                     | Priority | Effort |
| ---------------------------------------- | -------- | ------ |
| Add `revalidatePath()` to server actions | Low      | Medium |
| Migrate to `useOptimistic` for mutations | Low      | Medium |

### No Action Needed

| Item                         | Reason                              |
| ---------------------------- | ----------------------------------- |
| Auth page `router.refresh()` | Correct pattern for session changes |
| Page Object Model structure  | Already excellent                   |
| Fixture setup                | Already excellent                   |

---

## 5. Implementation Plan

If proceeding with fixes:

### Phase 1: E2E Test Fixes (Recommended)

1. Update `items-tree-drag.spec.ts`:
   - Replace all `waitForTimeout(500)` with `waitForLoadState("networkidle")`

2. Update `sign-in.spec.ts`:
   - Replace `waitForTimeout(500)` with explicit visibility check

### Phase 2: Server Action Enhancement (Optional)

1. Add `revalidatePath("/dashboard", "layout")` to:
   - `createItem()`
   - `updateItem()`
   - `deleteItem()`
   - `reorderItems()`

2. Simplify `refetchItems()` in items-view.tsx if server-side revalidation is added

---

## Appendix: Files Analyzed

### Client Components

- `app/(auth)/sign-in/page.tsx`
- `app/(auth)/sign-up/page.tsx`
- `components/items/items-view.tsx`

### E2E Tests

- `e2e/journeys/items/items-crud.spec.ts`
- `e2e/journeys/items/items-tree-drag.spec.ts`
- `e2e/journeys/auth/sign-in.spec.ts`
- `e2e/fixtures/index.ts`
- `e2e/pages/items.page.ts`

### Server Actions

- `lib/item-actions.ts`
