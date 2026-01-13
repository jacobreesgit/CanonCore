# Wizard "My Uploads" Tab Design

## Problem

In the Add Item dialog's TMDB metadata wizard (poster/hero selection steps), the "My Uploads" tab is always disabled because new items have no existing files. Users cannot upload their own artwork during item creation.

## Solution

Replace the "My Uploads" tab content in the wizard with a focused dropzone for the relevant file type. Each wizard step shows only its relevant upload option:

- **Poster step**: Shows artwork dropzone only
- **Hero step**: Shows hero image dropzone only

Queued files display as selectable thumbnails, allowing users to upload and then select their artwork in one flow.

## Behavior by Context

| Dialog        | Context                  | "My Uploads" Tab Content                            |
| ------------- | ------------------------ | --------------------------------------------------- |
| Add Item      | New item, no files       | Dropzone + queued file thumbnails (selectable)      |
| Item Settings | Existing item with files | Existing artwork grid (current behavior, unchanged) |

## UI Flow

### Add Item Wizard - Poster Step

```
┌─────────────────────────────────────────────┐
│ Apply Metadata                              │
│ Step 2 of 3: Select Poster                  │
├─────────────────────────────────────────────┤
│ [From TMDB] [My Uploads]  ← tabs            │
├─────────────────────────────────────────────┤
│                                             │
│ When "My Uploads" selected:                 │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │     📤 Drop poster images or click      │ │
│ │            to browse                    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Queued files (click to select):             │
│ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │ ✓   │ │     │ │     │  ← thumbnails      │
│ │ img │ │ img │ │ img │     (first auto-   │
│ └─────┘ └─────┘ └─────┘      selected)     │
│ poster1 poster2 poster3                     │
│                                             │
│ ☐ Skip poster selection                     │
│                                             │
├─────────────────────────────────────────────┤
│               [Cancel] [Skip All] [Next]    │
└─────────────────────────────────────────────┘
```

### Add Item Wizard - Hero Step

```
┌─────────────────────────────────────────────┐
│ Apply Metadata                              │
│ Step 3 of 3: Select Hero                    │
├─────────────────────────────────────────────┤
│ [From TMDB] [My Uploads]  ← tabs            │
├─────────────────────────────────────────────┤
│                                             │
│ When "My Uploads" selected:                 │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │     📤 Drop hero/backdrop images        │ │
│ │            or click to browse           │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Queued files (click to select):             │
│ ┌───────────┐ ┌───────────┐                │
│ │     ✓     │ │           │  ← 16:9        │
│ │    img    │ │    img    │     aspect     │
│ └───────────┘ └───────────┘                │
│ backdrop1.jpg  backdrop2.jpg               │
│                                             │
│ ☐ Skip hero selection                       │
│                                             │
├─────────────────────────────────────────────┤
│               [Cancel] [Apply]              │
└─────────────────────────────────────────────┘
```

### Item Settings Wizard (unchanged)

```
┌─────────────────────────────────────────────┐
│ Apply Metadata                              │
│ Step 2 of 3: Select Poster                  │
├─────────────────────────────────────────────┤
│ [From TMDB] [My Uploads]  ← tabs            │
├─────────────────────────────────────────────┤
│                                             │
│ When "My Uploads" selected:                 │
│                                             │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐            │
│ │ ✓   │ │     │ │     │ │     │  ← grid    │
│ │ img │ │ img │ │ img │ │ img │     of     │
│ └─────┘ └─────┘ └─────┘ └─────┘  existing  │
│ poster1 poster2 custom  hero      files    │
│                                             │
├─────────────────────────────────────────────┤
│               [Cancel] [Skip All] [Next]    │
└─────────────────────────────────────────────┘
```

## Implementation

### Design Principles

1. **Single Responsibility**: `ImageSelectionGrid` stays focused on displaying/selecting from galleries. Upload UI lives in the parent step components.

2. **Focused UX**: Each wizard step shows only its relevant upload category (poster or hero), not all 4 file types.

3. **Auto-selection**: First queued file is automatically selected. User can click other thumbnails to change selection.

4. **Shared State**: Queued files use existing `queuedFiles` state in `AddItemDialog`, ensuring consistency with Files tab.

### Component Changes

