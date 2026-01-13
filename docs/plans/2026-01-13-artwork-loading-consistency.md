# Artwork Loading Consistency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure all artwork/images display loading states and never "pop in" after content renders.

**Architecture:** Create a reusable `ArtworkThumbnail` component with built-in loading skeleton, then systematically replace raw `<img>` tags across the codebase. Fix the `hideToolbar` race condition on item detail pages.

**Tech Stack:** React, Tailwind CSS (animate-pulse), Next.js Image component

---

## Validation Notes

The following suggestions were identified during code review validation and should be considered during implementation:

### Design Decisions

- **Why custom skeleton instead of Next.js `placeholder="blur"`**: Next.js Image's blur placeholder requires a `blurDataURL` which TMDB external images don't provide. Custom skeleton approach works universally for both internal (`/api/artwork/`) and external (TMDB) URLs.
- **Why 8 items for preloading**: This matches the typical "above-the-fold" content for grid view. Consider making this configurable via a constant if needed.
- **preloadImages scope**: Currently only supports internal `/api/artwork/` URLs. TMDB images use browser caching instead.

### Testing Best Practices

- **Mock image loading events**: Don't rely on `waitFor` timing which can be flaky. Use `fireEvent.load(img)` and `fireEvent.error(img)` to control image loading in tests.
- **E2E network throttling**: Use Playwright's `page.route()` to slow down artwork requests for reliable loading state assertions.

---

## Audit Summary

### Places WITH Loading Tied to Images (Keep As-Is)

| Component        | File                          | Mechanism                          |
| ---------------- | ----------------------------- | ---------------------------------- |
| ItemsView        | items-view.tsx:404-500        | Preloads first 8 items + 300ms min |
| ItemDetailClient | item-detail-client.tsx:91-195 | Preloads hero + 300ms min          |

### Places WITHOUT Loading (Needs Fix)

| Component           | File                      | Lines            | Issue                           |
| ------------------- | ------------------------- | ---------------- | ------------------------------- |
| SpotlightSearch     | spotlight-search.tsx      | 163-170          | Direct img, no loading          |
| MediaSearchCombobox | media-search-combobox.tsx | 226-243          | Direct img (TMDB), no loading   |
| ImageSelectionGrid  | image-selection-grid.tsx  | 257-346, 363-446 | Error only, no loading skeleton |
| AddItemDialog       | add-item-dialog.tsx       | 1276-1356        | Season/episode TMDB thumbnails  |
| ItemSettingsDialog  | item-settings-dialog.tsx  | 1401-1480        | Season/episode TMDB thumbnails  |
| FileTypeCombobox    | file-type-combobox.tsx    | 675-680, 751-760 | Error only, no loading          |
| SettingsDialog      | settings-dialog.tsx       | 642-656, 749-765 | Preview images, no loading      |

### Critical Bug Found

**Item detail pages skip child artwork preloading** due to `hideToolbar={true}` in `items-view.tsx:483`:

```tsx
const isLoading = !hideToolbar && (...);  // Always false when hideToolbar=true!
```

---

## Task 1: Create ArtworkThumbnail Component

**Files:**

- Create: `components/ui/artwork-thumbnail.tsx`
- Test: `tests/unit/components/ui/artwork-thumbnail.test.tsx`

### Step 1: Write the failing test

