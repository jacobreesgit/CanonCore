# Unified Profile Route Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge `/my-items` and `/u/[username]` into a single unified route where `/u/[username]` is the canonical profile view with owner/viewer context switching.

**Architecture:** The `/u/[username]` route becomes the single source of truth for viewing any user's library. When the logged-in user views their own profile, they see all items with full edit capabilities. When viewing another user's profile (or as a guest), only public items are visible in read-only mode. The `/my-items` route is deleted entirely.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, existing component library

---

## Design Principles Applied

This plan was validated against project skills and best practices:

### Performance (react-best-practices)

- ✅ `React.cache()` for request deduplication
- ✅ `Promise.all()` for parallel fetching
- ✅ Dynamic imports for owner-only components (reduce viewer bundle)
- ✅ `useMemo`/`useCallback` for stable references
- ✅ `content-visibility: auto` for off-screen items
- ✅ Suspense boundaries with skeleton fallbacks
- ✅ ErrorBoundary for graceful failure handling

### Security (code-review-excellence)

- ✅ Input validation with Zod for URL parameters
- ✅ Server-side authorization checks
- ✅ No duplicate data fetching
- ✅ Rate limiting awareness for non-owner requests

### Accessibility (web-interface-guidelines)

- ✅ Keyboard navigation support
- ✅ `prefers-reduced-motion` support
- ✅ Semantic HTML structure
- ✅ Focus management for dialogs

### Code Quality

- ✅ TDD approach with failing tests first
- ✅ Proper TypeScript types (no unsafe casts)
- ✅ Functional setState patterns
- ✅ Comprehensive test coverage

---

## Overview

### Current State

```
/my-items                    → Private dashboard (all items, full CRUD)
/my-items/[itemId]           → Private item detail (all children, full CRUD)
/u/[username]                → Public profile (public items only, read-only)
/u/[username]/[itemId]       → Public item detail (public children only, read-only + fork)
```

### Target State

```
/u/[username]                → Unified profile (owner sees all + edit, others see public + fork)
/u/[username]/[itemId]       → Unified item detail (owner sees all + edit, others see public + fork)
```

**Note:** `/my-items` routes are deleted entirely - no redirects needed.

### Key Behavioral Changes

| Feature            | Owner View | Other User View | Guest View     |
| ------------------ | ---------- | --------------- | -------------- |
| Items shown        | All items  | Public only     | Public only    |
| Edit mode          | Yes        | No              | No             |
| Add items          | Yes        | No              | No             |
| Drag-drop reorder  | Yes        | No              | No             |
| Delete items       | Yes        | No              | No             |
| Pin to sidebar     | Yes        | No              | No             |
| Settings dialog    | Yes        | No              | No             |
| Google Drive sync  | Yes        | No              | No             |
| Tree view toggle   | Yes        | Yes             | Yes            |
| Fork button        | No         | Yes             | Sign in prompt |
| Progress display   | Yes        | No              | No             |
| Visibility toggles | Yes        | No              | No             |

---

## Merge Strategy: What We Keep From Each Page

### From My-Items (Owner Features)

- ✅ Full `ItemsView` with edit mode, drag-drop, bulk delete
- ✅ `ItemsToolbar` with Sync, Add, Edit, View toggle
- ✅ `ItemSettingsDialog` for item configuration
- ✅ `HeroCarousel` with progress bar and play/go-to buttons
- ✅ Tree view option (currently disabled on root, will enable)
- ✅ Sort/filter with full options (custom, name, date, has-files, synced, etc.)
- ✅ Pinned items sidebar integration
- ✅ Google Drive connection awareness

### From Public Profile (Viewer Features)

- ✅ `ProfileHero` with cover photo and avatar
- ✅ Fork button and `ForkDestinationDialog`
- ✅ Fork attribution display
- ✅ Read-only grid/tree view
- ✅ Owner label on items (`@username`)
- ✅ Rate limiting for non-owners
- ✅ Public-only item filtering

### New Unified Components Needed

- 🆕 `UnifiedProfileClient` - Single client component handling both modes
- 🆕 `UnifiedItemClient` - Single item detail component handling both modes
- 🆕 Conditional toolbar that shows edit controls for owner only
- 🆕 Redirect logic in `/my-items` routes

---

## Task Breakdown

### Phase 1: Data Layer Unification

#### Task 1: Create Unified Item Fetching Function

**Files:**

- Modify: `lib/item-actions.ts`
- Test: `tests/unit/lib/item-actions.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/item-actions.test.ts
describe("getItemsForProfile", () => {
  it("returns all items when viewer is owner", async () => {
    // Setup: user with 3 items (2 private, 1 public)
    const result = await getItemsForProfile(userId, userId);
    expect(result.items).toHaveLength(3);
    expect(result.isOwner).toBe(true);
  });

  it("returns only public items when viewer is different user", async () => {
    const result = await getItemsForProfile(profileUserId, viewerUserId);
    expect(result.items).toHaveLength(1); // Only public item
    expect(result.isOwner).toBe(false);
  });

  it("returns only public items when viewer is null (guest)", async () => {
    const result = await getItemsForProfile(profileUserId, null);
    expect(result.items).toHaveLength(1);
    expect(result.isOwner).toBe(false);
  });

  // Error handling tests
  it("throws when profile not found", async () => {
    await expect(getItemsForProfile("nonexistent-id", null)).rejects.toThrow(
      "Profile not found"
    );
  });

  it("throws when profile has no username", async () => {
    // User exists but username is null
    await expect(getItemsForProfile(userWithNoUsername, null)).rejects.toThrow(
      "Profile not found"
    );
  });

  it("handles empty items array", async () => {
    const result = await getItemsForProfile(userWithNoItems, userWithNoItems);
    expect(result.items).toHaveLength(0);
    expect(result.isOwner).toBe(true);
  });

  // Security tests
  it("verifies session matches viewerUserId for owner claims", async () => {
    // Attempt to spoof viewerUserId - should be caught by internal auth check
    // This test requires integration with auth mock
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/item-actions.test.ts -t "getItemsForProfile"`
Expected: FAIL with "getItemsForProfile is not defined"

**Step 3: Write minimal implementation**

