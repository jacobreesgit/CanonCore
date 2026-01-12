# Item Hero Visual Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix collapsed description height to exactly 2 lines, improve Read More button styling, and add a hero collapse/focus feature to maximize tree/grid viewport space.

**Architecture:** The ItemHero component gets a new `collapsed` prop and internal collapse button. A new `useHeroCollapse` hook manages collapsed state via localStorage. Both ItemDetailClient and ItemsView pass the collapse state to ItemHero. The collapsed hero becomes a sleek compact bar with title and essential actions.

**Tech Stack:** React, Tailwind CSS 4, motion/react (Framer Motion), Lucide icons, localStorage

---

## Design Direction: Cinematic Focus Mode

**Aesthetic:** The collapse feature follows the existing glassmorphism language—subtle borders, backdrop blur, refined transitions. The collapsed state is a sleek horizontal bar that feels like a "focus mode" rather than just a minimized hero.

**Collapsed State Appearance:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◀ Breaking Bad                                   [▶ Play]  [⬍ Expand]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Height: 56px (matches toolbar height)
- Subtle glass background with backdrop-blur
- Title left-aligned with truncation
- Essential actions on right (Play + Expand)
- Smooth height animation via motion/react

**Expanded State:**

- Full cinematic hero (current design)
- Small collapse button in top-right corner (ChevronUp icon)
- Button styled as glass pill for consistency

---

## Task 1: Create useHeroCollapse Hook

**Files:**

- Create: `hooks/use-hero-collapse.ts`
- Test: `tests/unit/hooks/use-hero-collapse.test.ts`

**Step 1: Write the failing test**

```typescript
/**
 * Unit tests for useHeroCollapse hook.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHeroCollapse } from "@/hooks/use-hero-collapse";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("useHeroCollapse", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("should default to expanded (false)", () => {
    const { result } = renderHook(() => useHeroCollapse());
    expect(result.current.isCollapsed).toBe(false);
  });

  it("should toggle collapsed state", () => {
    const { result } = renderHook(() => useHeroCollapse());

    act(() => {
      result.current.toggleCollapse();
    });

    expect(result.current.isCollapsed).toBe(true);

    act(() => {
      result.current.toggleCollapse();
    });

    expect(result.current.isCollapsed).toBe(false);
  });

  it("should persist state to localStorage", () => {
    const { result } = renderHook(() => useHeroCollapse());

    act(() => {
      result.current.toggleCollapse();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "canon-hero-collapsed",
      "true"
    );
  });

  it("should read initial state from localStorage", () => {
    localStorageMock.getItem.mockReturnValueOnce("true");

    const { result } = renderHook(() => useHeroCollapse());

    expect(result.current.isCollapsed).toBe(true);
  });

  it("should provide setCollapsed for direct control", () => {
    const { result } = renderHook(() => useHeroCollapse());

    act(() => {
      result.current.setCollapsed(true);
    });

    expect(result.current.isCollapsed).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/hooks/use-hero-collapse.test.ts`
Expected: FAIL - module not found

**Step 3: Write the hook implementation**

```typescript
/**
 * Hook for managing hero collapse state with localStorage persistence.
 * Used by ItemHero to toggle between full cinematic view and compact bar.
 */

"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "canon-hero-collapsed";

/**
 * Manages hero collapse state with localStorage persistence.
 * Defaults to expanded (false) on first visit.
 *
 * @returns Collapse state and control functions
 */
export function useHeroCollapse() {
  // Initialize from localStorage (SSR-safe with false default)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  // Sync to localStorage when state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setIsCollapsed(value);
  }, []);

  return {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/hooks/use-hero-collapse.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/use-hero-collapse.ts tests/unit/hooks/use-hero-collapse.test.ts
git commit -m "$(cat <<'EOF'
feat(hooks): add useHeroCollapse for hero focus mode

Manages collapsed/expanded state with localStorage persistence.
Enables focus mode where tree/grid takes more viewport space.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fix Collapsed Description Height

**Files:**

- Modify: `components/items/item-hero.tsx:155`

**Step 1: Update motion.div height**

Change line 155 from:

```tsx
height:
  descriptionExpanded || !shouldTruncate ? "auto" : "4.5rem",
