# Page Load Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate perceived navigation lag by adding route-level loading skeletons, streaming page content via Suspense, and deduplicating shelf queries.

**Architecture:** Four routes get `loading.tsx` files with layout-matched skeletons. Each page is restructured to render a fast shell (SiteHeader) immediately, then stream heavy content via new async server components wrapped in Suspense. `getSystemShelfItems` gains `React.cache()` deduplication.

**Tech Stack:** Next.js 16 App Router, React 19 Suspense, React.cache(), Skeleton component (existing), Vitest, Playwright

**Design doc:** `docs/plans/2026-02-27-page-load-performance-design.md`

### Key Layout Constants (reference for all skeleton tasks)

These dimensions come from the live codebase and **must** be matched exactly to prevent CLS:

| Element | Classes | Source |
|---------|---------|--------|
| Hero height (mobile) | `h-[calc(55vh+var(--header-height))]` | `cinematic-hero.tsx:138` |
| Hero height (desktop) | `md:h-[calc(65vh+var(--header-height))]` | `cinematic-hero.tsx:138` |
| Hero background | `bg-[var(--dark-900)]` | `cinematic-hero.tsx:138` |
| `--header-height` | `calc(var(--spacing) * 12)` = 48px | `app/(public)/layout.tsx:57` |
| Profile avatar | `size-28 sm:size-32 md:size-44 lg:size-48` | `hero-avatar.tsx:58–59` |
| Avatar glass border | `p-[3px]` + gradient ring | `hero-avatar.tsx:50–53` |
| Profile hero content | `flex items-end gap-5 md:gap-8` | `cinematic-hero.tsx:248` |
| Profile hero padding | `pb-8 md:pb-12` (single slide) | `cinematic-hero.tsx:237–240` |
| Carousel hero padding | `pb-16 md:pb-20` (multi slide) | `cinematic-hero.tsx:237–240` |
| Section padding | `px-[var(--section-px-mobile)]` through `2xl:px-[var(--section-px-2xl)]` | `cinematic-hero.tsx:236–243` |
| Tab list | `flex gap-8` | `underline-tabs.tsx:81` |
| Tab button | `py-4 text-sm font-medium tracking-[0.15em] uppercase` | `underline-tabs.tsx:114–122` |
| Tab panel | `min-h-[50vh]` | `underline-tabs.tsx:143` |
| ContentToolbar | `py-4` → `rounded-xl px-3 py-2 bg-white/[0.04] backdrop-blur-md border border-white/[0.06]` | `content-toolbar.tsx:297–304` |
| Profile/Explore grid | `grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6` | `profile-page.tsx:507,539` |
| Playlist grid | `grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6` | `playlist-detail-client.tsx:362` |
| Item detail grid (view) | `grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6` | `grid-view-content.tsx:201,268` |
| Card aspect ratio | `aspect-[2/3]` | All GridItem usage |
| Card border radius | `rounded-lg` | All GridItem usage |
| Name (text-3xl→6xl) | `h-8 w-48` mobile → `md:h-12 md:w-72` desktop | Derived from font sizes |
| Title (item/explore) | `h-10 w-64 md:h-14 md:w-96` | Derived from text-3xl→7xl |
| Logo max dimensions | `max-h-[80px] max-w-[220px]` → `lg:max-h-[140px] lg:max-w-[400px]` | `cinematic-hero.tsx:305` |

---

### Task 1: Profile Content Skeleton Component

**Files:**
- Create: `components/skeletons/profile-content-skeleton.tsx`
- Test: `tests/unit/components/skeletons/profile-content-skeleton.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/skeletons/profile-content-skeleton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileContentSkeleton } from "@/components/skeletons/profile-content-skeleton";

describe("ProfileContentSkeleton", () => {
  it("renders skeleton elements", () => {
    render(<ProfileContentSkeleton />);
    const skeletons = screen.getAllByTestId("skeleton");
    // Hero avatar + name + username + toolbar + 8 grid cards + shelf skeletons
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it("renders hero area with viewport-relative height", () => {
    const { container } = render(<ProfileContentSkeleton />);
    const hero = container.querySelector("[data-testid='skeleton-hero']");
    expect(hero).toBeTruthy();
    // Verify the exact height class is present (prevents CLS)
    expect(hero?.className).toContain("h-[calc(55vh+var(--header-height))]");
  });

  it("renders avatar skeleton with correct responsive sizes", () => {
    const { container } = render(<ProfileContentSkeleton />);
    const avatar = container.querySelector(".rounded-full.size-28");
    expect(avatar).toBeTruthy();
  });

  it("renders poster grid with correct column breakpoints", () => {
    const { container } = render(<ProfileContentSkeleton />);
    const grid = container.querySelector(".grid-cols-3.md\\:grid-cols-4.lg\\:grid-cols-6");
    expect(grid).toBeTruthy();
    // 8 poster cards with aspect-[2/3]
    const posters = grid!.querySelectorAll('[class*="aspect-"]');
    expect(posters.length).toBe(8);
  });

  it("renders tab bar with correct gap", () => {
    const { container } = render(<ProfileContentSkeleton />);
    const tabBar = container.querySelector(".gap-8");
    expect(tabBar).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- tests/unit/components/skeletons/profile-content-skeleton.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `components/skeletons/profile-content-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";
import { ShelfSkeleton } from "@/components/homepage/home-shelves";

/**
 * Skeleton matching the My Items / profile page layout.
 * Used by loading.tsx (route-level) and Suspense fallback (in-page streaming).
 *
 * IMPORTANT: All dimensions must exactly match the real page layout to prevent CLS.
 * See cinematic-hero.tsx, hero-avatar.tsx, and profile-page.tsx for source values.
 */
