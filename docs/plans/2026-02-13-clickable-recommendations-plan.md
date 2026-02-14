# Clickable Recommendations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make recommendation cards on the About tab interactive — navigate to owned/public items or open the Add Item dialog with TMDB pre-populated for new items.

**Architecture:** Server-side resolution via a single Prisma query matches TMDB IDs from recommendations against the user's library and public items. The resolved data flows from the server page through `ItemDetailClient` / `PublicItemClient` → `AboutTabContent` → `Recommendations` → `PosterCard`. PosterCard gains badge props matching GridItem's existing badge pattern. For "new" items, an `onAddRecommendation` callback fires up to `ItemDetailClient`, which opens the existing `AddItemDialog` (via `ItemsView`) and pre-selects the TMDB match via a new `initialTmdbMatch` prop.

**Tech Stack:** Next.js 16, React 19, Prisma, Vitest, Playwright, Storybook

**Key architectural note:** `AddItemDialog` and `MobileAddItemSheet` live inside `ItemsView` (Contents tab), not in `AboutTabContent` (About tab). The "add from recommendation" flow works by calling back up to `ItemDetailClient`, which already owns `addItemOpen` state and passes it to `ItemsView`. A new `initialTmdbMatch` prop threads the TMDB data down to the dialog. For `PublicItemClient` (viewer mode), there is no Add Item dialog — "new" items render as non-interactive for all viewers (guests and authenticated alike). This keeps the scope contained; adding items from a public view can be a separate feature.

---

### Task 1: Add `ResolvedRecommendation` Type

**Files:**
- Modify: `lib/tmdb-client.ts` (after `Recommendation` interface, ~line 48)

**Step 1: Add the type export**

Add after the existing `Recommendation` interface:

```typescript
/** Recommendation with library/public match resolution. */
export interface ResolvedRecommendation extends Recommendation {
  /** How this recommendation matched against the user's data. */
  matchType: "yours" | "public" | "new";
  /** Navigation href for 'yours' and 'public' matches. */
  href?: string;
  /** Matched item ID (for 'yours' and 'public'). */
  itemId?: string;
  /** Owner username (for 'public' matches, used in aria-label). */
  ownerUsername?: string;
}
```

**Note:** `tmdb-client.ts` has a "Server-side only" file header comment, but the types section is already imported by client components (e.g., `recommendations.tsx` imports `Recommendation`). Only the API functions are server-only; the type exports are safe for client use.

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: PASS (no consumers yet)

**Step 3: Commit**

```bash
git add lib/tmdb-client.ts
git commit -m "Add ResolvedRecommendation type to tmdb-client"
```

---

### Task 2: Implement `resolveRecommendationMatches()` with Tests (TDD)

**Files:**
- Create: `tests/unit/lib/resolve-recommendation-matches.test.ts`
- Modify: `lib/tmdb-utils.ts`

**Step 1: Write the failing tests**

Create `tests/unit/lib/resolve-recommendation-matches.test.ts`:

```typescript
/**
 * Unit tests for resolveRecommendationMatches.
 * Mocks Prisma to test resolution logic without a real database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Recommendation } from "@/lib/tmdb-client";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { resolveRecommendationMatches } from "@/lib/tmdb-utils";

const mockFindMany = vi.mocked(prisma.item.findMany);

const makeRec = (
  id: number,
  title: string,
  mediaType: "movie" | "tv" = "movie"
): Recommendation => ({
  id,
  title,
  posterPath: `/poster${id}.jpg`,
  backdropPath: null,
  mediaType,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveRecommendationMatches", () => {
  it("returns all as 'new' when no DB matches", async () => {
    mockFindMany.mockResolvedValue([]);
    const recs = [makeRec(100, "Movie A"), makeRec(200, "Movie B")];

    const result = await resolveRecommendationMatches(recs, "user-1");

    expect(result).toHaveLength(2);
    expect(result[0].matchType).toBe("new");
    expect(result[1].matchType).toBe("new");
    expect(result[0].href).toBeUndefined();
  });

  it("resolves 'yours' when user owns item with matching tmdbId", async () => {
    mockFindMany.mockResolvedValue([
      { id: "item-1", tmdbId: 100, userId: "user-1", user: { username: "me" }, isPublic: false, inheritVisibility: false },
    ]);
    const recs = [makeRec(100, "My Movie")];

    const result = await resolveRecommendationMatches(recs, "user-1");

    expect(result[0].matchType).toBe("yours");
    expect(result[0].href).toBe("/u/me/item-1");
    expect(result[0].itemId).toBe("item-1");
  });

  it("resolves 'public' when another user's public item matches", async () => {
    mockFindMany.mockResolvedValue([
      { id: "item-2", tmdbId: 200, userId: "other-user", user: { username: "cinefan" }, isPublic: true, inheritVisibility: false },
    ]);
    const recs = [makeRec(200, "Public Movie")];

    const result = await resolveRecommendationMatches(recs, "user-1");

    expect(result[0].matchType).toBe("public");
    expect(result[0].href).toBe("/u/cinefan/item-2");
    expect(result[0].ownerUsername).toBe("cinefan");
  });

  it("prioritises 'yours' over 'public' when both match", async () => {
    mockFindMany.mockResolvedValue([
      { id: "my-item", tmdbId: 100, userId: "user-1", user: { username: "me" }, isPublic: false, inheritVisibility: false },
      { id: "pub-item", tmdbId: 100, userId: "other", user: { username: "other" }, isPublic: true, inheritVisibility: false },
    ]);
    const recs = [makeRec(100, "Shared Movie")];

    const result = await resolveRecommendationMatches(recs, "user-1");

    expect(result[0].matchType).toBe("yours");
    expect(result[0].href).toBe("/u/me/my-item");
  });

  it("returns all as 'new' for guests (userId: null), except public matches", async () => {
    mockFindMany.mockResolvedValue([
      { id: "pub-item", tmdbId: 200, userId: "someone", user: { username: "someone" }, isPublic: true, inheritVisibility: false },
    ]);
    const recs = [makeRec(100, "No Match"), makeRec(200, "Public Movie")];

    const result = await resolveRecommendationMatches(recs, null);

    expect(result[0].matchType).toBe("new");
    expect(result[1].matchType).toBe("public");
    expect(result[1].href).toBe("/u/someone/pub-item");
  });

  it("returns empty array for empty recommendations", async () => {
    const result = await resolveRecommendationMatches([], "user-1");
    expect(result).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("skips recommendations without valid tmdbId (id: 0)", async () => {
    mockFindMany.mockResolvedValue([]);
    const recs = [makeRec(0, "No TMDB")];

    const result = await resolveRecommendationMatches(recs, "user-1");

    expect(result[0].matchType).toBe("new");
  });

  it("only queries for non-zero TMDB IDs", async () => {
    mockFindMany.mockResolvedValue([]);
    const recs = [makeRec(0, "No ID"), makeRec(100, "Has ID")];

    await resolveRecommendationMatches(recs, "user-1");

    // Should only query for tmdbId 100, not 0
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs?.where?.tmdbId?.in).toEqual([100]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- resolve-recommendation-matches`
Expected: FAIL — `resolveRecommendationMatches` is not exported from `@/lib/tmdb-utils`

