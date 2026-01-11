# Design: Detect Trashed CanonCore Root Folder

**Date:** 2026-01-11
**Status:** Ready for implementation

## Problem

When a user moves their CanonCore folder to Google Drive's Trash:

- Sync queries use `trashed = false`, so trashed files are filtered out
- API calls to `listFiles(rootFolderId)` return empty results
- The `rootFolderId` in database still points to the trashed folder
- No error is shown to the user - sync appears broken with no explanation

## Solution

Detect when the root folder is trashed and show a clear warning with recovery options.

## Detection

**When:** At the start of `syncFromGoogleDrive()` before any sync operations.

**How:** Single API call to check folder status:

```typescript
const response = await drive.files.get({
  fileId: rootFolderId,
  fields: "id, trashed",
});
```

**Error codes:**

- `ROOT_FOLDER_TRASHED` - Folder is in Trash (recoverable)
- `ROOT_FOLDER_DELETED` - Folder permanently deleted (404 response)

## Database State

When trashed folder detected:

```typescript
await prisma.googleDriveConnection.update({
  where: { id: connection.id },
  data: {
    lastError: "ROOT_FOLDER_TRASHED", // Machine-readable code
    lastSyncAt: new Date(),
    // Keep isActive: true - connection is valid
    // Keep needsReauth: false - not an auth problem
  },
});
```

## UI Display

**Settings dialog when `lastError === 'ROOT_FOLDER_TRASHED'`:**

- Warning icon with message: "CanonCore folder is in Trash"
- Explanation: "Your CanonCore folder was moved to Google Drive's Trash. Sync is paused until you restore it."
- "Restore in Drive" button - links to `https://drive.google.com/drive/folders/${rootFolderId}` (new tab)
- "Disconnect" button - removes connection

**When `lastError === 'ROOT_FOLDER_DELETED'`:**

- Message: "CanonCore folder was permanently deleted"
- Only option: "Disconnect" (reconnecting creates new folder)

**After user restores folder:**

- Next sync clears the error if folder is no longer trashed
- Success toast: "CanonCore folder restored. Sync resumed."

## Implementation

### Files to Modify

| File                                           | Change                                         |
| ---------------------------------------------- | ---------------------------------------------- |
| `lib/google-drive-client.ts`                   | Add `checkRootFolderStatus()` function         |
| `lib/google-drive-actions.ts`                  | Call check at start of `syncFromGoogleDrive()` |
| `components/google-drive/settings-section.tsx` | Render warning UI for trashed state            |

### New Function: `checkRootFolderStatus()`

**Location:** `lib/google-drive-client.ts`

```typescript
/**
 * Check if the root folder exists and whether it's trashed.
 *
 * @param drive - Authenticated Drive client
 * @param folderId - The root folder ID to check
 * @returns Status object indicating existence and trashed state
 */
export async function checkRootFolderStatus(
  drive: drive_v3.Drive,
  folderId: string
): Promise<{ exists: true; trashed: boolean } | { exists: false }> {
  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: "id, trashed",
    });
    return { exists: true, trashed: response.data.trashed ?? false };
  } catch (error) {
    // googleapis errors use .code, not .status
    if ((error as { code?: number })?.code === 404) {
      return { exists: false };
    }
    throw error;
  }
}
```

### Modify: `syncFromGoogleDrive()`

Add at start of function, after getting drive client:

```typescript
// Check root folder status before syncing
const rootStatus = await checkRootFolderStatus(drive, connection.rootFolderId);

if (!rootStatus.exists) {
  await prisma.googleDriveConnection.update({
    where: { id: connection.id },
    data: { lastError: "ROOT_FOLDER_DELETED", lastSyncAt: new Date() },
  });
  return { success: false, error: "ROOT_FOLDER_DELETED" };
}

if (rootStatus.trashed) {
  await prisma.googleDriveConnection.update({
    where: { id: connection.id },
    data: { lastError: "ROOT_FOLDER_TRASHED", lastSyncAt: new Date() },
  });
  return { success: false, error: "ROOT_FOLDER_TRASHED" };
}

// Clear any previous root folder error if folder is now healthy
if (connection.lastError?.startsWith("ROOT_FOLDER_")) {
  await prisma.googleDriveConnection.update({
    where: { id: connection.id },
    data: { lastError: null },
  });
}
```