export function ProfileContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero — exact match to CinematicHero single-slide profile mode */}
      <div
        data-testid="skeleton-hero"
        className="relative h-[calc(55vh+var(--header-height))] w-full overflow-hidden bg-[var(--dark-900)] md:h-[calc(65vh+var(--header-height))]"
      >
        {/* Gradient overlay — matches cinematic-hero.tsx diagonal gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--dark-900) 0%, color-mix(in srgb, var(--dark-900) 70%, transparent) 20%, transparent 55%)",
          }}
          aria-hidden="true"
        />

        {/* Content positioned at bottom — matches cinematic-hero.tsx:233–244 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div className="px-[var(--section-px-mobile)] pb-8 sm:px-[var(--section-px-sm)] md:px-[var(--section-px-md)] md:pb-12 lg:px-[var(--section-px-lg)] xl:px-[var(--section-px-xl)] 2xl:px-[var(--section-px-2xl)]">
            {/* Profile avatar mode — flex items-end gap-5 md:gap-8 */}
            <div className="flex items-end gap-5 md:gap-8">
              {/* Avatar with glass border — matches hero-avatar.tsx:49–61 */}
              <div className="relative shrink-0">
                <div className="relative rounded-full p-[3px] bg-gradient-to-b from-white/20 via-white/8 to-white/4">
                  <Skeleton
                    data-testid="skeleton"
                    className="size-28 rounded-full sm:size-32 md:size-44 lg:size-48 ring-1 ring-white/10"
                  />
                </div>
              </div>
              {/* Name + username — matches cinematic-hero.tsx:257–269 */}
              <div className="min-w-0 flex-1 pb-1">
                {/* Name — text-3xl sm:text-4xl md:text-5xl lg:text-6xl */}
                <Skeleton
                  data-testid="skeleton"
                  className="h-8 w-48 sm:h-10 sm:w-56 md:h-12 md:w-72"
                />
                {/* @username — mt-2 text-sm md:text-base */}
                <Skeleton
                  data-testid="skeleton"
                  className="mt-2 h-4 w-28 md:h-5 md:w-32"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — matches UnderlineTabs: flex gap-8, py-4 buttons */}
      <Section>
        <div className="flex gap-8">
          <Skeleton data-testid="skeleton" className="h-5 w-14 my-4" />
          <Skeleton data-testid="skeleton" className="h-5 w-18 my-4" />
        </div>
      </Section>

      {/* ContentToolbar — matches content-toolbar.tsx glassmorphism container */}
      <Section className="py-4">
        <div className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 bg-white/[0.04] border border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Skeleton data-testid="skeleton" className="h-8 w-20 rounded-md" />
            <Skeleton data-testid="skeleton" className="h-8 w-16 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton data-testid="skeleton" className="size-8 rounded-md" />
            <Skeleton data-testid="skeleton" className="size-8 rounded-md" />
            <Skeleton data-testid="skeleton" className="size-8 rounded-md" />
          </div>
        </div>
      </Section>

      {/* Poster grid (8 cards) — matches profile-page.tsx:507,539 */}
      <Section className="pb-8">
        <div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              data-testid="skeleton"
              className="aspect-[2/3] w-full rounded-lg"
            />
          ))}
        </div>
      </Section>

      {/* Shelf skeletons — reuses existing ShelfSkeleton */}
      <ShelfSkeleton />
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test -- tests/unit/components/skeletons/profile-content-skeleton.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/skeletons/profile-content-skeleton.tsx tests/unit/components/skeletons/profile-content-skeleton.test.tsx
git commit -m "feat: add ProfileContentSkeleton with exact layout dimensions"
```

---

### Task 2: Explore Content Skeleton Component

**Files:**
- Create: `components/skeletons/explore-content-skeleton.tsx`
- Test: `tests/unit/components/skeletons/explore-content-skeleton.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/skeletons/explore-content-skeleton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExploreContentSkeleton } from "@/components/skeletons/explore-content-skeleton";

