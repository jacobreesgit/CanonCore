# Routing and Sidebar Active State Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix inconsistent sidebar active states and add auth page redirect guards for better UX.

**Architecture:** Update NavMain component to use consistent prefix matching for section awareness. Add (auth) layout to redirect authenticated users away from auth pages. Add aria-current accessibility attribute.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright

---

## Summary of Changes

| Change | Files Affected | Tests Affected |
|--------|----------------|----------------|
| Fix My Items active state | `nav-main.tsx` | Unit: update expectations, E2E: update expectations |
| Add aria-current accessibility | `nav-main.tsx`, `components/ui/sidebar.tsx` | Unit: add aria-current tests |
| Add auth layout redirect | Create `(auth)/layout.tsx` | E2E: new (no unit test - server component) |
| Clean up Explore active logic | `nav-main.tsx` | Unit: add /u/* coverage |

---

## Task 1: Update NavMain Active State Logic

**Files:**
- Modify: `components/nav-main.tsx:60-63`
- Modify: `components/ui/sidebar.tsx` (SidebarMenuButton)
- Modify: `tests/unit/components/nav-main.test.tsx`

### Step 1: Write failing tests for new active state behavior

Add tests that expect My Items to stay active on nested paths.

```typescript
// Add to tests/unit/components/nav-main.test.tsx after line 95

it("renders My Items button as active on nested path /my-items/abc123", () => {
  mockPathname.mockReturnValue("/my-items/abc123");
  render(<NavMain items={testItems} />);

  const button = screen.getByTestId("sidebar-menu-button");
  expect(button.getAttribute("data-active")).toBe("true");
});

it("renders My Items button as active on deeply nested path /my-items/abc/def/ghi", () => {
  mockPathname.mockReturnValue("/my-items/abc/def/ghi");
  render(<NavMain items={testItems} />);

  const button = screen.getByTestId("sidebar-menu-button");
  expect(button.getAttribute("data-active")).toBe("true");
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm test tests/unit/components/nav-main.test.tsx`

Expected: 2 FAIL - tests expect `true` but get `false`

### Step 3: Update active state logic in NavMain

```typescript
// components/nav-main.tsx - replace lines 58-63
{items.map((item) => {
  // Use prefix matching for section awareness:
  // - My Items stays active throughout /my-items/* for consistent navigation
  // - Explore stays active on /explore and /u/* because public profiles
  //   are discovered via the Explore page (no direct /explore/* routes exist)
  const isActive =
    item.url === "/explore"
      ? pathname === "/explore" || pathname.startsWith("/u/")
      : pathname === item.url || pathname.startsWith(`${item.url}/`);
  return (
```

### Step 4: Run tests to verify they pass

Run: `pnpm test tests/unit/components/nav-main.test.tsx`

Expected: All PASS

### Step 5: Update existing tests that expected old behavior

The tests at lines 90-104 currently expect inactive on nested paths. Update them:

```typescript
// tests/unit/components/nav-main.test.tsx - replace test at ~line 90
it("renders My Items button as active on nested path /my-items/abc123", () => {
  mockPathname.mockReturnValue("/my-items/abc123");
  render(<NavMain items={testItems} />);

  const button = screen.getByTestId("sidebar-menu-button");
  expect(button.getAttribute("data-active")).toBe("true");
});

// Replace test at ~line 98
it("renders My Items button as active on /my-items/connections", () => {
  mockPathname.mockReturnValue("/my-items/connections");
  render(<NavMain items={testItems} />);

  const button = screen.getByTestId("sidebar-menu-button");
  expect(button.getAttribute("data-active")).toBe("true");
});
```

### Step 6: Run all NavMain tests

Run: `pnpm test tests/unit/components/nav-main.test.tsx`

Expected: All PASS

### Step 7: Add tests for Explore active on /u/* paths

```typescript
// Add to tests/unit/components/nav-main.test.tsx
describe("Explore navigation", () => {
  const exploreItems = [{ title: "Explore", url: "/explore", icon: Folder }];

  it("renders Explore button as active on /explore", () => {
    mockPathname.mockReturnValue("/explore");
    render(<NavMain items={exploreItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders Explore button as active on /u/username", () => {
    mockPathname.mockReturnValue("/u/john_doe");
    render(<NavMain items={exploreItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders Explore button as active on /u/username/itemId", () => {
    mockPathname.mockReturnValue("/u/john_doe/abc123");
    render(<NavMain items={exploreItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders Explore button as active on deeply nested /u/username/item/child/grandchild", () => {
    mockPathname.mockReturnValue("/u/john_doe/abc123/def456/ghi789");
    render(<NavMain items={exploreItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders Explore button as inactive on /my-items", () => {
    mockPathname.mockReturnValue("/my-items");
    render(<NavMain items={exploreItems} />);

    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("false");
  });
});
```

### Step 8: Run all unit tests

Run: `pnpm test tests/unit/components/nav-main.test.tsx`

Expected: All PASS

### Step 9: Add aria-current accessibility attribute

Update the SidebarMenuButton mock in tests to support aria-current:

```typescript
// tests/unit/components/nav-main.test.tsx - update SidebarMenuButton mock
SidebarMenuButton: ({
  children,
  isActive,
  tooltip,
  className,
  onClick,
}: {
  children: React.ReactNode;
  isActive?: boolean;
  tooltip?: string;
  asChild?: boolean;
  className?: string;
  onClick?: () => void;
}) => (
  <button
    data-testid="sidebar-menu-button"
    data-active={isActive}
    data-tooltip={tooltip}
    className={className}
    onClick={onClick}
    aria-current={isActive ? "page" : undefined}
  >
    {children}
  </button>
),
```

Add aria-current test:

```typescript
// Add to tests/unit/components/nav-main.test.tsx
it("sets aria-current='page' when active for accessibility", () => {
  mockPathname.mockReturnValue("/my-items");
  render(<NavMain items={testItems} />);

  const button = screen.getByTestId("sidebar-menu-button");
  expect(button.getAttribute("aria-current")).toBe("page");
});

it("does not set aria-current when inactive", () => {
  mockPathname.mockReturnValue("/docs");
  render(<NavMain items={testItems} />);

  const button = screen.getByTestId("sidebar-menu-button");
  expect(button.getAttribute("aria-current")).toBeNull();
});
```

### Step 10: Update SidebarMenuButton to include aria-current

```typescript
// components/ui/sidebar.tsx - in SidebarMenuButton component
// Add aria-current attribute when isActive is true
aria-current={isActive ? "page" : undefined}
```

### Step 11: Run all NavMain tests

Run: `pnpm test tests/unit/components/nav-main.test.tsx`

Expected: All PASS

### Step 12: Commit

```bash
git add components/nav-main.tsx components/ui/sidebar.tsx tests/unit/components/nav-main.test.tsx
git commit -m "$(cat <<'EOF'
fix: consistent sidebar active states with prefix matching

My Items now stays highlighted throughout /my-items/* for better
section awareness. Explore highlights on /explore and /u/* paths
since public profiles are discovered via explore.

Adds aria-current="page" for screen reader accessibility (WCAG 2.1).
EOF
)"
```

---

## Task 2: Update E2E Tests for New Active State

**Files:**
- Modify: `e2e/journeys/navigation/nav-active-state.spec.ts:39-54`

### Step 1: Update E2E test expectation

The test "My Items nav is inactive on nested folder" needs to expect active now.

```typescript
// e2e/journeys/navigation/nav-active-state.spec.ts - replace test at ~line 39
test("My Items nav stays active on nested folder for section awareness", async ({
  page,
  itemsPage,
}) => {
  // Create item first (sidebar covers content on mobile)
  await itemsPage.createItem("Test Folder");
  await itemsPage.clickItem("Test Folder");

  // Now open sidebar to check nav state
  await openSidebarIfMobile(page);
  // My Items should be active throughout /my-items/* for section awareness
  const myItemsNav = page.locator('[data-slot="sidebar-menu-button"]', {
    hasText: "My Items",
  });
  await expect(myItemsNav).toHaveAttribute("data-active", "true");
});
```

### Step 2: Add E2E test for Explore active on public profiles

Uses established fixture patterns for consistency with existing tests.

```typescript
// Add to e2e/journeys/navigation/nav-active-state.spec.ts after guest user section

test.describe("public profile navigation", () => {
  test.beforeEach(async ({ signUpPage, page }) => {
    // Create a public user using established patterns
    const email = generateUniqueEmail("explore-nav");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("Explore nav is active when viewing public profile", async ({ page }) => {
    // Enable public profile for current user
    await page.goto("/my-items");
    // Open settings and enable public profile
    await page.getByRole("button", { name: /settings/i }).click();
    await page.getByLabel(/make profile public/i).check();
    await page.getByRole("button", { name: /save/i }).click();

    // Get the username from the profile
    const usernameInput = page.getByLabel(/username/i);
    const username = await usernameInput.inputValue();

    // Visit own public profile
    await page.goto(`/u/${username}`);
    await openSidebarIfMobile(page);

    const exploreNav = page.locator('[data-slot="sidebar-menu-button"]', {
      hasText: "Explore",
    });
    await expect(exploreNav).toHaveAttribute("data-active", "true");
  });

  test("Explore nav is active on nested public item page", async ({ page, itemsPage }) => {
    // Enable public profile
    await page.goto("/my-items");
    await page.getByRole("button", { name: /settings/i }).click();
    await page.getByLabel(/make profile public/i).check();
    await page.getByRole("button", { name: /save/i }).click();

    const usernameInput = page.getByLabel(/username/i);
    const username = await usernameInput.inputValue();

    // Create a public item
    await itemsPage.createItem("Public Test Item");
    // Make item public via context menu or settings

    // Visit the public item page
    await page.goto(`/u/${username}`);
    // Click on the public item to navigate to nested route
    await page.getByText("Public Test Item").click();

    await openSidebarIfMobile(page);
    const exploreNav = page.locator('[data-slot="sidebar-menu-button"]', {
      hasText: "Explore",
    });
    await expect(exploreNav).toHaveAttribute("data-active", "true");
  });
});
```

### Step 3: Add mobile viewport E2E test

```typescript
// Add to e2e/journeys/navigation/nav-active-state.spec.ts
test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test("My Items nav stays active on nested folder (mobile)", async ({
    page,
    signUpPage,
    itemsPage,
  }) => {
    const email = generateUniqueEmail("nav-mobile");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    await itemsPage.createItem("Mobile Test");
    await itemsPage.clickItem("Mobile Test");

    await openSidebarIfMobile(page);
    const myItemsNav = page.locator('[data-slot="sidebar-menu-button"]', {
      hasText: "My Items",
    });
    await expect(myItemsNav).toHaveAttribute("data-active", "true");
  });
});
```

### Step 4: Run E2E navigation tests

Run: `pnpm test:e2e e2e/journeys/navigation/nav-active-state.spec.ts`

Expected: All PASS

### Step 5: Commit

```bash
git add e2e/journeys/navigation/nav-active-state.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): update nav active state tests for prefix matching

Tests now expect My Items to stay active on nested paths and
Explore to be active on public profile pages. Adds mobile viewport
coverage for consistent behavior across devices.
EOF
)"
```

---

## Task 3: Add Auth Layout with Redirect Guard

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `e2e/journeys/auth/auth-redirect.spec.ts`

**Note:** No unit test for auth layout. Server components with `redirect()` throw during render, making unit tests unreliable. E2E tests provide better coverage for redirect behavior.

### Step 1: Create auth layout with redirect

```typescript
// Create app/(auth)/layout.tsx
/**
 * Auth pages layout.
 * Redirects authenticated users to My Items since they don't need auth pages.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout for authentication pages (sign-in, sign-up, forgot-password, reset-password).
 * Redirects already-authenticated users to their library.
 */