**Step 3: Write the implementation**

Add the import at the top of `lib/tmdb-utils.ts` (alongside existing imports):

```typescript
import type { Recommendation, ResolvedRecommendation } from "@/lib/tmdb-client";
```

Add to the end of `lib/tmdb-utils.ts`:

```typescript
/**
 * Resolves recommendations against the user's library and public items.
 * Single DB query matches TMDB IDs, then classifies each recommendation
 * as 'yours', 'public', or 'new'.
 *
 * Priority: yours > public > new.
 *
 * Performance: Single indexed query on tmdbId. Recommendations are typically
 * 6 items (sliced in getItemTmdbDetails), so the IN clause is small.
 * This adds ~1 DB round-trip after tmdbDetails resolves (data-dependent,
 * cannot be parallelised with the TMDB API calls).
 *
 * @param recommendations - TMDB recommendations to resolve
 * @param userId - Current user ID, or null for guests
 * @returns Resolved recommendations with matchType and navigation hrefs
 */
export async function resolveRecommendationMatches(
  recommendations: Recommendation[],
  userId: string | null
): Promise<ResolvedRecommendation[]> {
  if (recommendations.length === 0) return [];

  // Collect valid TMDB IDs (filter out 0/falsy)
  const tmdbIds = recommendations
    .map((r) => r.id)
    .filter((id) => id > 0);

  if (tmdbIds.length === 0) {
    return recommendations.map((r) => ({ ...r, matchType: "new" as const }));
  }

  // Single query: find items matching any of these TMDB IDs
  // that belong to the current user OR are explicitly public
  const matchedItems = await prisma.item.findMany({
    where: {
      tmdbId: { in: tmdbIds },
      OR: [
        ...(userId ? [{ userId }] : []),
        { isPublic: true, inheritVisibility: false },
      ],
    },
    select: {
      id: true,
      tmdbId: true,
      userId: true,
      isPublic: true,
      inheritVisibility: true,
      user: { select: { username: true } },
    },
  });

  // Build lookup: tmdbId → matched items (Map for O(1) resolution per rec)
  const matchMap = new Map<number, typeof matchedItems>();
  for (const item of matchedItems) {
    if (item.tmdbId === null) continue;
    const existing = matchMap.get(item.tmdbId) ?? [];
    existing.push(item);
    matchMap.set(item.tmdbId, existing);
  }

  // Resolve each recommendation
  return recommendations.map((rec) => {
    const matches = matchMap.get(rec.id);
    if (!matches || matches.length === 0) {
      return { ...rec, matchType: "new" as const };
    }

    // Priority: yours > public
    const ownItem = userId
      ? matches.find((m) => m.userId === userId)
      : undefined;
    if (ownItem && ownItem.user.username) {
      return {
        ...rec,
        matchType: "yours" as const,
        href: `/u/${ownItem.user.username}/${ownItem.id}`,
        itemId: ownItem.id,
      };
    }

    const publicItem = matches.find(
      (m) => m.isPublic && !m.inheritVisibility && m.userId !== userId
    );
    if (publicItem && publicItem.user.username) {
      return {
        ...rec,
        matchType: "public" as const,
        href: `/u/${publicItem.user.username}/${publicItem.id}`,
        itemId: publicItem.id,
        ownerUsername: publicItem.user.username,
      };
    }

    return { ...rec, matchType: "new" as const };
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test -- resolve-recommendation-matches`
Expected: PASS (all 8 tests)

