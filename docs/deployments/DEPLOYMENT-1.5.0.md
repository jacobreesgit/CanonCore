# Deployment 1.5.0 - Dropzone Upload for Settings

**Date**: 2026-01-11
**Branch**: development

## Summary

Profile picture and hero banner uploads now use a modern dropzone component with drag-and-drop support. Drop files directly onto the avatar or hero area, or click to browse. Visual feedback shows when dragging, and file validation happens client-side before upload.

## Features

### Drag-and-drop profile picture

The profile picture section in Settings now accepts file drops:

- Circular dropzone matches the avatar size
- Drag a file to see the ring highlight
- Drop JPEG, PNG, or WebP images (max 1MB)
- Preview updates immediately
- Click anywhere on the avatar to browse files

### Drag-and-drop hero banner

The hero banner section works the same way:

- Rectangular dropzone (96px height)
- Supports the same image formats (max 2MB)
- Shows the Sparkles icon when empty
- Preview fills the entire area on upload

### Better error messages

File validation errors show as toast notifications:

- "File is larger than X bytes" for oversized files
- "File type not accepted" for wrong formats
- Falls back to "File validation failed" for edge cases

## Files Changed

### Added

```
components/ui/dropzone.tsx                                # Dropzone component with context
tests/unit/components/ui/dropzone.test.tsx                # 12 unit tests
tests/unit/components/profile/settings-dialog-upload.test.tsx  # 14 unit tests
e2e/journeys/profile/settings-upload.spec.ts              # 10 E2E tests
e2e/fixtures/images/test-avatar.jpg                       # Test fixture
e2e/fixtures/images/test-hero.jpg                         # Test fixture
docs/plans/2026-01-11-settings-dropzone-upload.md         # Design document
```

### Modified

```
components/profile/settings-dialog.tsx  # Uses Dropzone instead of hidden inputs
package.json                            # Added react-dropzone dependency
pnpm-lock.yaml                          # Lock file updated
docs/todo.md                            # Removed "-drop zone" item
```

### Deleted

```
components/ui/shadcn-io/dropzone/index.tsx  # Moved to ui/dropzone.tsx (flat structure)
```

## Technical Details

### Dropzone component architecture

The dropzone uses React context to share state between parent and children:

```typescript
<Dropzone
  accept={{ "image/jpeg": [], "image/png": [], "image/webp": [] }}
  maxSize={1024 * 1024}
  maxFiles={1}
  onDrop={handleDrop}
  onError={(error) => toast.error(error.message)}
  src={file ? [file] : undefined}
>
  {hasImage ? <Avatar /> : <DropzoneEmptyState />}
</Dropzone>
```

Three exported components:

- `Dropzone` - Main wrapper with file handling
- `DropzoneContent` - Shows when files are selected
- `DropzoneEmptyState` - Shows upload instructions when empty

### Memory management

Preview URLs created with `URL.createObjectURL()` are cleaned up in a useEffect:

```typescript
useEffect(() => {
  return () => {
    if (profileImagePreview) URL.revokeObjectURL(profileImagePreview);
    if (heroImagePreview) URL.revokeObjectURL(heroImagePreview);
  };
}, [profileImagePreview, heroImagePreview]);
```

### Removed refs

The hidden file input refs (`profileInputRef`, `heroInputRef`) were removed since the dropzone handles file selection internally.

## Test Results

| Suite      | Result     |
| ---------- | ---------- |
| Unit tests | 634 passed |
| Lint       | 0 errors   |
| Types      | 0 errors   |
| Knip       | 0 unused   |

New test coverage:

- 12 tests for Dropzone component
- 14 tests for settings dialog upload functionality
- 10 E2E tests for upload flows

## Deployment Steps

1. Pull latest changes
2. Run `pnpm install` (new dependency: react-dropzone)
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No database migrations or environment variable changes required.

## Version History

| Version | Date       | Summary                                       |
| ------- | ---------- | --------------------------------------------- |
| 1.5.0   | 2026-01-11 | Dropzone upload for settings dialog           |
| 1.4.0   | 2026-01-11 | Google Drive improvements, sidebar cleanup    |
| 1.3.0   | 2026-01-10 | Dedicated password and email change modals    |
| 1.2.0   | 2026-01-10 | Sync behavior improvements, auth page polish  |
| 1.1.0   | 2026-01-10 | Test coverage expansion, auth UX improvements |
| 1.0.0   | 2026-01-10 | Google Drive integration replacing SFTP       |
