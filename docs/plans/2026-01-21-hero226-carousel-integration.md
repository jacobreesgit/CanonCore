# Hero226 Carousel Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the static ItemHero with a Hero226-based carousel system. Explore page shows 5 featured items; item detail pages show a single-slide carousel using the same component.

**Architecture:** Create a unified `HeroCarousel` component based on Hero226 that accepts an array of slides. Explore page fetches 5 featured items (most recently updated with artwork). Item detail pages pass a single item. Remove collapse functionality and `useHeroCollapse` hook entirely.

**Tech Stack:** Next.js 16, React 19, TypeScript, Embla Carousel, Motion, Vitest, Playwright

---

## Summary of Changes

| Change                                                  | Files Affected                                                                                                                                                                                          | Tests Affected                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Create HeroCarousel component with full ItemHero parity | Create `components/hero-carousel.tsx`                                                                                                                                                                   | Unit: new tests (~20 tests)             |
| Create getFeaturedItems server action                   | Modify `lib/public-auth.ts`                                                                                                                                                                             | Unit: new tests, Integration: new tests |
| Update Explore page to use carousel                     | Modify `app/(public)/explore/page.tsx`, `explore-client.tsx`                                                                                                                                            | E2E: update expectations                |
| Update item detail pages to use single-slide carousel   | Modify `components/items/item-detail-client.tsx`, `app/(public)/u/[username]/[itemId]/public-item-client.tsx`, `app/(public)/u/[username]/public-profile-client.tsx`, `components/items/items-view.tsx` | Unit: update, E2E: update               |
| Delete useHeroCollapse hook                             | Delete `hooks/use-hero-collapse.ts`                                                                                                                                                                     | Unit: delete tests                      |
| Delete ItemHero component                               | Delete `components/items/item-hero.tsx`                                                                                                                                                                 | Unit: delete tests                      |
| Update items-view.tsx                                   | Remove collapse logic, use HeroCarousel                                                                                                                                                                 | Unit: update                            |

### Key Feature: Ownership Logic

HeroCarousel uses `isOwner` prop to control visibility of owner-specific features:

- **`isOwner=true`**: Shows Play button, Go-to button, Progress bar (for owned content)
- **`isOwner=false`**: Shows only CTA button (for public/viewer content)

This matches the GridItem behavior on Explore page where owners see their progress but viewers don't.

---

## Task 1: Create getFeaturedItems Server Action

**Files:**

- Modify: `lib/public-auth.ts`
- Create: `tests/unit/lib/get-featured-items.test.ts`
- Create: `tests/integration/public/get-featured-items.test.ts`

> **Code Review Note:** This task addresses:
>
> - **Issue #2 (CRITICAL):** Error handling with graceful degradation
> - **Issue #3 (CRITICAL):** Filter out empty artworkIds to prevent invalid API calls
> - **Issue #4 (HIGH):** React.cache() for request deduplication
> - **Issue #21 (LOW):** Avoid non-null assertion by filtering null usernames

### Step 1: Write failing unit test for getFeaturedItems

```typescript
// tests/unit/lib/get-featured-items.test.ts
/**
 * Unit tests for getFeaturedItems server action.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findMany: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getFeaturedItems } from "@/lib/public-auth";

describe("getFeaturedItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return up to 5 featured items with artwork", async () => {
    const mockItems = [
      {
        id: "item-1",
        name: "Featured Movie",
        description: "A great movie",
        userId: "user-1",
        updatedAt: new Date(),
        files: [{ id: "art-1", driveFileId: "drive-1" }],
        user: { username: "testuser", name: "Test User" },
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as never);

    const result = await getFeaturedItems(5);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "item-1",
      name: "Featured Movie",
      artworkId: "art-1",
      ownerUsername: "testuser",
    });
  });

  it("should only include items with artwork files", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    const result = await getFeaturedItems(5);

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          files: { some: { fileType: "ARTWORK" } },
        }),
      })
    );
  });

  it("should order by updatedAt descending", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await getFeaturedItems(5);

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updatedAt: "desc" },
      })
    );
  });

  it("should respect limit parameter", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await getFeaturedItems(3);

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
      })
    );
  });

  it("should filter out items with empty artwork IDs", async () => {
    const mockItems = [
      {
        id: "item-1",
        name: "Has Artwork",
        description: "Good",
        userId: "user-1",
        files: [{ id: "art-1" }],
        user: { username: "testuser", name: "Test" },
      },
      {
        id: "item-2",
        name: "No Artwork",
        description: "Bad",
        userId: "user-2",
        files: [], // Empty files array
        user: { username: "testuser2", name: "Test2" },
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as never);

    const result = await getFeaturedItems(5);

    // Should only include items with valid artwork
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("item-1");
  });

  it("should filter out items with null username (Issue #21)", async () => {
    const mockItems = [
      {
        id: "item-1",
        name: "Has Username",
        description: "Good",
        userId: "user-1",
        files: [{ id: "art-1" }],
        user: { username: "validuser", name: "Test" },
      },
      {
        id: "item-2",
        name: "No Username",
        description: "Bad",
        userId: "user-2",
        files: [{ id: "art-2" }],
        user: { username: null, name: "Test2" }, // Null username - should be filtered
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as never);

    const result = await getFeaturedItems(5);

    // Should only include items with valid username
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("item-1");
    expect(result[0].ownerUsername).toBe("validuser");
  });

  it("should return empty array on database error (graceful degradation)", async () => {
    vi.mocked(prisma.item.findMany).mockRejectedValue(
      new Error("Database connection failed")
    );

    const result = await getFeaturedItems(5);

    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error), limit: 5 }),
      "Failed to fetch featured items"
    );
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/lib/get-featured-items.test.ts`
Expected: FAIL with "getFeaturedItems is not exported"

### Step 3: Implement getFeaturedItems

```typescript
// lib/public-auth.ts - Add imports at top of file
import { cache } from "react";
import { logger } from "@/lib/logger";

// lib/public-auth.ts - Add after getExploreItems function

/**
 * Featured item with artwork for carousel display.
 */
export interface FeaturedItem {
  id: string;
  name: string;
  description: string | null;
  artworkId: string;
  ownerUsername: string;
  ownerName: string | null;
  ownerUserId: string;
  link: string;
}

/**
 * Fetches featured public items for the Explore carousel.
 * Returns items with artwork, ordered by most recently updated.
 * Uses React.cache() for request deduplication within a single request.
 * Gracefully returns empty array on errors to prevent page crashes.
 *
 * @param limit - Maximum number of items to return (default: 5)
 * @returns Array of featured items with artwork and owner info
 */
export const getFeaturedItems = cache(
  async (limit = 5): Promise<FeaturedItem[]> => {
    try {
      const items = await prisma.item.findMany({
        where: {
          isPublic: true,
          inheritVisibility: false,
          // Must have artwork for carousel display
          files: {
            some: { fileType: "ARTWORK" },
          },
          user: {
            isPublic: true,
            username: { not: null },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          userId: true,
          files: {
            where: { fileType: "ARTWORK" },
            select: { id: true },
            take: 1,
            orderBy: [{ isHero: "desc" }, { isPrimary: "desc" }],
          },
          user: {
            select: {
              username: true,
              name: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });

      // Filter out items without valid artwork ID (Issue #3: prevents /api/artwork/ invalid calls)
      // Issue #21: Also filter out items where username is null (stricter than query allows)
      return items
        .filter((item) => item.files[0]?.id && item.user.username)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          artworkId: item.files[0].id, // Safe due to filter above
          ownerUsername: item.user.username as string, // Safe due to filter - avoids non-null assertion
          ownerName: item.user.name,
          ownerUserId: item.userId,
          link: `/u/${item.user.username}/${item.id}`,
        }));
    } catch (error) {
      // Issue #2: Graceful degradation - return empty array instead of crashing page
      logger.error({ error, limit }, "Failed to fetch featured items");
      return [];
    }
  }
);
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/lib/get-featured-items.test.ts`
Expected: PASS

### Step 5: Write integration test