describe("ExploreContentSkeleton", () => {
  it("renders skeleton elements", () => {
    render(<ExploreContentSkeleton />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it("renders hero with viewport-relative height", () => {
    const { container } = render(<ExploreContentSkeleton />);
    const hero = container.querySelector("[data-testid='skeleton-hero']");
    expect(hero).toBeTruthy();
    expect(hero?.className).toContain("h-[calc(55vh+var(--header-height))]");
  });

  it("renders poster grid with correct column breakpoints", () => {
    const { container } = render(<ExploreContentSkeleton />);
    const grid = container.querySelector(".grid-cols-3.md\\:grid-cols-4.lg\\:grid-cols-6");
    expect(grid).toBeTruthy();
    const posters = grid!.querySelectorAll('[class*="aspect-"]');
    expect(posters.length).toBe(12);
  });

  it("renders tab bar with gap-8", () => {
    const { container } = render(<ExploreContentSkeleton />);
    const tabBar = container.querySelector(".gap-8");
    expect(tabBar).toBeTruthy();
  });

  it("renders carousel dot indicators area", () => {
    const { container } = render(<ExploreContentSkeleton />);
    const dots = container.querySelector("[data-testid='skeleton-dots']");
    expect(dots).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- tests/unit/components/skeletons/explore-content-skeleton.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

Create `components/skeletons/explore-content-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";

/**
 * Skeleton matching the Explore page layout.
 * Used by loading.tsx and Suspense fallback.
 *
 * IMPORTANT: Hero height uses viewport-relative calc, not fixed pixels.
 * Grid columns match explore-client.tsx exactly.
 */
export function ExploreContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero carousel area — exact match to CinematicHero multi-slide mode */}
      <div
        data-testid="skeleton-hero"
        className="relative h-[calc(55vh+var(--header-height))] w-full overflow-hidden bg-[var(--dark-900)] md:h-[calc(65vh+var(--header-height))]"
      >
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--dark-900) 0%, color-mix(in srgb, var(--dark-900) 70%, transparent) 20%, transparent 55%)",
          }}
          aria-hidden="true"
        />

        {/* Content at bottom — multi-slide uses pb-16 md:pb-20 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div className="px-[var(--section-px-mobile)] pb-16 sm:px-[var(--section-px-sm)] md:px-[var(--section-px-md)] md:pb-20 lg:px-[var(--section-px-lg)] xl:px-[var(--section-px-xl)] 2xl:px-[var(--section-px-2xl)]">
            {/* Logo/title placeholder — matches logo max dimensions */}
            <Skeleton
              data-testid="skeleton"
              className="h-[80px] w-[220px] rounded-md sm:h-[100px] sm:w-[280px] md:h-[120px] md:w-[350px] lg:h-[140px] lg:w-[400px]"
            />
            {/* Metadata line */}
            <Skeleton
              data-testid="skeleton"
              className="mt-4 h-4 w-48 md:w-64"
            />
            {/* Description */}
            <Skeleton
              data-testid="skeleton"
              className="mt-3 h-4 w-80 max-w-full md:w-96"
            />
            {/* Action buttons */}
            <div className="mt-6 flex gap-3">
              <Skeleton
                data-testid="skeleton"
                className="h-9 w-24 rounded-full"
              />
              <Skeleton
                data-testid="skeleton"
                className="h-9 w-24 rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Carousel dot indicators — matches cinematic-hero.tsx:386–411 */}
        <div
          data-testid="skeleton-dots"
          className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2"
        >
          <Skeleton className="h-2 w-6 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-2 w-2 rounded-full" />
        </div>
      </div>

      {/* Tabs — matches UnderlineTabs: flex gap-8 */}
      <Section>
        <div className="flex gap-8">
          <Skeleton data-testid="skeleton" className="h-5 w-24 my-4" />
          <Skeleton data-testid="skeleton" className="h-5 w-20 my-4" />
        </div>
      </Section>

      {/* ContentToolbar — glassmorphism container */}
      <Section className="py-4">
        <div className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 bg-white/[0.04] border border-white/[0.06]">
          <Skeleton data-testid="skeleton" className="h-8 w-28 rounded-md" />
          <Skeleton data-testid="skeleton" className="h-8 w-20 rounded-md" />
        </div>
      </Section>

      {/* Poster grid (12 cards) — matches profile-page.tsx grid (shared breakpoints) */}
      <Section className="pb-8">
        <div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              data-testid="skeleton"
              className="aspect-[2/3] w-full rounded-lg"
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test -- tests/unit/components/skeletons/explore-content-skeleton.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/skeletons/explore-content-skeleton.tsx tests/unit/components/skeletons/explore-content-skeleton.test.tsx
git commit -m "feat: add ExploreContentSkeleton with exact layout dimensions"
```

---

### Task 3: Item Content Skeleton Component

**Files:**
- Create: `components/skeletons/item-content-skeleton.tsx`
- Test: `tests/unit/components/skeletons/item-content-skeleton.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/skeletons/item-content-skeleton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemContentSkeleton } from "@/components/skeletons/item-content-skeleton";

describe("ItemContentSkeleton", () => {
  it("renders skeleton elements", () => {
    render(<ItemContentSkeleton />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(8);
  });

  it("renders hero with viewport-relative height", () => {
    const { container } = render(<ItemContentSkeleton />);
    const hero = container.querySelector("[data-testid='skeleton-hero']");
    expect(hero).toBeTruthy();
    expect(hero?.className).toContain("h-[calc(55vh+var(--header-height))]");
  });

  it("renders tab bar skeleton", () => {
    const { container } = render(<ItemContentSkeleton />);
    const tabBar = container.querySelector(".gap-8");
    expect(tabBar).toBeTruthy();
  });

  it("renders toolbar skeleton with glassmorphism container", () => {
    const { container } = render(<ItemContentSkeleton />);
    const toolbar = container.querySelector(".rounded-xl.bg-white\\/\\[0\\.04\\]");
    expect(toolbar).toBeTruthy();
  });

  it("renders children grid with correct breakpoints", () => {
    const { container } = render(<ItemContentSkeleton />);
    const grid = container.querySelector(".grid-cols-2.md\\:grid-cols-4.lg\\:grid-cols-6");
    expect(grid).toBeTruthy();
    const gridCards = grid!.querySelectorAll('[class*="aspect-"]');
    expect(gridCards.length).toBe(6);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- tests/unit/components/skeletons/item-content-skeleton.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

Create `components/skeletons/item-content-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";

/**
 * Skeleton matching the item detail page layout.
 * Used by loading.tsx and Suspense fallback.
 *
 * IMPORTANT: Hero uses viewport-relative height, tabs use gap-8,
 * grid uses grid-cols-2 md:grid-cols-4 lg:grid-cols-6 (item detail view mode).
 */
export function ItemContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero backdrop — exact match to CinematicHero single-slide item mode */}
      <div
        data-testid="skeleton-hero"
        className="relative h-[calc(55vh+var(--header-height))] w-full overflow-hidden bg-[var(--dark-900)] md:h-[calc(65vh+var(--header-height))]"
      >
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--dark-900) 0%, color-mix(in srgb, var(--dark-900) 70%, transparent) 20%, transparent 55%)",
          }}
          aria-hidden="true"
        />

        {/* Content at bottom — single-slide uses pb-8 md:pb-12 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div className="px-[var(--section-px-mobile)] pb-8 sm:px-[var(--section-px-sm)] md:px-[var(--section-px-md)] md:pb-12 lg:px-[var(--section-px-lg)] xl:px-[var(--section-px-xl)] 2xl:px-[var(--section-px-2xl)]">
            {/* Title / logo placeholder */}
            <Skeleton
              data-testid="skeleton"
              className="h-10 w-64 md:h-14 md:w-96"
            />
            {/* Tagline */}
            <Skeleton
              data-testid="skeleton"
              className="mt-5 h-5 w-80 max-w-full md:w-[28rem]"
            />
            {/* Metadata line */}
            <Skeleton
              data-testid="skeleton"
              className="mt-4 h-4 w-48 md:w-64"
            />
            {/* Action buttons */}
            <div className="mt-6 flex gap-3">
              <Skeleton
                data-testid="skeleton"
                className="h-9 w-24 rounded-full"
              />
              <Skeleton
                data-testid="skeleton"
                className="h-9 w-24 rounded-full"
              />
              <Skeleton
                data-testid="skeleton"
                className="h-9 w-20 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — matches UnderlineTabs: Contents / About */}
      <Section>
        <div className="flex gap-8">
          <Skeleton data-testid="skeleton" className="h-5 w-20 my-4" />
          <Skeleton data-testid="skeleton" className="h-5 w-14 my-4" />
        </div>
      </Section>

      {/* ContentToolbar — glassmorphism container */}
      <Section className="py-4">
        <div className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 bg-white/[0.04] border border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Skeleton data-testid="skeleton" className="h-8 w-20 rounded-md" />
            <Skeleton data-testid="skeleton" className="h-8 w-16 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton data-testid="skeleton" className="size-8 rounded-md" />
            <Skeleton data-testid="skeleton" className="size-8 rounded-md" />
          </div>
        </div>
      </Section>

      {/* Children grid (6 cards) — matches grid-view-content.tsx:201,268 (view mode) */}
      <Section className="py-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              data-testid="skeleton"
              className="aspect-[2/3] w-full rounded-lg"
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test -- tests/unit/components/skeletons/item-content-skeleton.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/skeletons/item-content-skeleton.tsx tests/unit/components/skeletons/item-content-skeleton.test.tsx
git commit -m "feat: add ItemContentSkeleton with exact layout dimensions"
```

---

### Task 4: Playlist Content Skeleton Component

**Files:**
- Create: `components/skeletons/playlist-content-skeleton.tsx`
- Test: `tests/unit/components/skeletons/playlist-content-skeleton.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/skeletons/playlist-content-skeleton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaylistContentSkeleton } from "@/components/skeletons/playlist-content-skeleton";

describe("PlaylistContentSkeleton", () => {
  it("renders skeleton elements", () => {
    render(<PlaylistContentSkeleton />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it("renders hero with viewport-relative height", () => {
    const { container } = render(<PlaylistContentSkeleton />);
    const hero = container.querySelector("[data-testid='skeleton-hero']");
    expect(hero).toBeTruthy();
    expect(hero?.className).toContain("h-[calc(55vh+var(--header-height))]");
  });

  it("renders poster grid (not rows)", () => {
    const { container } = render(<PlaylistContentSkeleton />);
    // Playlist uses poster grid, NOT horizontal rows
    const grid = container.querySelector(".grid-cols-3.md\\:grid-cols-4.lg\\:grid-cols-6");
    expect(grid).toBeTruthy();
    const posters = grid!.querySelectorAll('[class*="aspect-"]');
    expect(posters.length).toBe(6);
  });

  it("renders tab bar with gap-8", () => {
    const { container } = render(<PlaylistContentSkeleton />);
    const tabBar = container.querySelector(".gap-8");
    expect(tabBar).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- tests/unit/components/skeletons/playlist-content-skeleton.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

Create `components/skeletons/playlist-content-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/ui/section";

/**
 * Skeleton matching the playlist detail page layout.
 * Used by loading.tsx and Suspense fallback.
 *
 * IMPORTANT: Playlist items render as a poster GRID (grid-cols-3 md:4 lg:6),
 * NOT as horizontal list rows. See playlist-detail-client.tsx:362.
 */
export function PlaylistContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero mosaic area — exact match to CinematicHero single-slide */}
      <div
        data-testid="skeleton-hero"
        className="relative h-[calc(55vh+var(--header-height))] w-full overflow-hidden bg-[var(--dark-900)] md:h-[calc(65vh+var(--header-height))]"
      >
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--dark-900) 0%, color-mix(in srgb, var(--dark-900) 70%, transparent) 20%, transparent 55%)",
          }}
          aria-hidden="true"
        />

        {/* Content at bottom — single-slide uses pb-8 md:pb-12 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div className="px-[var(--section-px-mobile)] pb-8 sm:px-[var(--section-px-sm)] md:px-[var(--section-px-md)] md:pb-12 lg:px-[var(--section-px-lg)] xl:px-[var(--section-px-xl)] 2xl:px-[var(--section-px-2xl)]">
            {/* Playlist title */}
            <Skeleton
              data-testid="skeleton"
              className="h-10 w-64 md:h-14 md:w-96"
            />
            {/* Description */}
            <Skeleton
              data-testid="skeleton"
              className="mt-3 h-4 w-80 max-w-full md:w-96"
            />
            {/* Action buttons */}
            <div className="mt-6 flex gap-3">
              <Skeleton
                data-testid="skeleton"
                className="h-9 w-20 rounded-full"
              />
              <Skeleton
                data-testid="skeleton"
                className="h-9 w-20 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — matches UnderlineTabs: Contents / About */}
      <Section>
        <div className="flex gap-8">
          <Skeleton data-testid="skeleton" className="h-5 w-20 my-4" />
          <Skeleton data-testid="skeleton" className="h-5 w-14 my-4" />
        </div>
      </Section>

      {/* ContentToolbar */}
      <Section className="py-4">
        <div className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 bg-white/[0.04] border border-white/[0.06]">
          <Skeleton data-testid="skeleton" className="h-8 w-20 rounded-md" />
          <div className="flex items-center gap-2">
            <Skeleton data-testid="skeleton" className="h-8 w-16 rounded-md" />
            <Skeleton data-testid="skeleton" className="size-8 rounded-md" />
          </div>
        </div>
      </Section>

      {/* Poster grid (6 cards) — matches playlist-detail-client.tsx:362 */}
      <Section className="pb-8">
        <div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              data-testid="skeleton"
              className="aspect-[2/3] w-full rounded-lg"
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test -- tests/unit/components/skeletons/playlist-content-skeleton.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/skeletons/playlist-content-skeleton.tsx tests/unit/components/skeletons/playlist-content-skeleton.test.tsx
git commit -m "feat: add PlaylistContentSkeleton with poster grid layout"
```

---

### Task 5: Add loading.tsx to All Four Routes

**Files:**
- Create: `app/(public)/u/[username]/loading.tsx`
- Create: `app/(public)/u/[username]/[itemId]/loading.tsx`
- Create: `app/(public)/u/[username]/playlists/[playlistId]/loading.tsx`
- Create: `app/(public)/explore/loading.tsx`

**Context:** `loading.tsx` replaces `{children}` in the nearest layout. The layout renders the sidebar — it persists. But SiteHeader is rendered by each **page**, not the layout, so loading.tsx must include SiteHeader to avoid a missing header during transitions.

**Limitation:** loading.tsx has no access to route params, so we can't know if the viewer is the owner or a visitor. We use reasonable defaults. The brief title change when the page renders is acceptable — it's far less noticeable than a 700ms frozen page.

**Step 1: Create My Items loading.tsx**

Create `app/(public)/u/[username]/loading.tsx`:

```tsx
import { SiteHeader } from "@/components/site-header";
import { ProfileContentSkeleton } from "@/components/skeletons/profile-content-skeleton";

export default function Loading() {
  return (
    <>
      <SiteHeader title="My Items" />
      <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <ProfileContentSkeleton />
      </div>
    </>
  );
}
```

**Step 2: Create Item Detail loading.tsx**

Create `app/(public)/u/[username]/[itemId]/loading.tsx`:

```tsx
import { SiteHeader } from "@/components/site-header";
import { ItemContentSkeleton } from "@/components/skeletons/item-content-skeleton";

export default function Loading() {
  return (
    <>
      <SiteHeader title="My Items" />
      <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <ItemContentSkeleton />
      </div>
    </>
  );
}
```

**Step 3: Create Playlist Detail loading.tsx**

Create `app/(public)/u/[username]/playlists/[playlistId]/loading.tsx`:

Note: the real playlist page does NOT include `-mt-(--header-height)` on its wrapper — see `playlist-detail-client.tsx` page. Match this.

```tsx
import { SiteHeader } from "@/components/site-header";
import { PlaylistContentSkeleton } from "@/components/skeletons/playlist-content-skeleton";

export default function Loading() {
  return (
    <>
      <SiteHeader title="My Playlists" />
      <div className="bg-background text-foreground flex flex-1 flex-col">
        <PlaylistContentSkeleton />
      </div>
    </>
  );
}
```

**Step 4: Create Explore loading.tsx**

Create `app/(public)/explore/loading.tsx`:

```tsx
import { SiteHeader } from "@/components/site-header";
import { ExploreContentSkeleton } from "@/components/skeletons/explore-content-skeleton";

export default function Loading() {
  return (
    <>
      <SiteHeader title="Explore" titleHref="/explore" />
      <div className="text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <ExploreContentSkeleton />
      </div>
    </>
  );
}
```

**Step 5: Verify build passes**

Run: `pnpm run type-check`
Expected: PASS — no type errors

**Step 6: Commit**

```bash
git add app/(public)/u/\[username\]/loading.tsx app/(public)/u/\[username\]/\[itemId\]/loading.tsx app/(public)/u/\[username\]/playlists/\[playlistId\]/loading.tsx app/(public)/explore/loading.tsx
git commit -m "feat: add route-level loading.tsx with layout-matched skeletons"
```

---

### Task 6: React.cache() Deduplication for Shelf Queries

**Files:**
- Modify: `lib/shelf-query-utils.ts`
- Test: `tests/unit/lib/shelf-query-cache.test.ts`

**Step 1: Write a smoke test**

Create `tests/unit/lib/shelf-query-cache.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

// Mock prisma before importing the module
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([]),
    playlistItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    item: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/tmdb-image-utils", () => ({
  resolveArtworkId: vi.fn().mockReturnValue(null),
}));

describe("getSystemShelfItems cache", () => {
  it("is exported as a function", async () => {
    const { getSystemShelfItems } = await import("@/lib/shelf-query-utils");
    expect(typeof getSystemShelfItems).toBe("function");
  });

  it("returns an array of ShelfItems", async () => {
    const { getSystemShelfItems } = await import("@/lib/shelf-query-utils");
    const result = await getSystemShelfItems("user-1", "RECENTLY_ADDED");
    expect(Array.isArray(result)).toBe(true);
  });
});
```

**Note on deduplication testing:** `React.cache()` only deduplicates within a React server render context, which Vitest does not provide. The deduplication behaviour is verified indirectly by Task 14's TTFB measurement (My Items TTFB should drop ~200-400ms from eliminated duplicate queries). A unit test for deduplication would require mocking React's cache internals, which is fragile and not recommended.

**Step 2: Run test to verify it passes with current code (baseline)**

Run: `pnpm run test -- tests/unit/lib/shelf-query-cache.test.ts`
Expected: PASS

**Step 3: Wrap getSystemShelfItems with React.cache()**

Modify `lib/shelf-query-utils.ts`:

1. Add `import { cache } from "react";` at the top with other imports
2. Rename the existing `export async function getSystemShelfItems(` to `async function _getSystemShelfItems(`
3. Add the cached export below the function:

```ts
/**
 * Dispatches to the correct query function for a system playlist type.
 * Wrapped with React.cache() to deduplicate calls within a single request.
 * Both args are primitives (string, string enum) so Object.is equality works.
 */
export const getSystemShelfItems = cache(_getSystemShelfItems);
```

**Step 4: Run test to verify it still passes**

Run: `pnpm run test -- tests/unit/lib/shelf-query-cache.test.ts`
Expected: PASS

**Step 5: Run full test suite to check for regressions**

Run: `pnpm run test`
Expected: All tests pass (function signature unchanged)

**Step 6: Commit**

```bash
git add lib/shelf-query-utils.ts tests/unit/lib/shelf-query-cache.test.ts
git commit -m "perf: deduplicate shelf queries with React.cache()"
```

---

### Task 7: Stream My Items Page with Suspense

**Files:**
- Modify: `app/(public)/u/[username]/page.tsx`

**Step 1: Restructure the page**

The page currently does all data fetching in the default export. Restructure to:

1. Keep fast work in the page component: `auth()`, `checkRateLimit()`, profile lookup, `isOwner` check
2. Move heavy fetching into a new `ProfileContent` async server component
3. Wrap `ProfileContent` in `<Suspense fallback={<ProfileContentSkeleton />}>`

Add imports:
```tsx
import { ProfileContentSkeleton } from "@/components/skeletons/profile-content-skeleton";
```

The page component's return becomes:

```tsx
return (
  <>
    <script type="application/ld+json" ... />
    {isOwner && (
      <Suspense fallback={null}>
        <OAuthToast />
      </Suspense>
    )}
    <SiteHeader
      title={isOwner ? "My Items" : `@${profile.username}`}
      titleHref={`/u/${profile.username}`}
      driveNeedsReauth={false}
    />
    <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
      <Suspense fallback={<ProfileContentSkeleton />}>
        <ProfileContent
          profileId={profile.id}
          username={profile.username!}
          profileName={profile.name}
          hasImage={"hasImage" in profile ? profile.hasImage : false}
          hasHeroImage={"hasHeroImage" in profile ? profile.hasHeroImage : false}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      </Suspense>
    </div>
  </>
);
```

New `ProfileContent` async server component (defined in same file):

```tsx
async function ProfileContent({
  profileId,
  username,
  profileName,
  hasImage,
  hasHeroImage,
  currentUserId,
  isOwner,
}: {
  profileId: string;
  username: string;
  profileName: string | null;
  hasImage: boolean;
  hasHeroImage: boolean;
  currentUserId: string | null;
  isOwner: boolean;
}) {
  // All heavy data fetching — same logic as before, just moved here
  const profileData = await getItemsForProfile(profileId, currentUserId);

  let hasDriveConnection = false;
  let driveNeedsReauth = false;
  let libraryProgress = null;
  let ownerPlaylists: Awaited<ReturnType<typeof getUserPlaylists>> | null = null;

  if (isOwner) {
    const [driveConnection, progress, playlistsResult] = await Promise.all([
      getGoogleDriveConnection(),
      getLibraryProgress(),
      getUserPlaylists(),
    ]);
    hasDriveConnection = driveConnection !== null && !driveConnection.needsReauth;
    driveNeedsReauth = driveConnection?.needsReauth ?? false;
    libraryProgress = progress;
    ownerPlaylists = playlistsResult;
  }

  let viewerProgress = null;
  let publicPlaylists: Awaited<ReturnType<typeof getPublicPlaylistsForUser>> = [];
  if (!isOwner) {
    [viewerProgress, publicPlaylists] = await Promise.all([
      getPublicLibraryProgress(profileId),
      getPublicPlaylistsForUser(profileId),
    ]);
  }

  return (
    <ProfilePageContent
      profile={{ id: profileId, username, name: profileName, hasImage, hasHeroImage }}
      items={profileData.items}
      isOwner={isOwner}
      hasDriveConnection={hasDriveConnection}
      libraryProgress={libraryProgress}
      viewerProgress={viewerProgress}
      publicPlaylists={publicPlaylists}
      ownerPlaylists={ownerPlaylists?.success ? ownerPlaylists.data : undefined}
      shelves={
        isOwner ? (
          <Suspense fallback={<ShelfSkeleton />}>
            <HomeShelves />
          </Suspense>
        ) : undefined
      }
    />
  );
}
```

**Note:** `driveNeedsReauth` is `false` in the fast shell SiteHeader since drive connection state isn't known yet. The `ProfilePageContent` client component handles the actual drive reauth banner based on the streamed `hasDriveConnection` prop. If the SiteHeader banner is critical, add a separate small Suspense for just the drive check.

**Step 2: Verify type check passes**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Verify unit tests pass**

Run: `pnpm run test`
Expected: All pass — no client component changes

**Step 4: Commit**

```bash
git add app/(public)/u/\[username\]/page.tsx
git commit -m "perf: stream My Items page content via Suspense boundary"
```

---

### Task 8: Stream Explore Page with Suspense

**Files:**
- Modify: `app/(public)/explore/page.tsx`

**Step 1: Restructure the page**

Keep fast work in the page: `auth()` + `getGoogleDriveConnection()` (for SiteHeader drive reauth banner).
Move all heavy fetching into `ExploreContent` async server component.

Add imports:
```tsx
import { Suspense } from "react";
import { ExploreContentSkeleton } from "@/components/skeletons/explore-content-skeleton";
```

The page becomes:

```tsx
export default async function ExplorePage() {
  // Fast shell: auth + drive connection for SiteHeader
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;
  const driveConnection = currentUserId
    ? await getGoogleDriveConnection()
    : null;
  const driveNeedsReauth = driveConnection?.needsReauth ?? false;

  return (
    <>
      <SiteHeader
        title="Explore"
        titleHref="/explore"
        driveNeedsReauth={driveNeedsReauth}
      />
      <div className="text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <Suspense fallback={<ExploreContentSkeleton />}>
          <ExploreContent currentUserId={currentUserId} />
        </Suspense>
      </div>
    </>
  );
}
```

New `ExploreContent` async server component (in same file) contains all the existing heavy fetching logic — the TMDB enrichment chain, `getExploreItems`, `getExplorePlaylists`, `getProfile`, sync data query — and renders `ExploreClient` with the same props as before.

**Step 2: Verify type check passes**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add app/(public)/explore/page.tsx
git commit -m "perf: stream Explore page content via Suspense boundary"
```

---

### Task 9: Stream Item Detail Page with Suspense

**Files:**
- Modify: `app/(public)/u/[username]/[itemId]/page.tsx`

**Step 1: Restructure the page**

This page has two branches: owner mode and viewer mode. The split must handle both.

Add imports:
```tsx
import { Suspense } from "react";
import { ItemContentSkeleton } from "@/components/skeletons/item-content-skeleton";
```

**Fast shell (kept in page component):**
- `auth()`, `params`, `searchParams`
- Profile lookup (owner vs public)
- 404 check
- `isOwner` determination

**Owner branch fast path — keep `getItem(itemId)` in the page:**
`getItem` is a simple PK lookup (~10-20ms) and we need `item.name` + `ancestors` for SiteHeader breadcrumbs and the 404 check. The heavy work (descendants, files, TMDB, progress, watch status) moves to `OwnerItemContent`.

```tsx
if (isOwner) {
  const itemResult = await getItem(itemId);
  if (!itemResult.success || !itemResult.data) notFound();
  const { item, ancestors } = itemResult.data;
  if (item.userId !== profile.id) notFound();

  const breadcrumbs = [...ancestors, { id: item.id, name: item.name }].map(
    (a) => ({ id: a.id, name: a.name, href: `/u/${profile.username}/${a.id}` })
  );

  return (
    <>
      <SiteHeader title="My Items" titleHref={`/u/${profile.username}`} breadcrumbs={breadcrumbs} driveNeedsReauth={false} />
      <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
        <Suspense fallback={<ItemContentSkeleton />}>
          <OwnerItemContent item={item} profile={profile} defaultSettingsOpen={defaultSettingsOpen} />
        </Suspense>
      </div>
    </>
  );
}
```

**`OwnerItemContent` async server component:**

```tsx
async function OwnerItemContent({
  item,
  profile,
  defaultSettingsOpen,
}: {
  item: /* item type from getItem */;
  profile: /* profile type */;
  defaultSettingsOpen: boolean;
}) {
  const tmdbDisplayOptions = extractTmdbDisplayOptions(item);

  const tmdbPromise = resolveTmdbForItem(item.id, item.tmdbId, item.tmdbType).then(
    async (resolved) => {
      if (!resolved) return { metadata: null, details: null };
      const [metadata, details] = await Promise.all([
        getItemTmdbMetadata(resolved.tmdbId, resolved.tmdbType),
        getItemTmdbDetails(resolved.tmdbId, resolved.tmdbType),
      ]);
      return { metadata, details };
    }
  );

  const [childrenResult, filesResult, itemProgress, driveConnection, tmdb, watchStatusResult] =
    await Promise.all([
      getDescendants(item.id),
      getItemFiles(item.id),
      getItemProgress(item.id),
      getGoogleDriveConnection(),
      tmdbPromise,
      getWatchStatus(item.id),
    ]);

  // ... existing result extraction logic (unchanged) ...

  return (
    <ItemDetailClient
      item={{ /* same prop mapping as current code */ }}
      childItems={childItems}
      files={files}
      itemProgress={itemProgress}
      hasDriveConnection={hasDriveConnection}
      currentUser={{ id: profile.id, username: profile.username, name: profile.name }}
      defaultSettingsOpen={defaultSettingsOpen}
      tmdbMetadata={tmdb.metadata}
      tmdbDetails={tmdb.details}
      tmdbDisplayOptions={tmdbDisplayOptions}
      initialWatchStatus={initialWatchStatus}
    />
  );
}
```

**Viewer branch fast path — keep `getPublicItem` + `getPublicBreadcrumb` in the page:**
`getPublicItem` is needed for 404 check. `getPublicBreadcrumb` is needed for SiteHeader breadcrumbs. Both are fast PK lookups. Heavy fetching (children, forks, TMDB, user lookup) moves to `ViewerItemContent`.

```tsx
// Viewer branch
const [rateResult] = await Promise.all([checkRateLimit("publicProfile")]);
if (rateResult) { /* rate limit response */ }

const [item, breadcrumb] = await Promise.all([
  getPublicItem(itemId),
  getPublicBreadcrumb(itemId),
]);
if (!item || item.userId !== profile.id) notFound();

const headerBreadcrumbs = (breadcrumb ?? []).map((crumb) => ({
  id: crumb.id, name: crumb.name, href: `/u/${profile.username}/${crumb.id}`,
}));

return (
  <>
    {/* JSON-LD deferred to ViewerItemContent since it needs TMDB data */}
    <SiteHeader
      title={`@${profile.username}`}
      titleHref={`/u/${profile.username}`}
      breadcrumbs={headerBreadcrumbs}
      driveNeedsReauth={false}
    />
    <div className="bg-background text-foreground -mt-(--header-height) flex flex-1 flex-col">
      <Suspense fallback={<ItemContentSkeleton />}>
        <ViewerItemContent
          item={item}
          profile={profile}
          currentUserId={currentUserId}
        />
      </Suspense>
    </div>
  </>
);
```

**`ViewerItemContent` async server component** does: TMDB chain, `getPublicDescendants`, `getForkInfo`, `getForkStatus`, user lookup, viewer drive connection. Renders `PublicItemClient` with same props as current code.

**Step 2: Verify type check passes**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add app/(public)/u/\[username\]/\[itemId\]/page.tsx
git commit -m "perf: stream Item Detail page content via Suspense boundary"
```

---

### Task 10: Stream Playlist Detail Page with Suspense

**Files:**
- Modify: `app/(public)/u/[username]/playlists/[playlistId]/page.tsx`

**Step 1: Restructure the page**

Keep fast work in the page: `auth()`, `checkRateLimit()`, profile lookup, `isOwner` check.
Move `getPlaylist()` / `getPublicPlaylist()` into async server components.

Add imports:
```tsx
import { Suspense } from "react";
import { PlaylistContentSkeleton } from "@/components/skeletons/playlist-content-skeleton";
```

**Owner branch:**

```tsx
if (isOwner) {
  return (
    <>
      <SiteHeader title="My Playlists" titleHref={`/u/${username}`} />
      <div className="bg-background text-foreground flex flex-1 flex-col">
        <Suspense fallback={<PlaylistContentSkeleton />}>
          <OwnerPlaylistContent playlistId={playlistId} username={username} />
        </Suspense>
      </div>
    </>
  );
}
```

`OwnerPlaylistContent` fetches `getPlaylist(playlistId)`, checks for 404, renders `PlaylistDetailClient` with same props.

**Viewer branch:**

```tsx
return (
  <>
    <SiteHeader title={`@${profile.username}`} titleHref={`/u/${username}`} />
    <div className="bg-background text-foreground flex flex-1 flex-col">
      <Suspense fallback={<PlaylistContentSkeleton />}>
        <ViewerPlaylistContent playlistId={playlistId} username={username} profile={profile} token={token} />
      </Suspense>
    </div>
  </>
);
```

`ViewerPlaylistContent` fetches `getPublicPlaylist(playlistId, token)`, checks for 404, renders JSON-LD + `PlaylistDetailClient` with same props.

**Note:** Playlist SiteHeader does NOT have breadcrumbs with the playlist name in the loading state because we don't know the playlist name yet. This is acceptable — the breadcrumb appears once content streams in (~200-400ms).

**Step 2: Verify type check passes**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add app/(public)/u/\[username\]/playlists/\[playlistId\]/page.tsx
git commit -m "perf: stream Playlist Detail page content via Suspense boundary"
```

---

### Task 11: E2E Test — Page Transition Loading States

**Files:**
- Create: `e2e/journeys/navigation/page-transitions.spec.ts`

**Step 1: Write the E2E spec**

Create `e2e/journeys/navigation/page-transitions.spec.ts`:

```ts
import { test, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

test.describe("Page transition loading states", () => {
  test("shows skeleton when navigating from My Items to Explore", async ({
    page,
    testUser,
    isMobile,
  }) => {
    // Start on My Items — wait for content to fully load
    await page.goto(`/u/${testUser.username}`);
    await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
      timeout: Timeouts.heavy,
    });

    // Navigate via sidebar/mobile nav
    if (isMobile) {
      await page.getByTestId("nav-mobile-explore").click();
    } else {
      const sidebar = page.getByTestId("nav-sidebar");
      await sidebar.getByRole("link", { name: "Explore" }).click();
    }

    // Skeleton should appear almost immediately during navigation
    const skeleton = page.locator('[data-slot="skeleton"]').first();
    await expect(skeleton).toBeVisible({ timeout: 2000 });

    // Content should eventually replace the skeleton
    await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
      timeout: Timeouts.heavy,
    });
  });

  test("shows skeleton when navigating from Explore to My Items", async ({
    page,
    testUser,
    isMobile,
  }) => {
    // Start on Explore
    await page.goto("/explore");
    await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
      timeout: Timeouts.heavy,
    });

    // Navigate to My Items
    if (isMobile) {
      await page.getByTestId("nav-mobile-my-items").click();
    } else {
      const sidebar = page.getByTestId("nav-sidebar");
      await sidebar.getByRole("link", { name: "My Items" }).click();
    }

    // Skeleton visible during transition
    const skeleton = page.locator('[data-slot="skeleton"]').first();
    await expect(skeleton).toBeVisible({ timeout: 2000 });

    // Profile content loads
    await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
      timeout: Timeouts.heavy,
    });
  });

  test("skeleton hero height matches content hero height (no CLS)", async ({
    page,
    testUser,
  }) => {
    // Navigate to trigger loading state
    await page.goto("/explore");
    await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
      timeout: Timeouts.heavy,
    });

    // Capture content hero height
    const contentHeroHeight = await page
      .locator("[data-testid='hero-carousel']")
      .boundingBox();

    // Navigate to My Items to trigger skeleton
    const sidebar = page.getByTestId("nav-sidebar");
    await sidebar.getByRole("link", { name: "My Items" }).click();

    // Wait for skeleton hero to appear
    const skeletonHero = page.locator("[data-testid='skeleton-hero']");
    await expect(skeletonHero).toBeVisible({ timeout: 2000 });

    // Capture skeleton hero height
    const skeletonHeroHeight = await skeletonHero.boundingBox();

    // Heights should be within 5% (viewport-relative heights may differ slightly
    // between explore multi-slide padding and profile single-slide padding)
    if (contentHeroHeight && skeletonHeroHeight) {
      const heightDiff = Math.abs(
        contentHeroHeight.height - skeletonHeroHeight.height
      );
      const tolerance = contentHeroHeight.height * 0.1;
      expect(heightDiff).toBeLessThan(tolerance);
    }
  });
});
```

**Step 2: Run the E2E test**

Run: `pnpm run test:e2e -- --grep "Page transition"`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/journeys/navigation/page-transitions.spec.ts
git commit -m "test: add E2E tests for page transition loading states and CLS"
```