#### 1. PosterSelectionStep - Add upload mode

```typescript
interface PosterSelectionStepProps {
  // ... existing props ...

  /** Enable upload mode for new items (no existing files) */
  uploadMode?: boolean;
  /** Queued artwork files (required when uploadMode=true) */
  queuedArtwork?: QueuedFile[];
  /** Callback when queued artwork changes */
  onQueueArtworkChange?: (files: QueuedFile[]) => void;
  /** Whether Drive connection exists */
  hasDriveConnection?: boolean;
}
```

When `uploadMode=true`:

- Render dropzone + queued file thumbnails instead of `ImageSelectionGrid`
- First queued file auto-selected as `selectedValue`
- Clicking thumbnail changes selection
- Tab label stays "My Uploads"

When `uploadMode=false` (default):

- Pass `existingFiles` to `ImageSelectionGrid` (current behavior)

#### 2. HeroSelectionStep - Add upload mode

Same pattern as PosterSelectionStep:

```typescript
interface HeroSelectionStepProps {
  // ... existing props ...

  uploadMode?: boolean;
  queuedHero?: QueuedFile[];
  onQueueHeroChange?: (files: QueuedFile[]) => void;
  hasDriveConnection?: boolean;
}
```

#### 3. ImageSelectionGrid - No changes

Keep focused on selection from TMDB images and existing files. Upload logic stays in parent components.

#### 4. AddItemDialog - Wire up wizard upload state

Pass upload props to wizard steps:

```typescript
<PosterSelectionStep
  posters={tmdbImages?.posters || []}
  uploadMode={true}  // Always true for Add Item (no existing files)
  queuedArtwork={queuedFiles.artwork}
  onQueueArtworkChange={updateCategory("artwork")}
  hasDriveConnection={hasDriveConnection}
  selectedValue={posterValue}
  selectedSource={posterSource}
  onSelect={handlePosterSelect}
  isSkipped={posterSkipped}
  onSkipChange={setPosterSkipped}
/>

<HeroSelectionStep
  backdrops={tmdbImages?.backdrops || []}
  uploadMode={true}
  queuedHero={queuedFiles.hero}
  onQueueHeroChange={updateCategory("hero")}
  hasDriveConnection={hasDriveConnection}
  selectedValue={backdropValue}
  selectedSource={backdropSource}
  onSelect={handleBackdropSelect}
  isSkipped={backdropSkipped}
  onSkipChange={setBackdropSkipped}
/>
```

#### 5. ItemSettingsDialog - No changes

Already passes `existingArtwork` to wizard steps. `uploadMode` defaults to false, preserving current behavior.

### Selection Logic

When user uploads files in wizard:

1. Files added to `queuedFiles.artwork` or `queuedFiles.hero` via callback
2. First file auto-selected: `posterValue = queuedFile.id`, `posterSource = "queued"`
3. User can click other thumbnails to change selection
4. On wizard complete, selection stored in `selectedTmdbOptions` with source="queued"
5. On item create, queued files uploaded and selected file marked as primary

New source type needed:

```typescript
type SelectionSource = "tmdb" | "existing" | "queued";
```

### Edge Cases

| Scenario                               | Behavior                                                          |
| -------------------------------------- | ----------------------------------------------------------------- |
| No Drive connection                    | Tab enabled, shows "Connect Google Drive in Settings" message     |
| User uploads then switches to TMDB tab | Queued files preserved, TMDB selection takes precedence if chosen |
| User cancels wizard                    | Queued files preserved (can see in Files tab)                     |
| User skips poster step                 | No poster selected, queued files still uploaded                   |
| User queues multiple files             | First auto-selected, can click to change, all files uploaded      |

## Test Changes

### Unit Tests

#### Update: `image-selection-grid.test.tsx`

```typescript
// KEEP: Test existing behavior for non-upload mode
it("renders My Uploads tab disabled when no existing files", () => {
  // This test remains valid - ImageSelectionGrid behavior unchanged
});

// KEEP: All other existing tests (selection, skip, etc.)
```

#### Add: `poster-selection-step.test.tsx`

