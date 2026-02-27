# Page Load Performance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate perceived navigation lag by adding route-level loading skeletons, streaming page content via Suspense, and deduplicating shelf queries.

**Architecture:** Four routes get `loading.tsx` files with layout-matched skeletons. Each page is restructured to render a fast shell (SiteHeader) immediately, then stream heavy content via new async server components wrapped in Suspense. `getSystemShelfItems` gains `React.cache()` deduplication.

**Tech Stack:** Next.js 16 App Router, React 19 Suspense, React.cache(), Skeleton component (existing), Vitest, Playwright

**Design doc:** `docs/plans/2026-02-27-page-load-performance-design.md`

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
    // Hero avatar + name + username + stats + toolbar buttons + 8 grid cards + shelf skeletons
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it("renders hero area with avatar skeleton", () => {
    const { container } = render(<ProfileContentSkeleton />);
    // Round avatar skeleton (96px)
    const avatar = container.querySelector(".rounded-full");
    expect(avatar).toBeTruthy();
  });

  it("renders poster grid skeletons", () => {
    const { container } = render(<ProfileContentSkeleton />);
    // 8 poster cards with aspect-[2/3]
    const posters = container.querySelectorAll('[class*="aspect-"]');
    expect(posters.length).toBeGreaterThanOrEqual(8);
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
 */
export function ProfileContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero area */}
      <div className="relative flex min-h-[280px] items-end pb-8 md:min-h-[340px]">
        <Section className="flex items-center gap-6">
          {/* Avatar */}
          <Skeleton data-testid="skeleton" className="size-24 shrink-0 rounded-full" />
          <div className="space-y-2">
            {/* Name */}
            <Skeleton data-testid="skeleton" className="h-6 w-48" />
            {/* Username */}
            <Skeleton data-testid="skeleton" className="h-4 w-24" />
            {/* Stats */}
            <Skeleton data-testid="skeleton" className="h-4 w-64" />
          </div>
        </Section>
      </div>

      {/* Tabs */}
      <Section className="border-b border-white/[0.06] pb-0">
        <div className="flex gap-6">
          <Skeleton data-testid="skeleton" className="h-8 w-16" />
          <Skeleton data-testid="skeleton" className="h-8 w-20" />
        </div>
      </Section>

      {/* Content toolbar */}
      <Section className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton data-testid="skeleton" className="h-8 w-28 rounded-md" />
            <Skeleton data-testid="skeleton" className="h-8 w-16 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton data-testid="skeleton" className="h-8 w-14 rounded-md" />
            <Skeleton data-testid="skeleton" className="h-8 w-14 rounded-md" />
            <Skeleton data-testid="skeleton" className="h-8 w-14 rounded-md" />
          </div>
        </div>
      </Section>

      {/* Poster grid (8 cards) */}
      <Section className="pb-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              data-testid="skeleton"
              className="aspect-[2/3] w-full rounded-lg"
            />
          ))}
        </div>
      </Section>

      {/* Shelf skeletons */}
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
git commit -m "feat: add ProfileContentSkeleton component with tests"
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

  it("renders hero carousel area", () => {
    const { container } = render(<ExploreContentSkeleton />);
    // 21:9 aspect hero area
    const hero = container.querySelector('[class*="aspect-"]');
    expect(hero).toBeTruthy();
  });

  it("renders tab bar skeletons", () => {
    render(<ExploreContentSkeleton />);
    const skeletons = screen.getAllByTestId("skeleton");
    // Should include tab-width skeletons
    const tabSkeletons = skeletons.filter((el) =>
      el.className.includes("w-24") || el.className.includes("w-20")
    );
    expect(tabSkeletons.length).toBeGreaterThanOrEqual(2);
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
 */
export function ExploreContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero carousel area */}
      <Skeleton
        data-testid="skeleton"
        className="aspect-[21/9] w-full"
      />

      {/* Tab bar */}
      <Section className="border-b border-white/[0.06] py-3">
        <div className="flex gap-6">
          <Skeleton data-testid="skeleton" className="h-8 w-24" />
          <Skeleton data-testid="skeleton" className="h-8 w-20" />
        </div>
      </Section>

      {/* Content toolbar */}
      <Section className="py-4">
        <div className="flex items-center justify-between">
          <Skeleton data-testid="skeleton" className="h-8 w-28 rounded-md" />
          <Skeleton data-testid="skeleton" className="h-8 w-20 rounded-md" />
        </div>
      </Section>

      {/* Poster grid (12 cards) */}
      <Section className="pb-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
git commit -m "feat: add ExploreContentSkeleton component with tests"
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
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it("renders hero backdrop area", () => {
    const { container } = render(<ItemContentSkeleton />);
    const hero = container.querySelector('[class*="min-h-"]');
    expect(hero).toBeTruthy();
  });

  it("renders children grid skeletons", () => {
    render(<ItemContentSkeleton />);
    const skeletons = screen.getAllByTestId("skeleton");
    const gridCards = skeletons.filter((el) =>
      el.className.includes("aspect-")
    );
    expect(gridCards.length).toBeGreaterThanOrEqual(6);
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
 */
export function ItemContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero backdrop */}
      <div className="relative min-h-[340px] md:min-h-[440px]">
        <Skeleton data-testid="skeleton" className="absolute inset-0" />
        {/* Overlaid title area */}
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
          <Section className="space-y-3">
            {/* Logo / title */}
            <Skeleton data-testid="skeleton" className="h-10 w-64" />
            {/* Tagline */}
            <Skeleton data-testid="skeleton" className="h-4 w-96 max-w-full" />
            {/* Metadata line */}
            <Skeleton data-testid="skeleton" className="h-4 w-48" />
            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Skeleton data-testid="skeleton" className="h-9 w-24 rounded-full" />
              <Skeleton data-testid="skeleton" className="h-9 w-24 rounded-full" />
            </div>
          </Section>
        </div>
      </div>

      {/* Description */}
      <Section className="py-6">
        <div className="space-y-2">
          <Skeleton data-testid="skeleton" className="h-4 w-full" />
          <Skeleton data-testid="skeleton" className="h-4 w-3/4" />
          <Skeleton data-testid="skeleton" className="h-4 w-1/2" />
        </div>
      </Section>

      {/* Children grid (6 cards) */}
      <Section className="pb-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
git commit -m "feat: add ItemContentSkeleton component with tests"
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

  it("renders item row skeletons", () => {
    render(<PlaylistContentSkeleton />);
    const skeletons = screen.getAllByTestId("skeleton");
    // 6 item rows
    const rows = skeletons.filter((el) => el.className.includes("h-16"));
    expect(rows.length).toBeGreaterThanOrEqual(6);
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
 */
export function PlaylistContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero mosaic area */}
      <div className="relative min-h-[280px] md:min-h-[340px]">
        <Skeleton data-testid="skeleton" className="absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
          <Section className="space-y-2">
            {/* Playlist title */}
            <Skeleton data-testid="skeleton" className="h-8 w-56" />
            {/* Description */}
            <Skeleton data-testid="skeleton" className="h-4 w-80 max-w-full" />
            {/* Item count */}
            <Skeleton data-testid="skeleton" className="h-4 w-24" />
          </Section>
        </div>
      </div>

      {/* Item list (6 rows) */}
      <Section className="space-y-3 py-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            data-testid="skeleton"
            className="h-16 w-full rounded-lg"
          />
        ))}
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
git commit -m "feat: add PlaylistContentSkeleton component with tests"
```

---

### Task 5: Add loading.tsx to All Four Routes

**Files:**
- Create: `app/(public)/u/[username]/loading.tsx`
- Create: `app/(public)/u/[username]/[itemId]/loading.tsx`
- Create: `app/(public)/u/[username]/playlists/[playlistId]/loading.tsx`
- Create: `app/(public)/explore/loading.tsx`

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

**Step 1: Write the failing test**

Create `tests/unit/lib/shelf-query-cache.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

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
  beforeEach(() => {
    vi.resetModules();
  });

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

