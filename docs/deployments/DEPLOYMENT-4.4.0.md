# Deployment 4.4.0 - Inherited Item Visibility & Setup Automation

**Date**: 2026-01-20
**Branch**: development

## Summary

This release introduces inherited item visibility for cleaner Explore pages, comprehensive Google Drive setup automation for developers, and a consolidated seed system. Children can now inherit public visibility from parents, reducing clutter while maintaining deep linking.

## Features

### Inherited item visibility

Items can now inherit public visibility from their parent chain, reducing the Explore page to top-level curated items only:

```
Movies/           isPublic: false   (organizational folder, hidden)
├── Shawshank     inheritVisibility: false, isPublic: true  → Explore ✓
├── Godfather     inheritVisibility: false, isPublic: true  → Explore ✓
└── Dark Knight   inheritVisibility: false, isPublic: true  → Explore ✓

TV Shows/         isPublic: false   (organizational folder, hidden)
└── Breaking Bad  inheritVisibility: false, isPublic: true  → Explore ✓
    └── Season 1  inheritVisibility: true   (inherits from BB) → accessible via link
        └── Ep 1  inheritVisibility: true   (inherits from S1) → accessible via link
```

**Rules:**
- `inheritVisibility: true` → Uses parent's effective visibility, toggle disabled in UI
- `inheritVisibility: false` → Uses own `isPublic` value, toggle enabled
- Explore shows only explicitly public items (not inheriting)
- Direct links and profile pages work for all effectively-visible items

**New components:**
- `ParentPrivacyWarningDialog` - Warns when making item public if parent is private
- `ReparentWarningDialog` - Warns when moving items that would change effective visibility

### Google Drive setup automation

Streamlined developer experience with automated folder creation and validation:

```bash
# Setup commands
pnpm run setup:e2e       # Setup E2E Drive account with auto-created folder
pnpm run setup:seed      # Setup seed Drive account with auto-created folder
pnpm run setup:verify    # Validate both accounts are configured correctly
pnpm run setup:all       # Run both OAuth setups sequentially
```

**Features:**
- Auto-creates root folders during OAuth setup
- Validates folder exists and is accessible
- Clear error messages for common issues
- Detects trashed folders and provides recovery guidance

**Environment variable renames:**
| Old | New |
|-----|-----|
| `GOOGLE_TEST_REFRESH_TOKEN` | `GOOGLE_SEED_REFRESH_TOKEN` |
| `GOOGLE_TEST_ROOT_FOLDER_ID` | `GOOGLE_SEED_ROOT_FOLDER_ID` |
| `GOOGLE_TEST_EMAIL` | `GOOGLE_SEED_EMAIL` |
| `E2E_GOOGLE_REFRESH_TOKEN` | `GOOGLE_E2E_REFRESH_TOKEN` |
| `E2E_GOOGLE_ROOT_FOLDER_ID` | `GOOGLE_E2E_ROOT_FOLDER_ID` |
| `E2E_GOOGLE_EMAIL` | `GOOGLE_E2E_EMAIL` |

### Consolidated seed system

Merged seed-cleanup functionality into the main seed script:

- Single `prisma/seed.ts` handles all seeding operations
- Auto-cleans Drive folder before seeding (like E2E now does)
- Enhanced error handling with clear progress reporting
- Removed redundant `prisma/seed-cleanup.ts`

### E2E global setup improvements

Enhanced test reliability with better Drive handling:

- Global setup now wipes Drive contents before tests
- Preserves baseline data (e.g., "Breaking Bad" folder)
- New test helpers in `e2e/helpers/test-user.ts`
- Mobile viewport reliability improvements

## Files Changed

### Added

```
components/items/parent-privacy-warning-dialog.tsx     # Privacy warning component
components/items/reparent-warning-dialog.tsx           # Reparent warning component
docs/plans/2026-01-20-google-drive-setup-automation.md # Setup automation plan
docs/plans/2026-01-20-inherited-item-visibility.md     # Visibility plan
e2e/journeys/public/item-visibility.spec.ts            # Visibility E2E tests (634 lines)
prisma/migrations/20260120000000_add_inherit_visibility/migration.sql
prisma/migrations/20260120000000_add_inherit_visibility/down.sql
scripts/verify-drive-setup.ts                          # Drive validation script
tests/unit/components/items/parent-privacy-warning-dialog.test.tsx
tests/unit/components/items/reparent-warning-dialog.test.tsx
tests/integration/seed/seed.test.ts                    # Seed integration tests
```