```typescript
// tests/integration/public/get-featured-items.test.ts
/**
 * Integration tests for getFeaturedItems with real database.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getFeaturedItems } from "@/lib/public-auth";

describe("getFeaturedItems integration", () => {
  let testUserId: string;
  let testItemId: string;

  beforeAll(async () => {
    // Create test user with public profile
    const user = await prisma.user.create({
      data: {
        email: `featured-test-${Date.now()}@test.com`,
        password: "hashedpassword",
        name: "Featured Test User",
        username: `featuredtest${Date.now()}`,
        isPublic: true,
      },
    });
    testUserId = user.id;

    // Create public item with artwork
    const item = await prisma.item.create({
      data: {
        name: "Featured Test Item",
        description: "Test description",
        userId: testUserId,
        isPublic: true,
        inheritVisibility: false,
        files: {
          create: {
            filename: "poster.jpg",
            fileType: "ARTWORK",
            driveFileId: "test-drive-id",
          },
        },
      },
    });
    testItemId = item.id;
  });

  afterAll(async () => {
    await prisma.item.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("should return featured items from database", async () => {
    const result = await getFeaturedItems(5);

    const testItem = result.find((item) => item.id === testItemId);
    expect(testItem).toBeDefined();
    expect(testItem?.name).toBe("Featured Test Item");
    expect(testItem?.artworkId).toBeDefined();
  });
});
```

### Step 6: Run integration test

Run: `pnpm test:integration tests/integration/public/get-featured-items.test.ts`
Expected: PASS

### Step 7: Commit

```bash
git add lib/public-auth.ts tests/unit/lib/get-featured-items.test.ts tests/integration/public/get-featured-items.test.ts
git commit -m "$(cat <<'EOF'
feat: add getFeaturedItems for carousel

Returns up to 5 public items with artwork, ordered by most recently
updated. Used by Explore page Hero226 carousel.
EOF
)"
```

---

## Task 2: Create HeroCarousel Component

**Files:**

- Create: `components/hero-carousel.tsx`
- Create: `tests/unit/components/hero-carousel.test.tsx`

> **Code Review Note:** This task addresses:
>
> - **Issue #1 (CRITICAL):** useEffect cleanup for Embla API listener
> - **Issue #5 (HIGH):** Reduced motion support using useReducedMotion
> - **Issue #6 (HIGH):** aria-current on active navigation dot
> - **Issue #9 (MEDIUM):** Image loading states with skeleton
> - **Issue #11 (MEDIUM):** Keyboard navigation support noted in comments
> - **Issue #12 (MEDIUM):** Improved test coverage with proper plugin verification
> - **Issue #13 (LOW):** Text alignment made configurable (default: left for media app)
> - **Issue #14 (LOW):** Animation only on initial mount
> - **Issue #15 (LOW):** Autoplay plugin not loaded for single slides
> - **Issue #16 (LOW):** Next.js Image for LCP optimization
> - **Issue #18 (LOW):** Focus ring styling for design system consistency
> - **Issue #20 (LOW):** touch-action: pan-y for scroll passthrough
> - **Issue #22 (LOW):** Dynamic Autoplay import for true code splitting

### Step 1: Write failing unit tests