```

To:

```tsx
height:
  descriptionExpanded || !shouldTruncate ? "auto" : "3.5rem",
```

**Rationale:** `text-lg` = 18px font, 28px line-height. Two lines = 56px = 3.5rem.

**Step 2: Verify tests pass**

Run: `pnpm test tests/unit/components/items/item-hero.test.tsx`
Expected: All tests pass

**Step 3: Commit**

```bash
git add components/items/item-hero.tsx
git commit -m "$(cat <<'EOF'
fix(item-hero): correct collapsed description to exactly 2 lines

Changed from 4.5rem (72px) to 3.5rem (56px) to match text-lg
line-height (28px × 2 = 56px).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Improve Read More Button Styling

**Files:**

- Modify: `components/items/item-hero.tsx:169-185`

**Step 1: Update button with glassmorphism styling**

Replace the Button block with:

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
  className="group mt-3 gap-1 border border-white/20 text-white/80 backdrop-blur-sm hover:border-white/40 hover:bg-white/10 hover:text-white"
  data-testid="hero-read-more"
>
  {descriptionExpanded ? "Show Less" : "Read More"}
  <motion.span
    animate={{ rotate: descriptionExpanded ? 180 : 0 }}
    transition={{ duration: 0.2 }}
  >
    <ChevronDown className="size-4" />
  </motion.span>
</Button>
```

**Step 2: Verify tests pass**

Run: `pnpm test tests/unit/components/items/item-hero.test.tsx`
Expected: All tests pass

**Step 3: Commit**

```bash
git add components/items/item-hero.tsx
git commit -m "$(cat <<'EOF'
style(item-hero): glassmorphism styling for Read More button

Added border-white/20 outline and backdrop-blur-sm for better
visibility against varied backdrops.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add Hero Collapse Feature to ItemHero

**Files:**

- Modify: `components/items/item-hero.tsx`
- Test: `tests/unit/components/items/item-hero.test.tsx`

**Step 1: Write failing tests for collapse feature**

Add to `item-hero.test.tsx`:

```typescript
describe("collapse/expand", () => {
  it("should render collapse button when onCollapse provided", () => {
    render(
      <ItemHero
        name="Test"
        isCollapsed={false}
        onCollapse={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /collapse hero/i })
    ).toBeInTheDocument();
  });

  it("should not render collapse button when onCollapse not provided", () => {
    render(<ItemHero name="Test" />);
    expect(
      screen.queryByRole("button", { name: /collapse hero/i })
    ).not.toBeInTheDocument();
  });

  it("should render collapsed state with expand button", () => {
    render(
      <ItemHero
        name="Test"
        isCollapsed={true}
        onCollapse={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /expand hero/i })
    ).toBeInTheDocument();
  });

  it("should call onCollapse when collapse button clicked", async () => {
    const user = userEvent.setup();
    const onCollapse = vi.fn();
    render(
      <ItemHero
        name="Test"
        isCollapsed={false}
        onCollapse={onCollapse}
      />
    );

    await user.click(screen.getByRole("button", { name: /collapse hero/i }));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("should show title in collapsed state", () => {
    render(
      <ItemHero
        name="Breaking Bad"
        isCollapsed={true}
        onCollapse={() => {}}
      />
    );
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
  });

  it("should show play button in collapsed state when hasMedia", () => {
    render(
      <ItemHero
        name="Test"
        isCollapsed={true}
        onCollapse={() => {}}
        hasMedia
        onPlay={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify failure**

Run: `pnpm test tests/unit/components/items/item-hero.test.tsx`
Expected: FAIL - isCollapsed/onCollapse props don't exist

**Step 3: Update ItemHero component**

Add new imports and update the component:

```tsx
// Add to imports
import { ChevronUp, Maximize2 } from "lucide-react";

