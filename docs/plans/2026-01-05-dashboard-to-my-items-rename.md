# Dashboard to My Items Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all user-facing "Dashboard" and "My Files" text with "My Items" throughout the application.

**Architecture:** Text-only changes to user-facing labels, E2E test locators, and documentation content. URL routes (`/dashboard`) remain unchanged to avoid breaking bookmarks/external links. Internal code identifiers (test IDs, file names) remain unchanged for stability.

**Tech Stack:** Next.js, React, Playwright, MDX

---

## Scope

### In Scope (User-Facing Text)
- Navigation labels: "Back to Dashboard" → "Back to My Items"
- Navigation labels: "My Files" → "My Items"
- CTA buttons: "Go to Dashboard" → "Go to My Items"
- Landing page copy: "dashboard" → "platform"
- Metadata description
- Site header default title
- Sidebar nav item title
- Documentation content (MDX files)
- Unit tests with "My Files" assertions
- E2E test text matchers
- Seed data labels

### Out of Scope (Internal/Technical)
- URL routes (`/dashboard/*`) - breaking change, keep as-is
- Test IDs (`dashboard-user-menu`) - internal, keep as-is
- File names (`dashboard.page.ts`) - internal, keep as-is
- Code comments and JSDoc - internal, keep as-is

---

## Task 1: Update Nav Docs Component

**Files:**
- Modify: `components/nav-docs.tsx:56`
- Test: `tests/unit/components/nav-docs.test.tsx` (if exists)

**Step 1: Update the back label text**

In `components/nav-docs.tsx`, change line 56:

```typescript
// Before
const backLabel = isAuthenticated ? "Back to Dashboard" : "Back to Home";

// After
const backLabel = isAuthenticated ? "Back to My Items" : "Back to Home";
```

**Step 2: Run type check**

```bash
pnpm run type-check
```

Expected: PASS

**Step 3: Commit**

```bash
git add components/nav-docs.tsx
git commit -m "feat: rename 'Back to Dashboard' to 'Back to My Items'"
```

---

## Task 2: Update Landing Page CTA

**Files:**
- Modify: `app/(public)/page.tsx:45,53`

**Step 1: Update CTA button text (line 53)**

```typescript
// Before
{isAuthenticated ? "Go to Dashboard" : "Get Started"}

// After
{isAuthenticated ? "Go to My Items" : "Get Started"}
```

**Step 2: Update landing page description (line 45)**

```typescript
// Before
Your all-in-one dashboard for managing and streaming your media

// After
Your all-in-one platform for managing and streaming your media
```

**Step 3: Run type check**

```bash
pnpm run type-check
```

Expected: PASS

**Step 4: Commit**

```bash
git add app/(public)/page.tsx
git commit -m "feat: update landing page to use 'My Items' instead of 'Dashboard'"
```

---

## Task 3: Update Root Layout Metadata

**Files:**
- Modify: `app/layout.tsx:25`

**Step 1: Update metadata description**

```typescript
// Before
export const metadata: Metadata = {
  title: "CanonCore",
  description: "CanonCore Dashboard",
};

// After
export const metadata: Metadata = {
  title: "CanonCore",
  description: "CanonCore - Media Library Manager",
};
```

**Step 2: Run type check**

```bash
pnpm run type-check
```

Expected: PASS

**Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: update metadata description"
```

---

## Task 4: Update Documentation Content

**Files:**
- Modify: `content/docs/getting-started/quick-tour.mdx`
- Modify: `content/docs/getting-started/create-account.mdx`
- Modify: `content/docs/getting-started/sign-in.mdx`

**Step 1: Update quick-tour.mdx heading (line 8)**

```mdx
// Before
## The Dashboard

// After
## My Items
```

**Step 2: Update quick-tour.mdx body (line 10)**

```mdx
// Before
When you sign in, you land on your dashboard. This is where all your folders live.

// After
When you sign in, you land on My Items. This is where all your folders live.
```

**Step 3: Update create-account.mdx (line 22)**

```mdx
// Before
After you create your account, you'll be taken straight to your dashboard. This is your home base where you'll organize all your folders.

// After
After you create your account, you'll be taken straight to My Items. This is your home base where you'll organize all your folders.
```

**Step 4: Update sign-in.mdx description (line 3)**

```mdx
// Before
description: Access your CanonCore dashboard

