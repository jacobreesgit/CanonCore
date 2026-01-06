# Item Settings Select Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace custom button-based file selection in Item Settings dialog with shadcn/ui Select dropdowns for a more compact, familiar UX.

**Architecture:** Refactor ItemSettingsDialog to use Select components for primary media, artwork, and subtitle selection. Artwork Select includes inline thumbnails in both trigger and options. Progressive disclosure unchanged - hide sections with 0 files, disable with 1 file, interactive with 2+ files.

**Tech Stack:** React, shadcn/ui Select, TypeScript, Vitest, Playwright

---

## Current State

The Item Settings dialog (`components/items/item-settings-dialog.tsx`) uses:

- Custom button-based "radio groups" for selecting primary files
- Media/subtitles: List of styled buttons with file metadata
- Artwork: Grid of clickable image thumbnails
- ~150 lines of custom button styling and state management

## Proposed Change

Replace with shadcn/ui Select dropdowns:

- More compact and familiar UX pattern
- Consistent with other form controls
- Built-in accessibility
- Artwork thumbnails rendered inline within Select options

## UI Design

### Primary Media Select

```
┌─────────────────────────────────────────────┐
│ movie.mp4 (1.2GB, 2h 15m)                 ▼ │
└─────────────────────────────────────────────┘
```

- Trigger shows: `{filename} ({size}, {duration})`
- Options show same format with checkmark for selected

### Primary Artwork Select

```
┌─────────────────────────────────────────────┐
│ [thumb] poster.jpg                        ▼ │
└─────────────────────────────────────────────┘
    ┌─────────────────────────────────┐
    │ [thumb] poster.jpg        ✓     │
    │ [thumb] fanart.jpg              │
    │ [thumb] banner.jpeg             │
    └─────────────────────────────────┘
```

- Trigger shows: thumbnail + filename
- Options show: thumbnail + filename + checkmark

### Default Subtitle Select

```
┌─────────────────────────────────────────────┐
│ movie.en.srt                              ▼ │
└─────────────────────────────────────────────┘
```

- Trigger shows: `{filename}`
- Options show same with checkmark

## Progressive Disclosure Rules (Unchanged)

| Files Count | Behavior                                  |
| ----------- | ----------------------------------------- |
| 0 files     | Hide section entirely                     |
| 1 file      | Show disabled Select (informational only) |
| 2+ files    | Show interactive Select                   |

---

## Tasks

### Task 1: Verify shadcn Select component exists

**Files:**

- Check: `components/ui/select.tsx`

**Step 1: Check if Select component exists**

Run: `ls -la components/ui/select.tsx`

If missing, install via:

```bash
pnpm dlx shadcn@latest add select
```

**Step 2: Verify imports work**

Ensure this import resolves:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

---

### Task 2: Write unit tests for Select-based file selection

**Files:**

- Create: `tests/unit/components/items/item-settings-dialog.test.tsx`

**Step 1: Write failing tests for Select rendering**

