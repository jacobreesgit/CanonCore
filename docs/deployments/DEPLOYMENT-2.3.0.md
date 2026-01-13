# Deployment 2.3.0 - Code Quality & Modular Architecture

**Date**: 2026-01-13
**Branch**: development

## Summary

Google Drive operations are now split into focused modules for better maintainability. The 1300-line `google-drive-actions.ts` file has been refactored into `google-drive-sync.ts` for bidirectional sync and `google-drive-upload.ts` for browser uploads. This release also adds rate limiting to the previously unprotected `deleteItem` action and simplifies the items view by removing complex image preloading logic.

## Features

### Modular Google Drive architecture

The monolithic Google Drive server actions file is now three focused modules:

**lib/google-drive-sync.ts** (893 lines):
- `syncFromGoogleDrive` - Full bidirectional sync
- `SyncContext` interface for tracking sync state
- Batch processing with configurable page sizes
- Error collection and reporting

**lib/google-drive-upload.ts** (443 lines):
- `createUploadSessions` - Generate resumable upload URLs
- `confirmUpload` - Verify and record completed uploads
- Session token signing for security
- File type categorization

**lib/google-drive-actions.ts** (reduced):
- Connection management (connect, disconnect)
- OAuth token handling
- Root folder status checks

**Import changes:**

```typescript
// Before
import { syncFromGoogleDrive, createUploadSessions } from "@/lib/google-drive-actions";

// After
import { syncFromGoogleDrive } from "@/lib/google-drive-sync";
import { createUploadSessions, confirmUpload } from "@/lib/google-drive-upload";
```

### Rate limiting for item deletion

The `deleteItem` action now includes rate limiting, closing a security gap identified in code review. All item mutations are now consistently protected.

```typescript
export async function deleteItem(id: string): Promise<ItemResult> {
  const rateLimitResult = await checkRateLimit("itemDelete");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }
  // ... rest of implementation
}
```

### Simplified items view loading

Removed ~100 lines of complex image preloading logic from `items-view.tsx`. The previous implementation tracked hydration state, preload completion, and minimum spinner duration. The new approach trusts browser caching and Next.js image optimization.

**Removed:**
- `lib/image-preload.ts` - Preloading utility deleted
- Hydration detection state
- Artwork preload key memoization
- Minimum spinner duration timer

## Files Changed

### Added

```
lib/google-drive-sync.ts                    # Extracted sync operations
lib/google-drive-upload.ts                  # Extracted upload operations
scripts/setup-e2e-drive.ts                  # E2E Drive environment setup
e2e/journeys/items/rate-limit.spec.ts       # Rate limit E2E tests
e2e/journeys/media/video-seeking.spec.ts    # Video seeking E2E tests
tests/integration/items/item-delete.test.ts # Delete integration tests
tests/unit/lib/google-drive-sync.test.ts    # Sync module unit tests
tests/unit/lib/google-drive-upload.test.ts  # Upload module unit tests
tests/unit/components/items-view.test.tsx   # Items view unit tests
tests/unit/components/sortable-grid.test.tsx
tests/unit/components/sortable-grid-item.test.tsx
tests/unit/api/stream-route.test.ts         # Stream API tests
docs/plans/2026-01-13-batch-operations.md
docs/plans/2026-01-13-code-review-remediation.md
docs/plans/2026-01-13-sorting-filtering-design.md
docs/plans/2026-01-13-storage-quota-ui.md
docs/plans/2026-01-13-sync-operations-tracking.md
```

### Deleted

```
lib/image-preload.ts                              # Preloading removed
tests/unit/components/items-view-loading.test.ts  # Old loading tests
```

### Modified

```
lib/google-drive-actions.ts           # Reduced to connection management
lib/item-actions.ts                   # Added rate limiting to deleteItem
lib/file-type-utils.ts                # Additional file type helpers
components/items/items-view.tsx       # Simplified loading, use sync module
components/items/item-detail-client.tsx
components/items/file-type-combobox.tsx
components/items/image-selection-grid.tsx
components/items/media-search-combobox.tsx
components/search/spotlight-search.tsx
components/sortable-grid/GridItem.tsx
tests/unit/lib/google-drive-actions.test.ts  # Updated for reduced scope
```

## Test Results

| Suite             | Result     |
| ----------------- | ---------- |
| Unit tests        | All passed |
| Integration tests | All passed |
| E2E tests         | All passed |

## Migration Notes

### Import path changes

If you import Google Drive functions directly:

```typescript
// Old (no longer works for sync/upload)
import { syncFromGoogleDrive, createUploadSessions } from "@/lib/google-drive-actions";

// New
import { syncFromGoogleDrive } from "@/lib/google-drive-sync";
import { createUploadSessions, confirmUpload } from "@/lib/google-drive-upload";

// Connection management stays the same
import { connectGoogleDrive, disconnectGoogleDrive } from "@/lib/google-drive-actions";
```

### Rate limit key

The `itemDelete` rate limit key is now active. Default limit: 30 deletes per minute per user. Configure in `lib/rate-limit.ts` if needed.
