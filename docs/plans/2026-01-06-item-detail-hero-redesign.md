# Item Detail Hero Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the tabbed interface with an always-visible CTA-style hero header featuring artwork background and glass play button.

**Architecture:** Remove tabs entirely from `item-detail-client.tsx`. Create a new `ItemHero` component based on CTA16 pattern with full-bleed artwork background (using GridItem's background logic). Add a `glass` button variant. Children/files always display below the hero without tabs. Simplify page.tsx to always use ItemDetailClient.

**Tech Stack:** React, Tailwind CSS 4, shadcn/ui Button, CTA16 pattern

---

## Validation Notes (Code Review)

**Reviewed using:** code-review-excellence skill, Context7 (shadcn/ui, Tailwind CSS), sequential-thinking

**Key findings addressed:**

- ✅ Glass variant extracted from CTA16 "Learn More" button (line 28 of cta16.tsx)
- ✅ Glass variant follows shadcn cva pattern (Context7 verified)
- ✅ backdrop-blur-sm is Tailwind best practice for glass effects
- 🔧 Removed "Learn More" button itself (YAGNI) - but kept its glass styling for Play button
- 🔧 Removed duplicate hero from item-detail.tsx
- 🔧 Simplified page.tsx to always use ItemDetailClient
- 🔧 Removed button.test.tsx (shadcn components not tested per CLAUDE.md)

---

## Summary of Changes

| Area                     | Change                                         |
| ------------------------ | ---------------------------------------------- |
| `item-detail-client.tsx` | Remove Tabs, always show hero + children/files |
| `item-hero.tsx`          | NEW - CTA16-style hero with artwork background |
| `button.tsx`             | Add `glass` variant                            |
| `item-detail.tsx`        | Remove hero section (moved to ItemHero)        |
| `[itemId]/page.tsx`      | Simplify to always use ItemDetailClient        |
| Unit tests               | Update/remove tab-related tests                |
| E2E tests                | Remove tab tests, update media page object     |

---

### Task 1: Add Glass Button Variant

**Files:**

- Modify: `components/ui/button.tsx`

> Note: No unit test needed - shadcn/ui components are not tested per CLAUDE.md guidelines.

**Step 1: Read current button variants**

Already read - button uses `class-variance-authority` with variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`.

**Step 2: Add glass variant to button.tsx**

Add after `link` variant in the `variants` object. This is extracted directly from CTA16's "Learn More" button styling (line 28 of `components/cta16.tsx`):

```tsx
glass:
  "border-0 bg-background/20 text-primary-foreground backdrop-blur-sm hover:bg-background/30 hover:text-primary-foreground",
```

> **Source:** CTA16 "Learn More" button uses this exact pattern for the frosted glass effect over background images.

**Step 3: Verify the change compiles**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Done** - Move to next task.

---

### Task 2: Create ItemHero Component

**Files:**

- Create: `components/items/item-hero.tsx`
- Test: `tests/unit/components/items/item-hero.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/items/item-hero.test.tsx`:

```tsx
/**
 * Unit tests for ItemHero component.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemHero } from "@/components/items/item-hero";

describe("ItemHero", () => {
  const defaultProps = {
    name: "Breaking Bad",
    description: "A high school chemistry teacher turned meth manufacturer.",
  };

  describe("rendering", () => {
    it("should render item name as heading", () => {
      render(<ItemHero {...defaultProps} />);
      expect(
        screen.getByRole("heading", { name: "Breaking Bad" })
      ).toBeInTheDocument();
    });

    it("should render description when provided", () => {
      render(<ItemHero {...defaultProps} />);
      expect(screen.getByText(/chemistry teacher/)).toBeInTheDocument();
    });

    it("should not render description when null", () => {
      render(<ItemHero name="Test" description={null} />);
      expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
    });
  });

  describe("artwork background", () => {
    it("should show artwork background when artworkId provided", () => {
      render(<ItemHero {...defaultProps} artworkId="art-123" />);
      const hero = screen.getByTestId("item-hero");
      expect(hero).toHaveStyle({
        backgroundImage: "url(/api/artwork/art-123)",
      });
    });

    it("should show fallback gradient when no artworkId", () => {
      render(<ItemHero {...defaultProps} />);
      const fallback = screen.getByTestId("hero-fallback");
      expect(fallback).toBeInTheDocument();
    });
  });

  describe("play button", () => {
    it("should show play button when hasMedia is true", () => {
      render(<ItemHero {...defaultProps} hasMedia onPlay={() => {}} />);
      expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    });

    it("should not show play button when hasMedia is false", () => {
      render(<ItemHero {...defaultProps} hasMedia={false} />);
      expect(
        screen.queryByRole("button", { name: /play/i })
      ).not.toBeInTheDocument();
    });

    it("should call onPlay when play button clicked", async () => {
      const user = userEvent.setup();
      const onPlay = vi.fn();
      render(<ItemHero {...defaultProps} hasMedia onPlay={onPlay} />);

      await user.click(screen.getByRole("button", { name: /play/i }));
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it("should show Resume when hasProgress is true", () => {
      render(
        <ItemHero {...defaultProps} hasMedia hasProgress onPlay={() => {}} />
      );
      expect(
        screen.getByRole("button", { name: /resume/i })
      ).toBeInTheDocument();
    });
  });

  describe("file stats", () => {
    it("should show media count when provided", () => {
      render(<ItemHero {...defaultProps} mediaCount={3} />);
      expect(screen.getByText(/3 media/i)).toBeInTheDocument();
    });

    it("should show subtitle count when provided", () => {
      render(<ItemHero {...defaultProps} subtitleCount={2} />);
      expect(screen.getByText(/2 subtitle/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/components/items/item-hero.test.tsx`
Expected: FAIL - module not found

**Step 3: Write the ItemHero component**

Create `components/items/item-hero.tsx`:

```tsx
/**
 * Hero banner component for item detail pages.
 * CTA16-style full-bleed artwork with centered content overlay.
 * Uses GridItem's background image pattern for consistency.
 */

"use client";

import { useState } from "react";
import { Play, Film, FileText, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ItemHeroProps {
  /** Item name displayed as heading. */
  name: string;
  /** Optional description (max 200 chars). */
  description?: string | null;
  /** Artwork file ID for background image. */
  artworkId?: string | null;
  /** Whether item has playable media files. */
  hasMedia?: boolean;
  /** Whether media has watch progress (shows Resume vs Play). */
  hasProgress?: boolean;
  /** Number of media files. */
  mediaCount?: number;
  /** Number of subtitle files. */
  subtitleCount?: number;
  /** Number of child items. */
  childCount?: number;
  /** Callback when play button clicked. */
  onPlay?: () => void;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * CTA-style hero banner with full-bleed artwork background.
 * Always renders regardless of files/children state.
 *
 * @param props - Hero configuration
 */
export function ItemHero({
  name,
  description,
  artworkId,
  hasMedia = false,
  hasProgress = false,
  mediaCount = 0,
  subtitleCount = 0,
  childCount = 0,
  onPlay,
  className,
}: ItemHeroProps) {
  const [imageError, setImageError] = useState(false);
  const shouldShowArtwork = artworkId && !imageError;

  return (
    <section
      data-testid="item-hero"
      className={cn(
        // CTA16-inspired height and centering
        "relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl",
        // Background image styles (GridItem pattern)
        "bg-black/80 bg-cover bg-center bg-no-repeat",
        // Dark overlay for text legibility
        "before:absolute before:inset-0 before:z-10 before:bg-black/50",
        className
      )}
      style={{
        backgroundImage: shouldShowArtwork
          ? `url(/api/artwork/${artworkId})`
          : undefined,
      }}
    >
      {/* Hidden img for error detection */}
      {artworkId && !imageError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/artwork/${artworkId}`}
          alt=""
          className="hidden"
          onError={() => setImageError(true)}
        />
      )}

      {/* Fallback gradient when no artwork */}
      {!shouldShowArtwork && (
        <div
          data-testid="hero-fallback"
          className={cn(
            "absolute inset-0 z-0",
            "flex items-center justify-center",
            "from-muted/80 to-muted bg-gradient-to-br"
          )}
        >
          <Film className="text-muted-foreground/30 size-24" strokeWidth={1} />
        </div>
      )}

      {/* Content overlay - centered */}
      <div className="relative z-20 flex flex-col items-center gap-6 p-8 text-center text-white">
        {/* Title */}
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight drop-shadow-lg md:text-5xl">
          {name}
        </h1>

        {/* Description */}
        {description && (
          <p className="max-w-xl text-lg text-white/80 drop-shadow-md">
            {description}
          </p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
          {mediaCount > 0 && (
            <span className="flex items-center gap-1.5">
              <Film className="size-4" />
              {mediaCount} media file{mediaCount !== 1 ? "s" : ""}
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
              {childCount} subfolder{childCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Play button */}
        {hasMedia && onPlay && (
          <Button
            size="lg"
            variant="glass"
            onClick={onPlay}
            className="gap-2"
            data-testid="item-hero-play"
          >
            <Play className="size-5" />
            {hasProgress ? "Resume" : "Play"}
          </Button>
        )}
      </div>
    </section>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- tests/unit/components/items/item-hero.test.tsx`
Expected: PASS

**Step 5: Done** - Move to next task.

---

### Task 3: Update ItemDetailClient - Remove Tabs

**Files:**

- Modify: `components/items/item-detail-client.tsx`
- Modify: `tests/unit/components/items/item-detail-client.test.tsx`

**Step 1: Update the unit tests first (TDD)**

Update `tests/unit/components/items/item-detail-client.test.tsx` - remove tab-related tests:

```tsx
/**
 * Unit tests for ItemDetailClient component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemDetailClient } from "@/components/items/item-detail-client";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Mock server actions
vi.mock("@/lib/item-actions", () => ({
  getItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
  updateItem: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/sftp-actions", () => ({
  getItemsByConnection: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock("@/lib/item-file-actions", () => ({
  getItemFiles: vi.fn().mockResolvedValue({
    success: true,
    data: { media: [], artwork: [], subtitles: [] },
  }),
}));

// Mock child components to simplify tests
vi.mock("@/components/items/items-toolbar", () => ({
  ItemsToolbar: ({
    hasItems,
    isEditing,
    item,
  }: {
    hasItems: boolean;
    isEditing: boolean;
    item?: { id: string; name: string };
  }) => (
    <div
      data-testid="items-toolbar"
      data-has-items={hasItems}
      data-editing={isEditing}
    >
      {item && <span data-testid="toolbar-item-name">{item.name}</span>}
    </div>
  ),
}));

vi.mock("@/components/items/items-view", () => ({
  ItemsView: ({
    items,
    parentId,
    isEditing,
  }: {
    items: Array<{ id: string }>;
    parentId: string;
    isEditing: boolean;
  }) => (
    <div
      data-testid="items-view"
      data-parent-id={parentId}
      data-editing={isEditing}
    >
      {items.length} items
    </div>
  ),
}));

vi.mock("@/components/items/item-hero", () => ({
  ItemHero: ({ name, hasMedia }: { name: string; hasMedia?: boolean }) => (
    <div data-testid="item-hero" data-name={name} data-has-media={hasMedia}>
      {name} hero
    </div>
  ),
}));

vi.mock("@/components/items/item-detail", () => ({
  ItemDetail: ({ item }: { item: { id: string; name: string } }) => (
    <div data-testid="item-detail">{item.name} detail</div>
  ),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ItemDetailClient", () => {
  const defaultItem = {
    id: "item-1",
    name: "Movies",
    description: "My movie collection",
    connectionId: null,
    sftpPath: null,
  };

  const defaultChildItems = [
    {
      id: "child-1",
      name: "Action",
      description: null,
      parentId: "item-1",
      order: 0,
      depth: 1,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      connectionId: null,
      sftpPath: null,
      sftpModifiedAt: null,
      artworkId: null,
      fileCounts: { media: 0, artwork: 0, subtitles: 0 },
      childCount: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render hero, toolbar, and items view", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);

      expect(screen.getByTestId("item-hero")).toBeInTheDocument();
      expect(screen.getByTestId("items-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("items-view")).toBeInTheDocument();
    });

    it("should always render hero regardless of files/children", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      expect(screen.getByTestId("item-hero")).toBeInTheDocument();
    });

    it("should pass item name to hero", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);
      expect(screen.getByTestId("item-hero")).toHaveAttribute(
        "data-name",
        "Movies"
      );
    });

    it("should pass childItems to items view", () => {
      render(
        <ItemDetailClient item={defaultItem} childItems={defaultChildItems} />
      );

      expect(screen.getByTestId("items-view")).toHaveTextContent("1 items");
    });

    it("should set hasItems=true when children exist", () => {
      render(
        <ItemDetailClient item={defaultItem} childItems={defaultChildItems} />
      );

      expect(screen.getByTestId("items-toolbar")).toHaveAttribute(
        "data-has-items",
        "true"
      );
    });

    it("should set hasItems=false when no children", () => {
      render(<ItemDetailClient item={defaultItem} childItems={[]} />);

      expect(screen.getByTestId("items-toolbar")).toHaveAttribute(
        "data-has-items",
        "false"
      );
    });
  });

  describe("hero with files", () => {
    const filesWithMedia = {
      media: [
        {
          id: "file-1",
          itemId: "item-1",
          filename: "movie.mp4",
          sftpPath: "/movie.mp4",
          fileType: "MEDIA" as const,
          mimeType: "video/mp4",
          size: 1024000,
          sftpModifiedAt: new Date(),
          isPrimary: true,
          playbackPosition: null,
          playbackDuration: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      artwork: [],
      subtitles: [],
    };

    it("should pass hasMedia=true to hero when media files exist", () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={[]}
          files={filesWithMedia}
        />
      );

      expect(screen.getByTestId("item-hero")).toHaveAttribute(
        "data-has-media",
        "true"
      );
    });

    it("should show both hero and item detail when files exist", () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={[]}
          files={filesWithMedia}
        />
      );

      expect(screen.getByTestId("item-hero")).toBeInTheDocument();
      expect(screen.getByTestId("item-detail")).toBeInTheDocument();
    });

    it("should NOT show tabs - always flat layout", () => {
      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={defaultChildItems}
          files={filesWithMedia}
        />
      );

      // Tabs should never appear
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });
  });

  describe("SFTP connection state", () => {
    it("should detect SFTP connected when both connectionId and sftpPath exist", () => {
      const sftpItem = {
        ...defaultItem,
        connectionId: "conn-1",
        sftpPath: "/media/movies",
      };

      render(<ItemDetailClient item={sftpItem} childItems={[]} />);

      // Component should render without error
      expect(screen.getByTestId("items-toolbar")).toBeInTheDocument();
    });
  });

  describe("connection context", () => {
    it("should pass connection to items view when provided", () => {
      const connection = { id: "conn-1", name: "My Server" };

      render(
        <ItemDetailClient
          item={defaultItem}
          childItems={defaultChildItems}
          connection={connection}
        />
      );

      // ItemsView should receive the connection context
      expect(screen.getByTestId("items-view")).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests - should fail**

Run: `pnpm run test:unit -- tests/unit/components/items/item-detail-client.test.tsx`
Expected: FAIL (item-hero mock not matching, tabs still present)

**Step 3: Update ItemDetailClient to remove tabs and add hero**

Replace `components/items/item-detail-client.tsx`:

```tsx
/**
 * Client-side wrapper for item detail pages.
 * Manages shared state between ItemsToolbar and ItemsView.
 * Always shows hero banner followed by content (no tabs).
 */

"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ItemsToolbar } from "./items-toolbar";
import { ItemsView } from "./items-view";
import { ItemDetail } from "./item-detail";
import { ItemHero } from "./item-hero";
import type { ItemWithArtwork, SerializedItemFile } from "@/lib/types";
import { getItems } from "@/lib/item-actions";
import { getItemsByConnection } from "@/lib/sftp-actions";

interface ItemDetailClientProps {
  /** Current item being viewed. */
  item: {
    id: string;
    name: string;
    description: string | null;
    connectionId: string | null;
    sftpPath: string | null;
  };
  /** Child items to display. */
  childItems: ItemWithArtwork[];
  /** Parent connection info for context. */
  connection?: { id: string; name: string } | null;
  /** Optional files for display. */
  files?: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
  /** Primary artwork ID for hero background. */
  artworkId?: string | null;
}

/**
 * Client wrapper for item detail page with hero banner and unified toolbar.
 * Manages edit mode and add item dialog state shared between toolbar and view.
 * Always displays: Hero -> Files (if any) -> Children (if any). No tabs.
 */
export function ItemDetailClient({
  item,
  childItems: initialChildItems,
  connection,
  files,
  artworkId,
}: ItemDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [childItems, setChildItems] = useState(initialChildItems);
  const [isEditing, setIsEditing] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [playingFile, setPlayingFile] = useState<SerializedItemFile | null>(
    null
  );

  const isSftpConnected = Boolean(item.connectionId && item.sftpPath);
  const hasFiles =
    files &&
    (files.media.length > 0 ||
      files.artwork.length > 0 ||
      files.subtitles.length > 0);
  const hasChildren = childItems.length > 0;
  const hasMedia = files && files.media.length > 0;

  // Check if any media has progress
  const hasProgress =
    hasMedia &&
    files.media.some((f) => f.playbackPosition && f.playbackPosition > 0);

  // Get primary media file for play button
  const primaryMedia = hasMedia
    ? files.media.find((f) => f.isPrimary) || files.media[0]
    : null;

  /**
   * Refetches child items from server.
   */
  const refetchItems = useCallback(async () => {
    startTransition(async () => {
      const result = item.connectionId
        ? await getItemsByConnection(item.connectionId, item.id)
        : await getItems(item.id);

      if (result.success && result.data) {
        setChildItems(result.data);
      }
    });
  }, [item.id, item.connectionId]);

  /**
   * Handles sync completion - refresh items and page.
   */
  const handleSyncComplete = useCallback(async () => {
    await refetchItems();
    router.refresh();
  }, [refetchItems, router]);

  /**
   * Handles play button click from hero.
   */
  const handlePlay = useCallback(() => {
    if (primaryMedia) {
      setPlayingFile(primaryMedia);
    }
  }, [primaryMedia]);

  // Shared toolbar props
  const toolbarProps = {
    hasItems: hasChildren,
    isEditing,
    onEditToggle: () => setIsEditing((prev) => !prev),
    onAddItem: () => setAddItemOpen(true),
    onSyncComplete: handleSyncComplete,
    item: {
      id: item.id,
      name: item.name,
      description: item.description,
    },
    childCount: childItems.length,
    isSftpConnected,
  };

  return (
    <div className={`flex flex-col gap-6 ${isPending ? "opacity-70" : ""}`}>
      {/* Hero banner - always visible */}
      <ItemHero
        name={item.name}
        description={item.description}
        artworkId={artworkId || files?.artwork[0]?.id}
        hasMedia={hasMedia}
        hasProgress={hasProgress}
        mediaCount={files?.media.length ?? 0}
        subtitleCount={files?.subtitles.length ?? 0}
        childCount={childItems.length}
        onPlay={handlePlay}
      />

      {/* Toolbar */}
      <ItemsToolbar {...toolbarProps} />

      {/* Files section - shown when files exist */}
      {hasFiles && (
        <ItemDetail
          item={item}
          files={files}
          playingFile={playingFile}
          onPlayingFileChange={setPlayingFile}
        />
      )}

      {/* Children section - always shown (may be empty state) */}
      <ItemsView
        items={childItems}
        parentId={item.id}
        connectionId={item.connectionId}
        hideToolbar
        isEditing={isEditing}
        onEditingChange={setIsEditing}
        addItemOpen={addItemOpen}
        onAddItemOpenChange={setAddItemOpen}
        currentConnection={connection}
        onSyncComplete={refetchItems}
      />
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- tests/unit/components/items/item-detail-client.test.tsx`
Expected: PASS

**Step 5: Done** - Move to next task.

---

### Task 4: Update ItemDetail - Remove Hero, Lift Playback State

**Files:**

- Modify: `components/items/item-detail.tsx`

**Step 1: Update ItemDetail to accept playback state from parent**

The hero is now in ItemHero - ItemDetail shows only file cards. Accept `playingFile` and `onPlayingFileChange` as props:

```tsx
/**
 * Item detail view component for displaying attached files.
 * Shows media files, artwork gallery, and subtitles in card format.
 * Hero section moved to ItemHero component.
 */

"use client";

import { useCallback } from "react";
import {
  Play,
  Download,
  ImageIcon,
  FileText,
  Clock,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MediaOverlay } from "@/components/media/media-overlay";
import { updatePlaybackPosition } from "@/lib/item-file-actions";
import type { SerializedItemFile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ItemDetailProps {
  /** The item being displayed */
  item: {
    id: string;
    name: string;
  };
  /** Files attached to this item, grouped by type (serialized for client) */
  files: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
  /** Currently playing file (controlled by parent). */
  playingFile?: SerializedItemFile | null;
  /** Callback when playing file changes. */
  onPlayingFileChange?: (file: SerializedItemFile | null) => void;
}

/**
 * Formats bytes to human-readable file size.
 */
function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Formats duration in seconds to time string.
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Calculates watch progress percentage.
 */
function getWatchProgress(file: SerializedItemFile): number | null {
  if (!file.playbackPosition || !file.playbackDuration) return null;
  return Math.round((file.playbackPosition / file.playbackDuration) * 100);
}

/**
 * Item detail view with cinematic styling.
 * Displays media files with playback controls and progress tracking.
 * Hero section removed - now handled by ItemHero component.
 *
 * @param item - The item metadata
 * @param files - Files grouped by type
 * @param playingFile - Currently playing file (optional, controlled)
 * @param onPlayingFileChange - Callback when playing file changes
 */
export function ItemDetail({
  item,
  files,
  playingFile,
  onPlayingFileChange,
}: ItemDetailProps) {
  // Handle position update from media overlay
  const handlePositionUpdate = useCallback(
    async (fileId: string, position: number, duration: number | null) => {
      await updatePlaybackPosition(fileId, position, duration);
    },
    []
  );

  const handleClose = useCallback(() => {
    onPlayingFileChange?.(null);
  }, [onPlayingFileChange]);

  return (
    <>
      <div className="space-y-8">
        {/* Media files section */}
        {files.media.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
                  <Play className="text-primary size-4" />
                </div>
                Media Files
              </CardTitle>
              <CardDescription>
                Click to play in fullscreen, or download for offline viewing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-border/50 divide-y">
                {files.media.map((file) => {
                  const progress = getWatchProgress(file);

                  return (
                    <li
                      key={file.id}
                      className={cn(
                        "group relative flex items-center justify-between gap-4 py-4",
                        "hover:bg-muted/50 transition-colors",
                        "-mx-6 px-6 first:-mt-2 last:-mb-2"
                      )}
                    >
                      {/* Progress bar background */}
                      {progress !== null && progress > 0 && (
                        <div
                          className="bg-primary/5 absolute inset-y-0 left-0 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      )}

                      <div className="relative z-10 min-w-0 flex-1">
                        <p className="truncate font-medium">{file.filename}</p>
                        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-sm">
                          <span className="flex items-center gap-1">
                            <HardDrive className="size-3.5" />
                            {formatFileSize(file.size)}
                          </span>
                          {file.playbackDuration && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5" />
                              {formatDuration(file.playbackDuration)}
                            </span>
                          )}
                          {progress !== null && progress > 0 && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                progress === 100
                                  ? "bg-green-500/10 text-green-500"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              {progress}% watched
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative z-10 flex items-center gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => onPlayingFileChange?.(file)}
                          className="gap-1.5"
                        >
                          <Play className="size-4" />
                          {progress !== null && progress > 0 && progress < 100
                            ? "Resume"
                            : "Play"}
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <a
                            href={`/api/sftp/download/file/${file.id}`}
                            download={file.filename}
                            title="Download"
                          >
                            <Download className="size-4" />
                          </a>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Artwork gallery section */}
        {files.artwork.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
                  <ImageIcon className="text-primary size-4" />
                </div>
                Artwork
              </CardTitle>
              <CardDescription>
                {files.artwork.length} image
                {files.artwork.length !== 1 ? "s" : ""} attached
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {files.artwork.map((file) => (
                  <div
                    key={file.id}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg",
                      "bg-muted ring-border/50 ring-1",
                      "hover:ring-primary/50 transition-all hover:shadow-lg"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/stream/${file.id}`}
                      alt={file.filename}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div
                      className={cn(
                        "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent",
                        "p-3 opacity-0 transition-opacity group-hover:opacity-100"
                      )}
                    >
                      <p className="truncate text-xs text-white">
                        {file.filename}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "absolute top-2 right-2 size-8",
                        "bg-black/50 text-white opacity-0 backdrop-blur-sm",
                        "transition-opacity group-hover:opacity-100",
                        "hover:bg-black/70"
                      )}
                      asChild
                    >
                      <a
                        href={`/api/sftp/download/file/${file.id}`}
                        download={file.filename}
                        title="Download"
                      >
                        <Download className="size-4" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subtitles section */}
        {files.subtitles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
                  <FileText className="text-primary size-4" />
                </div>
                Subtitles
              </CardTitle>
              <CardDescription>
                Available subtitle tracks for media playback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {files.subtitles.map((file) => (
                  <li
                    key={file.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg p-3",
                      "bg-muted/30 hover:bg-muted/50 transition-colors"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="text-muted-foreground size-4" />
                      <span className="text-sm font-medium">
                        {file.filename}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={`/api/sftp/download/file/${file.id}`}
                        download={file.filename}
                        className="gap-1.5"
                      >
                        <Download className="size-4" />
                        Download
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Media player overlay */}
      {playingFile && (
        <MediaOverlay
          file={playingFile}
          subtitles={files.subtitles}
          onClose={handleClose}
          onPositionUpdate={handlePositionUpdate}
        />
      )}
    </>
  );
}
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Done** - Move to next task.

---

### Task 5: Simplify Server Page - Always Use ItemDetailClient

**Files:**

- Modify: `app/(my-items)/my-items/[itemId]/page.tsx`

**Context:** The current page has 3 code paths (no files, files only, both). We simplify to always use ItemDetailClient which now handles all cases with the hero.

**Step 1: Replace the entire page with simplified version**

```tsx
/**
 * Item detail page displaying item contents and attached files.
 * Shows hero banner, children, and any media files attached to this item.
 */

import { notFound } from "next/navigation";
import { ItemDetailClient } from "@/components/items";
import { SiteHeader } from "@/components/site-header";
import { getItem, getItems } from "@/lib/item-actions";
import { getItemFiles } from "@/lib/item-file-actions";

interface ItemDetailPageProps {
  params: Promise<{ itemId: string }>;
}

/**
 * Renders the item detail view with hero, files, and children.
 * ItemDetailClient handles all layout variations.
 */
export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { itemId } = await params;

  // Fetch the current item with ancestors for breadcrumbs
  const itemResult = await getItem(itemId);

  if (!itemResult.success || !itemResult.data) {
    notFound();
  }

  const { item, ancestors } = itemResult.data;

  // Build breadcrumbs with hrefs for SiteHeader
  const breadcrumbs = [...ancestors, { id: item.id, name: item.name }].map(
    (a) => ({
      id: a.id,
      name: a.name,
      href: `/my-items/${a.id}`,
    })
  );

  // Fetch children of current item and attached files in parallel
  const [childrenResult, filesResult] = await Promise.all([
    getItems(itemId),
    getItemFiles(itemId),
  ]);

  const childItems = childrenResult.success ? (childrenResult.data ?? []) : [];
  const files =
    filesResult.success && filesResult.data
      ? filesResult.data
      : { media: [], artwork: [], subtitles: [] };

  return (
    <>
      <SiteHeader
        title="My Items"
        titleHref="/my-items"
        breadcrumbs={breadcrumbs}
      />
      <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <ItemDetailClient
          item={{
            id: item.id,
            name: item.name,
            description: item.description,
            connectionId: item.connectionId,
            sftpPath: item.sftpPath,
          }}
          childItems={childItems}
          connection={item.connection}
          files={files}
        />
      </div>
    </>
  );
}
```

**Step 2: Verify build**

Run: `pnpm run build`
Expected: PASS

**Step 3: Done** - Move to next task.

---

### Task 6: Update E2E Tests - Remove Tab Tests

**Files:**

- Modify: `e2e/journeys/media/media-playback.spec.ts`
- Modify: `e2e/pages/media.page.ts`

**Step 1: Update media.page.ts - Remove tab methods**

Remove these methods from MediaPage:

- `expectTabsVisible()`
- `clickMediaTab()`
- `clickSubfoldersTab()`

Add new hero-related methods:

```tsx
// Add to MediaPage class
readonly heroSection: Locator;
readonly heroPlayButton: Locator;

// In constructor, add:
this.heroSection = page.getByTestId("item-hero");
this.heroPlayButton = this.heroSection.getByRole("button", { name: /play|resume/i });

// Add methods:
/**
 * Expects the hero section to be visible.
 */
async expectHeroVisible(): Promise<void> {
  await expect(this.heroSection).toBeVisible({ timeout: 10000 });
}

/**
 * Clicks the play button in the hero.
 */
async clickHeroPlayButton(): Promise<void> {
  await this.heroPlayButton.click();
}
```

**Step 2: Update media-playback.spec.ts**

Remove the test `"shows tabs when item has both files and child items"` entirely.

Update other tests to use hero play button where appropriate.

**Step 3: Run E2E tests**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e -- --project=chromium -g "Media Playback"`
Expected: PASS

**Step 4: Done** - Move to next task.

---

### Task 7: Run Full Test Suite & Final Verification

**Step 1: Run all unit tests**

Run: `pnpm run test:unit`
Expected: All pass

**Step 2: Run all integration tests**

Run: `pnpm run test:integration`
Expected: All pass

**Step 3: Run E2E tests**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium`
Expected: All pass

**Step 4: Run full check**

Run: `pnpm run check`
Expected: All pass

**Step 5: Done** - Implementation complete. No commits made per user request.

---

## Files Changed Summary

| File                                                      | Action | Description                              |
| --------------------------------------------------------- | ------ | ---------------------------------------- |
| `components/ui/button.tsx`                                | Modify | Add `glass` variant                      |
| `components/items/item-hero.tsx`                          | Create | New CTA16-style hero component           |
| `components/items/item-detail-client.tsx`                 | Modify | Remove tabs, add hero, flat layout       |
| `components/items/item-detail.tsx`                        | Modify | Remove hero section, lift playback state |
| `app/(my-items)/my-items/[itemId]/page.tsx`               | Modify | Simplify from 3 code paths to 1          |
| `tests/unit/components/items/item-hero.test.tsx`          | Create | Hero component tests                     |
| `tests/unit/components/items/item-detail-client.test.tsx` | Modify | Remove tab tests, add hero tests         |
| `e2e/pages/media.page.ts`                                 | Modify | Remove tab methods, add hero locators    |
| `e2e/journeys/media/media-playback.spec.ts`               | Modify | Remove tab test                          |

---

## Test Impact Summary

| Test Type   | Added          | Removed       | Modified               |
| ----------- | -------------- | ------------- | ---------------------- |
| Unit        | 10 (item-hero) | 4 (tab tests) | 6 (item-detail-client) |
| Integration | 0              | 0             | 0                      |
| E2E         | 0              | 1 (tabs)      | 2 (media playback)     |

---

## Validation Checklist

- [x] Glass variant follows shadcn cva pattern (Context7)
- [x] backdrop-blur-sm is Tailwind best practice (Context7)
- [x] No purposeless buttons (YAGNI - removed "Learn More")
- [x] No duplicate code (hero in one place only)
- [x] No shadcn component tests (per CLAUDE.md)
- [x] Simplified page structure (1 code path vs 3)
- [x] JSDoc standards followed
- [x] data-testid added for E2E reliability