// Add to interface (after onPlay)
/** Whether hero is in collapsed state. */
isCollapsed?: boolean;
/** Callback to toggle collapsed state. */
onCollapse?: () => void;
```

Add to destructured props:

```tsx
isCollapsed = false,
onCollapse,
```

Replace the entire return statement with:

```tsx
// Collapsed state - compact bar
if (isCollapsed && onCollapse) {
  return (
    <motion.section
      data-testid="item-hero"
      initial={{ height: "auto" }}
      animate={{ height: 56 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "relative flex h-14 items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 px-4 backdrop-blur-md",
        className
      )}
    >
      {/* Left: Title */}
      <h1 className="truncate text-lg font-semibold text-white/90">{name}</h1>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {hasMedia && onPlay && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onPlay}
            className="gap-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            data-testid="item-hero-play"
          >
            <Play className="size-4" />
            <span className="hidden sm:inline">
              {hasProgress ? "Resume" : "Play"}
            </span>
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={onCollapse}
          aria-label="Expand hero"
          className="size-8 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </motion.section>
  );
}

// Expanded state - full cinematic hero
return (
  <motion.section
    data-testid="item-hero"
    initial={false}
    animate={{ height: "auto" }}
    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    className={cn(
      "relative flex min-h-[max(240px,30dvh)] items-center justify-center overflow-hidden rounded-xl",
      shouldShowBackground &&
        "bg-black/80 bg-cover bg-center bg-no-repeat before:absolute before:inset-0 before:z-10 before:bg-black/50",
      className
    )}
    style={{
      backgroundImage: shouldShowBackground
        ? `url(${backgroundSrc})`
        : undefined,
    }}
  >
    {/* Collapse button - top right */}
    {onCollapse && (
      <Button
        size="icon"
        variant="ghost"
        onClick={onCollapse}
        aria-label="Collapse hero"
        className="absolute top-3 right-3 z-30 size-8 border border-white/20 text-white/60 backdrop-blur-sm hover:border-white/40 hover:bg-white/10 hover:text-white"
      >
        <ChevronUp className="size-4" />
      </Button>
    )}

    {/* Hidden img for error detection */}
    {backgroundSrc && !imageError && (
      <img
        src={backgroundSrc}
        alt=""
        className="hidden"
        onError={() => setImageError(true)}
      />
    )}

    {/* Shader fallback when no background image */}
    {!shouldShowBackground && (
      <div data-testid="hero-fallback" className="absolute inset-0 z-0">
        {typeof window !== "undefined" && navigator.webdriver ? (
          <div className="h-full w-full bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900" />
        ) : (
          <Shader1 className="h-full" />
        )}
      </div>
    )}

    {/* Content overlay - centered */}
    <div className="relative z-20 flex flex-col items-center gap-6 p-8 text-center text-white">
      {/* Title */}
      <h1 className="line-clamp-2 max-w-2xl text-4xl font-bold tracking-tight drop-shadow-lg md:text-5xl">
        {name}
      </h1>

      {/* Description with expand/collapse */}
      {description && (
        <div className="flex max-w-xl flex-col items-center">
          <motion.div
            initial={false}
            animate={{
              height:
                descriptionExpanded || !shouldTruncate ? "auto" : "3.5rem",
            }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
            data-testid="hero-description"
          >
            <p className="text-lg text-white/80 drop-shadow-md">
              {descriptionExpanded || !shouldTruncate
                ? description
                : `${description.slice(0, DESCRIPTION_TRUNCATE_LENGTH)}...`}
            </p>
          </motion.div>

          {shouldTruncate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              className="group mt-3 gap-1 border border-white/20 text-white/80 backdrop-blur-sm hover:border-white/40 hover:bg-white/10 hover:text-white"
              data-testid="hero-read-more"
            >
              {descriptionExpanded ? "Show Less" : "Read More"}
              <motion.span
                animate={{ rotate: descriptionExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="size-4" />
              </motion.span>
            </Button>
          )}
        </div>
      )}

      {/* Stats row */}
      <div
        data-testid="item-hero-stats"
        className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/70"
      >
        {mediaCount > 0 && (
          <span className="flex items-center gap-1.5">
            <MediaIcon className="size-4" />
            {mediaCount} media file{mediaCount !== 1 ? "s" : ""}
          </span>
        )}
        {artworkCount > 0 && (
          <span className="flex items-center gap-1.5">
            <ImageIcon className="size-4" />
            {artworkCount} artwork
          </span>
        )}
        {subtitleCount > 0 && (
          <span className="flex items-center gap-1.5">
            <FileText className="size-4" />
            {subtitleCount} subtitle{subtitleCount !== 1 ? "s" : ""}
          </span>
        )}
        {childCount > 0 && (
          <span className="flex items-center gap-1.5">
            <Folder className="size-4" />
            {childCount} item{childCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Play button */}
      {hasMedia && onPlay && (
        <Button
          size="lg"
          variant="glass"
          onClick={onPlay}
          className="max-w-xs gap-2"
          data-testid="item-hero-play"
        >
          <Play className="size-5 shrink-0" />
          <span className="truncate">
            {hasProgress ? "Resume" : "Play"}
            {primaryMediaName && ` ${primaryMediaName}`}
          </span>
        </Button>
      )}
    </div>
  </motion.section>
);
```

**Step 4: Run tests**

Run: `pnpm test tests/unit/components/items/item-hero.test.tsx`
Expected: All tests pass

**Step 5: Commit**

```bash
git add components/items/item-hero.tsx tests/unit/components/items/item-hero.test.tsx
git commit -m "$(cat <<'EOF'
feat(item-hero): add collapse/focus mode for maximizing content area

- Collapsed state shows compact bar with title and essential actions
- Expand/collapse buttons with glassmorphism styling
- Smooth height animation via motion/react
- Play button visible in both states

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Integrate Collapse in ItemDetailClient

**Files:**

- Modify: `components/items/item-detail-client.tsx`
- Test: `tests/unit/components/items/item-detail-client.test.tsx` (if exists)

**Step 1: Import and use the hook**

Add import:

```tsx
import { useHeroCollapse } from "@/hooks/use-hero-collapse";
```

Add hook usage (after other state declarations):

```tsx
const { isCollapsed, toggleCollapse } = useHeroCollapse();
```

Update ItemHero props:

```tsx
<ItemHero
  name={item.name}
  description={item.description}
  artworkId={heroArtworkId}
  hasMedia={hasMedia}
  hasProgress={hasProgress}
  mediaCount={files?.media.length ?? 0}
  artworkCount={files?.artwork.length ?? 0}
  subtitleCount={files?.subtitles.length ?? 0}
  childCount={childItems.length}
  primaryMediaName={primaryMedia?.filename ?? null}
  primaryMediaMimeType={primaryMedia?.mimeType ?? null}
  onPlay={handlePlay}
  isCollapsed={isCollapsed}
  onCollapse={toggleCollapse}
/>
```

**Step 2: Run build to verify**

Run: `pnpm run type-check`
Expected: No type errors

**Step 3: Commit**

```bash
git add components/items/item-detail-client.tsx
git commit -m "$(cat <<'EOF'
feat(item-detail): integrate hero collapse with localStorage persistence

Uses useHeroCollapse hook to remember collapsed state across sessions.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Integrate Collapse in ItemsView (Root Page)

**Files:**

- Modify: `components/items/items-view.tsx`

**Step 1: Import and use the hook**

Add import:

```tsx
import { useHeroCollapse } from "@/hooks/use-hero-collapse";
```

Add hook usage (with other state):

```tsx
const { isCollapsed, toggleCollapse } = useHeroCollapse();
```

Update ItemHero usage (around line 507-513):

```tsx
{
  heroTitle && (
    <ItemHero
      name={heroTitle}
      childCount={heroItemCount ?? items.length}
      backgroundUrl={heroBackgroundUrl}
      isCollapsed={isCollapsed}
      onCollapse={toggleCollapse}
    />
  );
}
```

**Step 2: Run build to verify**

Run: `pnpm run type-check`
Expected: No type errors

**Step 3: Commit**

```bash
git add components/items/items-view.tsx
git commit -m "$(cat <<'EOF'
feat(items-view): integrate hero collapse for root My Items page

Uses shared useHeroCollapse hook so state persists across all pages.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add Read More Button Tests

**Files:**

- Modify: `tests/unit/components/items/item-hero.test.tsx`

**Step 1: Add tests for Read More functionality**

```typescript
describe("description expand/collapse", () => {
  const longDescription = "A".repeat(200);

  it("should show Read More button for long descriptions", () => {
    render(<ItemHero name="Test" description={longDescription} />);
    expect(
      screen.getByRole("button", { name: /read more/i })
    ).toBeInTheDocument();
  });

  it("should not show Read More button for short descriptions", () => {
    render(<ItemHero name="Test" description="Short text" />);
    expect(
      screen.queryByRole("button", { name: /read more/i })
    ).not.toBeInTheDocument();
  });

  it("should toggle to Show Less when expanded", async () => {
    const user = userEvent.setup();
    render(<ItemHero name="Test" description={longDescription} />);

    await user.click(screen.getByRole("button", { name: /read more/i }));

    expect(
      screen.getByRole("button", { name: /show less/i })
    ).toBeInTheDocument();
  });

  it("should toggle back to Read More when collapsed", async () => {
    const user = userEvent.setup();
    render(<ItemHero name="Test" description={longDescription} />);

    await user.click(screen.getByRole("button", { name: /read more/i }));
    await user.click(screen.getByRole("button", { name: /show less/i }));

    expect(
      screen.getByRole("button", { name: /read more/i })
    ).toBeInTheDocument();
  });

  it("should have data-testid for E2E targeting", () => {
    render(<ItemHero name="Test" description={longDescription} />);
    expect(screen.getByTestId("hero-read-more")).toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `pnpm test tests/unit/components/items/item-hero.test.tsx`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/unit/components/items/item-hero.test.tsx
git commit -m "$(cat <<'EOF'
test(item-hero): add Read More expand/collapse tests

Tests visibility, toggle behavior, and data-testid for E2E access.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add E2E Tests for Hero Collapse

**Files:**

- Create: `e2e/journeys/items/item-hero.spec.ts`

**Step 1: Create E2E test file**

```typescript
/**
 * E2E tests for ItemHero collapse and description expand features.
 */

import { test, expect } from "@playwright/test";
import { ItemsPage } from "../../pages/items.page";
import { loginAndCleanup } from "../../fixtures/auth";

test.describe("Item Hero", () => {
  let itemsPage: ItemsPage;

  test.beforeEach(async ({ page }) => {
    await loginAndCleanup(page);
    itemsPage = new ItemsPage(page);
  });

  test.describe("collapse/expand", () => {
    test("should collapse and expand hero on My Items page", async ({
      page,
    }) => {
      await itemsPage.goto();

      // Hero should be visible and expanded
      const hero = page.getByTestId("item-hero");
      await expect(hero).toBeVisible();

      // Find and click collapse button
      const collapseButton = page.getByRole("button", {
        name: /collapse hero/i,
      });
      await expect(collapseButton).toBeVisible();
      await collapseButton.click();

      // Hero should now be collapsed (smaller height)
      const expandButton = page.getByRole("button", { name: /expand hero/i });
      await expect(expandButton).toBeVisible();

      // Click to expand
      await expandButton.click();

      // Collapse button should be back
      await expect(collapseButton).toBeVisible();
    });

    test("should persist collapsed state across navigation", async ({
      page,
    }) => {
      await itemsPage.goto();

      // Collapse the hero
      await page.getByRole("button", { name: /collapse hero/i }).click();

      // Navigate away and back
      await page.goto("/docs");
      await itemsPage.goto();

      // Should still be collapsed
      await expect(
        page.getByRole("button", { name: /expand hero/i })
      ).toBeVisible();
    });
  });

  test.describe("description Read More", () => {
    const longDescription =
      "This is a very long description that exceeds 150 characters to trigger the Read More button. " +
      "It contains enough text to demonstrate the expand and collapse functionality properly.";

    test("should expand and collapse long description", async ({ page }) => {
      // Create item with long description
      await itemsPage.goto();
      await itemsPage.createItem("Hero Test", longDescription);
      await itemsPage.clickItem("Hero Test");

      // Should see Read More button
      const readMoreButton = page.getByTestId("hero-read-more");
      await expect(readMoreButton).toBeVisible();
      await expect(readMoreButton).toHaveText(/read more/i);

      // Click to expand
      await readMoreButton.click();
      await expect(readMoreButton).toHaveText(/show less/i);

      // Click to collapse
      await readMoreButton.click();
      await expect(readMoreButton).toHaveText(/read more/i);

      // Cleanup
      await itemsPage.breadcrumbHome.click();
      await itemsPage.deleteItemViaContextMenu("Hero Test");
    });
  });
});
```

**Step 2: Run E2E tests**

Run: `pnpm test:e2e e2e/journeys/items/item-hero.spec.ts --project=chromium`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/journeys/items/item-hero.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add ItemHero collapse and Read More E2E tests

Tests collapse persistence, expand/collapse behavior, and
description Read More functionality.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Update Items Page E2E Helpers

**Files:**

- Modify: `e2e/pages/items.page.ts`

**Step 1: Add hero collapse helpers**

Add to the class:

```typescript
/**
 * Collapses the hero section.
 */
async collapseHero(): Promise<void> {
  await this.page.getByRole("button", { name: /collapse hero/i }).click();
}

/**
 * Expands the hero section.
 */
async expandHero(): Promise<void> {
  await this.page.getByRole("button", { name: /expand hero/i }).click();
}

/**
 * Checks if the hero is currently collapsed.
 */
async isHeroCollapsed(): Promise<boolean> {
  return this.page
    .getByRole("button", { name: /expand hero/i })
    .isVisible();
}
```

**Step 2: Commit**

```bash
git add e2e/pages/items.page.ts
git commit -m "$(cat <<'EOF'
test(e2e): add hero collapse helpers to ItemsPage

Adds collapseHero(), expandHero(), and isHeroCollapsed() methods.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Run Full Test Suite

**Step 1: Run unit tests**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Run E2E tests**

Run: `pnpm test:e2e --project=chromium`
Expected: All tests pass

**Step 3: Run checks**

Run: `pnpm run check`
Expected: All checks pass

---

## Test Summary

### Unit Tests

| File                                             | Tests Added |
| ------------------------------------------------ | ----------- |
| `tests/unit/hooks/use-hero-collapse.test.ts`     | 5 new       |
| `tests/unit/components/items/item-hero.test.tsx` | 11 new      |

### E2E Tests

| File                                   | Tests Added |
| -------------------------------------- | ----------- |
| `e2e/journeys/items/item-hero.spec.ts` | 3 new       |

### Existing Tests - No Changes Required

All existing tests continue to pass as the changes are additive.

---

## Files Changed Summary

| File                                             | Change                                |
| ------------------------------------------------ | ------------------------------------- |
| `hooks/use-hero-collapse.ts`                     | Created                               |
| `tests/unit/hooks/use-hero-collapse.test.ts`     | Created                               |
| `components/items/item-hero.tsx`                 | Modified (collapse feature + styling) |
| `tests/unit/components/items/item-hero.test.tsx` | Modified (new tests)                  |
| `components/items/item-detail-client.tsx`        | Modified (integrate hook)             |
| `components/items/items-view.tsx`                | Modified (integrate hook)             |
| `e2e/journeys/items/item-hero.spec.ts`           | Created                               |
| `e2e/pages/items.page.ts`                        | Modified (helpers)                    |

---

## Out of Scope

- Keyboard shortcut for collapse toggle (e.g., "F" for focus)
- Animation of content sliding up when hero collapses
- Different collapse states for different pages (all share same state)
- Toolbar "Focus" button (collapse button in hero is sufficient)