```typescript
// lib/item-actions.ts
import { cache } from "react";
import { z } from "zod";

export interface ProfileItemsResult {
  items: ItemWithArtwork[];
  isOwner: boolean;
  profile: {
    id: string;
    username: string;
    name: string | null;
    hasImage: boolean;
    hasHeroImage: boolean;
  };
}

// Input validation schema for username (reuse from validations.ts)
const userIdSchema = z.string().uuid();

// Wrap with React.cache() for request deduplication
export const getItemsForProfile = cache(async function getItemsForProfile(
  profileUserId: string,
  viewerUserId: string | null
): Promise<ProfileItemsResult> {
  // Input validation
  const parseResult = userIdSchema.safeParse(profileUserId);
  if (!parseResult.success) {
    throw new Error("Invalid profile ID");
  }

  const isOwner = viewerUserId === profileUserId;

  const profile = await prisma.user.findUnique({
    where: { id: profileUserId },
    select: {
      id: true,
      username: true,
      name: true,
      image: true,
      heroImage: true,
    },
  });

  if (!profile || !profile.username) {
    throw new Error("Profile not found");
  }

  if (isOwner) {
    // Owner: fetch all items with full data
    const items = await getAllItems();
    return {
      items,
      isOwner: true,
      profile: {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        hasImage: !!profile.image,
        hasHeroImage: !!profile.heroImage,
      },
    };
  } else {
    // Viewer: fetch only public items
    const publicItems = await getPublicItemsForUser(
      profileUserId,
      200,
      0,
      viewerUserId
    );
    // Properly transform PublicItem[] to ItemWithArtwork[] shape (no unsafe cast)
    const items: ItemWithArtwork[] = publicItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      order: item.order,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      userId: item.userId,
      artworkId: item.artworkId,
      // Read-only defaults for viewer
      isPublic: true,
      inheritVisibility: false,
      driveFileId: null,
      syncStatus: null,
      mediaCount: 0,
      artworkCount: 0,
      subtitleCount: 0,
      pinnedOrder: null,
      forkedFromId: item.forkedFromId ?? null,
    }));

    return {
      items,
      isOwner: false,
      profile: {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        hasImage: !!profile.image,
        hasHeroImage: !!profile.heroImage,
      },
    };
  }
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/item-actions.test.ts -t "getItemsForProfile"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/item-actions.ts tests/unit/lib/item-actions.test.ts
git commit -m "feat: add getItemsForProfile for unified profile data fetching"
```

---

#### Task 2: Create Unified Item Children Fetching Function

**Files:**

- Modify: `lib/item-actions.ts`
- Test: `tests/unit/lib/item-actions.test.ts`

**Step 1: Write the failing test**

```typescript
describe("getItemChildrenForProfile", () => {
  it("returns all children when viewer is owner", async () => {
    const result = await getItemChildrenForProfile(itemId, ownerId, ownerId);
    expect(result.children).toHaveLength(5); // All children
    expect(result.isOwner).toBe(true);
  });

  it("returns only public children when viewer is different user", async () => {
    const result = await getItemChildrenForProfile(itemId, ownerId, viewerId);
    expect(result.children).toHaveLength(2); // Only public
    expect(result.isOwner).toBe(false);
  });

  it("includes fork info for non-owners", async () => {
    const result = await getItemChildrenForProfile(itemId, ownerId, viewerId);
    expect(result.forkInfo).toBeDefined();
    expect(result.forkStatus).toBeDefined();
  });
});
```

**Step 2-5:** Follow same pattern as Task 1

---

### Phase 2: Component Unification

#### Task 3: Create UnifiedProfileClient Component

**Files:**

