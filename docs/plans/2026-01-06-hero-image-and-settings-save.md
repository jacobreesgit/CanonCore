# Hero Image & Settings Save Redesign

**Date:** 2026-01-06
**Status:** Approved (Validated)

## Overview

Two related changes to the item detail experience:

1. **Hero Image Field** - Separate selection for hero banner background vs thumbnail artwork
2. **Single Save Button** - Consolidate Item Settings dialog to save all changes at once

## Data Model

### New `isHero` field on ItemFile

Add `isHero: Boolean @default(false)` to the ItemFile model:

```prisma
model ItemFile {
  id               String    @id @default(cuid())
  filename         String
  sftpPath         String?
  fileType         FileType
  mimeType         String
  size             BigInt
  playbackPosition Float     @default(0)
  isPrimary        Boolean   @default(false)
  isHero           Boolean   @default(false)  // NEW
  itemId           String
  item             Item      @relation(fields: [itemId], references: [id], onDelete: Cascade)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}
```

### Selection Logic

- Only ARTWORK files can have `isHero = true`
- One file per item can be `isHero` (enforced by server action)
- Hero display fallback chain: `isHero` artwork → `isPrimary` artwork → first artwork → gradient fallback

## Item Settings Dialog

### UI Changes

1. **Remove individual Save buttons** for name, description, and file selections
2. **Add single "Save Changes" button** in dialog footer
3. **Add "Hero Image" dropdown** below Primary Artwork (only when 2+ artwork files)
4. **Track dirty state** - Save button disabled until changes made
5. **Add Cancel button** to reset without saving

### Layout

```
┌────────────────────────────────────┐
│ ⚙ Item Settings                    │
│ Configure display preferences      │
├────────────────────────────────────┤
│ Name         [Breaking Bad      ]  │
│                                    │
│ Description                        │
│ ┌────────────────────────────────┐ │
│ │ A chemistry teacher...         │ │
│ └────────────────────────────────┘ │
│                           0/200    │
│                                    │
│ ── File Summary ───────────────   │
│   3 media · 2 artwork · 4 items   │
├────────────────────────────────────┤
│ Primary Media   [video.mp4      ▾] │
│ Primary Artwork [poster.jpg     ▾] │
│ Hero Image      [fanart.jpg     ▾] │
│ Default Subtitle[en.srt         ▾] │
├────────────────────────────────────┤
│           [Cancel]  [Save Changes] │
└────────────────────────────────────┘
```

### State Management

Track pending changes in component state, only call server action on Save:

```typescript
interface PendingChanges {
  name?: string;
  description?: string;
  primaryMediaId?: string;
  primaryArtworkId?: string;
  heroArtworkId?: string;
  primarySubtitleId?: string;
}
```

## Seed Data Updates

### SeedFile Interface

```typescript
export interface SeedFile {
  filename: string;
  fileType: FileType;
  mimeType: string;
  size: bigint;
  isPrimary?: boolean;
  isHero?: boolean; // NEW
}
```

### Hero Assignment Strategy

| Content Type          | Hero File              | Rationale                      |
| --------------------- | ---------------------- | ------------------------------ |
| Movies with banner    | `banner.jpeg`          | Cinematic wide format for hero |
| Movies without banner | Same as `isPrimary`    | Falls back to poster           |
| TV show seasons       | `fanart.jpg` if exists | Wider aspect for hero          |
| Episodes with thumb   | `thumb.jpg`            | Episode-specific art           |
| Albums                | Same as `isPrimary`    | Cover art for both             |

## Server Actions

### New: `updateItemSettings` (Atomic Save)

Single transactional action for the Save button. Uses Prisma transaction for atomicity:

```typescript
export async function updateItemSettings(
  itemId: string,
  changes: {
    name?: string;
    description?: string;
    primaryMediaId?: string;
    primaryArtworkId?: string;
    heroArtworkId?: string;
    primarySubtitleId?: string;
  }
): Promise<ActionResult<void>>;
```

**Implementation requirements:**

1. Verify authenticated user owns the item (authorization)
2. Validate all file IDs belong to the item
3. Validate file types match selection (ARTWORK for artwork/hero, MEDIA for media, SUBTITLE for subtitle)
4. Use `prisma.$transaction()` to update atomically:
   - Update item name/description
   - Clear and set `isPrimary` flags per file type
   - Clear and set `isHero` flag for artwork
5. Return error if any validation fails (no partial updates)

