# FileTypeCombobox Upload-Only Mode

**Date**: 2026-01-12
**Status**: Approved

## Summary

Add `uploadOnly` mode to `FileTypeCombobox` so AddItemDialog can use the same component structure as ItemSettingsDialog. This provides visual consistency between creating and editing items, with categorized dropzones for each file type.

## Problem

Currently:

- **ItemSettingsDialog**: Uses 4 `FileTypeCombobox` components (Primary Media, Artwork, Hero, Subtitle)
- **AddItemDialog**: Uses one generic `Dropzone` for all file types mixed together

This creates visual inconsistency and makes it harder for users to understand what files they're adding.

## Solution

Add `uploadOnly` prop to `FileTypeCombobox` that:

- Hides the combobox dropdown (no existing files to select)
- Shows a dropzone for queueing files
- Displays queued files inline with remove buttons
- Defers upload until after item creation

## Design

### New Props (Discriminated Union)

Use a discriminated union type to enforce that `uploadOnly` mode always has required callbacks:

```typescript
// Base props shared by both modes
interface FileTypeComboboxBaseProps {
  label: string;
  description?: string;
  icon?: LucideIcon;
  fileType: "media" | "artwork" | "subtitle";
  disabled?: boolean;
}

// Normal mode: existing file selection
interface FileTypeComboboxSelectModeProps extends FileTypeComboboxBaseProps {
  uploadOnly?: false;
  files: ItemFile[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string | null) => void;
  onUploadComplete?: (file: ItemFile) => void;
}

// Upload-only mode: queue files for deferred upload
interface FileTypeComboboxUploadModeProps extends FileTypeComboboxBaseProps {
  uploadOnly: true;
  queuedFiles: QueuedFile[];
  onQueueFilesChange: (files: QueuedFile[]) => void;
}

type FileTypeComboboxProps =
  | FileTypeComboboxSelectModeProps
  | FileTypeComboboxUploadModeProps;
```

This pattern:

- Enforces type safety at compile time
- Prevents passing incompatible prop combinations
- Uses single `onQueueFilesChange` callback instead of separate add/remove callbacks

### Behavior Modes

| Mode              | Dropdown | Dropzone             | Upload Timing       |
| ----------------- | -------- | -------------------- | ------------------- |
| Normal (existing) | Visible  | Hidden (in dropdown) | Immediate           |
| `uploadOnly`      | Hidden   | Visible              | After item creation |

### AddItemDialog State Changes

Use a single categorized state object instead of multiple useState calls:

```typescript
// Before: 4 separate useState calls
const [queuedMedia, setQueuedMedia] = useState<QueuedFile[]>([]);
const [queuedArtwork, setQueuedArtwork] = useState<QueuedFile[]>([]);
const [queuedHero, setQueuedHero] = useState<QueuedFile[]>([]);
const [queuedSubtitles, setQueuedSubtitles] = useState<QueuedFile[]>([]);

// After: single state object with category keys
interface QueuedFilesByCategory {
  media: QueuedFile[];
  artwork: QueuedFile[];
  hero: QueuedFile[];
  subtitle: QueuedFile[];
}

const [queuedFiles, setQueuedFiles] = useState<QueuedFilesByCategory>({
  media: [],
  artwork: [],
  hero: [],
  subtitle: [],
});

// Helper to update a specific category
const updateCategory =
  (category: keyof QueuedFilesByCategory) => (files: QueuedFile[]) => {
    setQueuedFiles((prev) => ({ ...prev, [category]: files }));
  };
```

### Files Tab Layout

```tsx
const filesContent = (
  <div className="space-y-4">
    <FileTypeCombobox
      uploadOnly
      label="Primary Media"
      description="The file that plays when clicking on this item."
      icon={Film}
      fileType="media"
      queuedFiles={queuedFiles.media}
      onQueueFilesChange={updateCategory("media")}
      disabled={!hasDriveConnection}
    />

    <FileTypeCombobox
      uploadOnly
      label="Primary Artwork"
      description="The image used as the thumbnail."
      icon={ImageIcon}
      fileType="artwork"
      queuedFiles={queuedFiles.artwork}
      onQueueFilesChange={updateCategory("artwork")}
      disabled={!hasDriveConnection}
    />

    <FileTypeCombobox
      uploadOnly
      label="Hero Image"
      description="The image used as the banner background."
      icon={Sparkles}
      fileType="artwork"
      queuedFiles={queuedFiles.hero}
      onQueueFilesChange={updateCategory("hero")}
      disabled={!hasDriveConnection}
    />

    <FileTypeCombobox
      uploadOnly
      label="Default Subtitle"
      description="The subtitle track that loads by default."
      icon={FileText}
      fileType="subtitle"
      queuedFiles={queuedFiles.subtitle}
      onQueueFilesChange={updateCategory("subtitle")}
      disabled={!hasDriveConnection}
    />
  </div>
);
```

### Category to Upload Mapping