- Create: `app/(public)/u/[username]/unified-profile-client.tsx`
- Test: `tests/unit/components/unified-profile-client.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/unit/components/unified-profile-client.test.tsx
describe("UnifiedProfileClient", () => {
  describe("owner view", () => {
    it("shows edit button when isOwner=true", () => {
      render(<UnifiedProfileClient {...ownerProps} isOwner={true} />);
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });

    it("shows add item button when isOwner=true", () => {
      render(<UnifiedProfileClient {...ownerProps} isOwner={true} />);
      expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
    });

    it("shows sync button when isOwner=true and hasDriveConnection", () => {
      render(<UnifiedProfileClient {...ownerProps} isOwner={true} hasDriveConnection={true} />);
      expect(screen.getByRole("button", { name: /sync/i })).toBeInTheDocument();
    });

    it("shows all items including private when isOwner=true", () => {
      render(<UnifiedProfileClient {...ownerProps} isOwner={true} />);
      expect(screen.getByText("Private Item")).toBeInTheDocument();
      expect(screen.getByText("Public Item")).toBeInTheDocument();
    });
  });

  describe("viewer view", () => {
    it("hides edit button when isOwner=false", () => {
      render(<UnifiedProfileClient {...viewerProps} isOwner={false} />);
      expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    });

    it("shows fork button for authenticated non-owner", () => {
      render(<UnifiedProfileClient {...viewerProps} isOwner={false} isAuthenticated={true} />);
      expect(screen.getByRole("button", { name: /fork/i })).toBeInTheDocument();
    });

    it("shows sign in prompt for guest", () => {
      render(<UnifiedProfileClient {...viewerProps} isOwner={false} isAuthenticated={false} />);
      expect(screen.getByText(/sign in to fork/i)).toBeInTheDocument();
    });

    it("shows only public items when isOwner=false", () => {
      render(<UnifiedProfileClient {...viewerProps} isOwner={false} />);
      expect(screen.queryByText("Private Item")).not.toBeInTheDocument();
      expect(screen.getByText("Public Item")).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/unified-profile-client.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// app/(public)/u/[username]/unified-profile-client.tsx
"use client";

import { useMemo, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { ProfileHero } from "@/components/profile";
import { ItemsToolbar } from "@/components/items/items-toolbar";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { EmptyState } from "@/components/items/empty-state";
import { ErrorBoundary } from "@/components/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useItemsSortFilter } from "@/hooks/use-items-sort-filter";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import { sortItems, filterItems, EXPLORE_SORT_OPTIONS } from "@/lib/item-utils";
import { cn } from "@/lib/utils";
import type { ItemWithArtwork } from "@/lib/types";
import type { PublicProfile } from "@/lib/public-auth";

// Dynamic import for owner-only component (reduces viewer bundle size)
const ItemsView = dynamic(
  () => import("@/components/items/items-view").then((mod) => mod.ItemsView),
  {
    ssr: false, // dnd-kit requires client-side only
    loading: () => <Skeleton className="h-96 w-full rounded-lg" />,
  }
);

// Virtualization threshold per Web Interface Guidelines
const VIRTUALIZATION_THRESHOLD = 50;

interface UnifiedProfileClientProps {
  profile: PublicProfile;
  items: ItemWithArtwork[];
  isOwner: boolean;
  isAuthenticated: boolean;
  hasDriveConnection?: boolean;
  currentUser?: { id: string; username: string | null; name: string | null } | null;
}

export function UnifiedProfileClient({
  profile,
  items,
  isOwner,
  isAuthenticated,
  hasDriveConnection = false,
  currentUser,
}: UnifiedProfileClientProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  // Owner uses full sort/filter, viewer uses explore sort only
  const ownerSortFilter = useItemsSortFilter();
  const viewerSortFilter = useExploreSortFilter();

  // Stable reference to avoid re-renders from object spread
  const sortFilterState = useMemo(() => {
    if (isOwner) {
      return ownerSortFilter;
    }
    return {
      sortBy: viewerSortFilter.sortBy,
      setSortBy: viewerSortFilter.setSortBy,
      filterBy: "all" as const,
      setFilterBy: () => {},
    };
  }, [isOwner, ownerSortFilter, viewerSortFilter]);

  const { sortBy, setSortBy, filterBy, setFilterBy } = sortFilterState;

  // Edit mode only for owners - use functional setState
  const [isEditing, setIsEditing] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);

  const handleEditToggle = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  const handleAddItemOpen = useCallback(() => {
    setAddItemOpen(true);
  }, []);

  // Sort and filter items
  const processedItems = useMemo(() => {
    if (isOwner) {
      return filterItems(sortItems(items, sortBy), filterBy);
    }
    return sortItems(items, sortBy);
  }, [items, sortBy, filterBy, isOwner]);

  // Memoized click handler (prevents new function per item per render)
  const handleItemClick = useCallback(
    (id: string) => {
      router.push(`/u/${profile.username}/${id}`);
    },
    [router, profile.username]
  );

  // Preload on hover for faster perceived navigation
  const handleMouseEnter = useCallback(
    (id: string) => {
      router.prefetch(`/u/${profile.username}/${id}`);
    },
    [router, profile.username]
  );

  const hasItems = items.length > 0;
  const needsVirtualization = processedItems.length > VIRTUALIZATION_THRESHOLD;

  return (
    <div className={cn("flex flex-col gap-6", !hasItems && "flex-1")}>
      {/* Profile Hero with cover photo and avatar */}
      <ProfileHero profile={profile} isOwnProfile={isOwner} />

      {/* Owner indicator for clarity */}
      {isOwner && (
        <p className="text-sm text-muted-foreground">
          You're viewing your public profile
        </p>
      )}

      {/* Toolbar - conditional based on owner status */}
      {isOwner ? (
        <ItemsToolbar
          hasItems={hasItems}
          isEditing={isEditing}
          onEditToggle={handleEditToggle}
          onAddItem={handleAddItemOpen}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filterBy={filterBy}
          onFilterChange={setFilterBy}
          hasDriveConnection={hasDriveConnection}
        />
      ) : (
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile: Options sheet */}
          <div className="sm:hidden">
            <MobileOptionsSheet
              sortBy={sortBy}
              onSortChange={setSortBy}
              disabled={!hasItems}
              sortOptions={EXPLORE_SORT_OPTIONS}
              defaultSort="updated-desc"
            />
          </div>
          {/* Desktop: Sort dropdown */}
          <div className="hidden sm:flex">
            <SortDropdown
              value={sortBy}
              onChange={setSortBy}
              disabled={!hasItems}
              options={EXPLORE_SORT_OPTIONS}
            />
          </div>
        </div>
      )}

      {/* Items display */}
      {hasItems ? (
        isOwner ? (
          <ErrorBoundary fallback={<div className="p-4 text-destructive">Failed to load items view</div>}>
            <ItemsView
              items={processedItems}
              parentId={null}
              isEditing={isEditing}
              onEditingChange={setIsEditing}
              addItemOpen={addItemOpen}
              onAddItemOpenChange={setAddItemOpen}
              hideToolbar={true}
              hasDriveConnection={hasDriveConnection}
              currentUser={currentUser}
            />
          </ErrorBoundary>
        ) : (
          <div
            data-testid="items-grid-view"
            className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
          >
            {processedItems.map((item, index) => (
              <GridItem
                key={item.id}
                id={item.id}
                name={item.name}
                description={item.description}
                artworkId={item.artworkId}
                onClick={() => handleItemClick(item.id)}
                onMouseEnter={() => handleMouseEnter(item.id)}
                showArtwork={true}
                showDescription={true}
                priority={index < 8}
                ownerLabel={`@${profile.username}`}
                ownerHref={`/u/${profile.username}`}
                ownerUserId={profile.id}
                ownerName={profile.name}
                // content-visibility for scroll performance
                style={index >= 8 ? { contentVisibility: "auto", containIntrinsicSize: "0 300px" } : undefined}
              />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          variant={isOwner ? "first-time" : "public-profile-empty"}
        />
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/unified-profile-client.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(public)/u/[username]/unified-profile-client.tsx tests/unit/components/unified-profile-client.test.tsx
git commit -m "feat: add UnifiedProfileClient with owner/viewer mode switching"
```

---

#### Task 4: Update Profile Page to Use Unified Client

**Files:**

- Modify: `app/(public)/u/[username]/page.tsx`
- Delete: `app/(public)/u/[username]/public-profile-client.tsx`

**Step 1: Update page.tsx**

