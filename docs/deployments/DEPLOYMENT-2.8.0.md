# Deployment 2.8.0 - Mobile Responsiveness & Error Handling

**Date**: 2026-01-16
**Branch**: development

## Summary

The toolbar now adapts to mobile screens with a swipe-up drawer for Sort and Filter options. Server actions use centralized error handling for cleaner code and better user messages when database operations fail. The Add Item dialog includes improved upload progress tracking with retry capability for failed files.

## Features

### Mobile-friendly toolbar

On mobile, the Sort and Filter dropdowns collapse into a single "Options" button that opens a bottom drawer:

**Desktop layout:**

- Sync button with text
- Sort dropdown
- Filter dropdown
- Add, Edit, View, Settings buttons with text labels

**Mobile layout:**

- Sync icon button (no text)
- Options button opens Vaul drawer with Sort and Filter sections
- Add, Edit, View, Settings show icons only

The Options button displays a small indicator dot when non-default options are active (sort not "Custom Order" or filter not "All Items").

### Centralized error handling

Server actions now use `handlePrismaError()` from `lib/errors.ts` to handle database constraint violations consistently:

```typescript
try {
  await prisma.item.create({ data: { userId: session.user.id, ... } });
} catch (error) {
  const result = handlePrismaError(error);
  if (result) return result;
  throw error;
}
```

This handles the edge case where a user's account is deleted while they're still signed in, showing a friendly message instead of a cryptic error.

### Upload progress improvements

The Add Item dialog now tracks file uploads with:

- Per-file progress bars during upload
- Success/error status for each file
- Retry button for failed uploads
- Dismiss option to close dialog even if some files failed (item still created)

## Bug Fixes

### Mobile Add button accessibility

The toolbar Add button needed `aria-label="Add"` so screen readers and Playwright can find it when the text is hidden on mobile with `hidden sm:inline`:

```tsx
<Button aria-label="Add">
  <Plus className="size-4" />
  <span className="hidden sm:inline" aria-hidden="true">
    Add
  </span>
</Button>
```

### E2E mobile-aware page object

The sort and filter page object methods now detect mobile vs desktop UI automatically:

```typescript
async selectSortOption(option: string): Promise<void> {
  const mobileOptionsButton = this.page.getByRole("button", { name: "Options" });
  const desktopSortDropdown = this.sortDropdown;

  await expect(mobileOptionsButton.or(desktopSortDropdown)).toBeVisible();
  const isMobile = await mobileOptionsButton.isVisible();

  if (isMobile) {
    await mobileOptionsButton.click();
    await this.page.getByRole("option", { name: option }).click();
    await this.page.keyboard.press("Escape");
  } else {
    await desktopSortDropdown.click();
    await this.page.getByRole("menuitemradio", { name: option }).click();
  }
}
```

### Files tab test setup

The "Tabs navigation in settings dialog" E2E test now sets up Google Drive connection before testing, since the Files tab only appears when Drive is connected.

## Files Changed

### Added

```
components/items/mobile-options-sheet.tsx          # Vaul drawer for mobile Sort/Filter
components/ui/drawer.tsx                           # Shadcn drawer component
lib/errors.ts                                      # Centralized Prisma error handling
tests/unit/components/ui/dropzone.test.tsx         # Dropzone test coverage
```

### Modified

```
components/items/items-toolbar.tsx                 # Mobile/desktop responsive layout
components/items/items-view.tsx                    # Integrate MobileOptionsSheet
components/items/edit-mode-toggle.tsx              # Responsive text labels (sm:inline)
components/items/bulk-actions-toolbar.tsx          # Responsive styling
components/items/add-item-dialog.tsx               # Upload progress tracking, retry UI
components/items/item-settings-dialog.tsx          # Consistent responsive patterns
components/sortable-tree/Tree.tsx                  # Selection props update
components/sortable-tree/SortableTree.tsx          # Selection props update
components/sortable-tree/components/TreeItem/*.tsx # Responsive updates
components/sortable-grid/GridItem.tsx              # Selection props update
lib/auth-actions.ts                                # Use handlePrismaError
lib/item-actions.ts                                # Use handlePrismaError
lib/tmdb-actions.ts                                # Use handlePrismaError
lib/google-drive-actions.ts                        # Use handlePrismaError
tests/unit/components/add-item-dialog.test.tsx     # Upload flow tests
tests/unit/components/items-view.test.tsx          # Mobile sheet tests
tests/unit/lib/tmdb-actions.test.ts                # Error handling tests
e2e/pages/items.page.ts                            # Mobile-aware sort/filter methods
e2e/journeys/items/media-lookup.spec.ts            # Drive connection for Files tab test
```

## Test Results

| Suite       | Tests | Result                      |
| ----------- | ----- | --------------------------- |
| Unit        | 1285  | All passed                  |
| Integration | 92    | All passed                  |
| E2E         | 415   | Passed (2 flaky Drive sync) |

## API Changes

### New module

```typescript
// lib/errors.ts
export function isForeignKeyError(error: unknown): boolean;
export function isUserNotFoundError(error: unknown): boolean;
export function handlePrismaError(error: unknown): { error: string } | null;
```

### New component

```typescript
// components/items/mobile-options-sheet.tsx
interface MobileOptionsSheetProps {
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  filterBy: FilterOption;
  onFilterChange: (value: FilterOption) => void;
  disabled?: boolean;
}

export function MobileOptionsSheet(props: MobileOptionsSheetProps): JSX.Element;
```

### New dependency

```json
{
  "vaul": "^1.1.2"
}
```

Vaul provides the native-feeling swipe gesture for the mobile drawer.

## Breaking Changes

None. All changes are additive and backward compatible.
