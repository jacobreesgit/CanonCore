# SFTP Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete removal of all SFTP/WebDAV code from the codebase - Google Drive is now the only storage backend.

**Architecture:** Delete SFTP components, lib files, tests, and API routes. Modify remaining files to remove SFTP references. Keep Prisma schema fields for migration path but remove active usage.

**Tech Stack:** Next.js 16, Prisma 7, TypeScript

**Context:** Phase 10.6 and 10.7 from the Google Drive implementation plan. Tasks 10.1-10.5 are already complete.

---

## Scope Summary

**73 files** reference SFTP/WebDAV. Organized into:

| Category                                        | Action           | Count |
| ----------------------------------------------- | ---------------- | ----- |
| Components (components/sftp/\*)                 | Delete           | 7     |
| Lib files (lib/sftp*, webdav*)                  | Delete           | 4     |
| API routes                                      | Delete/Modify    | 3     |
| Unit tests (sftp-related)                       | Delete           | 12    |
| Integration tests (sftp/)                       | Delete           | 2     |
| E2E tests (sftp/, connections/, media-playback) | Delete           | 5     |
| E2E fixtures/pages                              | Delete/Modify    | 5     |
| Components (items, sortable-\*)                 | Modify           | 12    |
| Lib files (types, validations, etc.)            | Modify           | 8     |
| Pages                                           | Modify           | 2     |
| Seed files                                      | Modify           | 2     |
| Scripts                                         | Modify           | 1     |
| Documentation (CLAUDE.md)                       | Modify           | 1     |
| Prisma schema                                   | Keep (migration) | -     |

---

## Task 1: Delete SFTP Component Directory

**Files:**

- Delete: `components/sftp/` (entire directory - 7 files)

**Step 1: Delete the directory**

```bash
rm -rf components/sftp/
```

**Step 2: Verify deletion**

```bash
ls components/sftp/ 2>&1 || echo "Directory deleted successfully"
```

Expected: "No such file or directory" or "Directory deleted successfully"

---

## Task 2: Delete SFTP Lib Files

**Files:**

- Delete: `lib/sftp-actions.ts`
- Delete: `lib/sftp-client.ts`
- Delete: `lib/sftp-utils.ts`
- Delete: `lib/webdav-utils.ts`

**Step 1: Delete the files**

```bash
rm -f lib/sftp-actions.ts lib/sftp-client.ts lib/sftp-utils.ts lib/webdav-utils.ts
```

**Step 2: Verify deletion**

```bash
ls lib/sftp*.ts lib/webdav*.ts 2>&1 || echo "Files deleted successfully"
```

---

## Task 3: Delete SFTP API Routes

**Files:**

- Delete: `app/api/sftp/` (entire directory)

**Step 1: Delete the directory**

```bash
rm -rf app/api/sftp/
```

---

## Task 4: Delete SFTP Unit Tests

**Files:**

- Delete: `tests/unit/lib/sftp-*.test.ts`
- Delete: `tests/unit/lib/webdav-utils.test.ts`
- Delete: `tests/unit/components/sftp/` (entire directory)
- Delete: `tests/unit/e2e/sftp-fixture.test.ts`

**Step 1: Delete the files and directories**

```bash
rm -f tests/unit/lib/sftp-*.test.ts
rm -f tests/unit/lib/webdav-utils.test.ts
rm -rf tests/unit/components/sftp/
rm -f tests/unit/e2e/sftp-fixture.test.ts
```

---

## Task 5: Delete SFTP Integration Tests

**Files:**

- Delete: `tests/integration/sftp/` (entire directory)

**Step 1: Delete the directory**

```bash
rm -rf tests/integration/sftp/
```

---

## Task 6: Delete SFTP E2E Tests and Fixtures

**Files:**

- Delete: `e2e/journeys/sftp/` (entire directory)
- Delete: `e2e/journeys/media/media-playback.spec.ts` (entirely SFTP-dependent)
- Delete: `e2e/fixtures/sftp.fixture.ts`
- Delete: `e2e/pages/connections.page.ts`
- Delete: `e2e/journeys/connections/` (entire directory)
- Delete: `e2e/docker-compose.yml`
- Modify: `e2e/journeys/items/items-settings.spec.ts` (remove SFTP comment)

**Step 1: Delete the files and directories**

```bash
rm -rf e2e/journeys/sftp/
rm -rf e2e/journeys/connections/
rm -f e2e/journeys/media/media-playback.spec.ts
rm -f e2e/fixtures/sftp.fixture.ts
rm -f e2e/pages/connections.page.ts
rm -f e2e/docker-compose.yml
```

**Step 2: Update items-settings.spec.ts**

Remove or update the comment on line 395 that says "These tests require seed data with SFTP-synced items" to reference Google Drive instead.

**Note:** `media-playback.spec.ts` is deleted because it's entirely dependent on SFTP fixtures. Google Drive E2E tests for media playback should be added in a future phase.

---

## Task 7: Update E2E Fixtures Index

**Files:**

- Modify: `e2e/fixtures/index.ts`

