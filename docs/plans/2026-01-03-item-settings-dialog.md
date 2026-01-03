# Item Settings Dialog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a unified Item Settings dialog consolidating name editing, primary media/artwork/subtitle selection.

**Architecture:** A single modal dialog (no tabs) accessible via context menu. Replaces the separate "Rename" action. Uses existing shadcn/ui components with new server actions. Database schema extended with `isPrimary` flag on ItemFile.

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Prisma 7, Vitest, Playwright

---

## Design Decisions

### Problem: Fragmented UX

The original design had:

- Rename in context menu (existing)
- Settings dialog with tabs (proposed)

This creates confusion - users wouldn't know where to find actions.

### Solution: Unified Settings Dialog

**Context Menu (Simplified):**

1. Add Subfolder
2. Settings → Opens unified dialog
3. ─────────
4. Delete

**Settings Dialog (Single Page):**

- Name input (always visible, replaces Rename dialog)
- File summary counts
- Primary media list (conditional: 2+ media files) - auto-plays when clicking item
- Primary artwork grid (conditional: 2+ artwork files) - thumbnail/hero image
- Default subtitle list (conditional: 2+ subtitle files) - loads by default in player

### Key Principles

1. **Single Entry Point**: All item configuration in Settings dialog
2. **Progressive Complexity**: Only show what's actionable
3. **No Empty States**: Hide sections with nothing to configure

---

## Database Schema Changes

### Task 1: Add isPrimary Flag to ItemFile

**Files:**

- Modify: `prisma/schema.prisma:117-143`
- Create: Migration file (auto-generated)

**Step 1: Update Prisma schema**

```prisma
model ItemFile {
  id        String   @id @default(cuid())
  itemId    String
  item      Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)

  filename  String
  sftpPath  String
  fileType  FileType
  mimeType  String?
  size      BigInt?
  sftpModifiedAt DateTime?

  // User overrides
  isPrimary Boolean  @default(false)

  // Playback
  playbackPosition Float?
  playbackDuration Float?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([itemId, sftpPath])
  @@index([itemId])
  @@index([fileType])
  @@index([itemId, fileType, isPrimary])  // Composite index for primary queries
}
```

**Step 2: Generate migration**

```bash
npx prisma migrate dev --name add_item_file_is_primary
```

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add isPrimary flag to ItemFile"
```

---

## Server Actions

### Task 2: Add setPrimaryFile Action

**Files:**

- Modify: `lib/item-file-actions.ts`
- Test: `tests/unit/lib/item-file-actions.test.ts`

**Step 1: Write failing test**

```typescript
describe("setPrimaryFile", () => {
  it("sets isPrimary and unsets others of same type using transaction", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as Session);
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      id: "file-1",
      itemId: "item-1",
      fileType: "ARTWORK",
      item: { userId: "user-1" },
    } as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([
      { count: 1 },
      { isPrimary: true },
    ]);

    const result = await setPrimaryFile("file-1");

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledWith([
      expect.objectContaining({}), // updateMany
      expect.objectContaining({}), // update
    ]);
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await setPrimaryFile("file-1");
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when user does not own item", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as Session);
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      item: { userId: "user-2" },
    } as any);
    const result = await setPrimaryFile("file-1");
    expect(result.error).toBe("Access denied");
  });

  it("returns error when file not found", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as Session);
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue(null);

    const result = await setPrimaryFile("nonexistent");

    expect(result.success).toBe(false);
    expect(result.error).toBe("File not found");
  });

  it("succeeds when file is already primary (idempotent)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as Session);
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValue({
      id: "file-1",
      itemId: "item-1",
      fileType: "ARTWORK",
      isPrimary: true, // Already primary
      item: { userId: "user-1" },
    } as any);
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }, {}]);

    const result = await setPrimaryFile("file-1");

    expect(result.success).toBe(true);
  });
});
```

**Step 2: Implement action**

```typescript
import { revalidatePath } from "next/cache";

/**
 * Sets a file as primary for its type within an item.
 * Unsets any other primary files of the same type.
 * Uses a transaction to ensure atomicity.
 *
 * @param fileId - The ID of the file to set as primary
 * @returns Success or error result
 */