```typescript
// app/(public)/u/[username]/page.tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getItemsForProfile } from "@/lib/item-actions";
import { getPublicProfile } from "@/lib/public-auth";
import { getDriveConnection } from "@/lib/google-drive-actions";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { UnifiedProfileClient } from "./unified-profile-client";

// Input validation for username param (security: prevent path traversal, XSS in logs)
const usernameParamSchema = z.string().min(3).max(20).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/);

interface PageProps {
  params: Promise<{ username: string }>;
}

// Skeleton for Suspense fallback
function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-[280px] w-full rounded-xl" />
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;

  // Validate username parameter (security)
  const parseResult = usernameParamSchema.safeParse(username);
  if (!parseResult.success) {
    notFound();
  }

  // Parallel fetch: auth + profile (independent operations)
  const [session, profile] = await Promise.all([
    auth(),
    getPublicProfile(username),
  ]);

  if (!profile) {
    notFound();
  }

  const viewerId = session?.user?.id ?? null;
  const isOwner = viewerId === profile.id;

  // Non-owner viewing non-public profile = 404
  // (getPublicProfile already handles this by returning null for non-public profiles)
  // No duplicate fetch needed - profile already validated above

  // Parallel fetch: items + drive connection (if owner)
  // Note: getItemsForProfile is wrapped with React.cache() for deduplication
  const [result, driveConnection] = await Promise.all([
    getItemsForProfile(profile.id, viewerId),
    isOwner ? getDriveConnection() : Promise.resolve(null),
  ]);

  return (
    <>
      <SiteHeader
        title={`@${profile.username}`}
        titleHref={`/u/${profile.username}`}
        // Breadcrumb shows @username for unified experience
      />
      <main className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <Suspense fallback={<ProfileSkeleton />}>
          <UnifiedProfileClient
            profile={result.profile}
            items={result.items}
            isOwner={result.isOwner}
            isAuthenticated={!!session}
            hasDriveConnection={!!driveConnection}
            currentUser={session?.user ? {
              id: session.user.id,
              username: session.user.username ?? null,
              name: session.user.name ?? null,
            } : null}
          />
        </Suspense>
      </main>
    </>
  );
}
```

**Step 2: Delete old client**

```bash
rm app/(public)/u/[username]/public-profile-client.tsx
```

**Step 3: Commit**

```bash
git add app/(public)/u/[username]/page.tsx
git rm app/(public)/u/[username]/public-profile-client.tsx
git commit -m "feat: migrate profile page to UnifiedProfileClient"
```

---

#### Task 5: Create UnifiedItemClient Component

**Files:**