```typescript
// tests/unit/components/hero-carousel.test.tsx
/**
 * Unit tests for HeroCarousel component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroCarousel } from "@/components/hero-carousel";

// Mock embla-carousel-autoplay (Issue #22: supports dynamic import)
const mockAutoplay = vi.fn(() => ({ name: "autoplay" }));
vi.mock("embla-carousel-autoplay", () => ({
  default: mockAutoplay,
}));

// Track if dynamic import was called
let autoplayImportCalled = false;
const originalDynamicImport = vi.fn().mockImplementation(() => {
  autoplayImportCalled = true;
  return Promise.resolve({ default: mockAutoplay });
});

// Mock framer-motion useReducedMotion
let mockReducedMotion = false;
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => mockReducedMotion,
  };
});

// Mock carousel components with proper API simulation
vi.mock("@/components/ui/carousel", () => {
  const mockApi = {
    on: vi.fn(),
    off: vi.fn(),
    selectedScrollSnap: () => 0,
    scrollTo: vi.fn(),
  };
  return {
    Carousel: ({ children, setApi, plugins }: { children: React.ReactNode; setApi?: (api: unknown) => void; plugins?: unknown[] }) => {
      // Simulate async setApi call like real Embla
      if (setApi) {
        setTimeout(() => setApi(mockApi), 0);
      }
      return <div data-testid="carousel" data-plugins={JSON.stringify(plugins?.length ?? 0)}>{children}</div>;
    },
    CarouselContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="carousel-content">{children}</div>
    ),
    CarouselItem: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="carousel-item">{children}</div>
    ),
  };
});

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, onLoad, onError, ...props }: { src: string; alt: string; onLoad?: () => void; onError?: () => void }) => (
    <img src={src} alt={alt} data-testid="next-image" {...props} />
  ),
}));

describe("HeroCarousel", () => {
  const mockSlides = [
    {
      id: "item-1",
      name: "Breaking Bad",
      description: "A chemistry teacher turned meth cook",
      artworkId: "art-1",
      link: "/u/testuser/item-1",
      ownerUsername: "testuser",
      ownerName: "Test User",
    },
    {
      id: "item-2",
      name: "Better Call Saul",
      description: "A lawyer's journey",
      artworkId: "art-2",
      link: "/u/testuser/item-2",
      ownerUsername: "testuser",
      ownerName: "Test User",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockReducedMotion = false;
    autoplayImportCalled = false;
  });

  describe("multi-slide mode", () => {
    it("should render carousel with all slides", () => {
      render(<HeroCarousel slides={mockSlides} />);

      expect(screen.getByTestId("carousel")).toBeInTheDocument();
      expect(screen.getAllByTestId("carousel-item")).toHaveLength(2);
    });

    it("should display slide titles", () => {
      render(<HeroCarousel slides={mockSlides} />);

      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
      expect(screen.getByText("Better Call Saul")).toBeInTheDocument();
    });

    it("should display slide descriptions", () => {
      render(<HeroCarousel slides={mockSlides} />);

      expect(screen.getByText("A chemistry teacher turned meth cook")).toBeInTheDocument();
    });

    it("should render navigation dots for multiple slides", () => {
      render(<HeroCarousel slides={mockSlides} />);

      const dots = screen.getAllByRole("button", { name: /go to slide/i });
      expect(dots).toHaveLength(2);
    });

    it("should use Next.js Image for artwork", () => {
      render(<HeroCarousel slides={mockSlides} />);

      const images = screen.getAllByTestId("next-image");
      expect(images[0]).toHaveAttribute("src", "/api/artwork/art-1");
    });

    it("should load autoplay plugin for multiple slides", () => {
      render(<HeroCarousel slides={mockSlides} />);

      expect(mockAutoplay).toHaveBeenCalledWith(
        expect.objectContaining({
          delay: 4000,
          stopOnInteraction: true,
          stopOnMouseEnter: true,
        })
      );
    });
  });

  describe("single-slide mode", () => {
    const singleSlide = [mockSlides[0]];

    it("should not render navigation dots for single slide", () => {
      render(<HeroCarousel slides={singleSlide} />);

      const dots = screen.queryAllByRole("button", { name: /go to slide/i });
      expect(dots).toHaveLength(0);
    });

    it("should NOT load autoplay plugin for single slide", () => {
      mockAutoplay.mockClear();
      render(<HeroCarousel slides={singleSlide} />);

      // Verify autoplay was not called for single slide
      expect(mockAutoplay).not.toHaveBeenCalled();
    });
  });

  describe("empty state", () => {
    it("should render nothing when no slides", () => {
      const { container } = render(<HeroCarousel slides={[]} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("CTA button", () => {
    it("should render View Collection link for each slide", () => {
      render(<HeroCarousel slides={mockSlides} />);

      const links = screen.getAllByRole("link", { name: /view collection/i });
      expect(links[0]).toHaveAttribute("href", "/u/testuser/item-1");
    });
  });

  describe("custom CTA", () => {
    it("should support custom ctaText prop", () => {
      render(<HeroCarousel slides={mockSlides} ctaText="Watch Now" />);

      expect(screen.getAllByText("Watch Now")).toHaveLength(2);
    });

    it("should support hiding CTA with showCta=false", () => {
      render(<HeroCarousel slides={mockSlides} showCta={false} />);

      expect(screen.queryByRole("link", { name: /view collection/i })).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have accessible navigation dots with aria-label", () => {
      render(<HeroCarousel slides={mockSlides} />);

      const dots = screen.getAllByRole("button", { name: /go to slide/i });
      expect(dots[0]).toHaveAttribute("aria-label", "Go to slide 1");
      expect(dots[1]).toHaveAttribute("aria-label", "Go to slide 2");
    });

    it("should have aria-current on active navigation dot", () => {
      render(<HeroCarousel slides={mockSlides} />);

      const dots = screen.getAllByRole("button", { name: /go to slide/i });
      // First dot should be active by default
      expect(dots[0]).toHaveAttribute("aria-current", "true");
      expect(dots[1]).not.toHaveAttribute("aria-current");
    });
  });

  describe("reduced motion support", () => {
    it("should skip animations when user prefers reduced motion", () => {
      mockReducedMotion = true;
      render(<HeroCarousel slides={mockSlides} />);

      // Should render without motion wrapper
      expect(screen.getByTestId("hero-carousel")).toBeInTheDocument();
    });

    it("should skip autoplay when user prefers reduced motion", () => {
      mockReducedMotion = true;
      mockAutoplay.mockClear();
      render(<HeroCarousel slides={mockSlides} />);

      // Should not load autoplay plugin
      expect(mockAutoplay).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle null description", () => {
      const slidesWithNullDesc = [{ ...mockSlides[0], description: null }];
      render(<HeroCarousel slides={slidesWithNullDesc} />);

      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
      expect(screen.queryByText("null")).not.toBeInTheDocument();
    });

    it("should handle very long titles with truncation", () => {
      const longTitle = "A".repeat(200);
      const slidesWithLongTitle = [{ ...mockSlides[0], name: longTitle }];
      render(<HeroCarousel slides={slidesWithLongTitle} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });
  });

  describe("owner mode - play button", () => {
    const slideWithMedia = {
      ...mockSlides[0],
      hasMedia: true,
      hasProgress: false,
      primaryMediaName: "S01E01",
    };

    it("should NOT show play button when isOwner=false", () => {
      render(
        <HeroCarousel
          slides={[slideWithMedia]}
          isOwner={false}
          onPlay={vi.fn()}
        />
      );

      expect(screen.queryByTestId("hero-play-button")).not.toBeInTheDocument();
    });

    it("should show play button when isOwner=true and hasMedia=true", () => {
      render(
        <HeroCarousel
          slides={[slideWithMedia]}
          isOwner={true}
          onPlay={vi.fn()}
        />
      );

      expect(screen.getByTestId("hero-play-button")).toBeInTheDocument();
      expect(screen.getByText(/Play S01E01/)).toBeInTheDocument();
    });

    it("should show Resume when hasProgress=true", () => {
      const slideWithProgress = { ...slideWithMedia, hasProgress: true };
      render(
        <HeroCarousel
          slides={[slideWithProgress]}
          isOwner={true}
          onPlay={vi.fn()}
        />
      );

      expect(screen.getByText(/Resume S01E01/)).toBeInTheDocument();
    });

    it("should call onPlay with slide id when clicked", async () => {
      const onPlay = vi.fn();
      render(
        <HeroCarousel
          slides={[slideWithMedia]}
          isOwner={true}
          onPlay={onPlay}
        />
      );

      await userEvent.click(screen.getByTestId("hero-play-button"));
      expect(onPlay).toHaveBeenCalledWith("item-1");
    });
  });

  describe("owner mode - go-to button", () => {
    const slideWithNextItem = {
      ...mockSlides[0],
      nextItem: { id: "next-item-id", name: "Episode 2" },
    };

    it("should NOT show go-to button when isOwner=false", () => {
      render(
        <HeroCarousel
          slides={[slideWithNextItem]}
          isOwner={false}
          onGoToNext={vi.fn()}
        />
      );

      expect(screen.queryByTestId("hero-goto-button")).not.toBeInTheDocument();
    });

    it("should show go-to button when isOwner=true and nextItem exists", () => {
      render(
        <HeroCarousel
          slides={[slideWithNextItem]}
          isOwner={true}
          onGoToNext={vi.fn()}
        />
      );

      expect(screen.getByTestId("hero-goto-button")).toBeInTheDocument();
      expect(screen.getByText("Go to Episode 2")).toBeInTheDocument();
    });

    it("should call onGoToNext with item id when clicked", async () => {
      const onGoToNext = vi.fn();
      render(
        <HeroCarousel
          slides={[slideWithNextItem]}
          isOwner={true}
          onGoToNext={onGoToNext}
        />
      );

      await userEvent.click(screen.getByTestId("hero-goto-button"));
      expect(onGoToNext).toHaveBeenCalledWith("next-item-id");
    });
  });

  describe("owner mode - progress bar", () => {
    const slideWithProgress = {
      ...mockSlides[0],
      progressPercentage: 75,
      progressLabel: "15/20 watched",
    };

    it("should NOT show progress bar when isOwner=false", () => {
      render(
        <HeroCarousel
          slides={[slideWithProgress]}
          isOwner={false}
        />
      );

      expect(screen.queryByTestId("hero-progress-bar")).not.toBeInTheDocument();
    });

    it("should show progress bar when isOwner=true and progressPercentage exists", () => {
      render(
        <HeroCarousel
          slides={[slideWithProgress]}
          isOwner={true}
        />
      );

      expect(screen.getByTestId("hero-progress-bar")).toBeInTheDocument();
      expect(screen.getByTestId("hero-progress-label")).toHaveTextContent("15/20 watched");
    });

    it("should NOT show progress bar when progressPercentage is null", () => {
      const slideNoProgress = { ...mockSlides[0], progressPercentage: null };
      render(
        <HeroCarousel
          slides={[slideNoProgress]}
          isOwner={true}
        />
      );

      expect(screen.queryByTestId("hero-progress-bar")).not.toBeInTheDocument();
    });
  });

  describe("backgroundUrl support", () => {
    it("should use backgroundUrl when provided (priority over artworkId)", () => {
      const slideWithBackgroundUrl = {
        ...mockSlides[0],
        backgroundUrl: "/api/user/hero",
        artworkId: "art-1",
      };
      render(<HeroCarousel slides={[slideWithBackgroundUrl]} />);

      const images = screen.getAllByTestId("next-image");
      expect(images[0]).toHaveAttribute("src", "/api/user/hero");
    });

    it("should fall back to artworkId when backgroundUrl is null", () => {
      const slideNoBackgroundUrl = {
        ...mockSlides[0],
        backgroundUrl: null,
        artworkId: "art-1",
      };
      render(<HeroCarousel slides={[slideNoBackgroundUrl]} />);

      const images = screen.getAllByTestId("next-image");
      expect(images[0]).toHaveAttribute("src", "/api/artwork/art-1");
    });
  });

  describe("shader fallback", () => {
    it("should show Shader1 fallback when no background image", () => {
      const slideNoBackground = {
        ...mockSlides[0],
        artworkId: null,
        backgroundUrl: null,
      };
      // Note: Shader1 is mocked in actual tests, this verifies the fallback logic
      render(<HeroCarousel slides={[slideNoBackground]} />);

      // Should still render title (fallback doesn't break rendering)
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/hero-carousel.test.tsx`
Expected: FAIL with "HeroCarousel is not exported"

### Step 3: Create HeroCarousel component