---

### Task 12: Update Existing E2E Wait Strategies

**Files:**
- Audit and modify: E2E specs that navigate to the four streamed routes

**Step 1: Audit affected specs**

Search for specs that navigate to `/u/`, `/explore`, or playlist routes and assert on content that now streams via Suspense. Key files to check:

- `e2e/journeys/items/cinematic-hero.spec.ts` — asserts hero element
- `e2e/journeys/public/explore.spec.ts` — asserts grid content
- `e2e/journeys/public/explore-features.spec.ts` — similar
- `e2e/journeys/playlists/playlist-crud.spec.ts` — asserts playlist content

**Step 2: Update wait patterns**

Replace immediate content assertions with waits for specific streamed elements. Avoid `waitForLoadState("networkidle")` — it's unreliable with Suspense streaming.

Pattern:
```ts
// Before
await page.goto(url);
// Immediately asserts content that now streams

// After
await page.goto(url);
// Wait for streamed content to arrive
await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
  timeout: Timeouts.heavy,
});
// Then assert content
```

For specs that use POMs with `goto` methods, update the POM methods to include appropriate waits.

**Step 3: Run full E2E suite to verify**

Run: `pnpm run test:e2e`
Expected: All pass

**Step 4: Commit**

```bash
git add e2e/
git commit -m "test: update E2E wait strategies for streamed page content"
```