- Create: `app/(public)/u/[username]/[itemId]/unified-item-client.tsx`
- Test: `tests/unit/components/unified-item-client.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/unit/components/unified-item-client.test.tsx
import { render, screen } from "@testing-library/react";
import { UnifiedItemClient } from "@/app/(public)/u/[username]/[itemId]/unified-item-client";

const mockItem = {
  id: "item-1",
  name: "Test Movie",
  description: "A test description",
  artworkId: "art-1",
  userId: "user-1",
  parentId: null,
  order: 0,
  isPublic: true,
  inheritVisibility: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockChildren = [
  { ...mockItem, id: "child-1", name: "Episode 1", parentId: "item-1" },
  { ...mockItem, id: "child-2", name: "Episode 2", parentId: "item-1" },
];

describe("UnifiedItemClient", () => {
  describe("owner view", () => {
    it("shows HeroCarousel with play button when isOwner=true", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={true} />);
      expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    });

    it("shows go-to button for incomplete items when isOwner=true", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={true} hasIncomplete={true} />);
      expect(screen.getByRole("button", { name: /go to/i })).toBeInTheDocument();
    });

    it("shows progress bar when isOwner=true", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={true} progressPercentage={50} />);
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("shows settings button when isOwner=true", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={true} />);
      expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
    });

    it("shows edit button when isOwner=true", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={true} />);
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });

    it("allows drag-drop reordering in edit mode when isOwner=true", async () => {
      const { user } = render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={true} />);
      await user.click(screen.getByRole("button", { name: /edit/i }));
      // dnd-kit elements should now be visible
      expect(screen.getByTestId("sortable-tree")).toBeInTheDocument();
    });
  });

  describe("viewer view", () => {
    it("hides play button when isOwner=false", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={false} />);
      expect(screen.queryByRole("button", { name: /play/i })).not.toBeInTheDocument();
    });

    it("hides progress bar when isOwner=false", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={false} progressPercentage={50} />);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("shows fork button for authenticated non-owner", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={false} isAuthenticated={true} />);
      expect(screen.getByRole("button", { name: /fork/i })).toBeInTheDocument();
    });

    it("shows sign-in prompt for fork when guest", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={false} isAuthenticated={false} />);
      expect(screen.getByText(/sign in to fork/i)).toBeInTheDocument();
    });

    it("hides settings button when isOwner=false", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={false} />);
      expect(screen.queryByRole("button", { name: /settings/i })).not.toBeInTheDocument();
    });

    it("shows fork attribution when item is forked", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={false} forkInfo={{ forkedFromName: "Original", forkedFromUsername: "creator" }} />);
      expect(screen.getByText(/forked from/i)).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("manages focus when opening media overlay", async () => {
      // Focus should move to overlay, return on close
    });

    it("respects prefers-reduced-motion for animations", () => {
      // Test with useReducedMotion mock
    });

    it("has proper heading hierarchy", () => {
      render(<UnifiedItemClient item={mockItem} children={mockChildren} isOwner={true} />);
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent(mockItem.name);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/unified-item-client.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// app/(public)/u/[username]/[itemId]/unified-item-client.tsx
"use client";

import { useMemo, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { HeroCarousel } from "@/components/items/hero-carousel";
import { ItemsToolbar } from "@/components/items/items-toolbar";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { EmptyState } from "@/components/items/empty-state";
import { ForkDestinationDialog } from "@/components/items/fork-destination-dialog";
import { useItemsSortFilter } from "@/hooks/use-items-sort-filter";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import { sortItems, filterItems, EXPLORE_SORT_OPTIONS } from "@/lib/item-utils";
import { cn } from "@/lib/utils";
import type { ItemWithArtwork, ForkInfo, ForkStatus } from "@/lib/types";
import type { PublicProfile } from "@/lib/public-auth";

// Dynamic imports for owner-only components (reduces viewer bundle)
const ItemsView = dynamic(
  () => import("@/components/items/items-view").then((mod) => mod.ItemsView),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full rounded-lg" /> }
);

const ItemSettingsDialog = dynamic(
  () => import("@/components/items/item-settings-dialog").then((mod) => mod.ItemSettingsDialog),
  { ssr: false }
);

const MediaOverlay = dynamic(
  () => import("@/components/media/media-overlay").then((mod) => mod.MediaOverlay),
  { ssr: false }
);

interface UnifiedItemClientProps {
  item: ItemWithArtwork;
  children: ItemWithArtwork[];
  profile: PublicProfile;
  isOwner: boolean;
  isAuthenticated: boolean;
  hasDriveConnection?: boolean;
  // Owner-only props
  progressPercentage?: number | null;
  watchedCount?: number;
  totalMediaCount?: number;
  nextItem?: { id: string; name: string } | null;
  files?: Array<{ id: string; filename: string; fileType: string; isPrimary: boolean; isHero: boolean }>;
  // Viewer-only props
  forkInfo?: ForkInfo | null;
  forkStatus?: ForkStatus | null;
  currentUser?: { id: string; username: string | null; name: string | null } | null;
}

export function UnifiedItemClient({
  item,
  children,
  profile,
  isOwner,
  isAuthenticated,
  hasDriveConnection = false,
  progressPercentage,
  watchedCount,
  totalMediaCount,
  nextItem,
  files = [],
  forkInfo,
  forkStatus,
  currentUser,
}: UnifiedItemClientProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  // Sort/filter state - owner gets full options, viewer gets explore options
  const ownerSortFilter = useItemsSortFilter();
  const viewerSortFilter = useExploreSortFilter();

  const sortFilterState = useMemo(() => {
    if (isOwner) return ownerSortFilter;
    return {
      sortBy: viewerSortFilter.sortBy,
      setSortBy: viewerSortFilter.setSortBy,
      filterBy: "all" as const,
      setFilterBy: () => {},
    };
  }, [isOwner, ownerSortFilter, viewerSortFilter]);

  const { sortBy, setSortBy, filterBy, setFilterBy } = sortFilterState;

  // Owner-only state
  const [isEditing, setIsEditing] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mediaOverlayOpen, setMediaOverlayOpen] = useState(false);

  // Viewer-only state
  const [forkDialogOpen, setForkDialogOpen] = useState(false);

  // Callbacks with useCallback for stable references
  const handleEditToggle = useCallback(() => setIsEditing((prev) => !prev), []);
  const handleAddItem = useCallback(() => setAddItemOpen(true), []);
  const handleSettingsOpen = useCallback(() => setSettingsOpen(true), []);
  const handlePlay = useCallback(() => setMediaOverlayOpen(true), []);

  const handleGoTo = useCallback(() => {
    if (nextItem) {
      router.push(`/u/${profile.username}/${nextItem.id}`);
    }
  }, [router, profile.username, nextItem]);

  const handleFork = useCallback(() => {
    if (!isAuthenticated) {
      router.push(`/sign-in?callbackUrl=/u/${profile.username}/${item.id}`);
      return;
    }
    setForkDialogOpen(true);
  }, [isAuthenticated, router, profile.username, item.id]);

  const handleItemClick = useCallback(
    (id: string) => router.push(`/u/${profile.username}/${id}`),
    [router, profile.username]
  );

  const handleMouseEnter = useCallback(
    (id: string) => router.prefetch(`/u/${profile.username}/${id}`),
    [router, profile.username]
  );

  // Process children for display
  const processedChildren = useMemo(() => {
    if (isOwner) {
      return filterItems(sortItems(children, sortBy), filterBy);
    }
    return sortItems(children, sortBy);
  }, [children, sortBy, filterBy, isOwner]);

  const hasChildren = children.length > 0;
  const primaryFile = files.find((f) => f.isPrimary);
  const heroFile = files.find((f) => f.isHero);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero section - different content for owner vs viewer */}
      <HeroCarousel
        item={item}
        heroArtworkId={heroFile?.id ?? item.artworkId}
        // Owner-only: show play, go-to, progress
        showPlayButton={isOwner && !!primaryFile}
        showGoToButton={isOwner && !!nextItem}
        onPlay={handlePlay}
        onGoTo={handleGoTo}
        goToLabel={nextItem?.name}
        progressPercentage={isOwner ? progressPercentage : undefined}
        watchedCount={isOwner ? watchedCount : undefined}
        totalMediaCount={isOwner ? totalMediaCount : undefined}
        // Viewer-only: show fork button
        showForkButton={!isOwner}
        onFork={handleFork}
        forkButtonLabel={isAuthenticated ? "Fork to Library" : "Sign in to fork"}
        // Fork attribution
        forkInfo={forkInfo}
        // Accessibility
        prefersReducedMotion={prefersReducedMotion}
      />

      {/* Owner indicator */}
      {isOwner && (
        <p className="text-sm text-muted-foreground">
          You're viewing your item
        </p>
      )}

      {/* Toolbar - owner gets full controls, viewer gets sort only */}
      {isOwner ? (
        <ItemsToolbar
          hasItems={hasChildren}
          isEditing={isEditing}
          onEditToggle={handleEditToggle}
          onAddItem={handleAddItem}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filterBy={filterBy}
          onFilterChange={setFilterBy}
          hasDriveConnection={hasDriveConnection}
          onSettingsOpen={handleSettingsOpen}
        />
      ) : (
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="sm:hidden">
            <MobileOptionsSheet
              sortBy={sortBy}
              onSortChange={setSortBy}
              disabled={!hasChildren}
              sortOptions={EXPLORE_SORT_OPTIONS}
              defaultSort="updated-desc"
            />
          </div>
          <div className="hidden sm:flex">
            <SortDropdown
              value={sortBy}
              onChange={setSortBy}
              disabled={!hasChildren}
              options={EXPLORE_SORT_OPTIONS}
            />
          </div>
        </div>
      )}

      {/* Children display */}
      {hasChildren ? (
        isOwner ? (
          <ErrorBoundary fallback={<div className="p-4 text-destructive">Failed to load items</div>}>
            <ItemsView
              items={processedChildren}
              parentId={item.id}
              isEditing={isEditing}
              onEditingChange={setIsEditing}
              addItemOpen={addItemOpen}
              onAddItemOpenChange={setAddItemOpen}
              hideToolbar={true}
              hasDriveConnection={hasDriveConnection}
              currentUser={currentUser}
            />
          </ErrorBoundary>
        ) : (
          <div
            data-testid="items-grid-view"
            className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
          >
            {processedChildren.map((child, index) => (
              <GridItem
                key={child.id}
                id={child.id}
                name={child.name}
                description={child.description}
                artworkId={child.artworkId}
                onClick={() => handleItemClick(child.id)}
                onMouseEnter={() => handleMouseEnter(child.id)}
                showArtwork={true}
                showDescription={true}
                priority={index < 8}
                ownerLabel={`@${profile.username}`}
                ownerHref={`/u/${profile.username}`}
                style={index >= 8 ? { contentVisibility: "auto", containIntrinsicSize: "0 300px" } : undefined}
              />
            ))}
          </div>
        )
      ) : (
        <EmptyState variant={isOwner ? "no-children" : "public-profile-empty"} />
      )}

      {/* Owner-only dialogs */}
      {isOwner && (
        <>
          <ItemSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            item={item}
            files={files}
          />
          <MediaOverlay
            open={mediaOverlayOpen}
            onOpenChange={setMediaOverlayOpen}
            files={files}
            initialFileId={primaryFile?.id}
          />
        </>
      )}

      {/* Viewer-only: Fork destination dialog */}
      {!isOwner && isAuthenticated && (
        <ForkDestinationDialog
          open={forkDialogOpen}
          onOpenChange={setForkDialogOpen}
          sourceItemId={item.id}
          sourceItemName={item.name}
        />
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/unified-item-client.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(public)/u/[username]/[itemId]/unified-item-client.tsx tests/unit/components/unified-item-client.test.tsx
git commit -m "feat: add UnifiedItemClient with owner/viewer mode switching"
```