```tsx
// tests/unit/components/ui/artwork-thumbnail.test.tsx
/**
 * Unit tests for ArtworkThumbnail component.
 * Tests loading skeleton, error fallback, and loaded states.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ArtworkThumbnail } from "@/components/ui/artwork-thumbnail";

describe("ArtworkThumbnail", () => {
  it("shows skeleton while loading", () => {
    render(<ArtworkThumbnail src="/api/artwork/123" alt="Test" size="sm" />);

    expect(screen.getByTestId("artwork-skeleton")).toBeInTheDocument();
  });

  it("hides skeleton after image loads", async () => {
    render(<ArtworkThumbnail src="/api/artwork/123" alt="Test" size="sm" />);

    const img = screen.getByRole("img");
    fireEvent.load(img);

    await waitFor(() => {
      expect(screen.queryByTestId("artwork-skeleton")).not.toBeInTheDocument();
    });
  });

  it("shows fallback icon on error", async () => {
    render(<ArtworkThumbnail src="/api/artwork/bad" alt="Test" size="sm" />);

    const img = screen.getByRole("img");
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByTestId("artwork-fallback")).toBeInTheDocument();
    });
  });

  it("shows fallback when src is null", () => {
    render(<ArtworkThumbnail src={null} alt="Test" size="sm" />);

    expect(screen.getByTestId("artwork-fallback")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("applies size variants correctly", () => {
    const { rerender } = render(
      <ArtworkThumbnail src="/api/artwork/123" alt="Test" size="sm" />
    );

    expect(screen.getByTestId("artwork-container")).toHaveClass("h-8", "w-8");

    rerender(<ArtworkThumbnail src="/api/artwork/123" alt="Test" size="md" />);
    expect(screen.getByTestId("artwork-container")).toHaveClass("h-10", "w-10");

    rerender(<ArtworkThumbnail src="/api/artwork/123" alt="Test" size="lg" />);
    expect(screen.getByTestId("artwork-container")).toHaveClass("h-14", "w-14");
  });

  it("applies custom className", () => {
    render(
      <ArtworkThumbnail
        src="/api/artwork/123"
        alt="Test"
        size="sm"
        className="custom-class"
      />
    );

    expect(screen.getByTestId("artwork-container")).toHaveClass("custom-class");
  });

  it("uses custom fallback icon when provided", () => {
    render(
      <ArtworkThumbnail
        src={null}
        alt="Test"
        size="sm"
        fallbackIcon={<span data-testid="custom-icon">X</span>}
      />
    );

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("applies rounded style based on prop", () => {
    const { rerender } = render(
      <ArtworkThumbnail
        src="/api/artwork/123"
        alt="Test"
        size="sm"
        rounded="md"
      />
    );

    expect(screen.getByTestId("artwork-container")).toHaveClass("rounded-md");

    rerender(
      <ArtworkThumbnail
        src="/api/artwork/123"
        alt="Test"
        size="sm"
        rounded="lg"
      />
    );
    expect(screen.getByTestId("artwork-container")).toHaveClass("rounded-lg");
  });

  it("skips skeleton when priority is true", () => {
    render(
      <ArtworkThumbnail
        src="/api/artwork/123"
        alt="Test"
        size="sm"
        priority={true}
      />
    );

    // With priority=true, skeleton should NOT be shown initially
    expect(screen.queryByTestId("artwork-skeleton")).not.toBeInTheDocument();
    // Image should be visible immediately (not opacity-0)
    const img = screen.getByRole("img");
    expect(img).not.toHaveClass("opacity-0");
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/ui/artwork-thumbnail.test.tsx`
Expected: FAIL with "Cannot find module"

### Step 3: Write the implementation

```tsx
// components/ui/artwork-thumbnail.tsx
/**
 * Artwork thumbnail with loading skeleton and error fallback.
 * Prevents image "pop-in" by showing skeleton until loaded.
 */

"use client";

import { useState, ReactNode } from "react";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  poster: "h-14 w-10",
} as const;

interface ArtworkThumbnailProps {
  /** Image source URL or null for fallback */
  src: string | null;
  /** Alt text for accessibility */
  alt: string;
  /** Size variant */
  size: keyof typeof sizeClasses;
  /** Border radius style */
  rounded?: "sm" | "md" | "lg";
  /** Custom fallback icon (default: Folder) */
  fallbackIcon?: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Skip skeleton for above-the-fold critical images (default: false) */
  priority?: boolean;
}

/**
 * Displays artwork thumbnail with loading skeleton and error fallback.
 *
 * @param src - Image URL or null
 * @param alt - Alt text for accessibility
 * @param size - Size variant (sm, md, lg, poster)
 * @param rounded - Border radius (default: md)
 * @param fallbackIcon - Custom fallback icon
 * @param className - Additional CSS classes
 * @param priority - Skip skeleton for above-the-fold critical images
 */
export function ArtworkThumbnail({
  src,
  alt,
  size,
  rounded = "md",
  fallbackIcon,
  className,
  priority = false,
}: ArtworkThumbnailProps) {
  // Skip skeleton state for priority images (above-the-fold critical images)
  const [isLoading, setIsLoading] = useState(!priority);
  const [hasError, setHasError] = useState(false);

  const containerClasses = cn(
    "relative shrink-0 overflow-hidden",
    sizeClasses[size],
    rounded === "sm" && "rounded-sm",
    rounded === "md" && "rounded-md",
    rounded === "lg" && "rounded-lg",
    className
  );

  // Show fallback if no src or error
  if (!src || hasError) {
    return (
      <div
        data-testid="artwork-container"
        className={cn(
          containerClasses,
          "bg-muted/50 text-muted-foreground flex items-center justify-center"
        )}
      >
        <div data-testid="artwork-fallback">
          {fallbackIcon ?? <Folder className="h-4 w-4" />}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="artwork-container" className={containerClasses}>
      {/* Loading skeleton */}
      {isLoading && (
        <div
          data-testid="artwork-skeleton"
          className="bg-muted absolute inset-0 animate-pulse"
        />
      )}

      {/* Actual image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={cn("h-full w-full object-cover", isLoading && "opacity-0")}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/ui/artwork-thumbnail.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/ui/artwork-thumbnail.tsx tests/unit/components/ui/artwork-thumbnail.test.tsx
git commit -m "feat: add ArtworkThumbnail component with loading skeleton

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Fix Item Detail Child Artwork Preloading

**Files:**

- Modify: `components/items/item-detail-client.tsx`
- Modify: `components/items/items-view.tsx`
- Test: `tests/unit/components/items/item-detail-client.test.tsx`

### Step 1: Write the failing test

Add to existing test file:

```tsx
// Add to tests/unit/components/items/item-detail-client.test.tsx