---

### Task 13: Full Quality Gate

**Step 1: Run format**

Run: `pnpm run format`

**Step 2: Run lint**

Run: `pnpm run lint`

**Step 3: Run type check**

Run: `pnpm run type-check`

**Step 4: Run knip**

Run: `pnpm run knip`

**Step 5: Run unit tests**

Run: `pnpm run test`

**Step 6: Run build**

Run: `pnpm run build`

**Step 7: Fix any issues and commit**

```bash
git add -A
git commit -m "chore: fix lint and formatting issues"
```

---

### Task 14: Verify Performance Improvement

**Step 1: Start production server**

```bash
pnpm run build && npx next start -p 3001
```

**Step 2: Measure TTFB (shell should be ~50ms, down from 700ms+)**

```bash
curl -s -o /dev/null -w "My Items TTFB: %{time_starttransfer}s\n" http://localhost:3001/u/demo
curl -s -o /dev/null -w "Explore TTFB: %{time_starttransfer}s\n" http://localhost:3001/explore
curl -s -o /dev/null -w "Item Detail TTFB: %{time_starttransfer}s\n" http://localhost:3001/u/demo/some-item-id
```

**Step 3: Visual verification with Playwright**

Use Playwright MCP to navigate between pages via sidebar and confirm:
- Skeletons appear immediately on click (within ~50ms)
- Content replaces skeletons within ~1s
- No visible layout shift during skeleton → content transition
- Hero heights match between skeleton and content
- Grid column counts match between skeleton and content

**Step 4: Verify React.cache dedup (My Items TTFB)**

My Items TTFB should be ~200-400ms faster than before React.cache wrapping. Compare Task 14 measurement against the baseline from investigation (695ms).

**Step 5: Kill production server**

```bash
lsof -ti:3001 | xargs kill
```