**Step 2: Run test to verify it passes with current code**

Run: `pnpm run test -- tests/unit/lib/shelf-query-cache.test.ts`
Expected: PASS (baseline — existing function works)

**Step 3: Wrap getSystemShelfItems with React.cache()**

Modify `lib/shelf-query-utils.ts`. Change the existing export:

```ts
// Before (line 18):
export async function getSystemShelfItems(

// After:
import { cache } from "react";

// ... keep the private implementation
async function _getSystemShelfItems(
  userId: string,
  systemType: SystemPlaylistType
): Promise<ShelfItem[]> {
  // existing switch body unchanged
}

/**
 * Dispatches to the correct query function for a system playlist type.
 * Wrapped with React.cache() to deduplicate calls within a single request.
 */
export const getSystemShelfItems = cache(_getSystemShelfItems);
```

The import of `cache` from `"react"` goes at the top with other imports. Rename the existing function to `_getSystemShelfItems` (private) and export the cached wrapper.

**Step 4: Run test to verify it still passes**

Run: `pnpm run test -- tests/unit/lib/shelf-query-cache.test.ts`
Expected: PASS

**Step 5: Run full test suite to check for regressions**

Run: `pnpm run test`
Expected: All tests pass (the function signature is unchanged)

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

The page currently does all data fetching in the default export, then renders `ProfilePageContent`. Restructure to:

1. Keep fast work in the page component: `auth()`, `checkRateLimit()`, profile lookup
2. Move heavy fetching into a new `ProfileContent` async server component
3. Wrap `ProfileContent` in `<Suspense fallback={<ProfileContentSkeleton />}>`

Modify `app/(public)/u/[username]/page.tsx`:

- Add import: `import { ProfileContentSkeleton } from "@/components/skeletons/profile-content-skeleton";`
- Keep everything through line 107 (auth, rate limit, profile lookup, `isOwner` check) in the page component
- Extract lines 109–131 (all the heavy fetching: `getItemsForProfile`, `getGoogleDriveConnection`, `getLibraryProgress`, `getUserPlaylists`, viewer queries) into a new async function `ProfileContent` defined in the same file
- The page component renders:

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

The new `ProfileContent` async server component does all the heavy work and renders `ProfilePageContent`:

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
      profile={{
        id: profileId,
        username,
        name: profileName,
        hasImage,
        hasHeroImage,
      }}
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

Note: `driveNeedsReauth` on SiteHeader is set to `false` in the fast shell since we don't know the Drive connection status yet. The actual banner will appear when `ProfileContent` streams in (it passes the real value to `ProfilePageContent`, which can render the banner client-side if needed). Alternatively, keep a separate small Suspense for the Drive reauth check if the banner must appear in the header.

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

Keep fast work in the page: `auth()` (for SiteHeader context).
Move all heavy fetching into `ExploreContent` async server component.

The page becomes:

```tsx
export default async function ExplorePage() {
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

The `ExploreContent` async server component contains all the existing heavy fetching logic (lines 50–121 from the current file) and renders `ExploreClient`.

Add imports:
```tsx
import { Suspense } from "react";
import { ExploreContentSkeleton } from "@/components/skeletons/explore-content-skeleton";
```

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

This page has two branches: owner mode and viewer mode. Split both:

1. Keep auth + profile lookup + item existence check in the page
2. Owner branch: move heavy fetching (descendants, files, progress, TMDB, watch status) into `ItemContent` async server component
3. Viewer branch: move heavy fetching into `PublicItemContent` async server component
4. Both wrapped in `<Suspense fallback={<ItemContentSkeleton />}>`

Add imports:
```tsx
import { Suspense } from "react";
import { ItemContentSkeleton } from "@/components/skeletons/item-content-skeleton";
```

The page renders SiteHeader immediately with breadcrumbs (item name is available from the fast `getItem` call already needed for the 404 check), then streams the heavy content.

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

Keep auth + profile in the page. Move `getPlaylist` / `getPublicPlaylist` into `PlaylistContent` / `PublicPlaylistContent` async server components.

Add imports:
```tsx
import { Suspense } from "react";
import { PlaylistContentSkeleton } from "@/components/skeletons/playlist-content-skeleton";
```

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
  test("shows skeleton when navigating from My Items to Explore via sidebar", async ({
    page,
    testUser,
    isMobile,
  }) => {
    // Start on My Items
    await page.goto(`/u/${testUser.username}`);
    await page.waitForLoadState("networkidle");

    if (isMobile) {
      // Mobile uses footer nav
      await page.getByTestId("nav-mobile-explore").click();
    } else {
      // Desktop uses sidebar
      const sidebar = page.getByTestId("nav-sidebar");
      await sidebar.getByRole("link", { name: "Explore" }).click();
    }

    // Skeleton should appear during navigation
    // Use a short timeout — skeletons should appear almost instantly
    const skeleton = page.locator('[data-slot="skeleton"]').first();
    await expect(skeleton).toBeVisible({ timeout: Timeouts.navigation });

    // Content should eventually replace the skeleton
    await page.waitForLoadState("networkidle", {
      timeout: Timeouts.heavy,
    });
  });

  test("shows skeleton when navigating from Explore to My Items via sidebar", async ({
    page,
    testUser,
    isMobile,
  }) => {
    // Start on Explore
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");

    if (isMobile) {
      await page.getByTestId("nav-mobile-my-items").click();
    } else {
      const sidebar = page.getByTestId("nav-sidebar");
      await sidebar.getByRole("link", { name: "My Items" }).click();
    }

    const skeleton = page.locator('[data-slot="skeleton"]').first();
    await expect(skeleton).toBeVisible({ timeout: Timeouts.navigation });

    await page.waitForLoadState("networkidle", {
      timeout: Timeouts.heavy,
    });
  });
});
```

**Step 2: Run the E2E test**

Run: `pnpm run test:e2e -- --grep "Page transition"`
Expected: Tests pass (skeletons are visible during navigation)

Note: If E2E infrastructure is not set up locally, this test can be verified in CI. The test is intentionally simple — it checks that skeletons appear, not exact timing.

**Step 3: Commit**

```bash
git add e2e/journeys/navigation/page-transitions.spec.ts
git commit -m "test: add E2E tests for page transition loading states"
```

---

### Task 12: Update Existing E2E Wait Strategies

**Files:**
- Audit and modify: E2E specs that navigate to the four streamed routes

**Step 1: Audit affected specs**

Search for specs that navigate to `/u/`, `/explore`, or playlist routes and immediately assert on content. Key files to check:

- `e2e/journeys/items/cinematic-hero.spec.ts` — navigates to item detail, asserts hero
- `e2e/journeys/public/explore.spec.ts` — navigates to explore, asserts grid
- `e2e/journeys/public/explore-features.spec.ts` — similar
- `e2e/journeys/playlists/playlist-crud.spec.ts` — navigates to playlist detail

**Step 2: Update wait patterns**

For each affected spec, replace `waitForLoadState('domcontentloaded')` with waiting for specific content elements. For example:

```ts
// Before
await page.goto(url);
// Immediately asserts content

// After
await page.goto(url);
await page.waitForLoadState("networkidle", { timeout: Timeouts.heavy });
// Then asserts content
```

Or better, wait for a specific element that only appears after streaming:

```ts
await page.goto(`/u/${username}`);
// Wait for the profile content to stream in
await expect(page.getByRole("heading", { name: "Library" })).toBeVisible({
  timeout: Timeouts.api,
});
```

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

**Step 2: Measure TTFB**

```bash
# Shell TTFB (should be ~50ms now, down from 700ms+)
curl -s -o /dev/null -w "My Items TTFB: %{time_starttransfer}s\n" http://localhost:3001/u/demo
curl -s -o /dev/null -w "Explore TTFB: %{time_starttransfer}s\n" http://localhost:3001/explore
```

**Step 3: Visual verification with Playwright**

Use Playwright MCP to navigate between pages via sidebar and confirm:
- Skeletons appear immediately on click
- Content replaces skeletons within ~1s
- No layout shift during transition

**Step 4: Kill production server**

```bash
lsof -ti:3001 | xargs kill
```
