# Deployment 4.3.0 - Test Coverage & Code Quality

**Date**: 2026-01-19
**Branch**: development

## Summary

This release focuses on test infrastructure improvements, E2E test reliability, and code quality standardization. Key changes include Prisma error mocks for unit testing, mobile-friendly E2E test refactoring, and Next.js 16 API compliance fixes.

## Features

### Prisma error mocks for unit testing

Added comprehensive Prisma error class mocks to the test setup, enabling proper error handling tests:

```typescript
// tests/unit/setup.ts
class MockPrismaClientKnownRequestError extends Error {
  code: string;
  meta?: Record<string, unknown>;
  constructor(
    message: string,
    { code, meta }: { code: string; meta?: Record<string, unknown> }
  ) {
    super(message);
    this.name = "PrismaClientKnownRequestError";
    this.code = code;
    this.meta = meta;
  }
}

// Also added: MockPrismaClientInitializationError, MockPrismaClientValidationError
```

### Prisma enum mocks

Added @prisma/client enum mocks for component testing:

- `SyncStatus`: SYNCED, SYNCING, PENDING, ERROR
- `SyncLogAction`: CREATE, RENAME, DELETE, MOVE, UPLOAD, DOWNLOAD, SYNC
- `SyncLogStatus`: SUCCESS, FAILED, PENDING
- `FileType`: MEDIA, ARTWORK, SUBTITLE
- `Prisma` namespace with error classes

### E2E test reliability improvements

Refactored public profile E2E tests to use page object methods for sign-out, improving mobile viewport reliability:

```typescript
// Before: Direct DOM manipulation
await page.getByTestId("my-items-user-menu").click();
await page.getByTestId("my-items-sign-out-button").click();

// After: Page object method (handles mobile sidebar)
await myItemsPage.signOut();
```

### Next.js 16 API compliance

Moved `themeColor` from `metadata` to `viewport` export per Next.js 16 best practices:

```typescript
// app/layout.tsx
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#242424" },
  ],
};
```

### Code formatting standardization

Applied Prettier formatting to 15+ components for consistent JSX attribute line breaks:

- `components/google-drive/settings-section.tsx`
- `components/items/add-item-dialog.tsx`
- `components/items/item-settings-dialog.tsx`
- `components/media/media-overlay.tsx`
- `components/profile/settings-dialog.tsx`
- `components/search/spotlight-search.tsx`
- `components/sortable-tree/SortableTree.tsx`

## Files Changed

### Added

```
docs/plans/2026-01-19-seed-drive-cleanup-design.md  # Seed cleanup design document
```

### Modified

```
app/globals.css                                    # CSS class ordering
app/layout.tsx                                     # themeColor moved to viewport
components/google-drive/settings-section.tsx       # Prettier formatting
components/items/add-item-dialog.tsx               # Prettier formatting
components/items/item-settings-dialog.tsx          # Prettier formatting
components/media/media-overlay.tsx                 # Prettier formatting
components/profile/settings-dialog.tsx             # Prettier formatting
components/search/spotlight-search.tsx             # Prettier formatting
components/sortable-tree/SortableTree.tsx          # Prettier formatting
e2e/journeys/public/public-profile.spec.ts         # Use page object methods
e2e/pages/items.page.ts                            # Enhanced page object
e2e/pages/settings.page.ts                         # Enhanced page object
tests/unit/components/grid-item.test.tsx           # Test coverage
tests/unit/components/grid.test.tsx                # Test coverage
tests/unit/components/items-view.test.tsx          # Test coverage
tests/unit/components/items/items-toolbar.test.tsx # Test coverage
tests/unit/components/search/spotlight-search.test.tsx  # Test coverage
tests/unit/components/sortable-grid-item.test.tsx  # Test coverage
tests/unit/components/sortable-grid.test.tsx       # Test coverage
tests/unit/setup.ts                                # Prisma mocks
```

## Test Coverage Impact

| Area               | Before | After | Change |
| ------------------ | ------ | ----- | ------ |
| Prisma error mocks | 0      | 3     | +3     |
| Prisma enum mocks  | 0      | 4     | +4     |
| E2E sign-out tests | Manual | POM   | Stable |

## Breaking Changes

None. All changes are backwards compatible.

## Migration Notes

No database migrations required. Test setup changes are additive and don't affect existing tests.
