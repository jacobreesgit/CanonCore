# Deployment 1.2.0 - Sync Behavior Improvements

**Date**: 2026-01-10
**Branch**: development

## Summary

This release fixes sync feedback accuracy, adds auto-sync for existing Google Drive folders, improves upload feedback in settings, and polishes auth page branding with gradient backgrounds.

## Bug Fixes

### Accurate sync update counts

Previously, clicking **Sync** after renaming an item locally showed "Sync complete: 1 updated" even when nothing changed from Drive's perspective. The sync now compares current values with Drive values before counting updates.

| Scenario                        | Before          | After                         |
| ------------------------------- | --------------- | ----------------------------- |
| Rename item locally, click Sync | "1 updated"     | "Sync complete" (no count)    |
| External changes in Drive       | "1 updated"     | "1 updated" (accurate)        |
| No changes anywhere             | "0 updated"     | "Sync complete" (cleaner)     |

### Auto-sync existing folders on connect

When connecting Google Drive with an existing CanonCore folder, the content is now automatically imported with a two-phase toast:

1. "Connected to Google Drive. Syncing existing content..." (loading)
2. "Imported X items from existing folder." (success)

Previously, users had to manually click Sync after connecting.

## UX Improvements

### Upload feedback in settings dialog

When files are uploaded in the item settings dialog, the save toast now includes the upload count:

- "Settings saved. 3 files uploaded." (with uploads)
- "Settings saved" (no uploads)

### Auth page branding consistency

All auth pages now feature:

- Gradient background with primary color accents
- Smaller logo (h-6) with "CanonCore" text beside it
- Consistent styling across sign-in, sign-up, forgot-password, and reset-password

## Files Changed

### Added

```
docs/plans/2026-01-10-sync-behavior-improvements-design.md
```

### Modified

```
app/(auth)/forgot-password/page.tsx    # Gradient background, branding
app/(auth)/reset-password/page.tsx     # Gradient background, branding
app/(auth)/sign-in/page.tsx            # Gradient background, branding
app/(auth)/sign-up/page.tsx            # Gradient background, branding
app/api/auth/callback/google-drive/route.ts  # Add existing flag to redirect
components/app-sidebar.tsx             # Smaller logo with text
components/google-drive/oauth-toast.tsx      # Auto-sync for existing folders
components/items/file-type-combobox.tsx      # Pass success count to callback
components/items/item-settings-dialog.tsx    # Track and display upload count
content/docs/google-drive/sync-files.mdx     # Updated sync documentation
lib/google-drive-actions.ts            # Change detection before counting updates
lib/google-drive-client.ts             # RootFolderResult with wasExisting flag
tests/unit/api/google-drive-callback-route.test.ts  # Updated mock return type
```

### Deleted

```
docs/todo.md                           # Completed items removed
```

## Technical Details

### Change detection in sync

New `hasItemChanges()` function compares:
- Item name
- Parent ID
- Thumbnail URL
- Modified timestamp

Only increments `ctx.stats.updated` when values actually differ.

### RootFolderResult interface

```typescript
interface RootFolderResult {
  id: string;
  wasExisting: boolean;
}
```

The `wasExisting` flag is passed via URL query param to trigger auto-sync on client.

## Test Results

| Suite      | Result     |
| ---------- | ---------- |
| Unit tests | 524 passed |
| Lint       | 0 errors   |
| Types      | 0 errors   |
| Build      | Success    |

## Deployment Steps

1. Pull latest changes
2. Run `pnpm install`
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No database migrations or environment variable changes required.

## Version History

| Version | Date       | Summary                                    |
| ------- | ---------- | ------------------------------------------ |
| 1.2.0   | 2026-01-10 | Sync behavior improvements, auth polish    |
| 1.1.0   | 2026-01-10 | Test coverage expansion, auth UX, favicons |
| 1.0.0   | 2026-01-10 | Google Drive integration, SFTP removal     |
