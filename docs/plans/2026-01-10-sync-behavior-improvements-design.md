# Sync Behavior Improvements Design

**Date:** 2026-01-10
**Status:** Approved

## Overview

Improvements to Google Drive sync behavior focusing on accurate feedback and handling edge cases during connection setup.

## Design Decisions

### 1. Fix Spurious "Updated" Count in Sync

**Problem:** When user renames an item and clicks Sync, toast shows "Sync complete: 1 updated" even though nothing actually changed from Drive's perspective.

**Root Cause:** In `lib/google-drive-actions.ts`, the `processFile()` function always increments `ctx.stats.updated++` when an existing item is found, regardless of whether any values actually changed.

```typescript
// Current behavior (line 472-488):
if (existing) {
  await prisma.item.update({ ... });  // Updates even if identical
  ctx.stats.updated++;  // Always increments - BUG!
}
```

**Solution:** Compare current values with Drive values before counting an update.

**Implementation:**

```typescript
// Fixed behavior:
if (existing) {
  const currentItem = await prisma.item.findUnique({ where: { id: existing.id } });

  const hasChanges =
    currentItem.name !== (file.name || "Untitled") ||
    currentItem.driveModifiedAt?.getTime() !== new Date(file.modifiedTime).getTime() ||
    currentItem.parentId !== parentItemId;

  if (hasChanges) {
    await prisma.item.update({ ... });
    ctx.stats.updated++;
  } else {
    // Just mark as synced, don't count as update
    await prisma.item.update({
      where: { id: existing.id },
      data: { syncStatus: SyncStatus.SYNCED, syncError: null }
    });
  }
}
```

**Code location:** `lib/google-drive-actions.ts` - `processFile()` function

**Result:**

- User renames item, clicks Sync → "Sync complete" (no count, nothing changed from Drive)
- External changes in Drive → "Sync complete: 2 updated" (accurate count)

### 2. Item Settings Dialog - Upload Feedback

**Problem:** No clear feedback when files are uploaded via the settings dialog.

**Solution:** Track successful uploads during dialog session and show consolidated toast on save.

**Implementation:**

1. Add state to `ItemSettingsDialog`:

```typescript
const [successfulUploadCount, setSuccessfulUploadCount] = useState(0);
```

2. Increment only on successful upload in `handleUploadComplete`:

```typescript
const handleUploadComplete = useCallback(
  async (wasSuccessful: boolean) => {
    if (wasSuccessful) {
      setSuccessfulUploadCount((prev) => prev + 1);
    }
    await onSettingsChange?.();
  },
  [onSettingsChange]
);
```

3. Update save toast in `handleSave`:

```typescript
if (result.success) {
  if (successfulUploadCount > 0) {
    toast.success(
      `Settings saved. ${successfulUploadCount} file${successfulUploadCount > 1 ? "s" : ""} uploaded.`
    );
  } else {
    toast.success("Settings saved");
  }
}
```

4. Reset count when dialog opens:

```typescript
useEffect(() => {
  if (open) {
    setSuccessfulUploadCount(0);
  }
}, [open]);
```

**Code location:** `components/items/item-settings-dialog.tsx`

**Edge cases:**

- Failed uploads: Handled inline with retry UI, not included in save toast
- User cancels without saving: Upload still happened, file visible in dropdown (no additional feedback needed)

### 3. Auto-Sync Existing Folder on Connect

**Problem:** When connecting Google Drive with an existing CanonCore folder, content isn't automatically imported.

**Solution:** Auto-trigger sync after successful connection with two-phase toast feedback.

**Implementation:**

**Phase 1: OAuth Callback** (`app/api/auth/callback/google-drive/route.ts`)

After successful connection, redirect with query params indicating folder was reused:

```typescript
const folderWasReused = existingFolderId !== null;
return NextResponse.redirect(
  `${origin}/my-items?drive=connected&existing=${folderWasReused}`
);
```

**Phase 2: Client-Side Handling** (`components/google-drive/oauth-toast.tsx`)

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const driveStatus = params.get("drive");
  const hasExisting = params.get("existing") === "true";

  if (driveStatus === "connected") {
    if (hasExisting) {
      // Two-phase toast for existing folder
      const toastId = toast.loading(
        "Connected to Google Drive. Syncing existing content..."
      );

      syncFromGoogleDrive().then((result) => {
        if (result.success) {
          const total = (result.itemsCreated || 0) + (result.itemsUpdated || 0);
          if (total > 0) {
            toast.success(
              `Imported ${total} item${total > 1 ? "s" : ""} from existing folder.`,
              { id: toastId }
            );
          } else {
            toast.success("Connected to Google Drive.", { id: toastId });
          }
        } else {
          toast.error(`Connected, but sync failed: ${result.error}`, {
            id: toastId,
          });
        }
      });
    } else {
      // New folder, no sync needed
      toast.success("Connected to Google Drive. Ready to sync.");
    }

    // Clean URL
    window.history.replaceState({}, "", "/my-items");
  }
}, []);
```

**Code locations:**

- `app/api/auth/callback/google-drive/route.ts` - Add query param
- `components/google-drive/oauth-toast.tsx` - Handle two-phase sync

**Edge cases:**

- Empty existing folder → "Connected to Google Drive." (no import count)
- Large folder → Loading toast persists until sync completes
- Sync failure → "Connected, but sync failed: [error]" with manual retry via Sync button
- User navigates away during sync → Sync continues in background, no toast shown

## Test Considerations

### Unit Tests

**New tests for Decision 1:**

- `syncFolder` with unchanged item → `updated` count should be 0
- `syncFolder` with changed item name → `updated` count should be 1
- `syncFolder` with changed parent → `updated` count should be 1
- `syncFolder` with only `modifiedTime` change → `updated` count should be 1

**New tests for Decision 2:**

- Upload count resets when dialog opens
- Upload count increments only on success
- Toast includes upload count when > 0
- Toast excludes upload count when 0

### Integration Tests

- Connect with existing folder → verify sync triggered automatically
- Connect with new folder → verify no auto-sync
- Sync with no changes → verify 0 updated count

### E2E Tests

**Decision 1:**

- Rename item via UI, click Sync → toast shows no update count
- Add file via Drive web, click Sync → toast shows "1 new"

**Decision 2:**

- Upload file in settings, save → toast shows "Settings saved. 1 file uploaded."
- Upload fails, save → toast shows "Settings saved" (no upload count)

**Decision 3:**

- Connect with existing folder → toast shows "Syncing..." then "Imported X items"
- Connect with empty folder → toast shows "Connected to Google Drive."
- Connect with new folder → toast shows "Ready to sync"

## Files to Modify

1. `lib/google-drive-actions.ts` - Fix `processFile()` to compare before counting updates
2. `components/items/item-settings-dialog.tsx` - Track upload count, update save toast
3. `components/items/file-type-combobox.tsx` - Pass success status to `onUploadComplete`
4. `app/api/auth/callback/google-drive/route.ts` - Add `existing` query param
5. `components/google-drive/oauth-toast.tsx` - Handle two-phase sync toast

## Migration

No database changes required. Changes are purely behavioral/UX.