When uploading queued files after item creation, apply flags based on category:

| Category         | fileType   | isPrimary    | isHero       | Notes                               |
| ---------------- | ---------- | ------------ | ------------ | ----------------------------------- |
| Primary Media    | `media`    | first = true | false        | First file becomes primary playback |
| Primary Artwork  | `artwork`  | first = true | false        | First file becomes thumbnail        |
| Hero Image       | `artwork`  | false        | first = true | First file becomes hero banner      |
| Default Subtitle | `subtitle` | first = true | false        | First file loads by default         |

### QueuedFile Type

The `QueuedFile` type already exists in `lib/types.ts`. The `isHero` flag is set during the upload transformation step, not when queuing:

```typescript
export interface QueuedFile {
  id: string;
  file: File;
  fileType: "media" | "artwork" | "subtitle";
  size: number;
  isHero?: boolean; // Set during upload transformation, not when queuing
}
```

### Upload Transformation

When preparing files for upload after item creation, transform each category's queue:

```typescript
function prepareFilesForUpload(
  queuedFiles: QueuedFilesByCategory
): QueuedFile[] {
  const result: QueuedFile[] = [];

  // Primary Media: first gets isPrimary
  queuedFiles.media.forEach((file, index) => {
    result.push({ ...file, isPrimary: index === 0, isHero: false });
  });

  // Primary Artwork: first gets isPrimary
  queuedFiles.artwork.forEach((file, index) => {
    result.push({ ...file, isPrimary: index === 0, isHero: false });
  });

  // Hero Image: first gets isHero (NOT isPrimary)
  queuedFiles.hero.forEach((file, index) => {
    result.push({ ...file, isPrimary: false, isHero: index === 0 });
  });

  // Default Subtitle: first gets isPrimary
  queuedFiles.subtitle.forEach((file, index) => {
    result.push({ ...file, isPrimary: index === 0, isHero: false });
  });

  return result;
}
```

### Disabled State

When `hasDriveConnection` is false, show disabled state matching ItemSettingsDialog pattern:

```tsx
<div className="bg-muted/50 rounded-lg border border-dashed p-4 text-center">
  <CloudOff className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
  <p className="text-muted-foreground text-sm">
    Connect Google Drive in Settings to enable file uploads.
  </p>
</div>
```

### File Size Limits

File size validation relies on existing dropzone configuration:

- **Max file size**: 10GB (matches Google Drive resumable upload limit)
- **Max files per category**: No limit (user discretion)
- **MIME type filtering**: Applied per `fileType` prop using existing `getAcceptedMimeTypes()` utility

### Upload Flow

1. User queues files in each category (files stored in local state)
2. User clicks "Create"
3. Item created via `createItem()` → get `itemId`
4. Transform queued files with `prepareFilesForUpload()` to set proper flags
5. Upload using existing batch upload logic (`uploadFilesToDrive()`)
6. First file in each category becomes primary/hero based on category rules
7. On upload failure: show error toast, queued files remain for retry
8. On success: close dialog, navigate to new item

## Files Changed

| File                                      | Changes                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| `components/items/file-type-combobox.tsx` | Add `uploadOnly` mode with discriminated union props     |
| `components/items/add-item-dialog.tsx`    | Use 4 FileTypeCombobox components with categorized state |
| `lib/types.ts`                            | Verify `isHero` exists on QueuedFile (already present)   |

## Tests

### Unit Tests

**file-type-combobox.test.tsx**:

- `uploadOnly` mode renders dropzone instead of combobox
- Queuing files calls `onQueueFilesChange` with new file added
- Removing files calls `onQueueFilesChange` with file filtered out
- Disabled state shows Drive connection message with icon
- MIME type filtering restricts file types per `fileType` prop
- Multiple files can be queued in same category

**add-item-dialog.test.tsx**:

- Categorized state updates correctly for each category
- Dialog close clears all queued files
- Create with no files works (just name)
- Create with files triggers upload after item creation
- Upload failure shows error toast, files remain queued
- Upload success closes dialog

### E2E Tests

**media-lookup.spec.ts**:

- "Add Child Item shows upload dropzones when Drive connected"
- "Add Child Item shows disabled state when Drive not connected"
- "Creating item with queued files uploads to Drive"

## Edge Cases

1. **Duplicate filenames** - Allowed (Drive handles uniqueness)
2. **Wrong file type** - Restricted by MIME type filter per category
3. **File removed** - `onQueueFilesChange` called with filtered array
4. **Dialog cancelled** - State clears on dialog close
5. **Create fails** - Queued files remain in state for retry
6. **Upload fails after create** - Error toast shown, files remain queued, item exists without files
7. **Large file counts** - No artificial limit; UI scrolls within category
8. **File object detached** - Upload will fail gracefully with error toast
9. **Empty queues on save** - Valid; creates item with just name/description
10. **Network loss mid-upload** - Resumable upload protocol handles retry; shows progress