```tsx
/**
 * Unit tests for ItemSettingsDialog component.
 * Tests Select-based primary file selection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemSettingsDialog } from "@/components/items/item-settings-dialog";
import type { SerializedItemFile } from "@/lib/types";

// Mock server actions
vi.mock("@/lib/item-file-actions", () => ({
  setPrimaryFile: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ItemSettingsDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    item: { id: "item-1", name: "Test Item", description: null },
    files: { media: [], artwork: [], subtitles: [] },
    onRename: vi.fn(),
    onDescriptionChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create complete mock file objects
  const createMockFile = (
    overrides: Partial<SerializedItemFile> & { id: string; filename: string }
  ) => ({
    itemId: "item-1",
    sftpPath: `/${overrides.filename}`,
    fileType: "MEDIA" as const,
    mimeType: "video/mp4",
    size: null,
    sftpModifiedAt: null,
    isPrimary: false,
    playbackPosition: null,
    playbackDuration: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("Primary Media Select", () => {
    it("should hide media section when no media files", () => {
      render(<ItemSettingsDialog {...defaultProps} />);
      expect(screen.queryByLabelText(/primary media/i)).not.toBeInTheDocument();
    });

    it("should show disabled select when 1 media file", () => {
      const files = {
        media: [
          createMockFile({
            id: "m1",
            filename: "movie.mp4",
            isPrimary: true,
            size: 1024,
            playbackDuration: 7200,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", { name: /primary media/i });
      expect(select).toBeDisabled();
    });

    it("should show interactive select when 2+ media files", () => {
      const files = {
        media: [
          createMockFile({
            id: "m1",
            filename: "movie.mp4",
            isPrimary: true,
            size: 1024,
            playbackDuration: 7200,
          }),
          createMockFile({
            id: "m2",
            filename: "movie-hd.mkv",
            isPrimary: false,
            size: 2048,
            playbackDuration: 7200,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", { name: /primary media/i });
      expect(select).not.toBeDisabled();
    });

    it("should call setPrimaryFile when selection changes", async () => {
      const { setPrimaryFile } = await import("@/lib/item-file-actions");
      const user = userEvent.setup();
      const files = {
        media: [
          createMockFile({
            id: "m1",
            filename: "movie.mp4",
            isPrimary: true,
            size: 1024,
          }),
          createMockFile({
            id: "m2",
            filename: "movie-hd.mkv",
            isPrimary: false,
            size: 2048,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", { name: /primary media/i });
      await user.click(select);
      await user.click(screen.getByRole("option", { name: /movie-hd\.mkv/i }));

      expect(setPrimaryFile).toHaveBeenCalledWith("m2");
    });

    it("should show error toast when setPrimaryFile fails", async () => {
      const { setPrimaryFile } = await import("@/lib/item-file-actions");
      const { toast } = await import("sonner");
      vi.mocked(setPrimaryFile).mockResolvedValueOnce({
        success: false,
        error: "Failed to update",
      });
      const user = userEvent.setup();
      const files = {
        media: [
          createMockFile({ id: "m1", filename: "movie.mp4", isPrimary: true }),
          createMockFile({
            id: "m2",
            filename: "movie-hd.mkv",
            isPrimary: false,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", { name: /primary media/i });
      await user.click(select);
      await user.click(screen.getByRole("option", { name: /movie-hd\.mkv/i }));

      expect(toast.error).toHaveBeenCalledWith("Failed to update");
    });

    it("should disable select during save operation", async () => {
      const { setPrimaryFile } = await import("@/lib/item-file-actions");
      // Make setPrimaryFile hang to test loading state
      vi.mocked(setPrimaryFile).mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      const files = {
        media: [
          createMockFile({ id: "m1", filename: "movie.mp4", isPrimary: true }),
          createMockFile({
            id: "m2",
            filename: "movie-hd.mkv",
            isPrimary: false,
          }),
        ],
        artwork: [],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", { name: /primary media/i });
      await user.click(select);
      await user.click(screen.getByRole("option", { name: /movie-hd\.mkv/i }));

      // Select should be disabled while saving
      expect(select).toBeDisabled();
    });
  });

  describe("Primary Artwork Select", () => {
    it("should show artwork thumbnails in select options", async () => {
      const user = userEvent.setup();
      const files = {
        media: [],
        artwork: [
          createMockFile({
            id: "a1",
            filename: "poster.jpg",
            isPrimary: true,
            fileType: "ARTWORK",
            mimeType: "image/jpeg",
          }),
          createMockFile({
            id: "a2",
            filename: "fanart.jpg",
            isPrimary: false,
            fileType: "ARTWORK",
            mimeType: "image/jpeg",
          }),
        ],
        subtitles: [],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", { name: /primary artwork/i });
      await user.click(select);

      // Options should contain images with correct src
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
      const img = options[0].querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute(
        "src",
        expect.stringContaining("/api/artwork/a1")
      );
    });
  });

  describe("Default Subtitle Select", () => {
    it("should show subtitle filenames in select", () => {
      const files = {
        media: [],
        artwork: [],
        subtitles: [
          createMockFile({
            id: "s1",
            filename: "movie.en.srt",
            isPrimary: true,
            fileType: "SUBTITLE",
            mimeType: "text/srt",
          }),
          createMockFile({
            id: "s2",
            filename: "movie.es.srt",
            isPrimary: false,
            fileType: "SUBTITLE",
            mimeType: "text/srt",
          }),
        ],
      };
      render(<ItemSettingsDialog {...defaultProps} files={files} />);

      const select = screen.getByRole("combobox", {
        name: /default subtitle/i,
      });
      expect(select).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit -- tests/unit/components/items/item-settings-dialog.test.tsx -v`

Expected: Tests fail (current implementation uses buttons, not Select)

---

### Task 3: Refactor ItemSettingsDialog to use Select components

**Files:**

- Modify: `components/items/item-settings-dialog.tsx`

**Step 1: Add Select and Label imports**

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
```

**Step 2: Add helper to find primary file**

```tsx
/**
 * Finds the primary file in an array, or returns the first file.
 */