**Step 5: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/tmdb-utils.ts tests/unit/lib/resolve-recommendation-matches.test.ts
git commit -m "Add resolveRecommendationMatches with unit tests"
```

---

### Task 3: Integration Test for `resolveRecommendationMatches`

**Files:**
- Create: `tests/integration/resolve-recommendation-matches.test.ts`

**Why:** The design doc specifies integration tests with real DB to verify the Prisma query, yours-vs-public priority, and guest behaviour work with actual data.

**Step 1: Write the integration test**

Create `tests/integration/resolve-recommendation-matches.test.ts`:

```typescript
/**
 * Integration tests for resolveRecommendationMatches.
 * Uses real database to verify Prisma query and resolution logic.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveRecommendationMatches } from "@/lib/tmdb-utils";
import type { Recommendation } from "@/lib/tmdb-client";

const TEST_PREFIX = "rec-match-test";

const makeRec = (
  id: number,
  title: string,
  mediaType: "movie" | "tv" = "movie"
): Recommendation => ({
  id,
  title,
  posterPath: null,
  backdropPath: null,
  mediaType,
});

let testUserId: string;
let otherUserId: string;
let ownItemId: string;
let publicItemId: string;

beforeAll(async () => {
  // Create test users
  const testUser = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-owner@test.com`,
      username: `${TEST_PREFIX}owner`,
      password: "hashed",
    },
  });
  testUserId = testUser.id;

  const otherUser = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-other@test.com`,
      username: `${TEST_PREFIX}other`,
      password: "hashed",
      isPublic: true,
    },
  });
  otherUserId = otherUser.id;

  // Create owned item with tmdbId 278 (Shawshank Redemption)
  const ownItem = await prisma.item.create({
    data: {
      name: "Own Movie",
      userId: testUserId,
      tmdbId: 278,
      tmdbType: "movie",
      isPublic: false,
    },
  });
  ownItemId = ownItem.id;

  // Create public item with tmdbId 238 (The Godfather)
  const pubItem = await prisma.item.create({
    data: {
      name: "Public Movie",
      userId: otherUserId,
      tmdbId: 238,
      tmdbType: "movie",
      isPublic: true,
      inheritVisibility: false,
    },
  });
  publicItemId = pubItem.id;
});

afterAll(async () => {
  // Clean up test data
  await prisma.item.deleteMany({
    where: { userId: { in: [testUserId, otherUserId] } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });
});

describe("resolveRecommendationMatches (integration)", () => {
  it("resolves 'yours' for owned items", async () => {
    const recs = [makeRec(278, "The Shawshank Redemption")];
    const result = await resolveRecommendationMatches(recs, testUserId);

    expect(result[0].matchType).toBe("yours");
    expect(result[0].itemId).toBe(ownItemId);
    expect(result[0].href).toContain(ownItemId);
  });

  it("resolves 'public' for other users' public items", async () => {
    const recs = [makeRec(238, "The Godfather")];
    const result = await resolveRecommendationMatches(recs, testUserId);

    expect(result[0].matchType).toBe("public");
    expect(result[0].itemId).toBe(publicItemId);
  });

  it("prioritises 'yours' over 'public'", async () => {
    // Make own item also public so both conditions match
    await prisma.item.update({
      where: { id: ownItemId },
      data: { isPublic: true, inheritVisibility: false },
    });

    const recs = [makeRec(278, "The Shawshank Redemption")];
    const result = await resolveRecommendationMatches(recs, testUserId);

    expect(result[0].matchType).toBe("yours");

    // Restore
    await prisma.item.update({
      where: { id: ownItemId },
      data: { isPublic: false },
    });
  });

  it("resolves 'new' for unmatched items", async () => {
    const recs = [makeRec(99999, "Unknown Movie")];
    const result = await resolveRecommendationMatches(recs, testUserId);

    expect(result[0].matchType).toBe("new");
    expect(result[0].href).toBeUndefined();
  });

  it("guest sees public matches but not 'yours'", async () => {
    const recs = [makeRec(278, "Shawshank"), makeRec(238, "Godfather")];
    const result = await resolveRecommendationMatches(recs, null);

    // 278 is private → new for guest
    expect(result[0].matchType).toBe("new");
    // 238 is public → public for guest
    expect(result[1].matchType).toBe("public");
  });
});
```

**Step 2: Run integration test**

Run: `pnpm run test:integration -- resolve-recommendation-matches`
Expected: PASS (all 5 tests)

**Step 3: Commit**

```bash
git add tests/integration/resolve-recommendation-matches.test.ts
git commit -m "Add integration tests for resolveRecommendationMatches"
```

---

### Task 4: Add Badge and Disabled Props to PosterCard with Tests (TDD)

**Files:**
- Create: `tests/unit/components/poster-card.test.tsx`
- Modify: `components/items/poster-card.tsx`

**Step 1: Write the failing tests**

Create `tests/unit/components/poster-card.test.tsx`:

```typescript
/**
 * Unit tests for PosterCard badge and disabled states.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PosterCard } from "@/components/items/poster-card";

// Mock next/image — filter out Image-specific props to avoid React warnings
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

describe("PosterCard", () => {
  it("renders 'Yours' badge when isOwn is true", () => {
    render(
      <PosterCard posterUrl={null} title="Test Movie" isOwn />
    );

    const badge = screen.getByTestId("ownership-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Yours");
    expect(badge).toHaveAttribute("aria-label", "Your item");
  });

  it("renders 'In Library' badge when isForked is true", () => {
    render(
      <PosterCard posterUrl={null} title="Test Movie" isForked />
    );

    const badge = screen.getByTestId("ownership-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("In Library");
    expect(badge).toHaveAttribute("aria-label", "In your library");
  });

  it("does not render badge when neither isOwn nor isForked", () => {
    render(
      <PosterCard posterUrl={null} title="Test Movie" />
    );

    expect(screen.queryByTestId("ownership-badge")).not.toBeInTheDocument();
  });

  it("renders as div when disabled is true", () => {
    render(
      <PosterCard posterUrl={null} title="Disabled Movie" disabled />
    );

    // Should not have link or button
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // Should render the title
    expect(screen.getByText("Disabled Movie")).toBeInTheDocument();
  });

  it("disabled card does not respond to clicks", async () => {
    const onClick = vi.fn();
    render(
      <PosterCard posterUrl={null} title="Disabled" disabled onClick={onClick} />
    );

    const card = screen.getByText("Disabled").closest("div");
    if (card) await userEvent.click(card);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabled overrides href (renders div, not link)", () => {
    render(
      <PosterCard posterUrl={null} title="Disabled Link" disabled href="/u/test/item-1" />
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Disabled Link")).toBeInTheDocument();
  });

  it("renders as Link when href is provided (no onClick)", () => {
    render(
      <PosterCard posterUrl={null} title="Link Movie" href="/u/test/item-1" />
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/u/test/item-1");
  });

  it("renders as button when onClick is provided", async () => {
    const onClick = vi.fn();
    render(
      <PosterCard posterUrl={null} title="Button Movie" onClick={onClick} />
    );

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("passes aria-label to link element", () => {
    render(
      <PosterCard
        posterUrl={null}
        title="My Movie"
        href="/u/me/item-1"
        aria-label='Go to "My Movie"'
      />
    );

    expect(screen.getByRole("link")).toHaveAttribute("aria-label", 'Go to "My Movie"');
  });

  it("passes aria-label to button element", () => {
    render(
      <PosterCard
        posterUrl={null}
        title="New Movie"
        onClick={() => {}}
        aria-label='Add "New Movie" to library'
      />
    );

    expect(screen.getByRole("button")).toHaveAttribute("aria-label", 'Add "New Movie" to library');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- poster-card.test`
Expected: FAIL — `ownership-badge` testid not found, `disabled` prop not recognised

**Step 3: Implement badge and disabled in PosterCard**

Modify `components/items/poster-card.tsx`:

Add `User, Check` imports from lucide-react:

```typescript
import { User, Check } from "lucide-react";
```

Add new props to `PosterCardProps`:

```typescript
  /** Whether this item belongs to the current user. Shows "Yours" badge. */
  isOwn?: boolean;
  /** Whether the current user has this item in their library. Shows "In Library" badge. */
  isForked?: boolean;
  /** Whether the card is non-interactive (renders as div). */
  disabled?: boolean;