**Step 1: Read and remove SFTP exports**

Remove any exports related to SFTP fixture. The file should only export auth and db fixtures.

---

## Task 8: Update E2E Global Setup/Teardown

**Files:**

- Modify: `e2e/journeys/global.setup.ts`
- Modify: `e2e/journeys/global.teardown.ts`

**Step 1: Remove Docker container startup/shutdown**

Remove any code that starts/stops SFTP Docker containers.

---

## Task 9: Update lib/types.ts

**Files:**

- Modify: `lib/types.ts`

**Step 1: Remove SFTP-related types**

Remove:

- `SftpConnection` type exports
- `ItemWithSftpConnection` or similar composite types
- Any SFTP-related field references in type definitions

Keep Google Drive types intact.

---

## Task 10: Update lib/validations.ts

**Files:**

- Modify: `lib/validations.ts`

**Step 1: Remove SFTP validation schemas**

Remove:

- `sftpConnectionSchema` or similar
- `webdavSchema` or similar
- Any SFTP-specific field validations

---

## Task 11: Update lib/env.ts

**Files:**

- Modify: `lib/env.ts`

**Step 1: Remove SFTP environment variable validations**

Remove any SFTP-related env var validations (if any exist beyond what's already there).

---

## Task 12: Update lib/rate-limit.ts

**Files:**

- Modify: `lib/rate-limit.ts`

**Step 1: Remove SFTP rate limit keys**

Remove rate limit configurations for:

- `sftp:sync`
- `sftp:test`
- `sftp:create`
- Or similar SFTP-related rate limit keys

---

## Task 13: Update lib/crypto.ts

**Files:**

- Modify: `lib/crypto.ts`

**Step 1: Check for SFTP-specific encryption**

Review and remove any SFTP-specific encryption helpers if they exist. Keep generic encryption functions used by Google Drive.

---

## Task 14: Update lib/item-utils.ts

**Files:**

- Modify: `lib/item-utils.ts`

**Step 1: Remove SFTP path utilities**

Remove any SFTP path-related helper functions.

---

## Task 15: Remove Connection Filter Component

**Files:**

- Delete: `components/items/connection-filter.tsx`
- Delete: `components/items/filtered-items-view.tsx`

**Step 1: Delete the files**

```bash
rm -f components/items/connection-filter.tsx
rm -f components/items/filtered-items-view.tsx
```

---

## Task 16: Update Sortable Grid Components

**Files:**

- Modify: `components/sortable-grid/Grid.tsx`
- Modify: `components/sortable-grid/GridItem.tsx`
- Modify: `components/sortable-grid/SortableGrid.tsx`
- Modify: `components/sortable-grid/SortableGridItem.tsx`

**Step 1: Remove showConnectionBadge prop and SFTP references**

For each file, remove:

- `showConnectionBadge` prop
- Connection badge rendering
- Any `connectionId` or `sftpPath` references

---

## Task 17: Update Sortable Tree Components

**Files:**

- Modify: `components/sortable-tree/Tree.tsx`
- Modify: `components/sortable-tree/SortableTree.tsx`
- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`

**Step 1: Remove showConnectionBadge prop and SFTP references**

Same as Task 16 - remove connection badge and SFTP-related props.

---

## Task 18: Update Items Index Export

**Files:**

- Modify: `components/items/index.ts`

**Step 1: Remove SFTP component exports**

Remove exports for:

- `ConnectionFilter`
- `FilteredItemsView`
- Any other SFTP-related component exports

---

## Task 19: Update Root My Items Page

**Files:**

- Modify: `app/(my-items)/my-items/page.tsx`

**Step 1: Remove SFTP connection fetching and filtering**

Remove:

- Imports from sftp components
- Connection fetching logic
- Props passing connection data to children

---

## Task 20: Update Public Landing Page

**Files:**

- Modify: `app/(public)/page.tsx`

**Step 1: Remove SFTP marketing references**

Remove any marketing copy referencing SFTP sync. Update to reference Google Drive only.

---

## Task 21: Modify API Routes for Google Drive

**Files:**

- Modify: `app/api/artwork/[fileId]/route.ts`
- Modify: `app/api/stream/[fileId]/route.ts`

**Step 1: Update to use Google Drive instead of SFTP**

These routes currently download files via SFTP. Update them to:

1. Check if file has `driveFileId`
2. Use Google Drive API to get download URL or stream
3. Remove SFTP fallback code

---

## Task 22: Update Remaining Unit Tests

**Files:**

- Modify: `tests/unit/lib/item-actions.test.ts`
- Modify: `tests/unit/lib/item-file-actions.test.ts`
- Modify: `tests/unit/components/items/item-detail-client.test.tsx`
- Modify: `tests/unit/components/items/items-toolbar.test.tsx`
- Modify: `tests/unit/components/items/item-settings-dialog.test.tsx`
- Modify: `tests/unit/components/grid.test.tsx`
- Modify: `tests/unit/components/grid-item.test.tsx`
- Modify: `tests/unit/components/tree.test.tsx`
- Modify: `tests/unit/api/artwork-route.test.ts`
- Modify: `tests/unit/setup.ts`

**Step 1: Remove SFTP mocks and test cases**

For each test file:

- Remove SFTP-related imports
- Remove SFTP mock definitions
- Remove test cases that test SFTP functionality
- Update remaining tests to not reference SFTP

---

## Task 23: Update Seed Files

**Files:**

- Modify: `prisma/seed.ts`
- Modify: `prisma/seed-utils.ts`

**Step 1: Remove --with-drive flag (Drive is now default)**

In `seed.ts`:

- Remove `withDrive` from `SeedConfig`
- Remove `--with-drive` from `parseArgs()`
- Make Google Drive seeding run by default when `GOOGLE_SEED_REFRESH_TOKEN` is set
- Remove SFTP-related seeding code

In `seed-utils.ts`:

- Remove any SFTP path resolution utilities

---

## Task 24: Update CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Update documentation**

- Remove SFTP references from architecture section
- Remove SFTP components from project structure
- Update seeding documentation (no more --with-drive flag)
- Remove SFTP rate limit documentation
- Remove SFTP E2E testing documentation

---

## Task 25: Update Other Test Files

**Files:**

- Modify: `tests/unit/prisma/seed-upload.test.ts`
- Modify: `tests/unit/lib/validations.test.ts`
- Modify: `tests/integration/items/item-file.test.ts`
- Modify: `tests/integration/prisma/seed.test.ts`

**Step 1: Remove SFTP test cases**

Remove tests that test SFTP-specific validation or functionality.

---

## Task 26: Update scripts/reset-database.ts

**Files:**

- Modify: `scripts/reset-database.ts`

**Step 1: Remove SFTP cleanup logic**

Remove any SFTP-specific database cleanup code.

---

## Task 27: Final Verification

**Step 1: Search for remaining SFTP references**

```bash
grep -rn "sftp\|Sftp\|SFTP\|webdav\|WebDAV" --include="*.ts" --include="*.tsx" lib/ components/ app/ tests/ e2e/ | grep -v node_modules || echo "No SFTP references found"
```

**Step 2: Run type check**

```bash
pnpm run type-check
```

Expected: No type errors

**Step 3: Run linter**

```bash
pnpm run lint
```

Expected: No lint errors (may have unused imports to clean up)

**Step 4: Run full check**

```bash
pnpm run check
```

Expected: All checks pass

**Step 5: Run unit tests**

```bash
pnpm run test
```

Expected: All tests pass

---

## Task 28: Commit Changes

**Step 1: Stage all changes**

```bash
git add -A
```

**Step 2: Commit**

```bash
git commit -m "chore: remove SFTP/WebDAV code (replaced by Google Drive)

- Delete components/sftp/ directory (7 files)
- Delete lib/sftp-*.ts and lib/webdav-utils.ts (4 files)
- Delete app/api/sftp/ route
- Delete SFTP tests (unit, integration, e2e)
- Delete e2e/docker-compose.yml
- Update sortable-grid and sortable-tree components
- Update API routes for Google Drive
- Update seed files (Drive is now default)
- Update CLAUDE.md documentation

BREAKING CHANGE: SFTP connections no longer supported.
Google Drive is now the only storage backend.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Verification Checklist

After all tasks complete:

**Deletions verified:**

- [ ] No files in `components/sftp/`
- [ ] No `lib/sftp*.ts` or `lib/webdav*.ts` files
- [ ] No `app/api/sftp/` directory
- [ ] No `components/items/connection-filter.tsx` or `filtered-items-view.tsx`
- [ ] No `e2e/journeys/sftp/` directory
- [ ] No `e2e/journeys/connections/` directory
- [ ] No `e2e/journeys/media/media-playback.spec.ts`
- [ ] No `e2e/fixtures/sftp.fixture.ts`
- [ ] No `e2e/pages/connections.page.ts`
- [ ] No `e2e/docker-compose.yml`
- [ ] No SFTP tests in `tests/unit/lib/sftp*.test.ts`
- [ ] No `tests/unit/components/sftp/` directory
- [ ] No `tests/integration/sftp/` directory

**No remaining references:**

- [ ] `grep -rn "sftp" lib/ components/ app/` returns no results
- [ ] `grep -rn "webdav" lib/ components/ app/` returns no results
- [ ] `grep -rn "SftpConnection" lib/ components/ app/` returns no results (except types.ts for migration)

**Build & tests pass:**

- [ ] `pnpm run type-check` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run check` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run test:e2e` passes (may skip some tests if Drive not configured)
- [ ] Application builds and runs successfully

---

## Notes

- **Prisma Schema**: Keep `SftpConnection` model and SFTP fields on `Item`/`ItemFile` for now. This allows existing data to remain valid. A future migration can clean these up.
- **Rate Limits**: SFTP rate limits can be removed as they're no longer needed.
- **Encryption**: Keep generic encryption in `lib/crypto.ts` - it's used by Google Drive tokens too.