export async function setPrimaryFile(fileId: string): Promise<ItemFileResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const file = await prisma.itemFile.findUnique({
      where: { id: fileId },
      include: { item: true },
    });

    if (!file) return { success: false, error: "File not found" };
    if (file.item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    // Use transaction to ensure atomicity (prevents race conditions)
    await prisma.$transaction([
      // Unset existing primary files of the same type
      prisma.itemFile.updateMany({
        where: {
          itemId: file.itemId,
          fileType: file.fileType,
          isPrimary: true,
        },
        data: { isPrimary: false },
      }),
      // Set this file as primary
      prisma.itemFile.update({
        where: { id: fileId },
        data: { isPrimary: true },
      }),
    ]);

    // Revalidate the page to reflect changes
    revalidatePath("/dashboard", "layout");

    return { success: true };
  } catch {
    return { success: false, error: "Failed to set primary file" };
  }
}
```

**Step 3: Update getItemFiles to sort primary first**

```typescript
const files = await prisma.itemFile.findMany({
  where: { itemId, item: { userId: session.user.id } },
  orderBy: [{ isPrimary: "desc" }, { filename: "asc" }],
});
```

**Step 4: Commit**

```bash
git add lib/item-file-actions.ts tests/unit/lib/item-file-actions.test.ts
git commit -m "feat: add setPrimaryFile server action"
```

---

## UI Components

### Task 3: Create ItemSettingsDialog Component

**Files:**

- Create: `components/items/item-settings-dialog.tsx`

**Implementation:**

```tsx
/**
 * Unified item settings dialog.
 * Consolidates name editing, primary artwork, and default subtitle selection.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Check,
  Loader2,
  ImageIcon,
  FileText,
  Film,
  HardDrive,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { setPrimaryFile } from "@/lib/item-file-actions";
import { toast } from "sonner";
import type { ItemFile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ItemSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: { id: string; name: string };
  files: { media: ItemFile[]; artwork: ItemFile[]; subtitles: ItemFile[] };
  onRename: (newName: string) => Promise<void>;
  onSettingsChange?: () => void;
}

export function ItemSettingsDialog({
  open,
  onOpenChange,
  item,
  files,
  onRename,
  onSettingsChange,
}: ItemSettingsDialogProps) {
  const [name, setName] = useState(item.name);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

  // Sync name state when item prop changes (prevents stale state on dialog reopen)
  useEffect(() => {
    setName(item.name);
  }, [item.name]);

  const totalFiles =
    files.media.length + files.artwork.length + files.subtitles.length;
  const hasMultipleMedia = files.media.length > 1;
  const hasMultipleArtwork = files.artwork.length > 1;
  const hasMultipleSubtitles = files.subtitles.length > 1;
  const hasMediaSettings =
    hasMultipleMedia || hasMultipleArtwork || hasMultipleSubtitles;

  // Helper to format file size
  const formatSize = (bytes: bigint | null) => {
    if (!bytes) return "";
    const num = Number(bytes);
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(0)} KB`;
    if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`;
    return `${(num / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  // Helper to format duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleSaveName = useCallback(async () => {
    if (!name.trim() || name === item.name) return;
    setIsSaving(true);
    try {
      await onRename(name.trim());
      toast.success("Name updated");
    } catch {
      toast.error("Failed to update name");
    } finally {
      setIsSaving(false);
    }
  }, [name, item.name, onRename]);

  const handleSetPrimary = useCallback(
    async (fileId: string, label: string) => {
      setLoadingFileId(fileId);
      try {
        const result = await setPrimaryFile(fileId);
        if (result.success) {
          toast.success(`Primary ${label} updated`);
          onSettingsChange?.();
        } else {
          toast.error(result.error || "Failed to update");
        }
      } finally {
        setLoadingFileId(null);
      }
    },
    [onSettingsChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Item Settings</DialogTitle>
          <DialogDescription>
            Configure display preferences for this item.
          </DialogDescription>
        </DialogHeader>

        {/* Name Section */}
        <div className="space-y-2">
          <Label htmlFor="item-name">Name</Label>
          <div className="flex gap-2">
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            />
            <Button
              onClick={handleSaveName}
              disabled={!name.trim() || name === item.name || isSaving}
              size="sm"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>

        {/* File Summary */}
        <p className="text-muted-foreground text-sm">
          {files.media.length} media • {files.artwork.length} artwork •{" "}
          {files.subtitles.length} subtitle
          {files.subtitles.length !== 1 ? "s" : ""}
        </p>

        {/* Media Settings (conditional) */}
        {hasMediaSettings && (
          <>
            <Separator />

            {/* Primary Media */}
            {hasMultipleMedia && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Film className="size-4" />
                  Primary Media
                </div>
                <p className="text-muted-foreground text-xs">
                  Select which file plays when clicking on this item.
                </p>
                <div className="space-y-1">
                  {files.media.map((file) => (
                    <Button
                      key={file.id}
                      variant={file.isPrimary ? "secondary" : "ghost"}
                      size="sm"
                      className="h-auto w-full justify-start gap-3 py-2"
                      onClick={() => handleSetPrimary(file.id, "media")}
                      disabled={loadingFileId === file.id}
                    >
                      {loadingFileId === file.id ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" />
                      ) : file.isPrimary ? (
                        <Check className="size-4 shrink-0" />
                      ) : (
                        <div className="size-4 shrink-0" />
                      )}
                      <div className="flex-1 truncate text-left">
                        <span className="block truncate">{file.filename}</span>
                        <span className="text-muted-foreground flex items-center gap-2 text-xs">
                          {file.size && (
                            <span className="flex items-center gap-1">
                              <HardDrive className="size-3" />
                              {formatSize(file.size)}
                            </span>
                          )}
                          {file.playbackDuration && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {formatDuration(file.playbackDuration)}
                            </span>
                          )}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Artwork */}
            {hasMultipleArtwork && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ImageIcon className="size-4" />
                  Primary Artwork
                </div>
                <p className="text-muted-foreground text-xs">
                  Select which image to use as the thumbnail.
                </p>
                <div
                  className="grid grid-cols-4 gap-2"
                  role="radiogroup"
                  aria-label="Select primary artwork"
                >
                  {files.artwork.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => handleSetPrimary(file.id, "artwork")}
                      disabled={loadingFileId === file.id}
                      role="radio"
                      aria-checked={file.isPrimary}
                      aria-label={`Select ${file.filename} as primary artwork`}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-md",
                        "ring-2 transition-all",
                        file.isPrimary
                          ? "ring-primary"
                          : "hover:ring-primary/50 ring-transparent"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/stream/${file.id}`}
                        alt={file.filename}
                        className="h-full w-full object-cover"
                      />
                      {file.isPrimary && (
                        <div className="bg-primary absolute top-1 right-1 rounded-full p-0.5">
                          <Check className="size-3 text-white" />
                        </div>
                      )}
                      {loadingFileId === file.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="size-4 animate-spin text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Default Subtitle */}
            {hasMultipleSubtitles && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="size-4" />
                  Default Subtitle
                </div>
                <div className="space-y-1">
                  {files.subtitles.map((file) => (
                    <Button
                      key={file.id}
                      variant={file.isPrimary ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => handleSetPrimary(file.id, "subtitle")}
                      disabled={loadingFileId === file.id}
                    >
                      {loadingFileId === file.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : file.isPrimary ? (
                        <Check className="size-4" />
                      ) : (
                        <div className="size-4" />
                      )}
                      {file.filename}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Export from index**

```typescript
export { ItemSettingsDialog } from "./item-settings-dialog";
```

**Step 3: Commit**

```bash
git add components/items/
git commit -m "feat: add unified ItemSettingsDialog component"
```

---

### Task 4: Update Context Menu - Remove Rename, Add Settings

**Files:**

- Modify: `components/items/item-context-menu.tsx`

**Changes:**

1. Remove `onRename` prop and rename dialog
2. Add `onSettings` prop
3. Replace Rename menu item with Settings

**Updated interface:**

```typescript
interface ItemContextMenuProps {
  children: ReactNode;
  itemName: string;
  showAddChild?: boolean;
  onSettings?(): void; // Replaces onRename
  onDelete?(): Promise<void>;
  onAddChild?(name: string): Promise<string | undefined>;
}
```

**Updated menu:**

```tsx
<ContextMenuContent className="w-52">
  {showAddChild && onAddChild && (
    <ContextMenuItem onClick={() => setAddChildOpen(true)} className="gap-2">
      <FolderPlus className="size-4" />
      Add Subfolder
    </ContextMenuItem>
  )}
  {onSettings && (
    <ContextMenuItem onClick={onSettings} className="gap-2">
      <Settings className="size-4" />
      Settings
    </ContextMenuItem>
  )}
  {onDelete && (
    <>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => setDeleteOpen(true)}
        className="text-destructive focus:text-destructive gap-2"
      >
        <Trash2 className="size-4" />
        Delete
      </ContextMenuItem>
    </>
  )}
</ContextMenuContent>
```

**Step 2: Commit**

```bash
git add components/items/item-context-menu.tsx
git commit -m "refactor: replace Rename with Settings in context menu"
```

---

### Task 5: Wire Up Dialog in Parent Components

**Files:**

- Modify: `components/items/item-detail.tsx`
- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Modify: `components/sortable-grid/GridItem.tsx`

**Pattern:** Each component that uses ItemContextMenu needs to:

1. Add state for settings dialog
2. Pass `onSettings` callback
3. Render ItemSettingsDialog

**Step 1: Update ItemDetail**

Add settings button in hero section and dialog at end.

**Step 2: Update TreeItem and GridItem**

Pass `onSettings` to ItemContextMenu, manage dialog state in parent view.

**Step 3: Commit**

```bash
git add components/
git commit -m "feat: integrate ItemSettingsDialog throughout UI"
```

---

## Tests

### Task 6: Unit Tests for setPrimaryFile

**Files:**

- Modify: `tests/unit/lib/item-file-actions.test.ts`

See Task 2 for test implementation.

---

### Task 7: Integration Tests

**Files:**

- Create: `tests/integration/items/item-file-primary.test.ts`

```typescript
/**
 * Integration tests for ItemFile primary selection.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

describe("ItemFile Primary Selection", () => {
  let userId: string;
  let itemId: string;
  let artwork1Id: string;
  let artwork2Id: string;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-primary-${Date.now()}@example.com`,
        passwordHash: "hash",
      },
    });
    userId = user.id;

    // Create test item
    const item = await prisma.item.create({
      data: { name: "Test Movie", userId, order: 0, depth: 0 },
    });
    itemId = item.id;

    // Create two artwork files
    const artwork1 = await prisma.itemFile.create({
      data: {
        itemId,
        filename: "poster1.jpg",
        sftpPath: "/movies/poster1.jpg",
        fileType: "ARTWORK",
        isPrimary: true,
      },
    });
    artwork1Id = artwork1.id;

    const artwork2 = await prisma.itemFile.create({
      data: {
        itemId,
        filename: "poster2.jpg",
        sftpPath: "/movies/poster2.jpg",
        fileType: "ARTWORK",
        isPrimary: false,
      },
    });
    artwork2Id = artwork2.id;
  });

  afterEach(async () => {
    await prisma.itemFile.deleteMany({ where: { itemId } });
    await prisma.item.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("only one file of same type can be primary", async () => {
    // Set artwork2 as primary using transaction
    await prisma.$transaction([
      prisma.itemFile.updateMany({
        where: { itemId, fileType: "ARTWORK", isPrimary: true },
        data: { isPrimary: false },
      }),
      prisma.itemFile.update({
        where: { id: artwork2Id },
        data: { isPrimary: true },
      }),
    ]);

    // Verify only artwork2 is primary
    const files = await prisma.itemFile.findMany({
      where: { itemId, fileType: "ARTWORK" },
    });

    const primaryFiles = files.filter((f) => f.isPrimary);
    expect(primaryFiles).toHaveLength(1);
    expect(primaryFiles[0].id).toBe(artwork2Id);
  });

  it("primary files sort first in queries", async () => {
    const files = await prisma.itemFile.findMany({
      where: { itemId, fileType: "ARTWORK" },
      orderBy: [{ isPrimary: "desc" }, { filename: "asc" }],
    });

    expect(files[0].isPrimary).toBe(true);
    expect(files[0].id).toBe(artwork1Id);
  });

  it("transaction ensures atomicity", async () => {
    // Verify both operations complete together
    const result = await prisma.$transaction([
      prisma.itemFile.updateMany({
        where: { itemId, fileType: "ARTWORK", isPrimary: true },
        data: { isPrimary: false },
      }),
      prisma.itemFile.update({
        where: { id: artwork2Id },
        data: { isPrimary: true },
      }),
    ]);

    expect(result).toHaveLength(2);

    // Verify final state
    const artwork1 = await prisma.itemFile.findUnique({
      where: { id: artwork1Id },
    });
    const artwork2 = await prisma.itemFile.findUnique({
      where: { id: artwork2Id },
    });

    expect(artwork1?.isPrimary).toBe(false);
    expect(artwork2?.isPrimary).toBe(true);
  });
});
```

---

### Task 8: E2E Tests

**Files:**

- Create: `e2e/pages/item-settings.page.ts`
- Create: `e2e/journeys/items/item-settings.spec.ts`

**Page Object Model:**

```typescript
/**
 * Page Object Model for Item Settings Dialog.
 */

import { Page, Locator, expect } from "@playwright/test";

export class ItemSettingsPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly nameInput: Locator;
  readonly saveButton: Locator;
  readonly mediaSection: Locator;
  readonly artworkSection: Locator;
  readonly subtitleSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole("dialog");
    this.nameInput = page.getByLabel("Name");
    this.saveButton = page.getByRole("button", { name: "Save" });
    this.mediaSection = page.locator('[data-testid="primary-media"]');
    this.artworkSection = page.locator(
      '[role="radiogroup"][aria-label="Select primary artwork"]'
    );
    this.subtitleSection = page.locator('[data-testid="default-subtitle"]');
  }

  async expectOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async expectClosed() {
    await expect(this.dialog).not.toBeVisible();
  }

  async editName(newName: string) {
    await this.nameInput.clear();
    await this.nameInput.fill(newName);
    await this.saveButton.click();
  }

  async selectPrimaryArtwork(index: number) {
    const buttons = this.artworkSection.locator("button");
    await buttons.nth(index).click();
  }

  async selectPrimaryMedia(filename: string) {
    await this.page.getByRole("button", { name: filename }).click();
  }

  async selectDefaultSubtitle(filename: string) {
    await this.page.getByRole("button", { name: filename }).click();
  }

  async close() {
    await this.page.keyboard.press("Escape");
    await this.expectClosed();
  }
}
```

**E2E Test Spec:**

```typescript
/**
 * E2E tests for Item Settings Dialog.
 */

import { test, expect } from "@/e2e/fixtures";
import { ItemSettingsPage } from "@/e2e/pages/item-settings.page";

test.describe("Item Settings Dialog", () => {
  test("opens settings dialog from context menu", async ({
    page,
    itemsPage,
    authenticatedUser,
  }) => {
    await page.goto("/dashboard");
    await itemsPage.addItem("Test Movie");

    // Right-click to open context menu
    await itemsPage.rightClickItem("Test Movie");
    await page.getByRole("menuitem", { name: "Settings" }).click();

    const settingsPage = new ItemSettingsPage(page);
    await settingsPage.expectOpen();
  });

  test("edits item name and saves", async ({
    page,
    itemsPage,
    authenticatedUser,
  }) => {
    await page.goto("/dashboard");
    await itemsPage.addItem("Original Name");

    await itemsPage.rightClickItem("Original Name");
    await page.getByRole("menuitem", { name: "Settings" }).click();

    const settingsPage = new ItemSettingsPage(page);
    await settingsPage.editName("New Name");

    await expect(page.getByText("Name updated")).toBeVisible();
  });

  test("closes dialog with escape key", async ({
    page,
    itemsPage,
    authenticatedUser,
  }) => {
    await page.goto("/dashboard");
    await itemsPage.addItem("Test Item");

    await itemsPage.rightClickItem("Test Item");
    await page.getByRole("menuitem", { name: "Settings" }).click();

    const settingsPage = new ItemSettingsPage(page);
    await settingsPage.expectOpen();
    await settingsPage.close();
  });
});

// Tests requiring SFTP fixture with multiple files
test.describe("Item Settings - Media Selection", () => {
  test.beforeEach(async ({ sftpFixture }) => {
    // Set up SFTP with multiple media files
    await sftpFixture.uploadFile("movie.mp4", "movies/Test Movie/");
    await sftpFixture.uploadFile("movie-4k.mp4", "movies/Test Movie/");
    await sftpFixture.uploadFile("poster1.jpg", "movies/Test Movie/");
    await sftpFixture.uploadFile("poster2.jpg", "movies/Test Movie/");
    await sftpFixture.uploadFile("english.srt", "movies/Test Movie/");
    await sftpFixture.uploadFile("spanish.srt", "movies/Test Movie/");
  });

  test("selects primary media file", async ({ page, sftpFixture }) => {
    // Navigate to synced item
    await page.goto("/dashboard/connections/[connectionId]/[itemId]");

    await page.getByRole("button", { name: "Settings" }).click();
    const settingsPage = new ItemSettingsPage(page);

    await settingsPage.selectPrimaryMedia("movie-4k.mp4");
    await expect(page.getByText("Primary media updated")).toBeVisible();
  });

  test("selects primary artwork", async ({ page, sftpFixture }) => {
    await page.goto("/dashboard/connections/[connectionId]/[itemId]");

    await page.getByRole("button", { name: "Settings" }).click();
    const settingsPage = new ItemSettingsPage(page);

    await settingsPage.selectPrimaryArtwork(1); // Second artwork
    await expect(page.getByText("Primary artwork updated")).toBeVisible();
  });

  test("selects default subtitle", async ({ page, sftpFixture }) => {
    await page.goto("/dashboard/connections/[connectionId]/[itemId]");

    await page.getByRole("button", { name: "Settings" }).click();
    const settingsPage = new ItemSettingsPage(page);

    await settingsPage.selectDefaultSubtitle("spanish.srt");
    await expect(page.getByText("Primary subtitle updated")).toBeVisible();
  });
});

// Mobile tests
test.describe("Item Settings - Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("dialog is accessible on mobile", async ({
    page,
    itemsPage,
    authenticatedUser,
  }) => {
    await page.goto("/dashboard");
    await itemsPage.addItem("Mobile Test");

    // Long press on mobile triggers context menu
    await itemsPage.longPressItem("Mobile Test");
    await page.getByRole("menuitem", { name: "Settings" }).click();

    const settingsPage = new ItemSettingsPage(page);
    await settingsPage.expectOpen();

    // Dialog should be full-width on mobile
    const dialogBox = await settingsPage.dialog.boundingBox();
    expect(dialogBox?.width).toBeGreaterThan(300);
  });
});
```

---

## Edge Cases and Fallback Behavior

### Primary File Deletion

**Scenario:** A file set as primary is deleted during SFTP sync.

**Behavior:**

- The `isPrimary` flag is stored on the ItemFile record
- When the file is deleted, its record is removed
- No automatic promotion of another file to primary
- **Fallback:** Application code treats "first file in list" as implicit primary when no explicit primary exists

**Implementation in getItemFiles:**

```typescript
// Files are sorted: isPrimary desc, filename asc
// First file in each category acts as implicit primary
const primaryArtwork =
  files.artwork.find((f) => f.isPrimary) || files.artwork[0];