```

Add badge markup inside `content` (after the poster image, before the "Default Gradient" div):

```tsx
{/* Ownership/fork badge - matching GridItem pattern */}
{(isOwn || isForked) && (
  <div
    className={cn(
      "absolute top-2 left-2 z-30",
      "flex items-center gap-1",
      "rounded-full px-1.5 py-0.5",
      "bg-black/50 backdrop-blur-sm",
      "text-[10px] font-medium text-white/70"
    )}
    data-testid="ownership-badge"
    aria-label={isOwn ? "Your item" : "In your library"}
  >
    {isOwn ? (
      <User className="size-2.5" aria-hidden="true" />
    ) : (
      <Check className="size-2.5 text-green-400" aria-hidden="true" />
    )}
    <span>{isOwn ? "Yours" : "In Library"}</span>
  </div>
)}
```

Add disabled rendering branch — **before** the `if (onClick)` block, add:

```typescript
// Render as non-interactive div when disabled (takes priority over href/onClick)
if (disabled) {
  return (
    <div
      className={cn(
        sharedClassName,
        "cursor-default hover:scale-100 hover:shadow-none active:scale-100"
      )}
    >
      {content}
    </div>
  );
}
```

Destructure `isOwn`, `isForked`, `disabled` in the component signature.

**Step 4: Run tests to verify they pass**

Run: `pnpm run test -- poster-card.test`
Expected: PASS (all 10 tests)

**Step 5: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add components/items/poster-card.tsx tests/unit/components/poster-card.test.tsx
git commit -m "Add badge and disabled props to PosterCard"
```

---

### Task 5: Update Recommendations Component with Tests (TDD)

**Files:**
- Create: `tests/unit/components/recommendations.test.tsx`
- Modify: `components/items/recommendations.tsx`

**Step 1: Write the failing tests**

Create `tests/unit/components/recommendations.test.tsx`:

```typescript
/**
 * Unit tests for Recommendations component.
 * Verifies correct rendering per matchType.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ResolvedRecommendation } from "@/lib/tmdb-client";

// Mock next/image — filter Image-specific props
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

import { Recommendations } from "@/components/items/recommendations";

const makeResolved = (
  id: number,
  title: string,
  matchType: "yours" | "public" | "new",
  extra?: Partial<ResolvedRecommendation>
): ResolvedRecommendation => ({
  id,
  title,
  posterPath: `/poster${id}.jpg`,
  backdropPath: null,
  mediaType: "movie",
  matchType,
  ...extra,
});

describe("Recommendations", () => {
  it("renders 'yours' item as link with Yours badge", () => {
    const recs = [
      makeResolved(1, "My Movie", "yours", {
        href: "/u/me/item-1",
        itemId: "item-1",
      }),
    ];

    render(<Recommendations recommendations={recs} />);

    const link = screen.getByRole("link", { name: /go to "my movie"/i });
    expect(link).toHaveAttribute("href", "/u/me/item-1");
    expect(screen.getByTestId("ownership-badge")).toHaveTextContent("Yours");
  });

  it("renders 'public' item as link without badge", () => {
    const recs = [
      makeResolved(2, "Public Movie", "public", {
        href: "/u/cinefan/item-2",
        ownerUsername: "cinefan",
      }),
    ];

    render(<Recommendations recommendations={recs} />);

    const link = screen.getByRole("link", { name: /view "public movie"/i });
    expect(link).toHaveAttribute("href", "/u/cinefan/item-2");
    expect(screen.queryByTestId("ownership-badge")).not.toBeInTheDocument();
  });

  it("renders 'new' item as button when onAddRecommendation provided", async () => {
    const onAdd = vi.fn();
    const recs = [makeResolved(3, "New Movie", "new")];

    render(
      <Recommendations recommendations={recs} onAddRecommendation={onAdd} />
    );

    const button = screen.getByRole("button", {
      name: /add "new movie" to library/i,
    });
    await userEvent.click(button);
    expect(onAdd).toHaveBeenCalledWith(recs[0]);
  });

  it("renders 'new' item as disabled div when no onAddRecommendation", () => {
    const recs = [makeResolved(4, "Guest Movie", "new")];

    render(<Recommendations recommendations={recs} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Guest Movie")).toBeInTheDocument();
  });

  it("returns null for empty recommendations", () => {
    const { container } = render(<Recommendations recommendations={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- tests/unit/components/recommendations.test`
Expected: FAIL — `Recommendations` doesn't accept `ResolvedRecommendation[]` or `onAddRecommendation`

**Step 3: Update the Recommendations component**

Rewrite `components/items/recommendations.tsx`:

```typescript
/**
 * Recommendations section showing similar movies/shows.
 * Renders cards with match-aware behaviour: navigate to owned/public items,
 * or trigger Add Item flow for new items.
 */

"use client";

import { cn } from "@/lib/utils";
import { isValidImagePath } from "@/lib/tmdb-client";
import { PosterCard } from "./poster-card";
import type { ResolvedRecommendation } from "@/lib/tmdb-client";

interface RecommendationsProps {
  /** Resolved recommendations with matchType info. */
  recommendations: ResolvedRecommendation[];
  /** Callback when a 'new' recommendation is clicked. If absent, new items are non-interactive. */
  onAddRecommendation?: (rec: ResolvedRecommendation) => void;
  /** Section title. */
  title?: string;
  /** Additional CSS classes. */
  className?: string;
  /** Base URL for poster images (default: TMDB poster base URL). */
  posterBaseUrl?: string;
}

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w780";

/**
 * Displays recommendation poster cards with match-aware rendering.
 * 'yours' → Link with badge, 'public' → Link, 'new' → button or disabled div.
 */
export function Recommendations({
  recommendations,
  onAddRecommendation,
  title = "More Like This",
  className,
  posterBaseUrl = TMDB_POSTER_BASE,
}: RecommendationsProps) {
  if (recommendations.length === 0) return null;

  return (
    <section className={className} data-testid="about-recommendations-section">
      <h2
        className={cn(
          "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--tertiary-foreground)]"
        )}
      >
        {title}
      </h2>

      <div
        className={cn(
          "grid gap-4",
          "grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        )}
      >
        {recommendations.map((rec) => {
          const posterUrl =
            rec.posterPath && isValidImagePath(rec.posterPath)
              ? `${posterBaseUrl}${rec.posterPath}`
              : null;

          switch (rec.matchType) {
            case "yours":
              if (!rec.href) return null;
              return (
                <PosterCard
                  key={rec.id}
                  posterUrl={posterUrl}
                  title={rec.title}
                  href={rec.href}
                  isOwn
                  aria-label={`Go to "${rec.title}"`}
                />
              );
            case "public":
              if (!rec.href) return null;
              return (
                <PosterCard
                  key={rec.id}
                  posterUrl={posterUrl}
                  title={rec.title}
                  href={rec.href}
                  aria-label={`View "${rec.title}" by @${rec.ownerUsername}`}
                />
              );
            case "new":
              if (onAddRecommendation) {
                return (
                  <PosterCard
                    key={rec.id}
                    posterUrl={posterUrl}
                    title={rec.title}
                    onClick={() => onAddRecommendation(rec)}
                    aria-label={`Add "${rec.title}" to library`}
                  />
                );
              }
              return (
                <PosterCard
                  key={rec.id}
                  posterUrl={posterUrl}
                  title={rec.title}
                  disabled
                  aria-label={rec.title}
                />
              );
          }
        })}
      </div>
    </section>
  );
}

export default Recommendations;
```

**Key change vs original plan:** Replaced `rec.href!` (non-null assertion) with a runtime guard `if (!rec.href) return null;` for type safety.

**Step 4: Run tests to verify they pass**

Run: `pnpm run test -- tests/unit/components/recommendations.test`
Expected: PASS (all 5 tests)

**Step 5: Run type-check**

Run: `pnpm run type-check`
Expected: May fail — consumers of `Recommendations` still pass `Recommendation[]` instead of `ResolvedRecommendation[]`. That's expected and fixed in Task 7.

**Step 6: Commit**

```bash
git add components/items/recommendations.tsx tests/unit/components/recommendations.test.tsx
git commit -m "Update Recommendations to use ResolvedRecommendation with match-aware rendering"
```

---

### Task 6: Add `initialTmdbMatch` Support to Add Item Flow

**Files:**
- Modify: `hooks/use-add-item-form.ts`
- Modify: `components/items/add-item-dialog.tsx`
- Modify: `components/items/mobile-add-item-sheet.tsx`
- Modify: `components/items/items-view.tsx`