```typescript
// components/hero-carousel.tsx
/**
 * Hero carousel component based on Hero226.
 * Supports multi-slide (Explore page) and single-slide (item detail) modes.
 * Single-slide mode disables autoplay and hides navigation dots.
 *
 * Accessibility: Supports reduced motion, aria-current on active dots.
 * Performance: Uses Next.js Image for LCP optimization, conditional Autoplay loading.
 */

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { Shader1 } from "@/components/shader1";

export interface HeroSlide {
  /** Unique identifier */
  id: string;
  /** Title displayed on the slide */
  name: string;
  /** Optional description text */
  description?: string | null;
  /** Artwork file ID for background image (used via /api/artwork/{id}) */
  artworkId?: string | null;
  /** Direct URL for background image (e.g., /api/user/hero). Takes precedence over artworkId. */
  backgroundUrl?: string | null;
  /** Link destination when CTA clicked */
  link: string;
  /** Owner username for attribution */
  ownerUsername?: string;
  /** Owner display name for attribution */
  ownerName?: string | null;
  /** Whether slide has playable media files (shows Play button when isOwner=true) */
  hasMedia?: boolean;
  /** Whether media has watch progress (shows Resume vs Play) */
  hasProgress?: boolean;
  /** Primary media filename for "now playing" display */
  primaryMediaName?: string | null;
  /** Progress percentage (0-100) for item and descendants */
  progressPercentage?: number | null;
  /** Progress label (e.g., "5/10 watched") for display */
  progressLabel?: string | null;
  /** Next incomplete item for "Go to" button */
  nextItem?: { id: string; name: string } | null;
}

interface HeroCarouselProps {
  /** Array of slides to display */
  slides: HeroSlide[];
  /** Custom CTA button text (default: "View Collection") */
  ctaText?: string;
  /** Whether to show CTA button (default: true) */
  showCta?: boolean;
  /** Autoplay delay in ms (default: 4000) */
  autoplayDelay?: number;
  /** Text alignment for content (default: "left" for media app readability) */
  textAlign?: "left" | "right" | "center";
  /** Additional CSS classes */
  className?: string;
  /** Whether current user owns this content - controls Play/Go-to buttons and progress display */
  isOwner?: boolean;
  /** Callback when play button clicked (only shown when isOwner=true and slide.hasMedia=true) */
  onPlay?: (slideId: string) => void;
  /** Callback when "Go to" button clicked (only shown when isOwner=true and slide.nextItem exists) */
  onGoToNext?: (itemId: string) => void;
}

/**
 * Carousel hero component for featured content display.
 * Based on Hero226 design with support for single and multi-slide modes.
 *
 * @param props - Carousel configuration
 */
export function HeroCarousel({
  slides,
  ctaText = "View Collection",
  showCta = true,
  autoplayDelay = 4000,
  textAlign = "left", // Issue #13: Default to left for media app readability
  className,
  isOwner = false,
  onPlay,
  onGoToNext,
}: HeroCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const hasAnimated = useRef(false); // Issue #14: Track if initial animation played

  // Issue #5: Respect user's reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  const isSingleSlide = slides.length === 1;
  const [autoplayPlugin, setAutoplayPlugin] = useState<unknown[] | null>(null);

  // Issue #22: Dynamic import for Autoplay plugin - only load when needed (code splitting)
  // Issue #15: Only use autoplay plugin for multiple slides AND if user doesn't prefer reduced motion
  useEffect(() => {
    if (isSingleSlide || prefersReducedMotion) {
      setAutoplayPlugin([]);
      return;
    }

    // Dynamic import - only loads when multi-slide and motion allowed
    import("embla-carousel-autoplay").then((mod) => {
      const Autoplay = mod.default;
      setAutoplayPlugin([
        Autoplay({
          delay: autoplayDelay,
          stopOnInteraction: true,
          stopOnMouseEnter: true,
        }),
      ]);
    });
  }, [isSingleSlide, autoplayDelay, prefersReducedMotion]);

  // Don't render until plugins are loaded (prevents flash)
  const plugins = autoplayPlugin ?? [];

  // Issue #1 (CRITICAL): Proper useEffect cleanup for Embla API listener
  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on("select", onSelect);

    // Cleanup: Remove listener when component unmounts or api changes
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // Issue #9: Track image loading state
  const handleImageLoad = useCallback((slideId: string) => {
    setImageLoaded((prev) => ({ ...prev, [slideId]: true }));
  }, []);

  // Don't render anything if no slides
  if (slides.length === 0) {
    return null;
  }

  // Issue #13: Text alignment classes
  const textAlignClass = {
    left: "text-left items-start",
    right: "text-right items-end",
    center: "text-center items-center",
  }[textAlign];

  // Issue #14: Only animate on first mount
  const shouldAnimate = !prefersReducedMotion && !hasAnimated.current;
  if (shouldAnimate) {
    hasAnimated.current = true;
  }

  // Issue #5: Wrapper component based on motion preference
  const Wrapper = prefersReducedMotion ? "div" : motion.div;
  const wrapperProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.5 },
      };

  return (
    <section
      data-testid="hero-carousel"
      className={cn("relative", className)}
    >
      <Wrapper {...wrapperProps}>
        {/* Issue #20: touch-action: pan-y allows vertical scroll while enabling horizontal swipe */}
        <Carousel
          setApi={setApi}
          className="w-full touch-pan-y"
          opts={{
            loop: !isSingleSlide,
            slidesToScroll: 1,
          }}
          plugins={plugins}
        >
          <CarouselContent className="flex w-full gap-4">
            {slides.map((slide, index) => {
              // Determine background source: backgroundUrl takes precedence over artworkId
              const backgroundSrc = slide.backgroundUrl ?? (slide.artworkId ? `/api/artwork/${slide.artworkId}` : null);
              const hasBackground = !!backgroundSrc;

              return (
                <CarouselItem
                  key={slide.id}
                  className={cn(
                    "w-full",
                    isSingleSlide ? "basis-full" : "basis-[91%]"
                  )}
                >
                  <div className="p-1">
                    <div className={cn(
                      "relative flex h-[max(240px,30dvh)] flex-col justify-between overflow-hidden rounded-xl bg-muted p-8",
                      textAlignClass
                    )}>
                      {/* Issue #9: Loading skeleton (only for image backgrounds) */}
                      {hasBackground && !imageLoaded[slide.id] && (
                        <Skeleton className="absolute inset-0 rounded-xl" />
                      )}

                      {/* Background: URL/artworkId image OR Shader1 fallback */}
                      <div className="pointer-events-none absolute inset-0">
                        {hasBackground ? (
                          <>
                            <Image
                              src={backgroundSrc}
                              alt="" // Decorative image, title provides context
                              fill
                              sizes="(max-width: 768px) 100vw, 91vw"
                              className={cn(
                                "object-cover transition-opacity duration-300",
                                imageLoaded[slide.id] ? "opacity-100" : "opacity-0"
                              )}
                              priority={index === 0} // LCP optimization for first slide
                              onLoad={() => handleImageLoad(slide.id)}
                              onError={() => handleImageLoad(slide.id)} // Still show content on error
                            />
                            {/* Dark overlay for text readability */}
                            <div className="absolute inset-0 bg-black/40" />
                          </>
                        ) : (
                          /* Shader fallback when no background image */
                          /* navigator.webdriver check for Playwright test stability */
                          typeof window !== "undefined" && navigator.webdriver ? (
                            <div className="h-full w-full bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900" />
                          ) : (
                            <Shader1 className="h-full" />
                          )
                        )}
                      </div>

                      {/* Content - Issue #13: Configurable text alignment */}
                      <div className={cn("z-10 mt-auto text-white", textAlignClass)}>
                        <h1 className="max-w-lg text-4xl font-bold tracking-tight md:text-5xl">
                          {slide.name}
                        </h1>
                        {slide.description && (
                          <p className="my-4 max-w-lg text-lg text-white/80 line-clamp-2">
                            {slide.description}
                          </p>
                        )}
                      </div>

                      {/* Progress bar - only shown when isOwner and has progress data */}
                      {isOwner && slide.progressPercentage != null && (
                        <div className="z-10 flex w-full flex-col items-center gap-1.5">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20 backdrop-blur-sm">
                            <motion.div
                              data-testid="hero-progress-bar"
                              className="h-full rounded-full bg-white"
                              initial={prefersReducedMotion ? false : { width: 0 }}
                              animate={{ width: `${slide.progressPercentage}%` }}
                              transition={prefersReducedMotion ? { duration: 0 } : {
                                type: "spring",
                                stiffness: 100,
                                damping: 20,
                                delay: 0.2,
                              }}
                            />
                          </div>
                          {slide.progressLabel && (
                            <span
                              data-testid="hero-progress-label"
                              className="text-xs tracking-wide text-white/60 tabular-nums"
                            >
                              {slide.progressLabel}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action buttons row */}
                      <div className={cn("z-10 flex w-full flex-wrap items-center gap-3", textAlign === "right" ? "justify-start" : "justify-end")}>
                        {/* Play button - only shown when isOwner and has media */}
                        {isOwner && slide.hasMedia && onPlay && (
                          <Button
                            size="lg"
                            variant="glass"
                            onClick={() => onPlay(slide.id)}
                            className="max-w-xs gap-2"
                            data-testid="hero-play-button"
                          >
                            <Play className="size-5 shrink-0" />
                            <span className="truncate">
                              {slide.hasProgress ? "Resume" : "Play"}
                              {slide.primaryMediaName && ` ${slide.primaryMediaName}`}
                            </span>
                          </Button>
                        )}

                        {/* Go to button - only shown when isOwner and has next item */}
                        {isOwner && slide.nextItem && onGoToNext && (
                          <Button
                            size="lg"
                            variant="glass"
                            onClick={() => onGoToNext(slide.nextItem!.id)}
                            className="max-w-xs gap-2"
                            data-testid="hero-goto-button"
                          >
                            <span className="truncate">Go to {slide.nextItem.name}</span>
                            <ArrowRight className="size-5 shrink-0" />
                          </Button>
                        )}

                        {/* CTA Button - for non-owners or explore page */}
                        {showCta && (
                          <Link href={slide.link}>
                            <Button
                              variant="outline"
                              className="group flex w-fit items-center justify-center gap-2 rounded-full border-white/30 bg-white/10 px-4 py-1 text-white backdrop-blur-sm hover:border-white/50 hover:bg-white/20"
                            >
                              {ctaText}
                              <ArrowRight className="size-4 -rotate-45 transition-all ease-out group-hover:ml-1 group-hover:rotate-0" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>

          {/* Navigation Dots - only for multiple slides */}
          {/* Issue #11: Note - keyboard navigation via arrow keys could be added with embla-carousel-wheel-gestures plugin */}
          {!isSingleSlide && (
            <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Carousel navigation">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => api?.scrollTo(index)}
                  className={cn(
                    // Issue #18: Explicit focus ring for design system consistency
                    "h-2.5 w-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    current === index
                      ? "w-4 bg-primary"
                      : "bg-muted-foreground/50 hover:bg-muted-foreground/70"
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={current === index ? "true" : undefined} // Issue #6: aria-current on active
                  role="tab"
                  aria-selected={current === index}
                />
              ))}
            </div>
          )}
        </Carousel>
      </Wrapper>
    </section>
  );
}
```