### Modify: `settings-section.tsx`

Add conditional rendering for trashed/deleted states:

```tsx
{
  connection.lastError === "ROOT_FOLDER_TRASHED" && (
    <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 text-yellow-500" />
        <div className="space-y-1">
          <p className="text-sm font-medium">CanonCore folder is in Trash</p>
          <p className="text-muted-foreground text-xs">
            Your CanonCore folder was moved to Google Drive's Trash. Sync is
            paused until you restore it.
          </p>
          <a
            href={`https://drive.google.com/drive/folders/${connection.rootFolderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1.5 text-xs hover:underline"
          >
            <ExternalLink className="size-3" />
            Restore in Drive
          </a>
        </div>
      </div>
    </div>
  );
}

{
  connection.lastError === "ROOT_FOLDER_DELETED" && (
    <div className="border-destructive/50 bg-destructive/10 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="text-destructive mt-0.5 size-4" />
        <div className="space-y-1">
          <p className="text-sm font-medium">CanonCore folder was deleted</p>
          <p className="text-muted-foreground text-xs">
            Your CanonCore folder was permanently deleted from Google Drive.
            Disconnect and reconnect to create a new folder.
          </p>
        </div>
      </div>
    </div>
  );
}
```

## Testing

### Unit Tests to ADD

**`tests/unit/lib/google-drive-client.test.ts`:**

| Test                                                                  | Description                            |
| --------------------------------------------------------------------- | -------------------------------------- |
| `checkRootFolderStatus returns trashed: true when folder is in trash` | Mock API response with `trashed: true` |
| `checkRootFolderStatus returns exists: false when folder is deleted`  | Mock 404 response                      |

**`tests/unit/lib/google-drive-actions.test.ts`:**

| Test                                                                     | Description                              |
| ------------------------------------------------------------------------ | ---------------------------------------- |
| `syncFromGoogleDrive returns ROOT_FOLDER_TRASHED when folder is trashed` | Verify early return and DB update        |
| `syncFromGoogleDrive returns ROOT_FOLDER_DELETED when folder is gone`    | Verify early return and DB update        |
| `syncFromGoogleDrive clears ROOT_FOLDER error when folder is restored`   | Verify error cleared on successful check |

**`tests/unit/components/google-drive/settings-section.test.tsx`:**

| Test                                                                 | Description                   |
| -------------------------------------------------------------------- | ----------------------------- |
| `shows trashed folder warning when lastError is ROOT_FOLDER_TRASHED` | Verify warning UI renders     |
| `shows correct Drive link for trashed folder`                        | Verify link uses rootFolderId |
| `shows deleted folder warning when lastError is ROOT_FOLDER_DELETED` | Verify different message      |
| `hides Sync Now button when folder is trashed`                       | Sync shouldn't be offered     |

### E2E Tests to ADD

**`e2e/journeys/google-drive/drive-connection.spec.ts`:**

| Test                                             | Description                                             |
| ------------------------------------------------ | ------------------------------------------------------- |
| `shows warning when CanonCore folder is trashed` | Set `lastError: 'ROOT_FOLDER_TRASHED'` in DB, verify UI |

### Tests to MODIFY

Existing sync tests may need to mock `checkRootFolderStatus` to return healthy state.

## Edge Cases

1. **Folder trashed then restored before sync** - Check passes, sync proceeds normally
2. **Folder trashed during sync** - Current sync may partially fail, next sync detects issue
3. **Network error during check** - Error propagates, sync fails with network error (existing behavior)
4. **Token expired during check** - Token refresh happens first (existing behavior)