// After
description: Access your CanonCore library
```

**Step 5: Run build to verify MDX**

```bash
pnpm run build
```

Expected: PASS (no MDX parse errors)

**Step 6: Commit**

```bash
git add content/docs/getting-started/
git commit -m "docs: update documentation to use 'My Items' terminology"
```

---

## Task 5: Update E2E Test - Docs Page Object

**Files:**
- Modify: `e2e/pages/docs.page.ts:17-18,38,40-41`

**Step 1: Update locator and method names**

```typescript
// Line 11 - rename property
readonly backToMyItems: Locator;

// Lines 17-19 - update locator
this.backToMyItems = page.getByRole("link", {
  name: "Back to My Items",
});

// Line 38-41 - update method and JSDoc
/**
 * Navigate back to My Items via sidebar link.
 */
async goBackToMyItems() {
  await this.backToMyItems.click();
}
```

**Step 2: Run type check**

```bash
pnpm run type-check
```

Expected: PASS

**Step 3: Commit**

```bash
git add e2e/pages/docs.page.ts
git commit -m "test(e2e): update docs page object for 'My Items' rename"
```

---

## Task 6: Update E2E Test - Docs Navigation Spec

**Files:**
- Modify: `e2e/journeys/docs/docs-navigation.spec.ts:42,48,52,55-56,60`

**Step 1: Update test name and locator (lines 42-60)**

```typescript
// Line 42 - update test name
test("can navigate back to my items from docs", async ({

// Line 48 - update comment
// Open sidebar if collapsed (mobile) - Back to My Items is in our sidebar

// Line 52 - update locator
const backLink = page.getByRole("link", { name: "Back to My Items" });

// Line 55-56 - update comment
// Should be on my items page
await expect(page).toHaveURL("/dashboard");

// Line 60 - update comment
// Set dark mode in my items
```

**Step 2: Run the specific E2E test**

```bash
BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium -g "navigate back to my items"
```

Expected: PASS

**Step 3: Commit**

```bash
git add e2e/journeys/docs/docs-navigation.spec.ts
git commit -m "test(e2e): update docs navigation test for 'My Items' rename"
```

---

## Task 7: Update Landing Page E2E Page Object

**Files:**
- Modify: `e2e/pages/landing.page.ts:25`

**Step 1: Update JSDoc comment**

```typescript
// Before (line 25)
/** Click the CTA button (Get Started for guests, Go to Dashboard for authenticated). */

// After
/** Click the CTA button (Get Started for guests, Go to My Items for authenticated). */
```

**Step 2: Commit**

```bash
git add e2e/pages/landing.page.ts
git commit -m "test(e2e): update landing page object JSDoc"
```

---

## Task 8: Verify All Tests Pass

**Step 1: Run unit tests**

```bash
pnpm run test:unit
```

Expected: All tests PASS

**Step 2: Run E2E tests (focused)**

```bash
BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium -g "docs"
```

Expected: All docs tests PASS

**Step 3: Run full check**

```bash
pnpm run check
```

Expected: All checks PASS

---

## Task 9: Update Site Header Default Title

**Files:**
- Modify: `components/site-header.tsx:68`

**Step 1: Update default prop value**

```typescript
// Before (line 68)
title = "My Files",

// After
title = "My Items",
```

**Step 2: Run type check**

```bash
pnpm run type-check
```

Expected: PASS

**Step 3: Commit**

```bash
git add components/site-header.tsx
git commit -m "feat: rename 'My Files' to 'My Items' in site header default"
```

---

## Task 10: Update App Sidebar Nav Item

**Files:**
- Modify: `components/app-sidebar.tsx:48`

**Step 1: Update nav item title**

```typescript
// Before (line 48)
title: "My Files",

// After
title: "My Items",
```

**Step 2: Run type check**

```bash
pnpm run type-check
```

Expected: PASS

**Step 3: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "feat: rename 'My Files' to 'My Items' in sidebar"
```

---

## Task 11: Update Dashboard Pages

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx:20`
- Modify: `app/(dashboard)/dashboard/[itemId]/page.tsx:67,83,98`

**Step 1: Update root dashboard page (line 20)**

```typescript
// Before
<SiteHeader title="My Files" titleHref="/dashboard" />

// After
<SiteHeader title="My Items" titleHref="/dashboard" />
```

**Step 2: Update item detail page (lines 67, 83, 98)**

Replace all three occurrences:

```typescript
// Before
title="My Files"

// After
title="My Items"
```

**Step 3: Run type check**

```bash
pnpm run type-check
```

Expected: PASS

**Step 4: Commit**

```bash
git add app/(dashboard)/dashboard/
git commit -m "feat: rename 'My Files' to 'My Items' in dashboard pages"
```

---

## Task 12: Update Site Header Unit Tests

**Files:**
- Modify: `tests/unit/components/site-header.test.tsx:30,45,64,79,92,115`

**Step 1: Update test assertions and props**

Replace all occurrences of "My Files" with "My Items":

```typescript
// Line 30 - update assertion
expect(link.textContent).toBe("My Items");

// Lines 45, 64, 79, 92, 115 - update render props
render(<SiteHeader title="My Items" ... />);
```

**Step 2: Run unit tests**

```bash
pnpm run test:unit tests/unit/components/site-header.test.tsx
```

Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/unit/components/site-header.test.tsx
git commit -m "test: update site header tests for 'My Items' rename"
```

---

## Task 13: Update Navigation Documentation

**Files:**
- Modify: `content/docs/files-and-folders/navigation.mdx:13,17,31,52`
- Modify: `content/docs/getting-started/quick-tour.mdx:16`

**Step 1: Update navigation.mdx**

Replace all "My Files" with "My Items":

```mdx
// Line 13 - breadcrumb example
My Items > Work > Projects > Project A

// Line 17
- Click **My Items** to return to the top level

// Line 31
- Click **My Items** in the sidebar

// Line 52
Click **My Items** in the sidebar to always get back to your starting point.
```

**Step 2: Update quick-tour.mdx sidebar item (line 16)**

```mdx
// Before
- **My Files** - Takes you back to your main folder list

// After
- **My Items** - Takes you back to your main folder list
```

**Step 3: Run build to verify MDX**

```bash
pnpm run build
```

Expected: PASS

**Step 4: Commit**

```bash
git add content/docs/
git commit -m "docs: rename 'My Files' to 'My Items' in documentation"
```

---

## Task 14: Update Seed Data

**Files:**
- Modify: `prisma/seed.ts:564`

**Step 1: Update seed data label**

```typescript
// Before (line 564)
"My Files",

// After
"My Items",
```

**Step 2: Run type check**

```bash
pnpm run type-check
```

Expected: PASS

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore: rename 'My Files' to 'My Items' in seed data"
```

---

## Task 15: Final Verification

**Step 1: Run full check**

```bash
pnpm run check
```

Expected: All checks PASS

**Step 2: Run unit tests**

```bash
pnpm run test:unit
```

Expected: All tests PASS

**Step 3: Run E2E tests**

```bash
BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium
```

Expected: All tests PASS

**Step 4: Verify no remaining "My Files" references**

```bash
grep -r "My Files" --include="*.tsx" --include="*.ts" --include="*.mdx" . | grep -v node_modules | grep -v docs/plans | grep -v docs/deployments
```

Expected: No matches (except historical docs)

---

## Summary of Changes

### "Dashboard" → "My Items" Changes

| File | Change |
|------|--------|
| `components/nav-docs.tsx` | "Back to Dashboard" → "Back to My Items" |
| `app/(public)/page.tsx` | "Go to Dashboard" → "Go to My Items", "dashboard" → "platform" |
| `app/layout.tsx` | Description: "CanonCore Dashboard" → "CanonCore - Media Library Manager" |
| `content/docs/.../quick-tour.mdx` | Heading "## The Dashboard" → "## My Items", body text update |
| `content/docs/.../create-account.mdx` | "dashboard" → "My Items" |
| `content/docs/.../sign-in.mdx` | "dashboard" → "library" |
| `e2e/pages/docs.page.ts` | Locator and method rename (`backToMyItems`) |
| `e2e/pages/landing.page.ts` | JSDoc update |
| `e2e/journeys/docs/docs-navigation.spec.ts` | Test name and locator updates |

### "My Files" → "My Items" Changes

| File | Change |
|------|--------|
| `components/site-header.tsx` | Default title prop: "My Files" → "My Items" |
| `components/app-sidebar.tsx` | Nav item title: "My Files" → "My Items" |
| `app/(dashboard)/dashboard/page.tsx` | SiteHeader title |
| `app/(dashboard)/dashboard/[itemId]/page.tsx` | SiteHeader title (3 occurrences) |
| `tests/unit/components/site-header.test.tsx` | Test assertions and props (6 occurrences) |
| `content/docs/.../navigation.mdx` | All "My Files" references (4 occurrences) |
| `content/docs/.../quick-tour.mdx` | Sidebar item description |
| `prisma/seed.ts` | Seed data label |

**Total: 17 files, ~35 line changes**
