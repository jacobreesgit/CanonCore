# Design: Dropzone Upload for Settings Dialog

**Date:** 2026-01-11
**Status:** Implemented

## Problem

The settings dialog uses hidden file inputs with "Upload" buttons for profile picture and hero banner. This provides no drag-and-drop support and requires clicking a button to open the file picker.

## Solution

Replace file inputs with the shadcn dropzone component for a better UX with drag-and-drop support and visual feedback.

## Component Architecture

### Profile Picture Dropzone

- Circular dropzone area matching current avatar size
- Empty state: Upload icon + "Drag and drop or click"
- Filled state: Avatar image with hover overlay for "Replace"
- Remove button appears when image exists (positioned outside dropzone)
- Constraints: JPEG/PNG/WebP, max 1MB

### Hero Banner Dropzone

- Rectangular dropzone (96px height, matches current preview)
- Empty state: Upload icon + "Drag and drop or click"
- Filled state: Hero image with hover overlay for "Replace"
- Remove button appears when image exists (positioned outside dropzone)
- Constraints: JPEG/PNG/WebP, max 2MB

## Implementation

### File Structure

Move shadcn dropzone from nested folder to flat structure:

```
components/ui/shadcn-io/dropzone/index.tsx  ->  components/ui/dropzone.tsx
```

Update import in settings-dialog.tsx:

```typescript
// Change from:
import {
  Dropzone,
  DropzoneEmptyState,
} from "@/components/ui/shadcn-io/dropzone";
// To:
import { Dropzone, DropzoneEmptyState } from "@/components/ui/dropzone";
```

### State Management

Keep existing state variables in settings-dialog.tsx:

```typescript
// No changes to state - dropzone integrates with existing state
const [profileImage, setProfileImage] = useState<File | null>(null);
const [heroImage, setHeroImage] = useState<File | null>(null);
const [profileImagePreview, setProfileImagePreview] = useState<string | null>(
  null
);
const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
const [removeProfile, setRemoveProfile] = useState(false);
const [removeHero, setRemoveHero] = useState(false);
```

Remove hidden file input refs (dropzone handles file selection internally):

```typescript
// DELETE these refs
const profileInputRef = useRef<HTMLInputElement>(null);
const heroInputRef = useRef<HTMLInputElement>(null);
```

Keep existing URL.createObjectURL cleanup (no changes needed):

```typescript
// KEEP this useEffect for memory cleanup
useEffect(() => {
  return () => {
    if (profileImagePreview) URL.revokeObjectURL(profileImagePreview);
    if (heroImagePreview) URL.revokeObjectURL(heroImagePreview);
  };
}, [profileImagePreview, heroImagePreview]);
```

### Dropzone Integration

Profile picture dropzone (note `p-0` to reset default padding):

```tsx
<div className="flex items-center gap-3">
  <Dropzone
    accept={{ "image/jpeg": [], "image/png": [], "image/webp": [] }}
    maxSize={1024 * 1024} // 1MB
    maxFiles={1}
    onDrop={(acceptedFiles) => {
      const file = acceptedFiles[0];
      setProfileImage(file);
      setRemoveProfile(false);
      setProfileImagePreview(URL.createObjectURL(file));
    }}
    onError={(error) => toast.error(error.message)}
    src={profileImage ? [profileImage] : undefined}
    className="size-20 rounded-full p-0"
  >
    {profileImageSrc ? (
      <Avatar className="size-full">
        <AvatarImage src={profileImageSrc} />
      </Avatar>
    ) : (
      <DropzoneEmptyState />
    )}
  </Dropzone>
  {profileImageSrc && (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        setProfileImage(null);
        setProfileImagePreview(null);
        setRemoveProfile(true);
      }}
    >
      Remove
    </Button>
  )}
</div>
```

Hero banner dropzone (note `p-0` to reset default padding):

```tsx
<div className="space-y-2">
  <Dropzone
    accept={{ "image/jpeg": [], "image/png": [], "image/webp": [] }}
    maxSize={2 * 1024 * 1024} // 2MB
    maxFiles={1}
    onDrop={(acceptedFiles) => {
      const file = acceptedFiles[0];
      setHeroImage(file);
      setRemoveHero(false);
      setHeroImagePreview(URL.createObjectURL(file));
    }}
    onError={(error) => toast.error(error.message)}
    src={heroImage ? [heroImage] : undefined}
    className="h-24 w-full rounded-lg p-0"
  >
    {heroImageSrc ? (
      <img src={heroImageSrc} className="size-full rounded-lg object-cover" />
    ) : (
      <DropzoneEmptyState />
    )}
  </Dropzone>
  {heroImageSrc && (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        setHeroImage(null);
        setHeroImagePreview(null);
        setRemoveHero(true);
      }}
    >
      Remove
    </Button>
  )}
</div>
```

### Error Handling

The dropzone component automatically validates:

- File type via `accept` prop
- File size via `maxSize` prop
- File count via `maxFiles` prop

Rejections trigger `onError` callback which shows a toast.

## Files Changed

### Modified

```
components/ui/dropzone.tsx                      # Move from shadcn-io subfolder
components/profile/settings-dialog.tsx          # Replace file inputs with Dropzone
```

### Added

```
tests/unit/components/ui/dropzone.test.tsx      # Unit tests for dropzone component
tests/unit/components/profile/settings-dialog-upload.test.tsx  # Upload-specific tests
e2e/journeys/profile/settings-upload.spec.ts    # E2E tests for file uploads
```

### Deleted

```
components/ui/shadcn-io/dropzone/index.tsx      # Moved to ui/dropzone.tsx
components/ui/shadcn-io/                        # Remove empty directory
```

## Testing

### New Unit Tests (settings-dialog-upload.test.tsx)

Add new file upload tests (none exist currently):

- Test empty dropzone renders with upload icon
- Test file drop updates preview state
- Test error toast on invalid file type/size
- Test remove button clears image and sets remove flag
- Mock `react-dropzone` using vitest

### New Unit Tests (dropzone.test.tsx)

- Test `Dropzone` renders children
- Test `DropzoneContent` shows when `src` provided
- Test `DropzoneEmptyState` shows when no `src`
- Test file rejection calls `onError`
- Test drag active state applies ring styling

### New E2E Tests (settings-upload.spec.ts)

Add new file upload E2E tests (none exist currently):

```typescript
test("can upload profile picture via dropzone", async ({
  page,
  myItemsPage,
}) => {
  await myItemsPage.openProfileSettings();

  // Find dropzone's internal input and upload file
  const dropzone = page.locator('[data-testid="profile-dropzone"]');
  const input = dropzone.locator('input[type="file"]');
  await input.setInputFiles("e2e/fixtures/test-avatar.jpg");

  // Verify preview appears
  await expect(dropzone.locator("img")).toBeVisible();
});

test("can remove profile picture", async ({ page, myItemsPage }) => {
  // Upload first, then test remove
  // ...
  await page
    .getByRole("button", { name: /remove/i })
    .first()
    .click();
  await expect(
    page.locator('[data-testid="profile-dropzone"] img')
  ).not.toBeVisible();
});
```

### No Changes Needed

- Existing settings-dialog.test.tsx (tests password/email modals, not uploads)
- Existing profile/settings.spec.ts (tests name/password/email, not uploads)
- Integration tests (test server actions, not UI)
- Item settings tests (not using dropzone per requirements)

## Out of Scope

- Item settings file-type-combobox (explicitly excluded per requirements)
- Google Drive file uploads (uses different mechanism)
- Any backend/API changes