```

### Single File Scenario

**Scenario:** Item has only 1 file of a type (e.g., 1 artwork).

**Behavior:**

- Settings dialog does NOT show Primary Artwork section (only shows when 2+ files)
- The single file is implicitly treated as primary
- No database flag needed - application logic handles this

### Items Without Files

**Scenario:** Item has no attached files (e.g., just created folder).

**Behavior:**

- Settings dialog shows only Name field
- No media settings sections appear
- File summary shows "0 media • 0 artwork • 0 subtitles"

### Concurrent Edits

**Scenario:** Two users/tabs edit the same item's primary file simultaneously.

**Behavior:**

- Transaction ensures atomicity - one wins, one overwrites
- Last write wins (standard database behavior)
- UI refreshes via `revalidatePath()` to show current state

---

## Summary

### Files Created

- `components/items/item-settings-dialog.tsx`
- `tests/integration/items/item-file-primary.test.ts`
- `e2e/pages/item-settings.page.ts`
- `e2e/journeys/items/item-settings.spec.ts`

### Files Modified

- `prisma/schema.prisma` - Add `isPrimary` to ItemFile
- `lib/item-file-actions.ts` - Add `setPrimaryFile`, update sorting
- `components/items/index.ts` - Export new component
- `components/items/item-context-menu.tsx` - Replace Rename with Settings
- `components/items/item-detail.tsx` - Integrate dialog
- `components/sortable-tree/components/TreeItem/TreeItem.tsx` - Pass onSettings
- `components/sortable-grid/GridItem.tsx` - Pass onSettings
- `tests/unit/lib/item-file-actions.test.ts` - Add tests

### Key Design Changes from Original

1. **No tabs** - Single page dialog with conditional sections
2. **Consolidated rename** - Name editing moved into Settings dialog
3. **Simplified context menu** - Fewer options, clearer purpose
4. **Progressive disclosure** - Media settings only shown when relevant

---

**Plan complete and saved. Ready for implementation.**