### New: `setHeroFile` (Standalone)

For potential future use outside settings dialog:

```typescript
export async function setHeroFile(fileId: string): Promise<ActionResult<void>>;
```

**Implementation requirements:**

1. Verify authenticated user owns the item (authorization check required)
2. Verify file exists and is ARTWORK type (validation)
3. Clear `isHero` on all other artwork files for that item
4. Set `isHero = true` on target file

### Modified: `getItemFiles`

Return `isHero` in the serialized response for client components.

## Component Changes

### ItemHero

No prop changes needed. The client handles fallback logic and passes the resolved artwork ID:

```typescript
interface ItemHeroProps {
  // ... existing props
  artworkId?: string | null; // Client passes hero OR fallback artwork
}
```

### ItemDetailClient

Determine hero file from files and pass to ItemHero:

```typescript
// Fallback chain: isHero → isPrimary → first artwork
const heroFile = files.artwork.find(f => f.isHero)
  ?? files.artwork.find(f => f.isPrimary)
  ?? files.artwork[0];

// Pass resolved ID to ItemHero
<ItemHero artworkId={heroFile?.id} ... />
```

## Test Changes

### Unit Tests - Add

| File                            | Tests                                            |
| ------------------------------- | ------------------------------------------------ |
| `item-settings-dialog.test.tsx` | Single Save button saves all changes             |
| `item-settings-dialog.test.tsx` | Cancel resets state to original values           |
| `item-settings-dialog.test.tsx` | Hero dropdown renders when 2+ artwork            |
| `item-settings-dialog.test.tsx` | Dirty state tracking enables/disables Save       |
| `item-settings-dialog.test.tsx` | Error handling when save fails                   |
| `item-file-actions.test.ts`     | `updateItemSettings` saves all fields atomically |
| `item-file-actions.test.ts`     | `updateItemSettings` validates file ownership    |
| `item-file-actions.test.ts`     | `updateItemSettings` validates file types        |
| `item-file-actions.test.ts`     | `setHeroFile` requires ARTWORK file type         |
| `item-file-actions.test.ts`     | `setHeroFile` verifies user authorization        |

### Unit Tests - Remove

| File                            | Tests                                             |
| ------------------------------- | ------------------------------------------------- |
| `item-settings-dialog.test.tsx` | Individual save button tests for name/description |

### Integration Tests - Add

| File                 | Tests                                                |
| -------------------- | ---------------------------------------------------- |
| `items/crud.test.ts` | Hero file selection and retrieval                    |
| `items/crud.test.ts` | `updateItemSettings` transaction rollback on failure |
| `items/crud.test.ts` | Bulk save updates all fields in single transaction   |

### E2E Tests - Modify

| File                 | Changes                                                   |
| -------------------- | --------------------------------------------------------- |
| `items-crud.spec.ts` | Update settings dialog tests for single Save flow         |
| `items-crud.spec.ts` | Test hero selection persists and displays                 |
| `items-crud.spec.ts` | Verify hero image displays on detail page after selection |
| `sftp-sync.spec.ts`  | Verify synced items populate hero from SFTP banner files  |

## Migration

```sql
ALTER TABLE "ItemFile" ADD COLUMN "isHero" BOOLEAN NOT NULL DEFAULT false;
```

## Files to Modify

### Create

- `prisma/migrations/XXX_add_is_hero_to_item_file/migration.sql`

### Modify

- `prisma/schema.prisma` - Add isHero field
- `prisma/seed-data.ts` - Add isHero to interface and mark hero files
- `lib/item-file-actions.ts` - Add `updateItemSettings`, `setHeroFile`, update `getItemFiles`
- `lib/types.ts` - Add isHero to SerializedItemFile
- `components/items/item-settings-dialog.tsx` - Single Save, Hero dropdown, Cancel button
- `components/items/item-detail-client.tsx` - Pass resolved hero file to ItemHero
- `tests/unit/components/items/item-settings-dialog.test.tsx`
- `tests/unit/lib/item-file-actions.test.ts`
- `tests/integration/items/crud.test.ts`
- `e2e/journeys/items/items-crud.spec.ts`
- `e2e/journeys/sftp/sftp-sync.spec.ts`

## Future Considerations

- **"None" option**: Consider adding a "None" option in Hero dropdown to explicitly clear hero selection and fall back to primary artwork
- **Bulk operations**: The `updateItemSettings` pattern could be extended for other bulk update scenarios
