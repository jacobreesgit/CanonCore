# Deployment 0.27.0 - Item Hierarchy and UX Polish

**Date**: 2026-01-07
**Branch**: development

## Summary

This release enhances hierarchical item management with new bulk operations, fixes drag-drop edit mode bugs, and polishes the UI with drag handles and artwork thumbnails. The `getDescendants` function uses efficient recursive CTEs for database queries, and a new `buildDescendantCounter` utility reduces code duplication.

## Changes

### Hierarchical Item Operations

New server actions for working with item hierarchies:

| Function                    | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `getAllItems()`             | Fetch full item hierarchy for inline tree view     |
| `getAllItemsByConnection()` | Same for connection-filtered view                  |
| `getDescendants()`          | Recursive CTE query for efficient descendant fetch |

The recursive CTE approach is significantly faster than multiple queries for deep hierarchies.

### Descendant Counter Utility

Extracted `buildDescendantCounter` to `lib/item-utils.ts` for DRY code:

```typescript
// Before: 20 lines duplicated in 3 places
const childrenMap = new Map<string | null, string[]>();
// ... build map, cache, recursive function

// After: Single line
const countDescendants = buildDescendantCounter(allItems);
```

Used in `getItems()`, `getAllItems()`, `getItemsByConnection()`, and `getAllItemsByConnection()`.

### Drag-Drop Bug Fixes

Fixed critical React immutability issue in tree utilities:

| Issue                                        | Root Cause                           | Fix                                    |
| -------------------------------------------- | ------------------------------------ | -------------------------------------- |
| Collapse/expand in edit mode sometimes fails | `setProperty` mutated items in place | Return new objects via `.map()`        |
| Math.min on empty array                      | `Math.min(...[])` returns Infinity   | Added defensive check for empty arrays |

### UI Enhancements

| Component          | Enhancement                                         |
| ------------------ | --------------------------------------------------- |
| GridItem           | Added GripVertical drag handle (top-right corner)   |
| TreeItem           | Added cursor-pointer to collapse toggle button      |
| ItemSettingsDialog | Added artwork thumbnails to Select dropdown options |

### E2E Test Fixes

Fixed 4 skipped tests by loading `.env.local` in Playwright config:

```typescript
// e2e/playwright.config.ts
import { config } from "dotenv";
config({ path: ".env.local" }); // Load SEED_PASSWORD for tests
```

### Developer Tooling

New script to inspect seed user's item hierarchy:

```bash
pnpm run db:check-seed
```

Output shows tree structure with order values and file counts.

## Files Changed

```
# New files
lib/item-utils.ts                              # buildDescendantCounter utility
scripts/check-seed-items.ts                    # Seed inspection script
e2e/journeys/items/items-hierarchy.spec.ts     # Hierarchy E2E tests
tests/integration/items/item-descendants.test.ts  # Descendant integration tests
docs/plans/2026-01-07-items-loading-spinner.md # Design doc

# Modified - Core logic
lib/item-actions.ts                            # getAllItems, getDescendants, DRY refactor
lib/sftp-actions.ts                            # getAllItemsByConnection, DRY refactor
components/sortable-tree/utilities.ts          # Immutability fix for setProperty
components/items/items-view.tsx                # Defensive Math.min handling

# Modified - UI
components/sortable-grid/GridItem.tsx          # Drag handle
components/sortable-tree/components/TreeItem/TreeItem.tsx  # Cursor pointer
components/items/item-settings-dialog.tsx      # Artwork thumbnails in dropdown

# Modified - Tests
e2e/playwright.config.ts                       # Dotenv loading
e2e/pages/items.page.ts                        # Page object methods
tests/unit/lib/item-actions.test.ts            # New unit tests
tests/unit/lib/sftp-actions.test.ts            # New unit tests
tests/unit/setup.ts                            # Mock updates

# Modified - Config
package.json                                   # Version bump
```

## Test Results

| Suite             | Result                 |
| ----------------- | ---------------------- |
| Unit tests        | 489 passed             |
| Integration tests | 71 passed              |
| E2E tests         | 141 passed (0 skipped) |

### New Tests

| Test File                        | Tests | Coverage                            |
| -------------------------------- | ----- | ----------------------------------- |
| item-descendants.test.ts         | 8     | getDescendants recursive CTE        |
| item-actions.test.ts (additions) | 6     | getAllItems, buildDescendantCounter |
| sftp-actions.test.ts (additions) | 4     | getAllItemsByConnection             |
| items-hierarchy.spec.ts          | 3     | Drag-drop hierarchy E2E             |

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install` (no new dependencies)
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No database migrations required.

## Architecture Notes

### Recursive CTE for Descendants

```sql
WITH RECURSIVE descendants AS (
  -- Base: direct children
  SELECT id, "parentId" FROM "Item" WHERE "parentId" = $1
  UNION ALL
  -- Recursive: children of children
  SELECT i.id, i."parentId" FROM "Item" i
  INNER JOIN descendants d ON i."parentId" = d.id
)
SELECT id FROM descendants;
```

Single query replaces N+1 queries for deep hierarchies.

### Immutability Fix Pattern

```typescript
// Before (buggy): Mutation in place
items.forEach((item) => {
  if (item.id === id) item[property] = value;
});
return items; // Same array, React doesn't re-render

// After (correct): Return new objects
return items.map((item) => {
  if (item.id === id) return { ...item, [property]: value };
  return item;
});
```
