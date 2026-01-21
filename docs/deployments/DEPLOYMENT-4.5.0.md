# Deployment 4.5.0 - Public Pages UI & E2E Auto-Recovery

**Date**: 2026-01-21
**Branch**: development

## Summary

This release delivers unified public pages with shared UI components, persistent sorting, and a robust automatic E2E setup system. The explore page now matches My Items page structure, and E2E tests self-heal by automatically creating or restoring missing prerequisites.

## Features

### Public pages UI improvements

Unified explore and public profile pages using shared components from My Items:

```
Explore Page Structure:
┌─────────────────────────────────────┐
│ ItemHero (Explore Collections)      │
├─────────────────────────────────────┤
│ [Sort ▾]              3 collections │
├─────────────────────────────────────┤
│ ┌───────┐ ┌───────┐ ┌───────┐      │
│ │ Item  │ │ Item  │ │ Item  │      │
│ │ @user │ │  You  │ │ @user │      │
│ └───────┘ └───────┘ └───────┘      │
└─────────────────────────────────────┘
```

**New hook:**

- `useExploreSortFilter` - localStorage-persisted sort state for explore/public pages
- Versioned storage key (`canoncore-explore-sort:v1`)
- Excludes "custom" sort (not applicable to public pages)
- Cross-tab sync via StorageEvent

**Shared utilities:**

- `sortPublicItems()` - unified sorting for public items (DRY)
- `EXPLORE_SORT_OPTIONS` - sort options without "custom"
- Mobile-responsive with `MobileOptionsSheet`

**UX improvements:**

- Route prefetching on hover for faster navigation
- Shows "You" for own items, clickable `@username` for others
- Collection count display in toolbar

### E2E automatic setup and recovery

Self-healing E2E test environment that creates or restores missing prerequisites:

```bash
# Automatic setup flow:
┌─────────────────────────────────────────────────────────────┐
│ 1. Restore root folder if trashed                           │
├─────────────────────────────────────────────────────────────┤
│ 2. Ensure test folder exists (create if missing)            │
│ 3. Ensure video file exists (upload if missing)      ↓      │
│                                                parallel     │
│ 4. Ensure E2E user exists (create if missing)        ↓      │
├─────────────────────────────────────────────────────────────┤
│ 5. Ensure Drive connection record                           │
│ 6. Ensure Item record for folder                            │
│ 7. Ensure ItemFile record for video                         │
└─────────────────────────────────────────────────────────────┘
```

**New libraries:**

- `lib/drive-verification.ts` - validates Drive credentials with detailed errors
- `lib/e2e-setup.ts` - idempotent setup functions that auto-create/restore

**Key functions:**

| Function                     | Purpose                                  |
| ---------------------------- | ---------------------------------------- |
| `verifyDriveSetup()`         | Validates tokens, folder existence       |
| `assertDriveConfigured()`    | Pre-flight check with clear error output |
| `restoreRootFolderIfTrashed` | Automatic trash recovery                 |
| `ensureTestFolderExists()`   | Creates "Breaking Bad" if missing        |
| `ensureVideoFileExists()`    | Uploads video from local file if missing |
| `runAutomaticSetup()`        | Full idempotent setup with parallelism   |

**Performance:** 2x faster setup via parallel Drive + DB operations.

### UI component refinements

- `EmptyState` - improved variant handling
- `FilterDropdown` / `SortDropdown` - consistent styling
- `GridItem` - description link support (for `@username` navigation)
- `TreeItem` - improved accessibility
- `Dialog` / `Command` - minor fixes

## Files Changed

### Added

```
hooks/use-explore-sort.ts                            # Explore sort state hook
lib/drive-verification.ts                            # Drive credential validation
lib/e2e-setup.ts                                     # Automatic E2E setup utilities
docs/plans/2026-01-20-public-pages-ui-improvements.md
docs/plans/2026-01-21-automatic-e2e-setup.md
docs/plans/2026-01-21-public-item-tree-view.md
tests/integration/e2e-setup/auto-recovery.test.ts
tests/unit/lib/drive-verification.test.ts
tests/unit/lib/e2e-setup.test.ts
```

### Modified

```
app/(public)/explore/explore-client.tsx              # Unified explore UI
app/(public)/explore/page.tsx                        # Server component updates
app/(public)/layout.tsx                              # Layout improvements
app/(public)/u/[username]/[itemId]/page.tsx          # Public item page
app/(public)/u/[username]/[itemId]/public-item-client.tsx  # Tree view, UI updates
app/(public)/u/[username]/page.tsx                   # Public profile page
app/(public)/u/[username]/public-profile-client.tsx  # Profile UI improvements
app/api/artwork/[fileId]/route.ts                    # Error handling improvements
components/items/empty-state.tsx                     # New variants
components/items/filter-dropdown.tsx                 # Consistency updates
components/items/mobile-options-sheet.tsx            # Sort-only mode support
components/items/sort-dropdown.tsx                   # Options prop support
components/sortable-grid/GridItem.tsx                # Description link support
components/sortable-tree/components/TreeItem/TreeItem.tsx  # Accessibility
components/ui/command.tsx                            # Minor fix
components/ui/dialog.tsx                             # Minor fix
e2e/journeys/global.setup.ts                         # Auto-recovery integration
lib/item-utils.ts                                    # sortPublicItems, EXPLORE_SORT_OPTIONS
prisma/seed.ts                                       # Import fixes
scripts/generate-refresh-token.ts                    # Refinements
scripts/verify-drive-setup.ts                        # Better output
tests/unit/api/artwork-route.test.ts                 # Extended coverage
```

### Deleted

```
e2e/journeys/media/video-seeking.spec.ts             # Consolidated into drive-media.spec.ts
```

## Test Coverage Impact

| Area                       | Before | After | Change |
| -------------------------- | ------ | ----- | ------ |
| Drive verification tests   | 0      | 241   | +241   |
| E2E setup unit tests       | 0      | 473   | +473   |
| E2E auto-recovery tests    | 0      | 103   | +103   |
| Artwork route tests        | ~100   | ~342  | +242   |

## Breaking Changes

None. All changes are additive or internal refactors.

## Migration Notes

1. **No database migration required** - this release contains no schema changes.

2. **E2E tests now auto-recover** - if test prerequisites are missing, they'll be created automatically. Manual setup is only needed if credentials are missing.

3. **New environment check** - E2E tests will fail fast with clear instructions if Drive credentials are not configured.