**Context:** The Add Item dialog/sheet lives inside `ItemsView`, not in `AboutTabContent`. To trigger it from a recommendation click, we pass an `initialTmdbMatch` prop through `ItemsView` → `AddItemDialog` / `MobileAddItemSheet` → `useAddItemForm`. When the dialog opens with a match, the hook auto-selects it.

**Step 1: Add `initialTmdbMatch` to `useAddItemForm`**

In `hooks/use-add-item-form.ts`, add a new parameter to the hook:

```typescript
// Add to the hook's params (the options object):
/** Pre-selected TMDB match from recommendation click. Auto-triggers media select on open. */
initialTmdbMatch?: { tmdbId: number; title: string; mediaType: "movie" | "tv" } | null;
```

Add an effect that triggers media selection when the dialog opens with a match:

```typescript
// Auto-select TMDB match when dialog opens with initialTmdbMatch
useEffect(() => {
  if (!initialTmdbMatch) return;

  const syntheticResult: TMDBSearchResult = {
    id: initialTmdbMatch.tmdbId,
    mediaType: initialTmdbMatch.mediaType,
    title: initialTmdbMatch.title,
    overview: "",
    posterPath: null,
    backdropPath: null,
    year: "",
  };
  handleMediaSelect(syntheticResult);
  // Only run when initialTmdbMatch changes (dialog opens with new match)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialTmdbMatch]);
```

**Step 2: Thread `initialTmdbMatch` through AddItemDialog and MobileAddItemSheet**

In `components/items/add-item-dialog.tsx`, add to `AddItemDialogProps`:

```typescript
/** Pre-selected TMDB match from recommendation click. */
initialTmdbMatch?: { tmdbId: number; title: string; mediaType: "movie" | "tv" } | null;
```

Pass it to `useAddItemForm(...)` call inside the component.

Do the same for `components/items/mobile-add-item-sheet.tsx`.

**Step 3: Thread through ItemsView**

In `components/items/items-view.tsx`, add to the props interface:

```typescript
/** Pre-selected TMDB match to pass to Add Item dialog. */
initialTmdbMatch?: { tmdbId: number; title: string; mediaType: "movie" | "tv" } | null;
```

Pass `initialTmdbMatch` to both `<AddItemDialog>` and `<MobileAddItemSheet>`.

**Step 4: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/use-add-item-form.ts components/items/add-item-dialog.tsx components/items/mobile-add-item-sheet.tsx components/items/items-view.tsx
git commit -m "Add initialTmdbMatch prop to Add Item flow for recommendation pre-selection"
```

---

### Task 7: Wire Resolution into AboutTabContent and Page Components

**Files:**
- Modify: `components/items/about-tab-content.tsx`
- Modify: `components/items/item-detail-client.tsx`
- Modify: `app/(public)/u/[username]/[itemId]/public-item-detail-client.tsx`
- Modify: `app/(public)/u/[username]/[itemId]/page.tsx`

**Step 1: Update AboutTabContent props**

In `about-tab-content.tsx`, change the import:

```typescript
import type { TmdbItemDetails } from "@/lib/tmdb-client";
```

to:

```typescript
import type { TmdbItemDetails, ResolvedRecommendation } from "@/lib/tmdb-client";
```

Add to `AboutTabContentProps`:

```typescript
/** Resolved recommendations (replaces tmdbDetails.recommendations). */
resolvedRecommendations?: ResolvedRecommendation[];
/** Callback when user clicks a 'new' recommendation to add it. */
onAddRecommendation?: (rec: ResolvedRecommendation) => void;
```

Update the Recommendations rendering block (around line 171) to use resolved data:

```tsx
{tmdbDisplayOptions?.showRecommendations !== false &&
  isSectionVisible("recommendations") &&
  resolvedRecommendations &&
  resolvedRecommendations.length > 0 && (
    <Recommendations
      recommendations={resolvedRecommendations}
      onAddRecommendation={onAddRecommendation}
    />
  )}
```

Destructure `resolvedRecommendations` and `onAddRecommendation` in the component signature.

**Step 2: Update the server page to call resolution**

In `app/(public)/u/[username]/[itemId]/page.tsx`, add the import:

```typescript
import { resolveRecommendationMatches } from "@/lib/tmdb-utils";
```

In the **owner mode** block (after the `Promise.all` resolves `tmdbDetails`, ~line 182), add:

```typescript
// Resolve recommendations against user's library (sequential — depends on tmdbDetails)
const resolvedRecommendations = tmdbDetails?.recommendations
  ? await resolveRecommendationMatches(tmdbDetails.recommendations, currentUserId)
  : undefined;
```

Pass `resolvedRecommendations` to `<ItemDetailClient>`.

In the **viewer mode** block (after the `Promise.all` resolves `tmdbDetails`, ~line 299), add the same resolution:

```typescript
const resolvedRecommendations = tmdbDetails?.recommendations
  ? await resolveRecommendationMatches(tmdbDetails.recommendations, currentUserId)
  : undefined;
```

Pass `resolvedRecommendations` to `<PublicItemClient>`.

**Step 3: Update ItemDetailClient**

In `components/items/item-detail-client.tsx`:

Add to `ItemDetailClientProps`:

```typescript
/** Resolved recommendations for About tab. */
resolvedRecommendations?: ResolvedRecommendation[];
```

Add import:

```typescript
import type { ResolvedRecommendation } from "@/lib/tmdb-client";
```

Add state and handler for the recommendation→add flow:

```typescript
// Pending TMDB match from recommendation click (passed to AddItemDialog via ItemsView)
const [pendingTmdbMatch, setPendingTmdbMatch] = useState<{
  tmdbId: number;
  title: string;
  mediaType: "movie" | "tv";
} | null>(null);

