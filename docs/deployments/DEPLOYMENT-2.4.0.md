# Deployment 2.4.0 - Sort, Filter & User Preferences

**Date**: 2026-01-13
**Branch**: development

## Summary

Items can now be sorted and filtered with preferences that persist across sessions. A new Preferences tab in Settings lets people choose their default view mode and sort order. The settings dialog now uses a tabbed interface for better organization, and dark mode tab styling has been improved.

## Features

### Sort and filter items

Sort your items by name, creation date, or last updated. Filter to show only items with files, without files, or by sync status.

**Sort options:**

- Custom Order (drag-and-drop enabled)
- Name A-Z / Name Z-A
- Newest First / Oldest First
- Recently Updated

**Filter options:**

- All Items
- Has Files / No Files
- Synced / Pending

The sort and filter selections persist in localStorage across sessions. Edit mode is automatically disabled when using a non-custom sort order since reordering doesn't make sense for sorted lists.

### Preferences tab in Settings

A new **Preferences** tab in the Settings dialog lets you configure:

- **Default View Mode** - Choose Grid or Tree as your default view
- **Default Sort** - Set which sort order to use when you open the app

Preferences are stored in the database and sync across devices when you sign in.

### Settings dialog tabs

The Settings dialog now uses a tabbed interface:

- **Profile** - Name, email, password, avatar, hero image
- **Preferences** - View mode and sort defaults

This makes it easier to find settings and keeps related options grouped together.

### Dark mode improvements

Fixed the active tab indicator in dark mode. The selected tab now has a visible background that contrasts properly against the tab bar.

## Files Changed

### Added

```
hooks/use-items-sort-filter.ts               # Sort/filter state with localStorage
components/items/sort-dropdown.tsx           # Sort option dropdown
components/items/filter-dropdown.tsx         # Filter option dropdown
components/profile/preferences-tab.tsx       # Preferences settings tab
components/ui/radio-group.tsx                # shadcn radio group component
components/ui/select.tsx                     # shadcn select component
e2e/journeys/items/items-sort-filter.spec.ts # E2E tests for sort/filter
tests/unit/hooks/use-items-sort-filter.test.ts
tests/unit/lib/item-utils-sort-filter.test.ts
tests/unit/components/items/sort-dropdown.test.tsx
tests/unit/components/items/filter-dropdown.test.tsx
tests/unit/components/items/items-toolbar-sort-filter.test.tsx
tests/unit/components/profile/preferences-tab.test.tsx
tests/unit/components/profile/settings-dialog-tabs.test.tsx
tests/unit/lib/user-actions-preferences.test.ts
prisma/migrations/20260113183701_add_user_preferences/migration.sql
```

### Modified

```
lib/types.ts                        # SortOption, FilterOption, ViewMode types
lib/item-utils.ts                   # sortItems(), filterItems() functions
lib/user-actions.ts                 # getPreferences(), updatePreferences()
prisma/schema.prisma                # defaultViewMode, defaultSortBy columns
components/items/items-view.tsx     # Integrated sort/filter dropdowns
components/items/items-toolbar.tsx  # Sort/filter props and rendering
components/items/view-toggle.tsx    # Minor styling adjustment
components/profile/settings-dialog.tsx  # Tabbed interface, preferences tab
components/ui/tabs.tsx              # Dark mode active state fix
```

## Database Migration

```sql
-- Add user preference columns
ALTER TABLE "User" ADD COLUMN "defaultSortBy" TEXT;
ALTER TABLE "User" ADD COLUMN "defaultViewMode" TEXT;
```

Both columns are nullable strings. Null means "use app defaults" (grid view, custom sort). Using strings instead of enums allows adding new options without migrations.

## Test Results

| Suite       | Tests  | Result     |
| ----------- | ------ | ---------- |
| Unit        | 1086   | All passed |
| Integration | 47     | All passed |
| E2E         | 58     | All passed |

## API Changes

### New server actions

```typescript
// lib/user-actions.ts
export async function getPreferences(): Promise<PreferencesResult>;
export async function updatePreferences(
  prefs: Partial<UserPreferences>
): Promise<ActionResult>;
```

### New types

```typescript
// lib/types.ts
export type SortOption =
  | "custom"
  | "name-asc"
  | "name-desc"
  | "created-desc"
  | "created-asc"
  | "updated-desc";

export type FilterOption =
  | "all"
  | "has-files"
  | "no-files"
  | "synced"
  | "pending";

export type ViewMode = "grid" | "tree";
```

### New utility functions

```typescript
// lib/item-utils.ts
export function sortItems(items: ItemWithArtwork[], sortBy: SortOption): ItemWithArtwork[];
export function filterItems(items: ItemWithArtwork[], filterBy: FilterOption): ItemWithArtwork[];
```
