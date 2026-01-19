# Future Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address performance, accessibility, and UX improvements identified during the comprehensive codebase audit, prioritized by user impact.

**Architecture:** Implements bundle size optimizations via dynamic imports, accessibility improvements for keyboard users, and rendering performance with content-visibility. Each task is independent and can be done in any order within its priority tier.

**Tech Stack:** Next.js 16, React 19, next/dynamic, CSS content-visibility

---

## Priority Tiers

| Tier        | Criteria                          | Timeframe        |
| ----------- | --------------------------------- | ---------------- |
| **P0**      | High user impact, low-medium risk | Next sprint      |
| **P1**      | Medium impact, improves UX/a11y   | Next 2 sprints   |
| **P2**      | Nice-to-have, low effort          | Opportunistic    |
| **Removed** | Over-engineering or low ROI       | Not implementing |

---

## P0: High Priority

### Task 1: Dynamic Import for Edit Mode Components

**Why:** `@dnd-kit/core` (~15KB) is loaded for all users even though only ~5% enter edit mode. Lazy-loading on "Edit" click improves initial page load.

**Files:**

- Modify: `components/items/items-view.tsx`
- Test: `tests/unit/components/items-view.test.tsx`

**Step 1: Create dynamic imports**

```tsx
// At top of items-view.tsx
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Replace static imports with dynamic
const SortableTree = dynamic(
  () => import("@/components/sortable-tree").then((mod) => mod.SortableTree),
  { loading: () => <TreeSkeleton />, ssr: false }
);

const SortableGrid = dynamic(
  () => import("@/components/sortable-grid").then((mod) => mod.SortableGrid),
  { loading: () => <GridSkeleton />, ssr: false }
);

// Add skeleton components
function TreeSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
      ))}
    </div>
  );
}
```

**Step 2: Verify edit mode still works**

Run: `pnpm run test && pnpm run build`

**Step 3: Test manually**

1. Navigate to My Items
2. Click Edit button
3. Verify drag-drop works after brief loading state

---

### Task 2: Skip to Main Content Link (Accessibility)

**Why:** Screen reader and keyboard users need to skip past repetitive navigation. Required for WCAG 2.1 Level A.

**Files:**

- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/(my-items)/layout.tsx`, `app/(public)/layout.tsx`, `app/(docs)/layout.tsx`
- Create: `e2e/journeys/navigation/skip-link.spec.ts`

**Step 1: Add skip link to layout**

```tsx
// In app/layout.tsx, after <body> opening tag
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
```

**Step 2: Add CSS for skip link**

```css
/* In app/globals.css */
.skip-link {
  @apply bg-background text-foreground fixed top-0 left-0 z-[9999] -translate-y-full px-4 py-2 text-sm font-medium transition-transform focus:translate-y-0;
}
```

**Step 3: Add id and tabindex to main content areas**

In each layout that has main content, add `id="main-content"` and `tabindex="-1"` (required for programmatic focus):

```tsx
// Example in app/(my-items)/layout.tsx
<main id="main-content" tabIndex={-1} className="...">
  {children}
</main>
```

Apply to:

- `app/(my-items)/layout.tsx`
- `app/(public)/layout.tsx`
- `app/(docs)/layout.tsx`

**Step 4: Add E2E test**

```typescript
// e2e/journeys/navigation/skip-link.spec.ts
import { test, expect } from "@playwright/test";

test("skip link becomes visible on focus and works", async ({ page }) => {
  await page.goto("/my-items");

  // Press Tab to focus skip link
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeVisible();

  // Click it
  await skipLink.click();

  // Verify focus moved to main content (needs tabindex="-1" to work)
  const main = page.locator("#main-content");
  await expect(main).toBeFocused();
});
```

**Step 5: Run tests**

```bash
pnpm run check
pnpm run test:e2e --grep "skip link"
```

---

## P1: Medium Priority

### Task 3: Content-Visibility for Tree/Grid Views

**Why:** For users with 50+ items, rendering all DOM nodes upfront causes jank. CSS `content-visibility: auto` lets the browser skip rendering off-screen items.

**Files:**

- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Modify: `components/sortable-grid/GridItem.tsx`
- Modify: `app/globals.css`

**Step 1: Add CSS utility class**

```css
/* In app/globals.css */
.content-auto {
  content-visibility: auto;
  contain-intrinsic-size: 0 48px; /* Tree item height */
}