// Handler for recommendation "add" clicks
const handleAddRecommendation = useCallback(
  (rec: ResolvedRecommendation) => {
    setPendingTmdbMatch({
      tmdbId: rec.id,
      title: rec.title,
      mediaType: rec.mediaType,
    });
    setAddItemOpen(true);
  },
  []
);

// Clear pending match when dialog closes
const handleAddItemOpenChange = useCallback((open: boolean) => {
  setAddItemOpen(open);
  if (!open) setPendingTmdbMatch(null);
}, []);
```

Update the `aboutContent` block to pass resolved data:

```tsx
const aboutContent = (
  <AboutTabContent
    description={item.description}
    tmdbDetails={tmdbDetails}
    tmdbDisplayOptions={tmdbDisplayOptions}
    isTV={isTV}
    actions={contentsActions}
    resolvedRecommendations={resolvedRecommendations}
    onAddRecommendation={handleAddRecommendation}
  />
);
```

Update `<ItemsView>` to pass `initialTmdbMatch` and use `handleAddItemOpenChange`:

```tsx
<ItemsView
  // ... existing props ...
  addItemOpen={addItemOpen}
  onAddItemOpenChange={handleAddItemOpenChange}
  initialTmdbMatch={pendingTmdbMatch}
  // ... rest of props ...
/>
```

**Step 4: Update PublicItemClient**

In `app/(public)/u/[username]/[itemId]/public-item-detail-client.tsx`:

Add to `PublicItemClientProps`:

```typescript
/** Resolved recommendations for About tab. */
resolvedRecommendations?: ResolvedRecommendation[];
```

Add import:

```typescript
import type { ResolvedRecommendation } from "@/lib/tmdb-client";
```

Update the `aboutContent` block — pass resolved data **without** `onAddRecommendation` (no Add Item dialog in viewer mode, so "new" items render as disabled):

```tsx
const aboutContent = (
  <AboutTabContent
    description={item.description}
    tmdbDetails={tmdbDetails}
    tmdbDisplayOptions={tmdbDisplayOptions}
    isTV={isTV}
    resolvedRecommendations={resolvedRecommendations}
  />
);
```

**Step 5: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 6: Run unit tests**

Run: `pnpm run test`
Expected: PASS (all existing + new tests)

**Step 7: Commit**

```bash
git add components/items/about-tab-content.tsx components/items/item-detail-client.tsx app/(public)/u/[username]/[itemId]/page.tsx app/(public)/u/[username]/[itemId]/public-item-detail-client.tsx
git commit -m "Wire recommendation resolution through page and client components"
```

---

### Task 8: Update Storybook Stories

**Files:**
- Modify: `components/items/recommendations.stories.tsx`

**Step 1: Update stories to use ResolvedRecommendation**

Rewrite `components/items/recommendations.stories.tsx`:

```typescript
/**
 * Stories for Recommendations component.
 * Fetches real TMDB recommendation data via Storybook loaders.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ResolvedRecommendation } from "@/lib/tmdb-client";
import { fetchTmdbDetails } from "../../.storybook/lib/tmdb";
import { Recommendations } from "./recommendations";

const meta: Meta<typeof Recommendations> = {
  title: "Items/About/Recommendations",
  component: Recommendations,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Displays a grid of recommendation poster cards with match-aware rendering. Cards navigate to owned/public items, open add-item flow for new items, or render as disabled for guests.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-5xl p-8">
        <Story />
      </div>
    ),
  ],
  loaders: [
    async ({ args }) => {
      const { tmdbId, mediaType } = args as {
        tmdbId?: number;
        mediaType?: "movie" | "tv";
      };
      if (!tmdbId || !mediaType) return { recommendations: [] };
      const details = await fetchTmdbDetails(tmdbId, mediaType);
      // Wrap raw recommendations as 'new' matchType (default for stories)
      const resolved: ResolvedRecommendation[] = (
        details?.recommendations ?? []
      ).map((r) => ({ ...r, matchType: "new" as const }));
      return { recommendations: resolved };
    },
  ],
  render: (args, { loaded: { recommendations } }) => (
    <Recommendations
      recommendations={args.recommendations ?? recommendations}
      title={args.title}
      onAddRecommendation={args.onAddRecommendation}
    />
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default recommendation grid — all items as 'new' with add callback. */
export const Default: Story = {
  args: {
    tmdbId: 27205,
    mediaType: "movie",
    onAddRecommendation: (rec) => console.log("Add:", rec.title),
  },
};

/** All items are 'new' with no callback — renders as non-interactive (guest mode). */
export const GuestMode: Story = {
  args: { tmdbId: 27205, mediaType: "movie" },
};

/** Mix of match types showing badge variants. */
export const MixedMatchTypes: Story = {
  args: {
    recommendations: [
      {
        id: 272,
        title: "Batman Begins",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
        matchType: "yours",
        href: "/u/me/item-batman",
        itemId: "item-batman",
      },
      {
        id: 155,
        title: "The Dark Knight",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
        matchType: "public",
        href: "/u/cinefan/item-dk",
        itemId: "item-dk",
        ownerUsername: "cinefan",
      },
      {
        id: 550,
        title: "Fight Club",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
        matchType: "new",
      },
      {
        id: 13,
        title: "Forrest Gump",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
        matchType: "new",
      },
    ] satisfies ResolvedRecommendation[],
    onAddRecommendation: (rec) => console.log("Add:", rec.title),
  },
  loaders: [],
  render: (args) => (
    <Recommendations
      recommendations={args.recommendations!}
      onAddRecommendation={args.onAddRecommendation}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          '"Yours" badge on Batman Begins, plain link on The Dark Knight (public), button on Fight Club and Forrest Gump (new).',
      },
    },
  },
};