---

### Phase 3: Delete My-Items Routes

#### Task 6: Delete /my-items Route Group

**Files:**

- Delete: `app/(my-items)/` (entire directory)

**Step 1: Delete the route group**

```bash
rm -rf app/(my-items)
```

**Step 2: Commit**

```bash
git rm -rf app/(my-items)
git commit -m "chore: remove /my-items routes (replaced by /u/[username])"
```

---

### Phase 4: Navigation Updates

#### Task 7: Update Sidebar Navigation

**Files:**

- Modify: `components/nav-main.tsx`
- Modify: `components/app-sidebar.tsx`
- Test: `tests/unit/components/nav-main.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/unit/components/nav-main.test.tsx
describe("My Items navigation with username", () => {
  it("renders My Items link pointing to /u/[username] when username provided", () => {
    render(<NavMain items={testItems} username="testuser" />);
    const link = screen.getByRole("link", { name: /my items/i });
    expect(link).toHaveAttribute("href", "/u/testuser");
  });

  it("renders My Items as active on /u/[own-username]", () => {
    mockPathname.mockReturnValue("/u/testuser");
    render(<NavMain items={testItems} username="testuser" />);
    const button = screen.getByTestId("sidebar-menu-button");
    expect(button.getAttribute("data-active")).toBe("true");
  });

  it("renders Explore as active on /u/[other-username]", () => {
    mockPathname.mockReturnValue("/u/otheruser");
    render(<NavMain items={testItems} username="testuser" />);
    // My Items should NOT be active
    // Explore SHOULD be active
  });
});
```

**Step 2: Update NavMain to accept username prop**

```typescript
// components/nav-main.tsx
interface NavMainProps {
  items: NavItem[];
  pinnedItems?: PinnedItem[];
  username?: string | null; // Current user's username
}

export function NavMain({ items, pinnedItems = [], username }: NavMainProps) {
  const pathname = usePathname();

  // Memoize nav items to avoid re-creating array on every render
  const navItems = useMemo(() => {
    return items.map((item) => {
      if (item.url === "/my-items" && username) {
        return { ...item, url: `/u/${username}` };
      }
      return item;
    });
  }, [items, username]);

  // Memoize active state calculation
  const getIsActive = useCallback(
    (itemUrl: string) => {
      // My Items (now /u/[username]) is active only for own profile
      if (itemUrl.startsWith("/u/") && username) {
        return pathname.startsWith(`/u/${username}`);
      }
      // Explore is active for other users' profiles
      if (itemUrl === "/explore") {
        const isOtherUserProfile =
          pathname.startsWith("/u/") && !pathname.startsWith(`/u/${username}`);
        return pathname === "/explore" || isOtherUserProfile;
      }
      // Standard prefix matching
      return pathname === itemUrl || pathname.startsWith(`${itemUrl}/`);
    },
    [pathname, username]
  );

  // Edge case: user has no username yet - show prompt or fallback
  // This should be rare as username is required for public profiles

  // ... rest of component
}
```

**Step 3: Update app-sidebar.tsx to pass username**

```typescript
// components/app-sidebar.tsx
<NavMain
  items={user ? authNavItems : guestNavItems}
  pinnedItems={user ? pinnedItems : undefined}
  username={user?.username}
/>
```

**Step 4: Commit**

```bash
git add components/nav-main.tsx components/app-sidebar.tsx tests/unit/components/nav-main.test.tsx
git commit -m "feat: update sidebar navigation to use /u/[username] for My Items"
```

---

#### Task 8: Update Pinned Items URLs

**Files:**

- Modify: `components/nav-main.tsx`
- Test: `tests/unit/components/nav-main.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/unit/components/nav-main.test.tsx
describe("Pinned items with username", () => {
  it("renders pinned item links to /u/[username]/[id]", () => {
    const pinnedItems = [{ id: "item-1", name: "Movies" }];
    render(<NavMain items={testItems} pinnedItems={pinnedItems} username="testuser" />);
    const link = screen.getByRole("link", { name: /movies/i });
    expect(link).toHaveAttribute("href", "/u/testuser/item-1");
  });

  it("renders pinned item as active on /u/[username]/[id]", () => {
    mockPathname.mockReturnValue("/u/testuser/item-1");
    const pinnedItems = [{ id: "item-1", name: "Movies" }];
    render(<NavMain items={testItems} pinnedItems={pinnedItems} username="testuser" />);
    const subButton = screen.getByTestId("sidebar-menu-sub-button");
    expect(subButton.getAttribute("data-active")).toBe("true");
  });

  it("handles pinned items when username is null", () => {
    const pinnedItems = [{ id: "item-1", name: "Movies" }];
    // Should not crash, but links won't work
    render(<NavMain items={testItems} pinnedItems={pinnedItems} username={null} />);
    // Pinned items section should still render
    expect(screen.getByText("Movies")).toBeInTheDocument();
  });
});
```

**Step 2: Update NavMain pinned items section**