function findPrimaryFile(
  files: SerializedItemFile[]
): SerializedItemFile | undefined {
  return files.find((f) => f.isPrimary) ?? files[0];
}
```

**Step 3: Replace Primary Media section**

Replace the existing button-based radiogroup (lines ~272-356) with:

```tsx
{
  /* Primary Media */
}
{
  hasMedia && (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <Film className="text-primary size-3.5" />
        </div>
        <Label htmlFor="primary-media" className="text-sm font-medium">
          Primary Media
        </Label>
      </div>
      <p className="text-muted-foreground text-xs">
        {hasMultipleMedia
          ? "Select which file plays when clicking on this item."
          : "The file that plays when clicking on this item."}
      </p>
      <Select
        value={findPrimaryFile(files.media)?.id}
        onValueChange={(id) => handleSetPrimary(id, "media")}
        disabled={!hasMultipleMedia || !!loadingFileId}
      >
        <SelectTrigger id="primary-media" className="w-full">
          {loadingFileId && files.media.some((f) => f.id === loadingFileId) ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SelectValue placeholder="Select media file" />
          )}
        </SelectTrigger>
        <SelectContent>
          {files.media.map((file) => (
            <SelectItem key={file.id} value={file.id}>
              <span className="flex items-center gap-2">
                <span className="truncate">{file.filename}</span>
                {(file.size || file.playbackDuration) && (
                  <span className="text-muted-foreground text-xs">
                    (
                    {[
                      formatSize(file.size),
                      formatDuration(file.playbackDuration),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    )
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Step 4: Replace Primary Artwork section**

Replace the existing grid (lines ~358-429) with:

```tsx
{
  /* Primary Artwork */
}
{
  hasArtwork &&
    (() => {
      const primaryArtwork = findPrimaryFile(files.artwork);
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                "bg-primary/10"
              )}
            >
              <ImageIcon className="text-primary size-3.5" />
            </div>
            <Label htmlFor="primary-artwork" className="text-sm font-medium">
              Primary Artwork
            </Label>
          </div>
          <p className="text-muted-foreground text-xs">
            {hasMultipleArtwork
              ? "Select which image to use as the thumbnail."
              : "The image used as the thumbnail."}
          </p>
          <Select
            value={primaryArtwork?.id}
            onValueChange={(id) => handleSetPrimary(id, "artwork")}
            disabled={!hasMultipleArtwork || !!loadingFileId}
          >
            <SelectTrigger id="primary-artwork" className="w-full">
              {loadingFileId &&
              files.artwork.some((f) => f.id === loadingFileId) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SelectValue placeholder="Select artwork">
                  {primaryArtwork && (
                    <span className="flex items-center gap-2">
                      <img
                        src={`/api/artwork/${primaryArtwork.id}`}
                        alt=""
                        className="size-5 rounded object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      <span className="truncate">
                        {primaryArtwork.filename}
                      </span>
                    </span>
                  )}
                </SelectValue>
              )}
            </SelectTrigger>
            <SelectContent>
              {files.artwork.map((file) => (
                <SelectItem key={file.id} value={file.id}>
                  <span className="flex items-center gap-2">
                    <img
                      src={`/api/artwork/${file.id}`}
                      alt=""
                      className="size-6 rounded object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="truncate">{file.filename}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    })();
}
```

**Step 5: Replace Default Subtitle section**

Replace the existing button list (lines ~431-500) with:

```tsx
{
  /* Default Subtitle */
}
{
  hasSubtitles && (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            "bg-primary/10"
          )}
        >
          <FileText className="text-primary size-3.5" />
        </div>
        <Label htmlFor="default-subtitle" className="text-sm font-medium">
          Default Subtitle
        </Label>
      </div>
      <p className="text-muted-foreground text-xs">
        {hasMultipleSubtitles
          ? "Select which subtitle track loads by default."
          : "The subtitle track that loads by default."}
      </p>
      <Select
        value={findPrimaryFile(files.subtitles)?.id}
        onValueChange={(id) => handleSetPrimary(id, "subtitle")}
        disabled={!hasMultipleSubtitles || !!loadingFileId}
      >
        <SelectTrigger id="default-subtitle" className="w-full">
          {loadingFileId &&
          files.subtitles.some((f) => f.id === loadingFileId) ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SelectValue placeholder="Select subtitle" />
          )}
        </SelectTrigger>
        <SelectContent>
          {files.subtitles.map((file) => (
            <SelectItem key={file.id} value={file.id}>
              {file.filename}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Step 6: Remove unused imports**

Remove `Check` from lucide-react imports (no longer needed for custom checkmarks).

**Step 7: Run unit tests**

Run: `pnpm run test:unit -- tests/unit/components/items/item-settings-dialog.test.tsx -v`

Expected: All tests pass

**Step 8: Run type check**

Run: `pnpm run type-check`

Expected: No errors

**Step 9: Commit**

```bash
git add components/items/item-settings-dialog.tsx tests/unit/components/items/item-settings-dialog.test.tsx
git commit -m "refactor(item-settings): replace button radiogroups with Select dropdowns

- Replace custom button-based file selection with shadcn Select
- Add inline artwork thumbnails in Select trigger and options
- Keep progressive disclosure (hide 0, disable 1, interactive 2+)
- Add unit tests for Select interactions"
```

---

### Task 4: Add E2E tests for file selection

**Files:**

- Modify: `e2e/journeys/items/items-settings.spec.ts`
- Modify: `e2e/pages/items.page.ts` (add helper methods)

**Step 1: Add page object methods for file selection**

In `e2e/pages/items.page.ts`, add:

```tsx
/**
 * Selects a primary media file in settings dialog.
 */
async selectPrimaryMedia(filename: string): Promise<void> {
  const select = this.page.getByRole("combobox", { name: /primary media/i });
  await select.click();
  await this.page.getByRole("option", { name: new RegExp(filename, "i") }).click();
}

/**
 * Selects a primary artwork file in settings dialog.
 */
async selectPrimaryArtwork(filename: string): Promise<void> {
  const select = this.page.getByRole("combobox", { name: /primary artwork/i });
  await select.click();
  await this.page.getByRole("option", { name: new RegExp(filename, "i") }).click();
}

/**
 * Selects a default subtitle file in settings dialog.
 */
async selectDefaultSubtitle(filename: string): Promise<void> {
  const select = this.page.getByRole("combobox", { name: /default subtitle/i });
  await select.click();
  await this.page.getByRole("option", { name: new RegExp(filename, "i") }).click();
}
```

**Step 2: Add E2E tests for file selection**

In `e2e/journeys/items/items-settings.spec.ts`, add new test block:

```tsx
test.describe("Primary File Selection", () => {
  // These tests require seed data with SFTP-synced items
  // Use: seed@canoncore.com with "Dune (2021)" or "The Shawshank Redemption (1994)"

  test.skip("should select primary media from dropdown", async ({
    page,
    itemsPage,
  }) => {
    // TODO: Implement with seed user login
    // 1. Login as seed user
    // 2. Navigate to synced item with multiple media files
    // 3. Open settings
    // 4. Select different media file
    // 5. Verify toast and persistence
  });

  test.skip("should select primary artwork with thumbnail preview", async ({
    page,
    itemsPage,
  }) => {
    // TODO: Implement with seed user login
  });

  test.skip("should select default subtitle from dropdown", async ({
    page,
    itemsPage,
  }) => {
    // TODO: Implement with seed user login
  });

  test.skip("should show disabled select when only 1 file exists", async ({
    page,
    itemsPage,
  }) => {
    // TODO: Implement with seed user login
  });
});
```

**Step 3: Run E2E tests**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e -- --project=chromium -g "Item Settings"`

Expected: Existing tests pass, new tests skipped

**Step 4: Commit**

```bash
git add e2e/journeys/items/items-settings.spec.ts e2e/pages/items.page.ts
git commit -m "test(e2e): add file selection test scaffolding for item settings

- Add page object methods for Select interactions
- Add skipped test cases for primary file selection
- Requires seed user implementation to fully test"
```

---

### Task 5: Run full verification

**Step 1: Run all checks**

```bash
pnpm run check
```

Expected: All checks pass (format, lint, type-check, knip, build)

**Step 2: Run all unit tests**

```bash
pnpm run test:unit
```

Expected: All tests pass

**Step 3: Manual verification**

1. Start dev server: `pnpm run dev`
2. Login and create item with SFTP connection
3. Sync item to get files
4. Open Item Settings
5. Verify Select dropdowns work for media, artwork, subtitles
6. Verify artwork thumbnails show in dropdown
7. Verify disabled state with 1 file
8. Verify hidden state with 0 files

---

## Summary

| Change             | Before                  | After                                  |
| ------------------ | ----------------------- | -------------------------------------- |
| Media selection    | Custom button list      | Select dropdown with metadata          |
| Artwork selection  | Thumbnail grid          | Select dropdown with inline thumbnails |
| Subtitle selection | Custom button list      | Select dropdown                        |
| Lines of code      | ~150 for file selection | ~60 for file selection                 |
| Accessibility      | Custom ARIA             | Built-in Select a11y                   |
