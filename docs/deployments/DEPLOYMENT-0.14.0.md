# Deployment 0.14.0 - Item Settings Dialog

**Date:** 2026-01-03
**Branch:** development
**Type:** Feature Enhancement

## Summary

Adds a unified Item Settings Dialog that consolidates name editing and primary file selection. People can now set which media file, artwork, or subtitle is the primary for an item with multiple attached files.

## Changes

### New Features

- **Item Settings Dialog** - Right-click an item and select **Settings** to open a unified dialog for configuring the item
- **Primary file selection** - Choose which media file plays, which artwork displays as thumbnail, and which subtitle loads by default
- **Progressive disclosure** - File selection sections only appear when an item has 2+ files of that type

### Database Changes

- Added `isPrimary` boolean field to ItemFile model (defaults to `false`)
- Added composite index on `(itemId, fileType, isPrimary)` for efficient queries
- Migration: `20260103000000_add_item_file_is_primary`

### API Changes

- Added `setPrimaryFile(fileId)` server action that atomically switches primary status using Prisma transaction
- Extended `getItemFiles` to include `isPrimary` field in response

### UI Changes

- Replaced "Rename" context menu item with "Settings" (opens dialog)
- Settings dialog includes:
  - Name input with save button
  - File count summary (media, artwork, subtitles)
  - Primary media selector (when 2+ media files)
  - Primary artwork selector with thumbnails (when 2+ artwork files)
  - Default subtitle selector (when 2+ subtitle files)

### Accessibility

- All file selection sections use `role="radiogroup"` with proper `aria-label`
- Individual file options use `role="radio"` with `aria-checked` state

## Files Changed

| Category       | Files                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Components     | `item-settings-dialog.tsx` (new), `item-context-menu.tsx`, `items-view.tsx`, sortable components |
| Server Actions | `lib/item-file-actions.ts`                                                                       |
| Types          | `lib/types.ts`                                                                                   |
| Database       | `prisma/schema.prisma`, migration file                                                           |
| Tests          | 6 new E2E tests, 4 new unit tests, 6 new integration tests                                       |

## Testing

- **Unit tests:** 192 passed
- **Integration tests:** 43 passed
- **E2E tests:** 92 passed

## Migration Notes

Run database migration before deploying:

```bash
npx prisma migrate deploy
```

The migration adds a new column with a default value, so existing records will have `isPrimary = false`.