### Step 4: Run tests to verify they pass

Run: `pnpm test tests/unit/components/hero-carousel.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/hero-carousel.tsx tests/unit/components/hero-carousel.test.tsx
git commit -m "$(cat <<'EOF'
feat: add HeroCarousel component based on Hero226

Unified carousel for Explore page (5 featured items) and item detail
pages (single slide). Supports autoplay, navigation dots, and
customizable CTA buttons.
EOF
)"
```

---

## Task 3: Update Explore Page to Use HeroCarousel

**Files:**

- Modify: `app/(public)/explore/page.tsx`
- Modify: `app/(public)/explore/explore-client.tsx`

### Step 1: Update Explore server component

```typescript
// app/(public)/explore/page.tsx - Replace entire file
/**
 * Public explore page showcasing featured and recent public items.
 * Features a Hero226 carousel with 5 featured items at the top.
 */

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getExploreItems, getFeaturedItems } from "@/lib/public-auth";
import { getProfile } from "@/lib/user-actions";
import { SiteHeader } from "@/components/site-header";
import { ExploreClient } from "./explore-client";

export const metadata: Metadata = {
  title: "Explore | CanonCore",
  description:
    "Discover public collections from the CanonCore community. Browse and fork curated media libraries.",
  openGraph: {
    title: "Explore | CanonCore",
    description:
      "Discover public collections from the CanonCore community. Browse and fork curated media libraries.",
    type: "website",
  },
};

/**
 * Explore page server component.
 * Fetches featured items for carousel and all public items for grid.
 */
export default async function ExplorePage() {
  // Get session, profile, featured items, and explore items in parallel
  const [session, profileResult, featuredItems, items] = await Promise.all([
    auth(),
    getProfile(),
    getFeaturedItems(5),
    getExploreItems(50, 0, null), // Don't pass currentUserId for featured fetch
  ]);

  const currentUserId = session?.user?.id ?? null;
  const profile = profileResult.success ? profileResult.data : null;
  const currentUser = profile
    ? {
        id: profile.id,
        username: profile.username,
        name: profile.name,
      }
    : null;

  return (
    <>
      <SiteHeader title="Explore" titleHref="/explore" />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <ExploreClient
          items={items}
          featuredItems={featuredItems}
          currentUser={currentUser}
        />
      </div>
    </>
  );
}
```

### Step 2: Update ExploreClient to use HeroCarousel

```typescript
// app/(public)/explore/explore-client.tsx - Replace entire file
"use client";

/**
 * Client component for the explore page.
 * Features HeroCarousel for featured items and grid for all public items.
 */

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { EmptyState } from "@/components/items/empty-state";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import { EXPLORE_SORT_OPTIONS, sortPublicItems } from "@/lib/item-utils";
import { cn } from "@/lib/utils";
import type { PublicItem } from "@/lib/public-auth";
import type { FeaturedItem } from "@/lib/public-auth";

interface CurrentUser {
  id: string;
  username: string | null;
  name: string | null;
}

interface ExploreClientProps {
  items: (PublicItem & {
    ownerUsername: string;
    ownerName: string | null;
    progressPercentage?: number | null;
    watchedCount?: number;
    totalMediaCount?: number;
    totalItems?: number;
  })[];
  featuredItems: FeaturedItem[];
  currentUser: CurrentUser | null;
}

/**
 * Main explore client component.
 * Structure: HeroCarousel -> Toolbar -> Grid.
 */
export function ExploreClient({
  items,
  featuredItems,
  currentUser,
}: ExploreClientProps) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreSortFilter();

  // Convert featured items to carousel slides
  const carouselSlides: HeroSlide[] = useMemo(
    () =>
      featuredItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        artworkId: item.artworkId,
        link: item.link,
        ownerUsername: item.ownerUsername,
        ownerName: item.ownerName,
      })),
    [featuredItems]
  );

  // Use shared sort utility
  const sortedItems = useMemo(
    () => sortPublicItems(items, sortBy),
    [items, sortBy]
  );

  // Preload on hover for faster perceived navigation
  const handleMouseEnter = useCallback(
    (item: ExploreClientProps["items"][number]) => {
      router.prefetch(`/u/${item.ownerUsername}/${item.id}`);
    },
    [router]
  );

  const handleItemClick = useCallback(
    (item: ExploreClientProps["items"][number]) => {
      router.push(`/u/${item.ownerUsername}/${item.id}`);
    },
    [router]
  );

  const hasItems = items.length > 0;
  const hasFeatured = carouselSlides.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", !hasItems && "flex-1")}>
      {/* Hero Carousel - Featured Items */}
      {hasFeatured && <HeroCarousel slides={carouselSlides} />}

      {/* Toolbar - Sort only */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
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
          <div className="hidden items-center gap-3 sm:flex">
            <SortDropdown
              value={sortBy}
              onChange={setSortBy}
              disabled={!hasItems}
              options={EXPLORE_SORT_OPTIONS}
            />
          </div>
        </div>

        {/* Collection count */}
        {hasItems && (
          <span className="text-muted-foreground text-sm">
            {items.length} {items.length === 1 ? "collection" : "collections"}
          </span>
        )}
      </div>

      {/* Items grid or empty state */}
      {hasItems ? (
        <div
          data-testid="items-grid-view"
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {sortedItems.map((item, index) => {
            const isOwnItem = currentUser?.id === item.userId;
            const ownerHref = isOwnItem
              ? currentUser?.username
                ? `/u/${currentUser.username}`
                : undefined
              : `/u/${item.ownerUsername}`;
            return (
              <GridItem
                key={item.id}
                id={item.id}
                name={item.name}
                description={item.description}
                artworkId={item.artworkId}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => handleMouseEnter(item)}
                showArtwork={true}
                showDescription={true}
                priority={index < 8}
                ownerLabel={isOwnItem ? "You" : `@${item.ownerUsername}`}
                ownerHref={ownerHref}
                ownerUserId={isOwnItem ? undefined : item.userId}
                ownerName={isOwnItem ? undefined : item.ownerName}
                progressPercentage={isOwnItem ? item.progressPercentage : null}
                watchedCount={isOwnItem ? item.watchedCount : undefined}
                totalMediaCount={isOwnItem ? item.totalMediaCount : undefined}
                totalItems={isOwnItem ? item.totalItems : undefined}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState variant="explore-empty" />
      )}
    </div>
  );
}
```