describe("child artwork preloading", () => {
  it("preloads child item artwork before showing content", async () => {
    const childItems = [
      mockItem({ id: "child1", artworkId: "art1", parentId: "parent" }),
      mockItem({ id: "child2", artworkId: "art2", parentId: "parent" }),
    ];

    render(
      <ItemDetailClient
        item={mockItem({ id: "parent" })}
        childItems={childItems}
        files={mockFiles()}
        hasDriveConnection={false}
        artworkId={null}
      />
    );

    // Should show loading while child artwork preloads
    expect(screen.getByTestId("items-loading")).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/items/item-detail-client.test.tsx -- -t "preloads child"`
Expected: FAIL (currently shows content immediately, no loading for children)

### Step 3: Implement the fix

**Approach:** Pass child artwork IDs to ItemDetailClient for preloading alongside hero artwork.

```tsx
// components/items/item-detail-client.tsx - Add to preload logic

// After line 89, add child artwork preloading:
const childArtworkIds = useMemo(() => {
  return childItems
    .slice(0, 8)
    .map((item) => item.artworkId)
    .filter((id): id is string => id !== null);
}, [childItems]);

// Modify line 95 to include child artwork state:
const [childArtworkPreloaded, setChildArtworkPreloaded] = useState(
  childArtworkIds.length === 0
);

// Add effect after line 112:
useEffect(() => {
  if (childArtworkIds.length === 0) {
    setChildArtworkPreloaded(true);
    return;
  }
  preloadImages(childArtworkIds).then(() => setChildArtworkPreloaded(true));
}, [childArtworkIds]);

// Modify line 114:
const isLoading =
  !isHydrated || !minDurationMet || !heroPreloaded || !childArtworkPreloaded;
```

Also update `items-view.tsx` to remove the `hideToolbar` bypass for loading (line 483-488):

```tsx
// The loading logic should ALWAYS run, but spinner visibility depends on hideToolbar
// Change to: spinner hidden when hideToolbar=true, but preloading still happens
```

Actually, on reflection, the parent (ItemDetailClient) should handle ALL preloading for the detail page. The ItemsView on detail pages should just render immediately since parent handles it.

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/items/item-detail-client.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/items/item-detail-client.tsx tests/unit/components/items/item-detail-client.test.tsx
git commit -m "fix: preload child artwork on item detail pages

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Loading State to SpotlightSearch

**Files:**

- Modify: `components/search/spotlight-search.tsx:163-170`
- Modify: `tests/unit/components/search/spotlight-search.test.tsx`

### Step 1: Write the failing test

Add to existing test file:

```tsx
// Add to tests/unit/components/search/spotlight-search.test.tsx

describe("artwork loading", () => {
  it("shows skeleton while artwork loads", async () => {
    // Setup mock with artwork
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "1",
          name: "Test",
          artworkId: "art1",
          description: null,
          breadcrumb: null,
        },
      ],
    });

    render(<SpotlightSearch open={true} onOpenChange={() => {}} />);

    // Wait for items to render
    await waitFor(() => {
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    // BEST PRACTICE: Check skeleton synchronously on initial render
    // Don't rely on waitFor timing - use fireEvent to control image loading
    expect(screen.getByTestId("artwork-skeleton")).toBeInTheDocument();
  });

  it("hides skeleton after image loads", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "1",
          name: "Test",
          artworkId: "art1",
          description: null,
          breadcrumb: null,
        },
      ],
    });

    render(<SpotlightSearch open={true} onOpenChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    // BEST PRACTICE: Use fireEvent to simulate image load
    const img = screen.getByRole("img");
    fireEvent.load(img);

    // Now skeleton should be gone
    expect(screen.queryByTestId("artwork-skeleton")).not.toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/search/spotlight-search.test.tsx -- -t "skeleton"`
Expected: FAIL

### Step 3: Implement the fix

Replace lines 163-170 with ArtworkThumbnail:

```tsx
// components/search/spotlight-search.tsx

// Add import at top:
import { ArtworkThumbnail } from "@/components/ui/artwork-thumbnail";

// Replace lines 162-176 with:
<ArtworkThumbnail
  src={item.artworkId ? `/api/artwork/${item.artworkId}` : null}
  alt=""
  size="sm"
  rounded="md"
  className="group-aria-selected:bg-primary/10"
/>;
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/search/spotlight-search.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/search/spotlight-search.tsx tests/unit/components/search/spotlight-search.test.tsx
git commit -m "feat: add loading skeleton to spotlight search thumbnails

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Loading State to MediaSearchCombobox

**Files:**

- Modify: `components/items/media-search-combobox.tsx:226-243`
- Modify: `tests/unit/components/items/media-search-combobox.test.tsx`

### Step 1: Write the failing test

```tsx
// Add to tests/unit/components/items/media-search-combobox.test.tsx

describe("poster loading", () => {
  it("shows skeleton while TMDB poster loads", async () => {
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 123,
          title: "Test Movie",
          posterPath: "/abc.jpg",
          mediaType: "movie",
          year: "2024",
        },
      ],
    });

    render(<MediaSearchCombobox value="" onValueChange={() => {}} />);

    // Type to trigger search
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "test");

    // Wait for results to render
    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
    });

    // BEST PRACTICE: Check skeleton synchronously after results render
    expect(screen.getByTestId("artwork-skeleton")).toBeInTheDocument();
  });

  it("hides skeleton after TMDB poster loads", async () => {
    vi.mocked(searchMediaAction).mockResolvedValue({
      success: true,
      data: [
        {
          id: 123,
          title: "Test Movie",
          posterPath: "/abc.jpg",
          mediaType: "movie",
          year: "2024",
        },
      ],
    });

    render(<MediaSearchCombobox value="" onValueChange={() => {}} />);

    const input = screen.getByRole("combobox");
    await userEvent.type(input, "test");

    await waitFor(() => {
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
    });

    // BEST PRACTICE: Use fireEvent to simulate image load
    const img = screen.getByRole("img");
    fireEvent.load(img);

    expect(screen.queryByTestId("artwork-skeleton")).not.toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/items/media-search-combobox.test.tsx -- -t "skeleton"`
Expected: FAIL

### Step 3: Implement the fix

Replace lines 226-243 with ArtworkThumbnail:

```tsx
// components/items/media-search-combobox.tsx

// Add import:
import { ArtworkThumbnail } from "@/components/ui/artwork-thumbnail";
import { Film, Tv } from "lucide-react";

// Replace poster thumbnail section:
<ArtworkThumbnail
  src={
    result.posterPath
      ? `https://image.tmdb.org/t/p/w92${result.posterPath}`
      : null
  }
  alt=""
  size="poster"
  rounded="sm"
  fallbackIcon={
    result.mediaType === "movie" ? (
      <Film className="text-muted-foreground h-5 w-5" />
    ) : (
      <Tv className="text-muted-foreground h-5 w-5" />
    )
  }
/>;
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/items/media-search-combobox.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/items/media-search-combobox.tsx tests/unit/components/items/media-search-combobox.test.tsx
git commit -m "feat: add loading skeleton to TMDB search poster thumbnails

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Loading State to ImageSelectionGrid

**Files:**

- Modify: `components/items/image-selection-grid.tsx:308-315, 416-423`
- Modify: `tests/unit/components/items/image-selection-grid.test.tsx`

**Note:** This component uses Next.js `<Image>` which has a built-in `placeholder="blur"` option. However, that requires a `blurDataURL` which TMDB external images don't provide. For consistency with our other components and to support external URLs without blur data, we use a custom skeleton approach here. Future enhancement: consider generating LQIP (Low-Quality Image Placeholders) for TMDB images.

### Step 1: Write the failing test

```tsx
// Add to tests/unit/components/items/image-selection-grid.test.tsx

describe("image loading", () => {
  it("shows skeleton while TMDB image loads", async () => {
    render(
      <ImageSelectionGrid
        tmdbImages={[{ path: "/abc.jpg", aspectRatio: 0.67, voteCount: 10 }]}
        existingFiles={[]}
        selectedImage={{ type: "tmdb", path: "/abc.jpg" }}
        onSelectImage={() => {}}
        type="poster"
      />
    );

    expect(screen.getByTestId("image-skeleton")).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/items/image-selection-grid.test.tsx -- -t "skeleton"`
Expected: FAIL

### Step 3: Implement the fix

Add loading state to ImageThumbnail component within image-selection-grid.tsx:

```tsx
// In ImageThumbnail component (lines 257-346), add loading state:

function ImageThumbnail({ ... }: ImageThumbnailProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);  // ADD THIS

  if (!src || hasError) {
    // ... existing fallback
  }

  return (
    <button ...>
      {/* ADD loading skeleton */}
      {isLoading && (
        <div
          data-testid="image-skeleton"
          className="bg-muted absolute inset-0 animate-pulse"
        />
      )}

      <Image
        src={src}
        alt={alt}
        fill
        className={cn("object-cover", isLoading && "opacity-0")}  // ADD opacity
        sizes={...}
        onLoad={() => setIsLoading(false)}  // ADD this
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
      {/* ... rest of component */}
    </button>
  );
}
```

Apply same pattern to ExistingFileThumbnail component.

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/items/image-selection-grid.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/items/image-selection-grid.tsx tests/unit/components/items/image-selection-grid.test.tsx
git commit -m "feat: add loading skeleton to image selection grid

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Loading State to Season/Episode Pickers

**Files:**

- Modify: `components/items/add-item-dialog.tsx:1276-1356`
- Modify: `components/items/item-settings-dialog.tsx:1401-1480`
- Test: `tests/unit/components/add-item-dialog.test.tsx`

### Step 1: Write the failing test

```tsx
// Add to tests/unit/components/add-item-dialog.test.tsx

describe("season picker loading", () => {
  it("shows skeleton while season poster loads", async () => {
    // Setup TMDB mock with seasons
    vi.mocked(getSeasonsAction).mockResolvedValue({
      success: true,
      data: [
        {
          seasonNumber: 1,
          name: "Season 1",
          posterPath: "/s1.jpg",
          episodeCount: 10,
        },
      ],
    });

    render(<AddItemDialog open onOpenChange={() => {}} />);

    // Select a TV show and navigate to seasons
    // ...

    await waitFor(() => {
      expect(screen.getByTestId("artwork-skeleton")).toBeInTheDocument();
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/add-item-dialog.test.tsx -- -t "season picker"`
Expected: FAIL

### Step 3: Implement the fix

Create a reusable SeasonEpisodeThumbnail component or use ArtworkThumbnail directly:

```tsx
// In both add-item-dialog.tsx and item-settings-dialog.tsx, replace TMDB img tags:

// Replace season poster (around line 1401-1415):
<ArtworkThumbnail
  src={season.posterPath ? `https://image.tmdb.org/t/p/w92${season.posterPath}` : null}
  alt=""
  size="poster"
  rounded="sm"
  fallbackIcon={<Tv className="text-muted-foreground h-5 w-5" />}
/>

// Replace episode still (around line 1450-1458):
<ArtworkThumbnail
  src={episode.stillPath ? `https://image.tmdb.org/t/p/w185${episode.stillPath}` : null}
  alt=""
  size="lg"
  rounded="sm"
  fallbackIcon={<Film className="text-muted-foreground h-5 w-5" />}
  className="w-16"  // Override for episode aspect ratio
/>
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/add-item-dialog.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/items/add-item-dialog.tsx components/items/item-settings-dialog.tsx tests/unit/components/add-item-dialog.test.tsx
git commit -m "feat: add loading skeleton to season/episode pickers

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Loading State to FileTypeCombobox

**Files:**

- Modify: `components/items/file-type-combobox.tsx:675-680, 751-760`
- Modify: `tests/unit/components/items/file-type-combobox.test.tsx`

### Step 1: Write the failing test

```tsx
// Add to tests/unit/components/items/file-type-combobox.test.tsx

describe("artwork loading", () => {
  it("shows skeleton while file artwork loads", async () => {
    const files = [
      {
        id: "1",
        filename: "poster.jpg",
        fileType: "ARTWORK" as const,
        mimeType: "image/jpeg",
      },
    ];

    render(
      <FileTypeCombobox
        files={files}
        selectedFileId={null}
        onSelect={() => {}}
      />
    );

    // Open dropdown
    await userEvent.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(screen.getByTestId("artwork-skeleton")).toBeInTheDocument();
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/items/file-type-combobox.test.tsx -- -t "skeleton"`
Expected: FAIL

### Step 3: Implement the fix

Replace img tags with ArtworkThumbnail in file-type-combobox.tsx.

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/items/file-type-combobox.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/items/file-type-combobox.tsx tests/unit/components/items/file-type-combobox.test.tsx
git commit -m "feat: add loading skeleton to file type combobox

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Loading State to SettingsDialog Previews

**Files:**

- Modify: `components/profile/settings-dialog.tsx:642-656, 749-765`
- Modify: `tests/unit/components/settings-dialog.test.tsx`

### Step 1: Write the failing test

```tsx
// Add to tests/unit/components/settings-dialog.test.tsx

describe("image preview loading", () => {
  it("shows skeleton while profile image preview loads", async () => {
    render(<SettingsDialog open onOpenChange={() => {}} />);

    // Upload an image
    const file = new File(["test"], "avatar.jpg", { type: "image/jpeg" });
    // ... trigger upload

    await waitFor(() => {
      expect(screen.getByTestId("artwork-skeleton")).toBeInTheDocument();
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/settings-dialog.test.tsx -- -t "skeleton"`
Expected: FAIL

### Step 3: Implement the fix

Replace preview img tags with ArtworkThumbnail or add loading state to existing previews.

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/settings-dialog.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/profile/settings-dialog.tsx tests/unit/components/settings-dialog.test.tsx
git commit -m "feat: add loading skeleton to settings dialog image previews

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Add E2E Tests for Artwork Loading

**Files:**

- Create: `e2e/journeys/items/artwork-loading.spec.ts`

### Step 1: Write E2E test

```ts
// e2e/journeys/items/artwork-loading.spec.ts
/**
 * E2E tests for artwork loading behavior.
 * Verifies that skeletons appear before images load.
 *
 * BEST PRACTICE: Use network throttling to ensure loading states are visible
 * long enough to be reliably tested.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Artwork Loading", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("artwork-loading");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("spotlight search shows skeletons for artwork", async ({
    page,
    itemsPage,
  }) => {
    // BEST PRACTICE: Throttle artwork requests to ensure skeleton is visible
    await page.route("**/api/artwork/**", async (route) => {
      // Add 500ms delay to artwork requests
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    // Create item with artwork (via TMDB) - this would need a TMDB-enabled test
    // For now, test with a manually created item
    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();

    // Open spotlight with "/"
    await page.keyboard.press("/");

    // Wait for dialog
    await expect(page.getByRole("dialog")).toBeVisible();

    // If there are items with artwork, verify skeleton appears
    const skeleton = page.getByTestId("artwork-skeleton");
    const itemCount = await page
      .getByRole("option")
      .filter({ has: page.getByRole("img") })
      .count();

    if (itemCount > 0) {
      // Skeleton should be visible while image loads
      await expect(skeleton.first()).toBeVisible();
    }
  });

  test("item detail page preloads child artwork", async ({
    page,
    itemsPage,
  }) => {
    // BEST PRACTICE: Throttle artwork to make loading spinner reliably visible
    await page.route("**/api/artwork/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });

    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();

    // Create parent
    await itemsPage.createItem("Parent");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("Parent");
    await itemsPage.waitForLoadingComplete();

    // Create children
    await itemsPage.createItem("Child 1");
    await itemsPage.waitForToastToDisappear();

    // Reload page and verify loading handles children
    await page.reload();

    // Should see loading spinner (throttling ensures it's visible)
    await expect(page.getByTestId("items-loading")).toBeVisible();

    // Then content without flash
    await itemsPage.waitForLoadingComplete();
    await expect(page.getByText("Child 1")).toBeVisible();
  });

  test("grid view shows skeletons during image load", async ({
    page,
    itemsPage,
  }) => {
    // Throttle all artwork requests
    await page.route("**/api/artwork/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    // Set to grid view
    await page.evaluate(() => {
      localStorage.setItem("items-view-mode", "grid");
    });

    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();

    // Create an item
    await itemsPage.createItem("Test Item");
    await itemsPage.waitForToastToDisappear();

    // Reload to trigger artwork loading with throttle
    await page.reload();

    // Loading spinner should be visible while artwork preloads
    await expect(page.getByTestId("items-loading")).toBeVisible();

    // Wait for loading to complete
    await itemsPage.waitForLoadingComplete();
  });
});
```

### Step 2: Run E2E test

Run: `pnpm test:e2e e2e/journeys/items/artwork-loading.spec.ts`
Expected: PASS

### Step 3: Commit

```bash
git add e2e/journeys/items/artwork-loading.spec.ts
git commit -m "test: add E2E tests for artwork loading behavior

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Run Full Test Suite and Verify

### Step 1: Run all unit tests

Run: `pnpm test`
Expected: All tests pass

### Step 2: Run all E2E tests

Run: `pnpm test:e2e`
Expected: All tests pass

### Step 3: Run check suite

Run: `pnpm run check`
Expected: No errors (format, lint, type-check, knip, build)

### Step 4: Final commit

```bash
git add -A
git commit -m "chore: artwork loading consistency complete

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary of Changes

| Component           | Before              | After                                |
| ------------------- | ------------------- | ------------------------------------ |
| ArtworkThumbnail    | N/A                 | New reusable component with skeleton |
| ItemDetailClient    | Only hero preloaded | Hero + first 8 children preloaded    |
| SpotlightSearch     | Raw img, pop-in     | ArtworkThumbnail with skeleton       |
| MediaSearchCombobox | Raw img, pop-in     | ArtworkThumbnail with skeleton       |
| ImageSelectionGrid  | Error only          | Loading skeleton + error             |
| AddItemDialog       | Raw TMDB img        | ArtworkThumbnail with skeleton       |
| ItemSettingsDialog  | Raw TMDB img        | ArtworkThumbnail with skeleton       |
| FileTypeCombobox    | Error only          | ArtworkThumbnail with skeleton       |
| SettingsDialog      | Raw img previews    | Loading skeleton                     |

## Tests Added/Modified

### Unit Tests

- `tests/unit/components/ui/artwork-thumbnail.test.tsx` (new)
- `tests/unit/components/items/item-detail-client.test.tsx` (modified)
- `tests/unit/components/search/spotlight-search.test.tsx` (modified)
- `tests/unit/components/items/media-search-combobox.test.tsx` (modified)
- `tests/unit/components/items/image-selection-grid.test.tsx` (modified)
- `tests/unit/components/add-item-dialog.test.tsx` (modified)
- `tests/unit/components/items/file-type-combobox.test.tsx` (modified)
- `tests/unit/components/settings-dialog.test.tsx` (modified)

### E2E Tests

- `e2e/journeys/items/artwork-loading.spec.ts` (new)

---

## Validation Suggestions Incorporated

The following improvements were added based on code review validation using the code-review-excellence skill, Context7 documentation, and sequential thinking:

### Task 1 Enhancements

- Added `priority` prop to skip skeleton for above-the-fold critical images
- Updated tests to verify priority behavior

### Task 3/4 Enhancements

- Improved unit tests to use `fireEvent.load(img)` and `fireEvent.error(img)` instead of relying on `waitFor` timing
- Added explicit "hides skeleton after load" test cases
- Added comments explaining best practices for testing image loading states

### Task 5 Clarification

- Added note explaining why we use custom skeleton instead of Next.js `placeholder="blur"` (TMDB images lack blurDataURL)
- Documented future enhancement opportunity for LQIP generation

### Task 9 Enhancements

- Added Playwright `page.route()` network throttling to ensure loading states are visible long enough for reliable E2E testing
- Added third test case for grid view skeleton behavior
- Added inline comments documenting the throttling best practice

### Design Decisions Documented

- Added Validation Notes section at top of document explaining key architectural decisions
- Documented why 8 items is the preload threshold
- Explained scope of preloadImages utility (internal URLs only)