/** No poster images — shows title initial fallback. */
export const NoPosterImages: Story = {
  args: {
    recommendations: [
      {
        id: 272,
        title: "Batman Begins",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
        matchType: "new",
      },
      {
        id: 155,
        title: "The Dark Knight",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
        matchType: "new",
      },
      {
        id: 550,
        title: "Fight Club",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
        matchType: "new",
      },
      {
        id: 13,
        title: "Forrest Gump",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
        matchType: "new",
      },
      {
        id: 120,
        title: "LOTR: Fellowship",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
        matchType: "new",
      },
      {
        id: 603,
        title: "The Matrix",
        posterPath: null,
        backdropPath: null,
        mediaType: "movie",
        matchType: "new",
      },
    ] satisfies ResolvedRecommendation[],
  },
  loaders: [],
  render: (args) => <Recommendations recommendations={args.recommendations!} />,
  parameters: {
    docs: {
      description: {
        story:
          "When TMDB poster images are unavailable, cards display the first letter of the title as a fallback.",
      },
    },
  },
};
```

**Step 2: Run Storybook build**

Run: `pnpm run build-storybook`
Expected: PASS

**Step 3: Commit**

```bash
git add components/items/recommendations.stories.tsx
git commit -m "Update Recommendations stories for ResolvedRecommendation"
```

---

### Task 9: Run Full Check Suite

**Step 1: Run all checks**

Run: `pnpm run check`
Expected: format, lint, type-check, knip, build all pass.

**Step 2: Fix any issues**

Address any lint, type, or knip warnings introduced by the changes.

**Step 3: Run all unit tests**

Run: `pnpm run test`
Expected: All tests pass.

**Step 4: Run integration tests**

Run: `pnpm run test:integration`
Expected: All tests pass.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "Fix lint/type issues from clickable recommendations"
```

---

### Task 10: E2E Tests

**Files:**
- Create: `e2e/journeys/items/recommendation-click.spec.ts`

**Context:** The seed creates items with TMDB IDs for the demo user (`demo@canoncore.com`): movies 278 (Shawshank), 238 (Godfather I), 240 (Godfather II), 424 (Schindler's List), 389 (12 Angry Men), 680 (Pulp Fiction), 13 (Forrest Gump), 603 (The Matrix). TMDB's recommendations for Shawshank (278) include Forrest Gump (13) and The Godfather (238), so viewing Shawshank should produce "Yours" badges on those recommendations.

**Step 1: Write E2E tests**

Create `e2e/journeys/items/recommendation-click.spec.ts`:

```typescript
/**
 * E2E tests for clickable recommendation cards on the About tab.
 * Verifies "Yours" badge, navigation on click, and guest non-interactivity.
 */

import { test, expect } from "@playwright/test";

test.describe("Recommendation Click Behaviour", () => {
  test("'Yours' badge is visible on recommendations matching user library", async ({
    page,
  }) => {
    // Login as demo user, navigate to an item with TMDB recommendations
    // that overlap with their library (e.g., Shawshank → Forrest Gump)
    // Exact navigation depends on seeded item IDs — find an item with tmdbId 278
    // Navigate to About tab, scroll to recommendations section
    // Assert: at least one recommendation card has [data-testid="ownership-badge"]
    // with text "Yours"

    // Implementation note: query the DB for the demo user's item with tmdbId=278,
    // navigate to /u/demo/{itemId}, switch to About tab, check for badge.
    test.skip(true, "Implement after verifying seed data produces recommendation overlap");
  });

  test("clicking 'Yours' recommendation navigates to owned item", async ({
    page,
  }) => {
    // Same setup as above
    // Click the recommendation card with "Yours" badge
    // Assert: URL changes to /u/demo/{matchedItemId}
    test.skip(true, "Implement after verifying seed data produces recommendation overlap");
  });

  test("clicking 'new' recommendation opens Add Item dialog (owner)", async ({
    page,
  }) => {
    // Login as demo user, navigate to item detail, About tab
    // Find a recommendation card that is NOT in the user's library
    // Click it
    // Assert: Add Item dialog opens (look for dialog role or testid)
    test.skip(true, "Implement after verifying seed data produces recommendation overlap");
  });

  test("guest sees non-interactive recommendation cards", async ({ page }) => {
    // Navigate to a public item detail page without logging in
    // Go to About tab, find recommendations section
    // Assert: no link or button roles on recommendation cards
    // Assert: cursor style is default (not pointer)
    test.skip(true, "Implement after verifying public seeded item has recommendations");
  });
});
```

**Note:** These tests are scaffolded with `test.skip` because the exact item IDs depend on the seed run. During implementation, query the E2E database to find the demo user's item with `tmdbId=278`, verify its TMDB recommendations include other seeded items (238, 13, etc.), then fill in the navigation paths and remove the skips.

**Step 2: Implement and run E2E tests**

Run: `pnpm run test:e2e -- --grep "Recommendation"`
Expected: PASS after implementing the skipped tests

**Step 3: Commit**

```bash
git add e2e/journeys/items/recommendation-click.spec.ts
git commit -m "Add E2E tests for clickable recommendations"
```