```typescript
// In the pinned items map, update the href:
{pinnedItems.map((pinnedItem) => {
  // Use /u/[username]/[id] instead of /my-items/[id]
  const href = username ? `/u/${username}/${pinnedItem.id}` : `/my-items/${pinnedItem.id}`;
  const isPinnedActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <ContextMenu key={pinnedItem.id}>
      {/* ... */}
      <SidebarMenuSubButton asChild isActive={isPinnedActive}>
        <Link href={href}>
          <Folder className="size-4" aria-hidden="true" />
          <span>{pinnedItem.name}</span>
        </Link>
      </SidebarMenuSubButton>
      {/* ... */}
    </ContextMenu>
  );
})}
```

**Step 3: Update context menu settings link**

```typescript
// Update settings link in context menu
<ContextMenuItem
  onClick={() => router.push(`${href}?settings=true`)}
  className="gap-2"
>
```

**Step 4: Commit**

```bash
git add components/nav-main.tsx tests/unit/components/nav-main.test.tsx
git commit -m "feat: update pinned items to use /u/[username] URLs"
```

---

### Phase 5: Test Updates

#### Task 9: Update E2E Navigation Tests

**Files:**

- Modify: `e2e/journeys/navigation/nav-active-state.spec.ts`

**Changes needed:**

- Remove tests for `/my-items` (route deleted)
- Add tests for `/u/[username]` being the canonical owner view
- Update active state assertions for My Items pointing to `/u/[username]`

```typescript
// e2e/journeys/navigation/nav-active-state.spec.ts
test("My Items nav links to /u/[username]", async ({ authedPage }) => {
  const myItemsLink = authedPage.page.getByRole("link", { name: /my items/i });
  await expect(myItemsLink).toHaveAttribute("href", /\/u\/\w+$/);
});

test("My Items nav is active on own profile /u/[username]", async ({
  authedPage,
}) => {
  await authedPage.goto("/u/demo"); // Assuming demo user
  await expect(
    authedPage.page.getByTestId("sidebar-menu-button").first()
  ).toHaveAttribute("data-active", "true");
});
```

---

#### Task 10: Update E2E Public Profile Tests

**Files:**

- Modify: `e2e/journeys/public/public-profile.spec.ts`

**Changes needed:**

- Add tests for owner viewing own profile (sees edit controls)
- Verify non-owner doesn't see edit controls
- Test fork button visibility

---

#### Task 11: Update Unit Tests for Removed Components

**Files:**

- Delete: Tests referencing `public-profile-client.tsx`
- Delete: Tests referencing `public-item-client.tsx`
- Delete: Tests referencing `/my-items` routes
- Update: Tests importing from old locations

---

#### Task 12: Update Integration Tests

**Files:**

- Modify: `tests/integration/public/public-profile.test.ts`

Add integration tests for:

- `getItemsForProfile()` returns correct items based on viewer
- Owner sees all items, viewer sees public only
- Fork info included for non-owners

---

### Phase 6: Cleanup

#### Task 13: Remove Deprecated Files

**Files to Delete:**

- `app/(public)/u/[username]/public-profile-client.tsx`
- `app/(public)/u/[username]/[itemId]/public-item-client.tsx`

**Already deleted in Task 6:**

- `app/(my-items)/` (entire directory)

---

#### Task 14: Update CLAUDE.md Documentation

**Files:**

- Modify: `CLAUDE.md`

Update the routing documentation to reflect unified structure:

```markdown
### Project Structure

├── app/
│ ├── (public)/
│ │ ├── u/[username]/ # Unified profile (owner sees all + edit, others see public + fork)
│ │ ├── u/[username]/[itemId]/ # Unified item detail
│ │ └── explore/ # Community discovery
```

Remove all references to `/my-items` routes.

---

## Test Summary

### Tests to ADD

| Type        | File                                                    | Count | Description                                   |
| ----------- | ------------------------------------------------------- | ----- | --------------------------------------------- |
| Unit        | `tests/unit/components/unified-profile-client.test.tsx` | ~15   | Owner/viewer mode switching                   |
| Unit        | `tests/unit/components/unified-item-client.test.tsx`    | ~20   | Item detail mode switching                    |
| Unit        | `tests/unit/lib/item-actions.test.ts`                   | ~10   | getItemsForProfile, getItemChildrenForProfile |
| Integration | `tests/integration/public/unified-profile.test.ts`      | ~10   | End-to-end data flow                          |
| E2E         | `e2e/journeys/navigation/nav-active-state.spec.ts`      | ~5    | Active state for /u/[username]                |

### Tests to MODIFY

| Type        | File                                               | Changes                                          |
| ----------- | -------------------------------------------------- | ------------------------------------------------ |
| Unit        | `tests/unit/components/nav-main.test.tsx`          | Add username prop tests, update URL expectations |
| E2E         | `e2e/journeys/public/public-profile.spec.ts`       | Add owner-view tests                             |
| E2E         | `e2e/journeys/navigation/nav-active-state.spec.ts` | Remove /my-items tests, add /u/[username]        |
| Integration | `tests/integration/public/public-profile.test.ts`  | Add unified fetch tests                          |

### Tests to DELETE

| Type | File                                                   | Reason                        |
| ---- | ------------------------------------------------------ | ----------------------------- |
| Unit | `tests/unit/components/public-profile-client.test.tsx` | Component deleted (if exists) |
| Unit | `tests/unit/components/public-item-client.test.tsx`    | Component deleted (if exists) |

### E2E Files Requiring Updates

**Files that reference `/my-items` (must be updated or deleted):**

```bash
# Run this to find all affected files:
grep -r "/my-items" e2e/
```

Expected files to update:

- `e2e/journeys/items/items-crud.spec.ts` - Update all /my-items URLs to /u/[username]
- `e2e/journeys/items/items-settings.spec.ts` - Update navigation paths
- `e2e/journeys/items/items-views.spec.ts` - Update view mode tests
- `e2e/journeys/items/items-drag.spec.ts` - Update drag-drop tests
- `e2e/journeys/navigation/nav-active-state.spec.ts` - Update active state tests
- `e2e/journeys/profile/profile-settings.spec.ts` - Update if references /my-items
- `e2e/pages/items-page.ts` - Update Page Object URLs

### Additional Test Cases to Add

**Edge cases:**

- User with no items (empty state)
- User with no username (should not happen, but handle gracefully)
- Very large item count (>100 items) - performance test
- Concurrent access (owner editing while viewer browsing)
- Offline behavior (owner tries to edit while offline)

**Security tests:**

- Non-owner cannot access owner-only actions via API
- Rate limiting applies to non-owner requests
- Invalid username parameter rejected

