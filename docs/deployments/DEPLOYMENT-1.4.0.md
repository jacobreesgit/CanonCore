# Deployment 1.4.0 - Google Drive Improvements and Sidebar Cleanup

**Date**: 2026-01-11
**Branch**: development

## Summary

Google Drive sync now detects when the CanonCore folder is trashed and guides users to recover. The sidebar is cleaner with Quick Create removed, and new "Open in Drive" links provide quick access to your synced folders.

## Features

### Trashed folder detection

When the CanonCore root folder is moved to Google Drive's Trash:

- Sync detects the trashed state and pauses syncing
- A clear warning shows in both the sync toast and settings
- Users can restore the folder in Drive, then retry sync
- If permanently deleted, settings prompts to disconnect and reconnect

Error codes:

- `ROOT_FOLDER_TRASHED` - Folder is in Trash (recoverable by restoring)
- `ROOT_FOLDER_DELETED` - Folder permanently deleted (requires reconnection)

### Open in Google Drive

The settings panel now includes a link icon next to connected accounts. Click it to open your CanonCore folder directly in Google Drive's web interface.

### Sync from settings

A **Sync** button in the Google Drive settings section lets you trigger manual sync without leaving the settings dialog. Shows progress and results via toast notifications.

### Simplified sidebar

Removed the Quick Create button from the sidebar. Items are created using the **Add Item** button in the toolbar, keeping the sidebar focused on navigation.

## Files Changed

### Added

```
tests/unit/components/google-drive/settings-section.test.tsx  # 18 unit tests
tests/unit/components/items/file-type-combobox.test.tsx       # 14 unit tests
tests/unit/components/items/item-context-menu.test.tsx        # 3 unit tests
docs/plans/2026-01-11-trashed-root-folder-detection.md        # Design document
docs/plans/2026-01-11-google-drive-links.md                   # Design document
```

### Modified

```
components/google-drive/settings-section.tsx  # Sync button, Drive link, trashed detection
components/nav-main.tsx                       # Removed Quick Create button
components/my-items-providers.tsx             # Simplified (removed QuickCreateProvider)
components/items/items-view.tsx               # Removed Quick Create subscription
lib/google-drive-actions.ts                   # Trashed folder error handling
lib/google-drive-client.ts                    # checkRootFolderStatus() function
lib/types.ts                                  # GoogleDriveConnection type consolidation
```

### Deleted

```
contexts/add-item-context.tsx                     # Quick Create context (no longer needed)
e2e/journeys/items/items-quick-create.spec.ts     # Quick Create E2E tests
```

## Technical Details

### Root folder status check

New function in `google-drive-client.ts`:

```typescript
async checkRootFolderStatus(rootFolderId: string): Promise<{
  exists: boolean;
  trashed: boolean;
}>;
```

Called at the start of `syncFromGoogleDrive()` to detect folder issues before attempting sync operations.

### Error propagation

When trashed folder detected:

1. `lastError` set to `ROOT_FOLDER_TRASHED` in database
2. Sync returns error with machine-readable code
3. UI displays user-friendly message with recovery steps
4. Sync button remains enabled (user can retry after restoring folder)

### Type consolidation

`GoogleDriveConnection` type moved from local interface in settings-section.tsx to centralized `lib/types.ts` for reuse across components.

## Test Results

| Suite      | Result     |
| ---------- | ---------- |
| Unit tests | 608 passed |
| Lint       | 0 errors   |
| Types      | 0 errors   |
| Knip       | 0 unused   |

## Deployment Steps

1. Pull latest changes
2. Run `pnpm install`
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No database migrations or environment variable changes required.

## Version History

| Version | Date       | Summary                                       |
| ------- | ---------- | --------------------------------------------- |
| 1.4.0   | 2026-01-11 | Google Drive improvements, sidebar cleanup    |
| 1.3.0   | 2026-01-10 | Dedicated password and email change modals    |
| 1.2.0   | 2026-01-10 | Sync behavior improvements, auth page polish  |
| 1.1.0   | 2026-01-10 | Test coverage expansion, auth UX improvements |
| 1.0.0   | 2026-01-10 | Google Drive integration replacing SFTP       |