### Modified

```
app/(my-items)/my-items/[itemId]/page.tsx              # Visibility prop
app/(public)/explore/page.tsx                          # Filter inheriting items
app/(public)/layout.tsx                                # Layout improvements
app/(public)/page.tsx                                  # Landing page updates
app/(public)/u/[username]/[itemId]/page.tsx            # Public item visibility
app/(public)/u/[username]/[itemId]/public-item-client.tsx  # Client visibility
app/(public)/u/[username]/page.tsx                     # Profile page
components/items/item-detail-client.tsx                # Visibility support
components/items/item-settings-dialog.tsx              # Inherit toggle
components/items/items-toolbar.tsx                     # Test IDs
components/items/items-view.tsx                        # Visibility handling
components/items/visibility-toggle.tsx                 # Major enhancement (+245 lines)
components/nav-main.tsx                                # Navigation updates
components/sortable-tree/SortableTree.tsx              # Reparent warnings
e2e/fixtures/google-drive.fixture.ts                   # Env var renames
e2e/helpers/test-user.ts                               # New test helpers
e2e/journeys/global.setup.ts                           # Drive wipe before tests (+240 lines)
lib/fork-actions.ts                                    # inheritVisibility: false on fork
lib/google-drive-client.ts                             # Client improvements
lib/item-actions.ts                                    # updateVisibility, updateInheritVisibility
lib/public-auth.ts                                     # getPublicChildItems, isItemFullyPublic
lib/types.ts                                           # InheritVisibilityItem type
prisma/schema.prisma                                   # inheritVisibility field
prisma/seed-config.ts                                  # Enhanced configuration
prisma/seed.ts                                         # Major refactor (+903 lines)
scripts/generate-refresh-token.ts                      # Purpose flag, auto-folder (+412 lines)
scripts/setup-e2e-drive.ts                             # Enhanced setup
tests/unit/lib/item-actions.test.ts                    # Visibility action tests
tests/unit/lib/public-auth.test.ts                     # Public auth tests (+144 lines)
tests/unit/prisma/seed.test.ts                         # Seed tests (+217 lines)
```

### Deleted

```
prisma/seed-cleanup.ts                                 # Consolidated into seed.ts
```

## Database Migration

```sql
-- Add inheritVisibility field
ALTER TABLE "Item" ADD COLUMN "inheritVisibility" BOOLEAN NOT NULL DEFAULT false;
```

**Rollback (if needed):**
```sql
ALTER TABLE "Item" DROP COLUMN "inheritVisibility";
```

## Test Coverage Impact

| Area                      | Before | After  | Change   |
| ------------------------- | ------ | ------ | -------- |
| Visibility E2E tests      | 0      | 634    | +634     |
| Public auth unit tests    | ~50    | ~194   | +144     |
| Seed integration tests    | 0      | 127    | +127     |
| Warning dialog tests      | 0      | 221    | +221     |
| Item action tests         | ~100   | ~259   | +159     |

## Breaking Changes

### Environment variable renames

Users must rename variables in `.env.local`:

```bash
# Old → New
GOOGLE_TEST_REFRESH_TOKEN → GOOGLE_SEED_REFRESH_TOKEN
GOOGLE_TEST_ROOT_FOLDER_ID → GOOGLE_SEED_ROOT_FOLDER_ID
GOOGLE_TEST_EMAIL → GOOGLE_SEED_EMAIL
E2E_GOOGLE_REFRESH_TOKEN → GOOGLE_E2E_REFRESH_TOKEN
E2E_GOOGLE_ROOT_FOLDER_ID → GOOGLE_E2E_ROOT_FOLDER_ID
E2E_GOOGLE_EMAIL → GOOGLE_E2E_EMAIL
```

## Migration Notes

1. **Run database migration:**
   ```bash
   npx prisma migrate deploy
   ```

2. **Update environment variables** (see Breaking Changes above)

3. **Existing items:** All existing items default to `inheritVisibility: false`, preserving current behavior.

4. **New child items:** When creating children of public items, they will default to `inheritVisibility: true` for cleaner hierarchies.