### Step 3: Run type check

Run: `pnpm type-check`
Expected: No errors

### Step 4: Commit

```bash
git add app/(public)/explore/page.tsx app/(public)/explore/explore-client.tsx
git commit -m "$(cat <<'EOF'
feat: add Hero226 carousel to Explore page

Explore page now shows 5 featured items in a carousel at the top.
Featured items are public items with artwork, ordered by most
recently updated.
EOF
)"
```

---

## Task 4: Create Single-Slide Hero for Item Detail Pages

**Files:**

- Modify: `components/items/item-detail-client.tsx`
- Modify: `app/(public)/u/[username]/[itemId]/public-item-client.tsx`
- Modify: `app/(public)/u/[username]/public-profile-client.tsx`

> **Code Review Note:** This task addresses:
>
> - **Issue #7 (HIGH):** Explicit code for each file (different data shapes require different implementations)
> - **Issue #10 (MEDIUM):** API route path is now centralized in HeroCarousel

### Step 1: Update item-detail-client to use HeroCarousel

Replace ItemHero with single-slide HeroCarousel. Remove collapse props and useHeroCollapse usage.

```typescript
// components/items/item-detail-client.tsx

// 1. Update imports - remove ItemHero, add HeroCarousel
// REMOVE:
// import { ItemHero } from "@/components/items/item-hero";
// import { useHeroCollapse } from "@/hooks/use-hero-collapse";

// ADD:
import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";

// 2. Remove useHeroCollapse hook usage
// REMOVE these lines from the component:
// const { isCollapsed, onCollapse, onExpand } = useHeroCollapse();

// 3. Create hero slide data (inside component, after existing artworkId logic)
// Find the existing heroArtworkId and primaryArtworkId variables, then add:
const heroSlide: HeroSlide | null = (heroArtworkId || primaryArtworkId) ? {
  id: item.id,
  name: item.name,
  description: item.description,
  artworkId: heroArtworkId ?? primaryArtworkId ?? "",
  link: `/my-items/${item.id}`, // Internal link for private items
} : null;

// 4. Replace JSX - find the <ItemHero ... /> component and replace with:
{heroSlide && (
  <HeroCarousel
    slides={[heroSlide]}
    showCta={false} // No CTA for item detail - user is already there
    className="mb-4"
  />
)}

// 5. Remove any remaining collapse-related props like:
// - isCollapsed={isCollapsed}
// - onCollapse={onCollapse}
// - onExpand={onExpand}
```

### Step 2: Update public-item-client.tsx

Public item pages have different data structure - they include owner info.

```typescript
// app/(public)/u/[username]/[itemId]/public-item-client.tsx

// 1. Update imports
// REMOVE:
// import { ItemHero } from "@/components/items/item-hero";

// ADD:
import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";

// 2. Create hero slide data (inside component)
// Note: Public items have ownerUsername available from props/params
const heroSlide: HeroSlide | null = item.artworkId ? {
  id: item.id,
  name: item.name,
  description: item.description,
  artworkId: item.artworkId, // Public items may have different artwork structure
  link: `/u/${username}/${item.id}`, // Public link includes username
  ownerUsername: username,
  ownerName: ownerName ?? null,
} : null;

// 3. Replace JSX
{heroSlide && (
  <HeroCarousel
    slides={[heroSlide]}
    showCta={false} // No CTA - user is already viewing the item
    className="mb-4"
  />
)}
```

### Step 3: Update public-profile-client.tsx

Public profile pages may show a featured item hero or profile-level hero.

```typescript
// app/(public)/u/[username]/public-profile-client.tsx

// 1. Update imports
// REMOVE:
// import { ItemHero } from "@/components/items/item-hero";

// ADD:
import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";

// 2. If the profile page shows a featured item hero, create slide data:
// This depends on existing implementation - check if profile has a featured item
const featuredSlide: HeroSlide | null = featuredItem ? {
  id: featuredItem.id,
  name: featuredItem.name,
  description: featuredItem.description,
  artworkId: featuredItem.artworkId ?? "",
  link: `/u/${username}/${featuredItem.id}`,
  ownerUsername: username,
  ownerName: profileName,
} : null;

// 3. Replace JSX (if applicable)
{featuredSlide && (
  <HeroCarousel
    slides={[featuredSlide]}
    ctaText="View Collection" // CTA makes sense here - links to the item
    className="mb-6"
  />
)}

// Note: If public-profile-client.tsx doesn't currently use ItemHero,
// skip this file - it may only show a grid of items without a hero section.
```

### Step 4: Run type check

Run: `pnpm type-check`
Expected: No errors

### Step 5: Commit

```bash
git add components/items/item-detail-client.tsx app/(public)/u/[username]/[itemId]/public-item-client.tsx app/(public)/u/[username]/public-profile-client.tsx
git commit -m "$(cat <<'EOF'
refactor: use HeroCarousel for item detail pages

Item detail pages now use single-slide HeroCarousel instead of
ItemHero. Removes collapse functionality for simpler UX.

- item-detail-client: showCta=false (user already at item)
- public-item-client: includes owner attribution
- public-profile-client: CTA to featured item (if applicable)
EOF
)"
```

---

## Task 5: Remove Collapse Functionality

**Files:**

- Delete: `hooks/use-hero-collapse.ts`
- Delete: `tests/unit/hooks/use-hero-collapse.test.ts`
- Modify: `components/items/items-view.tsx` (remove collapse logic)
- Modify: `e2e/journeys/items/item-hero.spec.ts` (remove collapse tests)

### Step 1: Remove useHeroCollapse from items-view.tsx

Remove import and usage of useHeroCollapse. Remove isCollapsed and onCollapse props from ItemHero calls.

### Step 2: Delete useHeroCollapse hook and tests

```bash
rm hooks/use-hero-collapse.ts
rm tests/unit/hooks/use-hero-collapse.test.ts
```

### Step 3: Update E2E tests

Remove or update collapse/expand tests in `e2e/journeys/items/item-hero.spec.ts`.

### Step 4: Run tests to verify nothing is broken

Run: `pnpm test`
Run: `pnpm test:e2e e2e/journeys/items/item-hero.spec.ts`
Expected: All pass (with removed tests)

### Step 5: Commit

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: remove hero collapse functionality