```typescript
describe("PosterSelectionStep", () => {
  describe("upload mode", () => {
    it("renders dropzone when uploadMode=true and hasDriveConnection=true", () => {
      render(
        <PosterSelectionStep
          posters={[]}
          uploadMode={true}
          queuedArtwork={[]}
          onQueueArtworkChange={vi.fn()}
          hasDriveConnection={true}
          // ... other required props
        />
      );
      expect(screen.getByText(/drop poster images/i)).toBeInTheDocument();
    });

    it("shows connect Drive message when hasDriveConnection=false", () => {
      render(
        <PosterSelectionStep
          posters={[]}
          uploadMode={true}
          hasDriveConnection={false}
          // ... other required props
        />
      );
      expect(screen.getByText(/connect google drive/i)).toBeInTheDocument();
    });

    it("displays queued files as selectable thumbnails", async () => {
      const queuedFiles = [
        { id: "q1", file: new File([""], "poster1.jpg"), fileType: "ARTWORK", size: 1000, status: "pending" },
        { id: "q2", file: new File([""], "poster2.jpg"), fileType: "ARTWORK", size: 2000, status: "pending" },
      ];
      render(
        <PosterSelectionStep
          uploadMode={true}
          queuedArtwork={queuedFiles}
          hasDriveConnection={true}
          // ... other required props
        />
      );
      expect(screen.getByText("poster1.jpg")).toBeInTheDocument();
      expect(screen.getByText("poster2.jpg")).toBeInTheDocument();
    });

    it("auto-selects first queued file", () => {
      const onSelect = vi.fn();
      const queuedFiles = [
        { id: "q1", file: new File([""], "poster1.jpg"), fileType: "ARTWORK", size: 1000, status: "pending" },
      ];
      render(
        <PosterSelectionStep
          uploadMode={true}
          queuedArtwork={queuedFiles}
          onQueueArtworkChange={vi.fn()}
          hasDriveConnection={true}
          selectedValue={null}
          onSelect={onSelect}
          // ... other required props
        />
      );
      expect(onSelect).toHaveBeenCalledWith("q1", "queued");
    });

    it("calls onQueueArtworkChange when files dropped", async () => {
      const onQueueChange = vi.fn();
      const user = userEvent.setup();
      render(
        <PosterSelectionStep
          uploadMode={true}
          queuedArtwork={[]}
          onQueueArtworkChange={onQueueChange}
          hasDriveConnection={true}
          // ... other required props
        />
      );

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const dropzone = screen.getByText(/drop poster images/i).closest("div");
      // ... simulate drop
      expect(onQueueChange).toHaveBeenCalled();
    });

    it("allows removing queued files", async () => {
      const onQueueChange = vi.fn();
      const user = userEvent.setup();
      const queuedFiles = [
        { id: "q1", file: new File([""], "poster1.jpg"), fileType: "ARTWORK", size: 1000, status: "pending" },
      ];
      render(
        <PosterSelectionStep
          uploadMode={true}
          queuedArtwork={queuedFiles}
          onQueueArtworkChange={onQueueChange}
          hasDriveConnection={true}
          // ... other required props
        />
      );

      await user.click(screen.getByLabelText(/remove poster1.jpg/i));
      expect(onQueueChange).toHaveBeenCalledWith([]);
    });
  });

  describe("non-upload mode (default)", () => {
    it("renders ImageSelectionGrid with existingFiles", () => {
      render(
        <PosterSelectionStep
          posters={mockPosters}
          existingFiles={mockExistingFiles}
          // ... other required props
        />
      );
      expect(screen.getByRole("tab", { name: /from tmdb/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /my uploads/i })).toBeInTheDocument();
    });
  });
});
```

#### Add: `hero-selection-step.test.tsx`

Mirror the poster-selection-step tests for hero-specific behavior.

#### Update: `add-item-dialog.test.tsx`