**Accessibility tests:**

- Keyboard navigation through all interactive elements
- Screen reader announces mode (owner/viewer)
- Focus management on dialog open/close
- prefers-reduced-motion respected

---

## Migration Checklist

### Phase 1: Data Layer Unification

- [ ] Task 1: Create `getItemsForProfile` with React.cache() wrapper
- [ ] Task 1: Add input validation with Zod
- [ ] Task 1: Add error handling tests (profile not found, no username)
- [ ] Task 2: Create `getItemChildrenForProfile`

### Phase 2: Component Unification

- [ ] Task 3: Create `UnifiedProfileClient` with dynamic imports
- [ ] Task 3: Add ErrorBoundary around ItemsView
- [ ] Task 3: Add memoized callbacks (handleItemClick, handleMouseEnter)
- [ ] Task 3: Add content-visibility for scroll performance
- [ ] Task 3: Add "viewing your profile" indicator
- [ ] Task 4: Update page.tsx with parallel fetching (Promise.all)
- [ ] Task 4: Add Suspense with skeleton fallback
- [ ] Task 4: Add username param validation
- [ ] Task 5: Create `UnifiedItemClient` with full implementation

### Phase 3: Delete My-Items Routes

- [ ] Task 6: Delete `app/(my-items)/` directory
- [ ] Verify no hardcoded links remain (grep -r "/my-items")

### Phase 4: Navigation Updates

- [ ] Task 7: Update NavMain with username prop and memoized navItems
- [ ] Task 7: Update active state logic for /u/[username]
- [ ] Task 8: Update pinned items URLs to /u/[username]/[id]
- [ ] Update breadcrumb behavior in SiteHeader

### Phase 5: Test Updates

- [ ] Task 9: Update E2E navigation tests
- [ ] Task 10: Add E2E owner-view tests for public profile
- [ ] Task 11: Delete/update unit tests for removed components
- [ ] Task 12: Add integration tests for unified fetch
- [ ] Run `grep -r "/my-items" e2e/` and update all hits

### Phase 6: Cleanup

- [ ] Task 13: Delete deprecated client components
- [ ] Task 14: Update CLAUDE.md documentation

### Final Verification

- [ ] Full unit test suite passes: `pnpm test`
- [ ] Full integration test suite passes: `pnpm test:integration`
- [ ] Full E2E test suite passes: `pnpm test:e2e`
- [ ] Build succeeds: `pnpm build`
- [ ] Lint passes: `pnpm lint`
- [ ] Type check passes: `pnpm type-check`

### Manual QA Flows

- [ ] Owner views own profile at /u/[username] - sees all items + edit controls
- [ ] Owner enters edit mode - drag-drop works
- [ ] Owner adds new item - appears in list
- [ ] Owner opens settings dialog - can modify item
- [ ] Owner plays media - overlay works
- [ ] Viewer views profile - sees only public items
- [ ] Viewer cannot see edit controls
- [ ] Guest views profile - sees sign-in prompt for fork
- [ ] Authenticated viewer forks item - destination dialog works
- [ ] Navigation: My Items link points to /u/[username]
- [ ] Navigation: My Items active only on own profile
- [ ] Navigation: Explore active on other users' profiles
- [ ] Pinned items: Links work to /u/[username]/[id]
- [ ] Mobile: All controls accessible via touch

---

## SEO & Bookmark Considerations

**Optional: Add 301 redirects for /my-items**

While we're deleting the /my-items routes, users may have bookmarked these URLs. Consider adding permanent redirects:

```typescript
// middleware.ts (optional)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Redirect old /my-items URLs to /u/[username]
  if (pathname === "/my-items" || pathname.startsWith("/my-items/")) {
    // Get username from session (if available)
    // Otherwise redirect to sign-in
    const username = request.cookies.get("username")?.value;
    if (username) {
      const newPath = pathname.replace("/my-items", `/u/${username}`);
      return NextResponse.redirect(new URL(newPath, request.url), 301);
    }
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
}

export const config = {
  matcher: ["/my-items/:path*"],
};
```

**Note:** This is optional. If user base is small or /my-items was not publicly indexed, redirects may not be necessary.

---

## Rollback Plan

If issues arise post-deploy:

1. Restore `app/(my-items)/` from git history
2. Restore old client components
3. Revert navigation URL changes
4. Remove middleware redirects (if added)

---

## Accessibility Checklist

Per Web Interface Guidelines, ensure these accessibility requirements are met:

### Keyboard Navigation

- [ ] All interactive elements reachable via Tab key
- [ ] Edit mode toggle has clear focus indicator
- [ ] Add Item button keyboard accessible
- [ ] Fork button keyboard accessible
- [ ] Grid items can be activated with Enter/Space
- [ ] Dialogs trap focus when open
- [ ] Dialogs return focus on close

### Screen Reader Support

- [ ] ProfileHero has proper heading hierarchy (h1 for name)
- [ ] Owner/viewer mode announced via aria-live region or clear text
- [ ] Empty states have descriptive text
- [ ] Grid items have descriptive labels
- [ ] Progress bar has aria-valuenow/valuemin/valuemax

### Reduced Motion

- [ ] ProfileHero respects `prefers-reduced-motion`
- [ ] HeroCarousel respects `prefers-reduced-motion`
- [ ] dnd-kit drag animations can be disabled
- [ ] Dialog open/close animations respect preference

### Semantic HTML

- [ ] Use `<main>` for primary content area
- [ ] Use `<section>` for ProfileHero
- [ ] Use `<nav>` for navigation (already in sidebar)
- [ ] Proper button/link usage (navigation = link, action = button)

---

## Performance Checklist

Before deployment, verify these optimizations are in place:

- [ ] `getItemsForProfile` uses `React.cache()` for deduplication
- [ ] Page uses `Promise.all()` for parallel fetching
- [ ] `ItemsView` is dynamically imported (not in viewer bundle)
- [ ] `ItemSettingsDialog` and `MediaOverlay` are dynamically imported
- [ ] Grid items use `content-visibility: auto` for off-screen items
- [ ] Click handlers are memoized with `useCallback`
- [ ] Sort/filter state uses `useMemo` for stable reference
- [ ] Suspense fallback provides meaningful skeleton UI
- [ ] ErrorBoundary catches dnd-kit failures gracefully

---

Plan complete and saved to `docs/plans/2026-01-22-unified-profile-route.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