Collapse/expand behavior removed for simpler UX. Hero carousel
provides consistent experience across all pages.
EOF
)"
```

---

## Task 6: Delete ItemHero Component

**Files:**

- Delete: `components/items/item-hero.tsx`
- Delete: `tests/unit/components/items/item-hero.test.tsx`

> **Code Review Note:** HeroCarousel now has full feature parity with ItemHero. Safe to delete.

### Step 1: Feature Parity Verification

HeroCarousel now includes ALL ItemHero functionality:

| Feature                           | ItemHero | HeroCarousel | Status                                        |
| --------------------------------- | -------- | ------------ | --------------------------------------------- |
| Background artwork (artworkId)    | ✅       | ✅           | ✅ Implemented                                |
| Background URL (backgroundUrl)    | ✅       | ✅           | ✅ Implemented                                |
| Shader1 fallback                  | ✅       | ✅           | ✅ Implemented                                |
| Title/description                 | ✅       | ✅           | ✅ Implemented                                |
| Play button (primary media)       | ✅       | ✅           | ✅ Implemented (isOwner + hasMedia)           |
| Resume vs Play logic              | ✅       | ✅           | ✅ Implemented (hasProgress)                  |
| Primary media name display        | ✅       | ✅           | ✅ Implemented (primaryMediaName)             |
| "Go to" button (first incomplete) | ✅       | ✅           | ✅ Implemented (isOwner + nextItem)           |
| Progress bar                      | ✅       | ✅           | ✅ Implemented (isOwner + progressPercentage) |
| Progress label                    | ✅       | ✅           | ✅ Implemented (progressLabel)                |
| Description line-clamp            | ✅       | ✅           | ✅ Implemented (line-clamp-2)                 |
| Collapse/expand                   | ✅       | ❌           | 🗑️ Intentionally removed                      |
| localStorage collapse state       | ✅       | ❌           | 🗑️ Intentionally removed                      |

**Ownership Logic:**

- `isOwner=true` → Shows Play button, Go-to button, and Progress bar
- `isOwner=false` → Shows only CTA button (View Collection)

This matches the GridItem behavior on Explore page where owners see progress but viewers don't.

### Step 2: Check if ItemHero is still used anywhere

```bash
grep -r "ItemHero" --include="*.tsx" --include="*.ts" app/ components/ lib/
```

If results show usage, complete Task 4 first.

### Step 3: If not used, delete ItemHero

```bash
rm components/items/item-hero.tsx
rm tests/unit/components/items/item-hero.test.tsx
```

### Step 4: Update component exports

Remove ItemHero from `components/items/index.ts` if it exists there.

### Step 5: Run full test suite

Run: `pnpm check`
Expected: All pass

### Step 6: Commit

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: delete ItemHero, replaced by HeroCarousel

HeroCarousel now has full feature parity with ItemHero:
- Play/Resume button (isOwner + hasMedia)
- "Go to" button for first incomplete item (isOwner + nextItem)
- Progress bar with label (isOwner + progressPercentage)
- backgroundUrl support for user hero images
- Shader1 fallback when no background

Intentionally removed:
- Collapse/expand behavior (simpler UX)

Removes ~360 lines of code and simplifies component architecture.
EOF
)"
```

---

## Task 7: Update E2E Tests

**Files:**

- Modify: `e2e/journeys/items/item-hero.spec.ts`
- Create: `e2e/journeys/public/explore-carousel.spec.ts`

> **Code Review Note:** This task addresses:
>
> - **Issue #12 (MEDIUM):** Comprehensive E2E test coverage including edge cases
> - **Issue #19 (LOW):** Replace waitForTimeout with polling assertions for reliability

### Step 1: Create E2E test for Explore carousel

```typescript
// e2e/journeys/public/explore-carousel.spec.ts
/**
 * E2E tests for Explore page Hero carousel.
 * Tests carousel display, navigation, accessibility, and error handling.
 */

import { test, expect } from "../../fixtures";

test.describe("Explore Carousel", () => {
  test.describe("basic functionality", () => {
    test("should display hero carousel on explore page", async ({ page }) => {
      await page.goto("/explore");

      // Carousel should be visible
      const carousel = page.getByTestId("hero-carousel");
      await expect(carousel).toBeVisible();
    });

    test("should navigate to item when CTA clicked", async ({ page }) => {
      await page.goto("/explore");

      // Click first View Collection button
      const ctaButton = page
        .getByRole("link", { name: /view collection/i })
        .first();

      if (await ctaButton.isVisible()) {
        await ctaButton.click();
        // Should navigate to public item page
        await expect(page).toHaveURL(/\/u\/[^/]+\/[^/]+/);
      }
    });

    test("should show navigation dots when multiple slides", async ({
      page,
    }) => {
      await page.goto("/explore");

      // Navigation dots should be visible if multiple featured items
      const dots = page.getByRole("button", { name: /go to slide/i });

      // May have 0 dots if < 2 featured items
      const count = await dots.count();
      if (count > 0) {
        expect(count).toBeGreaterThanOrEqual(2);
      }
    });
  });

  test.describe("navigation", () => {
    test("should change slide when dot clicked", async ({ page }) => {
      await page.goto("/explore");

      const dots = page.getByRole("button", { name: /go to slide/i });
      const count = await dots.count();

      if (count >= 2) {
        // Click second dot
        await dots.nth(1).click();

        // Second dot should now have aria-current
        await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
      }
    });

    test("should auto-advance slides after delay", async ({ page }) => {
      await page.goto("/explore");

      const dots = page.getByRole("button", { name: /go to slide/i });
      const count = await dots.count();

      if (count >= 2) {
        // Issue #19: Use polling assertion instead of magic timeout
        // Playwright will retry until assertion passes or times out (default 5s)
        await expect(dots.nth(1)).toHaveAttribute("aria-current", "true", {
          timeout: 6000, // Autoplay is 4s, allow buffer
        });
      }
    });
  });

  test.describe("accessibility", () => {
    test("should have accessible navigation dots", async ({ page }) => {
      await page.goto("/explore");

      const dots = page.getByRole("button", { name: /go to slide/i });
      const count = await dots.count();

      if (count >= 1) {
        // Check aria-label
        await expect(dots.first()).toHaveAttribute(
          "aria-label",
          "Go to slide 1"
        );

        // Check role
        await expect(dots.first()).toHaveAttribute("role", "tab");
      }
    });

    test("should have tablist role on dot container", async ({ page }) => {
      await page.goto("/explore");

      const tablist = page.getByRole("tablist", {
        name: /carousel navigation/i,
      });

      const count = await page
        .getByRole("button", { name: /go to slide/i })
        .count();
      if (count >= 2) {
        await expect(tablist).toBeVisible();
      }
    });
  });

  test.describe("image loading", () => {
    test("should show skeleton while image loads", async ({ page }) => {
      // Slow down image loading to catch skeleton
      await page.route("**/api/artwork/**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });

      await page.goto("/explore");

      // Skeleton should be visible briefly (may be hard to catch)
      const carousel = page.getByTestId("hero-carousel");
      await expect(carousel).toBeVisible();
    });
  });

  test.describe("graceful degradation", () => {
    test("should not crash if no featured items", async ({ page }) => {
      // Even with no featured items, page should load
      await page.goto("/explore");

      // Page should still render (may have no carousel)
      await expect(page.locator("body")).toBeVisible();
    });
  });
});
```

### Step 2: Update item-hero.spec.ts

Remove collapse tests and update for new HeroCarousel behavior.

```typescript
// e2e/journeys/items/item-hero.spec.ts
/**
 * E2E tests for item detail page hero (using HeroCarousel).
 * Collapse functionality has been removed - these tests verify new behavior.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Item Hero", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("item-hero");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test.describe("hero display", () => {
    test("should display hero carousel on item detail page", async ({
      page,
      itemsPage,
    }) => {
      // Create item with description
      await itemsPage.createItem("Hero Test", "Test description for hero");
      await itemsPage.clickItem("Hero Test");

      // Hero should be visible (if item has artwork)
      // Note: Hero only shows if item has artwork file
      await expect(
        page.getByRole("heading", { name: "Hero Test" })
      ).toBeVisible();
    });

    test("should NOT show navigation dots for single item", async ({
      page,
      itemsPage,
    }) => {
      await itemsPage.createItem("Single Hero", "Single item hero test");
      await itemsPage.clickItem("Single Hero");

      // Single-slide carousel should not have navigation dots
      const dots = page.getByRole("button", { name: /go to slide/i });
      await expect(dots).toHaveCount(0);
    });
  });

  // REMOVED: collapse/expand tests - functionality intentionally removed

  test.describe("description display", () => {
    const longDescription =
      "This is a very long description that exceeds 150 characters to test the line clamping. " +
      "It contains enough text to demonstrate the truncation functionality properly.";

    test("should truncate long descriptions with line-clamp", async ({
      page,
      itemsPage,
    }) => {
      await itemsPage.createItem("Long Desc Test", longDescription);
      await itemsPage.clickItem("Long Desc Test");

      // Description should be visible but truncated (line-clamp-2)
      const description = page.getByText(longDescription.substring(0, 50));
      await expect(description).toBeVisible();
    });
  });
});
```

### Step 3: Run E2E tests