.content-auto-card {
  content-visibility: auto;
  contain-intrinsic-size: auto 300px; /* Grid card approx height */
}
```

**Step 2: Apply to TreeItem**

```tsx
// In TreeItem.tsx, add class to wrapper
<div className={cn("tree-item content-auto", className)}>
```

**Step 3: Apply to GridItem**

```tsx
// In GridItem.tsx, add class to wrapper
<div className={cn("grid-item content-auto-card", className)}>
```

**Step 4: Test with large item list**

Use seed script to create 100+ items, then verify:

1. Initial render is fast
2. Scrolling is smooth
3. No visual glitches

---

### Task 4: Decorative Icons Audit Completion

**Why:** Remaining decorative icons in dialogs should have `aria-hidden="true"` for screen reader cleanliness.

**Files (batch update):**

- `components/items/add-item-dialog.tsx`
- `components/items/item-settings-dialog.tsx`
- `components/profile/settings-dialog.tsx`
- `components/google-drive/settings-section.tsx`

**Step 1: Search and replace pattern**

For each file, find icons that are decorative (next to text labels) and add `aria-hidden="true"`:

```tsx
// Before
<Settings className="size-4" />

// After
<Settings aria-hidden="true" className="size-4" />
```

**Icons to skip** (already have aria-label or are meaningful):

- Icons that are the only content in a button (these need aria-label instead)
- Status icons that convey meaning without text

**Step 2: Run accessibility linter**

```bash
pnpm run lint
pnpm run test
```

---

## P2: Nice-to-Have (Opportunistic)

### Task 5: Preload Edit Mode on Hover

**Why:** When user hovers over "Edit" button, preload the dnd-kit chunk so it's ready when they click.

**Files:**

- Modify: `components/items/edit-mode-toggle.tsx`

**Implementation:**

```tsx
// Add preload function
const preloadDndKit = () => {
  import("@/components/sortable-tree");
  import("@/components/sortable-grid");
};

// In EditModeToggle component
<Button onMouseEnter={preloadDndKit} onFocus={preloadDndKit} onClick={onToggle}>
  {isEditing ? "Done" : "Edit"}
</Button>;
```

---

### Task 6: aria-live for Search Results

**Why:** Screen reader users should be notified when search results update.

**Files:**

- Modify: `components/search/spotlight-search.tsx`

**Implementation:**

```tsx
// Add live region for result count
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {items.length} results found
</div>
```

---

### Task 7: Dynamic Import for VideoPlayer

**Why:** `@vidstack/react` is ~50KB and only needed when playing media.

**Files:**

- Modify: `components/media/media-overlay.tsx`

**Note:** This is more complex due to CSS imports. May need:

```tsx
const VideoPlayer = dynamic(
  () => import("./media-player").then((mod) => mod.VideoPlayer),
  { ssr: false }
);
```

Plus ensuring CSS is loaded when component mounts.

---

### Task 8: URL-Based State Management

**Why:** Currently sort/filter/view state is stored in localStorage. URL-based state would enable:

- Shareable links like `/my-items?sort=name-asc&filter=has-files&view=grid`
- Browser back/forward restores previous states
- Bookmarks preserve specific view states

**Current Decision:** localStorage is intentional for persistent user preferences. This is a feature request, not a bug fix.

**If implementing:**

- Use `nuqs` library for type-safe URL state management
- Consider shallow routing to avoid full page reloads
- May need server component updates to read initial state from URL

---

## Removed from Scope

These items from the original audit have been removed as low-value:

| Item                                      | Reason                                           |
| ----------------------------------------- | ------------------------------------------------ |
| Waterfall fixes (my-items, profile pages) | Already fixed with Promise.all in codebase       |
| Centralized formatBytes utilities         | Refactoring exercise, no user benefit            |
| SVG Animation Wrapper (Spinner)           | Micro-optimization, browsers handle SVG well     |
| shadcn transition-all fixes               | Would require maintaining a fork                 |
| dnd-kit reduced motion override           | Library handles internally                       |
| focus-within enhancements                 | Visual only, current focus works                 |
| Focus trap testing                        | Radix handles automatically                      |
| Full i18n infrastructure                  | No user demand, large scope                      |
| WebGL shader optimization                 | Edge case, already skipped in tests              |
| LRU cross-request caching                 | Adds complexity, current approach works          |
| Additional React.cache()                  | Very low impact                                  |
| Sequential data fetching (item detail)    | Data dependency makes parallelization impossible |

---

## Execution Notes

Each task is independent. Recommended order:

1. **Task 2** (skip link) - Accessibility compliance, quick win
2. **Task 1** (dynamic imports) - Bundle size improvement
3. **Task 3** (content-visibility) - Rendering perf
4. **Task 4** (decorative icons) - Completeness
5. **Tasks 5-7** - When convenient

---

_Plan created: 2026-01-19_
_Reviewed: 2026-01-19 - Removed invalid waterfall task, added tabindex detail_