export default async function AuthLayout({ children }: AuthLayoutProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/my-items");
  }

  return children;
}
```

### Step 2: Write E2E test for auth redirect

Uses established patterns from existing auth tests.

```typescript
// Create e2e/journeys/auth/auth-redirect.spec.ts
/**
 * E2E tests for auth page redirect behavior.
 * Verifies authenticated users are redirected away from auth pages.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Auth Page Redirects", () => {
  test("redirects authenticated user from /sign-in to /my-items", async ({
    page,
    signUpPage,
  }) => {
    // Sign up and authenticate
    const email = generateUniqueEmail("auth-redirect");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Try to visit sign-in page
    await page.goto("/sign-in");

    // Should redirect back to my-items
    await expect(page).toHaveURL("/my-items", { timeout: 5000 });
  });

  test("redirects authenticated user from /sign-up to /my-items", async ({
    page,
    signUpPage,
  }) => {
    const email = generateUniqueEmail("auth-redirect-signup");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Try to visit sign-up page
    await page.goto("/sign-up");

    // Should redirect back to my-items
    await expect(page).toHaveURL("/my-items", { timeout: 5000 });
  });

  test("redirects authenticated user from /forgot-password to /my-items", async ({
    page,
    signUpPage,
  }) => {
    const email = generateUniqueEmail("auth-redirect-forgot");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Try to visit forgot-password page
    await page.goto("/forgot-password");

    // Should redirect back to my-items
    await expect(page).toHaveURL("/my-items", { timeout: 5000 });
  });

  test("allows unauthenticated user to access /sign-in", async ({ page }) => {
    await page.goto("/sign-in");

    // Should stay on sign-in page
    await expect(page).toHaveURL("/sign-in");
    await expect(page.getByTestId("sign-in-email-input")).toBeVisible();
  });

  test("allows unauthenticated user to access /sign-up", async ({ page }) => {
    await page.goto("/sign-up");

    // Should stay on sign-up page
    await expect(page).toHaveURL("/sign-up");
    await expect(page.getByTestId("sign-up-email-input")).toBeVisible();
  });
});
```

### Step 3: Run E2E auth tests

Run: `pnpm test:e2e e2e/journeys/auth/auth-redirect.spec.ts`

Expected: All PASS

### Step 4: Commit

```bash
git add app/(auth)/layout.tsx e2e/journeys/auth/auth-redirect.spec.ts
git commit -m "$(cat <<'EOF'
feat: add auth layout to redirect authenticated users

Authenticated users visiting /sign-in, /sign-up, /forgot-password,
or /reset-password are now redirected to /my-items since they
don't need these pages.
EOF
)"
```

---

## Task 4: Run Full Test Suite and Type Check

**Files:**
- None (verification only)

### Step 1: Run type check

Run: `pnpm type-check`

Expected: No errors

### Step 2: Run all unit tests

Run: `pnpm test`

Expected: All PASS

### Step 3: Run E2E tests for affected areas

Run: `pnpm test:e2e e2e/journeys/navigation/ e2e/journeys/auth/ e2e/journeys/public/`

Expected: All PASS

### Step 4: Run full check

Run: `pnpm check`

Expected: All checks pass

### Step 5: Commit any formatting fixes

```bash
git add -A
git commit -m "chore: formatting fixes from pnpm check" --allow-empty
```

---

## Tests Summary

### Unit Tests

| File | Change |
|------|--------|
| `tests/unit/components/nav-main.test.tsx` | Update 2 tests, add 7 new tests (Explore + aria-current + deep nesting) |

### E2E Tests

| File | Change |
|------|--------|
| `e2e/journeys/navigation/nav-active-state.spec.ts` | Update 1 test, add 3 new tests (public profile, nested, mobile) |
| `e2e/journeys/auth/auth-redirect.spec.ts` | New file with 5 tests |

### Tests Removed

| File | Test | Reason |
|------|------|--------|
| N/A | Auth layout unit test | Server components with redirect() throw during render; E2E provides better coverage |

---

## Accessibility Improvements

| Change | Benefit |
|--------|---------|
| `aria-current="page"` on active nav | Screen readers announce current page location (WCAG 2.1 Level A) |

---

## Rollback Plan

If issues arise:
1. Revert NavMain changes: `git revert <commit-hash>` for Task 1
2. Delete auth layout: `rm app/(auth)/layout.tsx` and revert tests
3. Run `pnpm test` to verify rollback

---

## Future Considerations (Out of Scope)

These items were identified but are **not** part of this plan:

1. **Nested public item routes** (`/u/[username]/[...itemPath]`) - Larger routing change, separate plan needed
2. **Custom 404 page** - Nice to have, not critical
3. **API auth pattern standardization** - Technical debt, separate effort