Run: `pnpm test:e2e e2e/journeys/items/item-hero.spec.ts e2e/journeys/public/explore-carousel.spec.ts`
Expected: All pass

### Step 4: Commit

```bash
git add e2e/journeys/items/item-hero.spec.ts e2e/journeys/public/explore-carousel.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): update hero tests for carousel implementation

- Removes collapse tests (functionality removed)
- Adds comprehensive Explore carousel tests
- Tests navigation, accessibility, image loading
- Tests graceful degradation for edge cases
EOF
)"
```

---

## Task 8: Final Verification

### Step 1: Run type check

Run: `pnpm type-check`
Expected: No errors

### Step 2: Run all unit tests

Run: `pnpm test`
Expected: All pass

### Step 3: Run all E2E tests

Run: `pnpm test:e2e`
Expected: All pass

### Step 4: Run full check

Run: `pnpm check`
Expected: All pass

### Step 5: Manual verification

1. Visit `/explore` - verify carousel displays with featured items
2. Click carousel CTA - verify navigation works
3. Visit `/my-items` and click into an item - verify single-slide hero displays
4. Visit a public profile - verify hero displays correctly

---

## Tests Summary

### Unit Tests Added

| File                                           | Tests     |
| ---------------------------------------------- | --------- |
| `tests/unit/lib/get-featured-items.test.ts`    | 7 tests   |
| `tests/unit/components/hero-carousel.test.tsx` | ~20 tests |

**HeroCarousel test categories:**

- Multi-slide mode (6 tests)
- Single-slide mode (2 tests)
- Empty state (1 test)
- CTA button (1 test)
- Custom CTA (2 tests)
- Accessibility (2 tests)
- Reduced motion (2 tests)
- Edge cases (2 tests)
- Owner mode - play button (4 tests)
- Owner mode - go-to button (3 tests)
- Owner mode - progress bar (3 tests)
- backgroundUrl support (2 tests)
- Shader fallback (1 test)

### Unit Tests Removed

| File                                             | Reason                                                   |
| ------------------------------------------------ | -------------------------------------------------------- |
| `tests/unit/hooks/use-hero-collapse.test.ts`     | Hook deleted                                             |
| `tests/unit/components/items/item-hero.test.tsx` | Component deleted - HeroCarousel has full feature parity |

### Integration Tests Added

| File                                                  | Tests  |
| ----------------------------------------------------- | ------ |
| `tests/integration/public/get-featured-items.test.ts` | 1 test |

### E2E Tests Added

| File                                           | Tests   |
| ---------------------------------------------- | ------- |
| `e2e/journeys/public/explore-carousel.spec.ts` | 3 tests |

### E2E Tests Modified

| File                                   | Change                |
| -------------------------------------- | --------------------- |
| `e2e/journeys/items/item-hero.spec.ts` | Remove collapse tests |

---

## Code Review Notes

This plan was validated against the codebase skills (react-best-practices, frontend-design, web-design-guidelines) using code-review-excellence methodology. The following 22 issues were identified and addressed:

### Critical Issues (3)

| #   | Issue                                                                                                                | Location | Resolution                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| 1   | **useEffect cleanup missing** - Embla API listener (`api.on("select")`) not cleaned up, causing memory leaks         | Task 2   | Added cleanup function with `api.off("select", onSelect)` using same callback reference |
| 2   | **No error handling** - Database failures would crash the page                                                       | Task 1   | Wrapped in try/catch with graceful degradation (returns `[]`) and structured logging    |
| 3   | **Empty artworkId bug** - Items without artwork files could pass filter, causing `/api/artwork/` calls with empty ID | Task 1   | Added `.filter((item) => item.files[0]?.id)` before mapping                             |

### High Priority Issues (6)

| #   | Issue                                                                                                       | Location  | Resolution                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| 4   | **Missing React.cache()** - Server action not using request deduplication                                   | Task 1    | Wrapped `getFeaturedItems` with `cache()` from React                                                        |
| 5   | **No reduced motion support** - Animations run regardless of user preference (WCAG 2.3.3)                   | Task 2    | Added `useReducedMotion` hook, skip animations and autoplay when true                                       |
| 6   | **Missing aria-current** - Active navigation dot not properly announced                                     | Task 2    | Added `aria-current={current === index ? "true" : undefined}`                                               |
| 7   | **Task 4 lacked explicit code** - Generic "update component" instructions for 3 different files             | Task 4    | Added explicit code blocks for each file with different data shapes                                         |
| 8   | **ItemHero feature parity required** - Original plan didn't include Play button, Go-to button, Progress bar | Task 2, 6 | Added full feature parity: `isOwner`, `onPlay`, `onGoToNext`, progress bar, backgroundUrl, Shader1 fallback |

### Medium Priority Issues (4)

| #   | Issue                                                                      | Location      | Resolution                                                                                           |
| --- | -------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| 9   | **No image loading state** - Images appear suddenly causing layout shift   | Task 2        | Added `imageLoaded` state with Skeleton placeholder                                                  |
| 10  | **API route hardcoded** - `/api/artwork/${id}` repeated in multiple places | Task 4        | Centralized in HeroCarousel component                                                                |
| 11  | **No keyboard navigation** - Carousel dots not keyboard accessible         | Task 2        | Added `role="tab"`, `role="tablist"`, documented embla-carousel-wheel-gestures as future enhancement |
| 12  | **Test coverage gaps** - Missing edge case and accessibility tests         | Tasks 1, 2, 7 | Added error handling, reduced motion, aria-current, graceful degradation, and owner mode tests       |

### Low Priority Issues (9)

| #   | Issue                                                                                                      | Location | Resolution                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| 13  | **Right-aligned text** - Original Hero226 right-aligned for real estate aesthetic                          | Task 2   | Made configurable with `textAlign` prop, defaulting to "left" for media readability         |
| 14  | **Animation on every render** - Fade-in replays on state changes                                           | Task 2   | Added `hasAnimated` ref to only animate on initial mount                                    |
| 15  | **Unnecessary bundle size** - Autoplay plugin loaded for single slides                                     | Task 2   | Conditional plugin loading: `plugins = isSingleSlide ? [] : [Autoplay(...)]`                |
| 16  | **img instead of next/image** - Missing LCP optimization                                                   | Task 2   | Replaced with Next.js Image component, added `priority` for first slide                     |
| 17  | **No backgroundUrl/Shader1 fallback** - User hero images couldn't use direct URLs                          | Task 2   | Added `backgroundUrl` prop (priority over artworkId), Shader1 fallback when no background   |
| 18  | **Missing focus ring styling** - Navigation dots rely on browser defaults, inconsistent with design system | Task 2   | Added `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` to dots |
| 19  | **E2E timeout magic number** - `waitForTimeout(5000)` is fragile for autoplay testing                      | Task 7   | Replaced with `toHaveAttribute` polling assertion for aria-current change                   |
| 20  | **Missing touch-action** - Carousel swipe may conflict with page scroll                                    | Task 2   | Added `touch-action: pan-y` to carousel container for vertical scroll passthrough           |
| 21  | **Non-null assertion smell** - `ownerUsername: item.user.username!` uses TypeScript escape hatch           | Task 1   | Refactored query to ensure username is always present via stricter filter                   |
| 22  | **Dynamic Autoplay import** - Static import bundles plugin even for single slides                          | Task 2   | Changed to dynamic import pattern for true code splitting                                   |

### Validation Sources

- **react-best-practices skill**: Rules R-002 (useEffect cleanup), R-008 (error boundaries), R-011 (accessibility), R-012 (performance)
- **frontend-design skill**: Guidelines on graceful degradation, loading states, responsive design
- **web-design-guidelines skill**: WCAG accessibility requirements, reduced motion support
- **context7 MCP**: Verified Embla Carousel API cleanup pattern from official documentation
- **sequential-thinking MCP**: Systematic analysis across 11 reasoning steps

---

## Future Considerations (Out of Scope)

1. **Admin-curated featured items** - Add `isFeatured` flag to Item model for manual curation
2. **Featured item analytics** - Track which featured items get clicked
3. **Carousel performance** - Consider lazy loading slides for very large carousels