```typescript
describe("AddItemDialog wizard", () => {
  it("passes upload mode props to PosterSelectionStep", async () => {
    // Verify uploadMode, queuedArtwork, onQueueArtworkChange, hasDriveConnection
  });

  it("passes upload mode props to HeroSelectionStep", async () => {
    // Verify uploadMode, queuedHero, onQueueHeroChange, hasDriveConnection
  });

  it("includes queued wizard files in onAdd callback", async () => {
    const onAdd = vi.fn();
    // ... setup dialog, queue files in wizard, submit
    expect(onAdd).toHaveBeenCalledWith(
      expect.any(String), // name
      expect.any(String), // description
      expect.arrayContaining([
        expect.objectContaining({ fileType: "ARTWORK" }),
        expect.objectContaining({ fileType: "ARTWORK", isHero: true }),
      ]),
      expect.any(Object) // tmdbSelection
    );
  });

  it("preserves queued files when switching between wizard and main", async () => {
    // Queue files in wizard poster step
    // Go back to main
    // Re-enter wizard
    // Verify files still queued
  });
});
```

### E2E Tests

#### Add: `e2e/journeys/items/items-wizard-upload.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { ItemsPage } from "../../pages/items.page";

test.describe("Add Item wizard uploads", () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to items
  });

  test("can upload poster in wizard My Uploads tab", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    await itemsPage.openAddItemDialog();

    // Search for a movie to trigger wizard
    await itemsPage.searchTmdb("Inception");
    await itemsPage.selectTmdbResult("Inception");

    // Navigate to poster step
    await page.getByRole("button", { name: /next/i }).click();

    // Switch to My Uploads tab
    await page.getByRole("tab", { name: /my uploads/i }).click();

    // Upload a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("e2e/fixtures/test-poster.jpg");

    // Verify file appears and is selected
    await expect(page.getByText("test-poster.jpg")).toBeVisible();
    await expect(page.locator("[data-selected=true]")).toBeVisible();

    // Complete wizard and create item
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("button", { name: /apply/i }).click();
    await page.getByRole("button", { name: /create/i }).click();

    // Verify item created with uploaded artwork
    // ... assertions
  });

  test("shows connect Drive message when not connected", async ({ page }) => {
    // Use test account without Drive connection
    const itemsPage = new ItemsPage(page);
    await itemsPage.openAddItemDialog();
    await itemsPage.searchTmdb("Inception");
    await itemsPage.selectTmdbResult("Inception");
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("tab", { name: /my uploads/i }).click();

    await expect(page.getByText(/connect google drive/i)).toBeVisible();
  });

  test("queued files persist across wizard navigation", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    await itemsPage.openAddItemDialog();
    await itemsPage.searchTmdb("Inception");
    await itemsPage.selectTmdbResult("Inception");

    // Upload in poster step
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("tab", { name: /my uploads/i }).click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("e2e/fixtures/test-poster.jpg");

    // Go to hero step and back
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("button", { name: /back/i }).click();
    await page.getByRole("tab", { name: /my uploads/i }).click();

    // File should still be there
    await expect(page.getByText("test-poster.jpg")).toBeVisible();
  });

  test("can select from multiple queued files", async ({ page }) => {
    const itemsPage = new ItemsPage(page);
    // ... upload multiple files
    // ... verify clicking second file changes selection
  });
});
```

### Integration Tests

No new integration tests needed - file upload integration already tested via existing `FileTypeCombobox` and Google Drive action tests.

## File Changes Summary

| File                                                         | Change Type | Description                                              |
| ------------------------------------------------------------ | ----------- | -------------------------------------------------------- |
| `components/items/poster-selection-step.tsx`                 | Modify      | Add upload mode with dropzone and queued file thumbnails |
| `components/items/hero-selection-step.tsx`                   | Modify      | Add upload mode with dropzone and queued file thumbnails |
| `components/items/add-item-dialog.tsx`                       | Modify      | Wire upload props to wizard steps                        |
| `lib/types.ts`                                               | Modify      | Add "queued" to selection source type                    |
| `tests/unit/components/items/poster-selection-step.test.tsx` | Add         | Tests for upload mode                                    |
| `tests/unit/components/items/hero-selection-step.test.tsx`   | Add         | Tests for upload mode                                    |
| `tests/unit/components/add-item-dialog.test.tsx`             | Modify      | Add wizard upload integration tests                      |
| `e2e/journeys/items/items-wizard-upload.spec.ts`             | Add         | E2E tests for wizard uploads                             |

## Out of Scope

- Changing Item Settings dialog behavior (already works with existing files)
- Adding upload capability to Item Settings wizard (users can use Files tab)
- Changing TMDB selection behavior
- Modifying ImageSelectionGrid component (stays selection-only)
