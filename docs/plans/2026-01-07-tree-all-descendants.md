# Tree All Descendants Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display full item hierarchy inline in tree view (all nested items visible and collapsible) instead of requiring navigation to see children.

**Architecture:** Add `getAllItems()` and `getAllItemsByConnection()` server actions that fetch ALL items without parentId filtering. The existing `itemsToTree()` utility already builds nested structure from flat arrays. Update pages to use these new functions for tree view.

**Tech Stack:** Next.js server actions, Prisma, TypeScript, Vitest, Playwright

---

## Task 0: Add Helper Function for Descendant Counting

**Files:**

- Modify: `lib/item-actions.ts`

**Rationale:** The descendant count logic is needed by multiple functions. Extract to a helper to avoid duplication (DRY principle).

**Step 1: Add helper function**

Add to `lib/item-actions.ts` near the top of the file (after imports):

```typescript
/**
 * Builds a map of item IDs to their descendant counts.
 * Used by getAllItems, getDescendants, and related functions.
 * Exported for use by sftp-actions.ts.
 *
 * @param items - Array of items with id and parentId
 * @returns Function to get descendant count for any item ID
 */
export function buildDescendantCounter(
  items: { id: string; parentId: string | null }[]
): (itemId: string) => number {
  // Build parent -> children map
  const childrenMap = new Map<string | null, string[]>();
  for (const item of items) {
    const siblings = childrenMap.get(item.parentId) ?? [];
    siblings.push(item.id);
    childrenMap.set(item.parentId, siblings);
  }

  // Cache for memoization
  const cache = new Map<string, number>();

  // Recursive counter with memoization
  return function countDescendants(itemId: string): number {
    if (cache.has(itemId)) {
      return cache.get(itemId)!;
    }
    const children = childrenMap.get(itemId) ?? [];
    let count = children.length;
    for (const childId of children) {
      count += countDescendants(childId);
    }
    cache.set(itemId, count);
    return count;
  };
}
```

**Step 2: Commit**

```bash
git add lib/item-actions.ts
git commit -m "refactor: add buildDescendantCounter helper for DRY"
```

---

## Task 1: Add `getAllItems` Server Action

**Files:**

- Modify: `lib/item-actions.ts`
- Test: `tests/unit/lib/item-actions.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/item-actions.test.ts`:

```typescript
describe("getAllItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all items for user regardless of parent", async () => {
    // Setup auth mock (using existing mockAuth and mockSession helpers)
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));

    const mockItems = [
      { id: "root1", parentId: null, name: "Root 1", depth: 0 },
      { id: "child1", parentId: "root1", name: "Child 1", depth: 1 },
      { id: "grandchild1", parentId: "child1", name: "Grandchild 1", depth: 2 },
      { id: "root2", parentId: null, name: "Root 2", depth: 0 },
    ];

    vi.mocked(prisma.item.findMany)
      .mockResolvedValueOnce(mockItems) // For descendant count
      .mockResolvedValueOnce(
        mockItems.map((item) => ({
          ...item,
          description: null,
          order: 0,
          userId: "user-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          sftpPath: null,
          sftpModifiedAt: null,
          connectionId: null,
          files: [],
          connection: null,
        }))
      );

    const result = await getAllItems();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(4);
    expect(result.data?.map((i) => i.id)).toEqual([
      "root1",
      "child1",
      "grandchild1",
      "root2",
    ]);
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getAllItems();

    expect(result.error).toBe("Unauthorized");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- --grep "getAllItems" -t "returns all items"`
Expected: FAIL with "getAllItems is not defined"

**Step 3: Write minimal implementation**

Add to `lib/item-actions.ts` after the `getItems` function:

```typescript
/**
 * Fetches ALL items for the current user with artwork thumbnails.
 * Returns full hierarchy (all levels) for inline tree display.
 * Items are ordered by depth then order for proper tree building.
 *
 * @returns All items array with artworkId or error
 */
export async function getAllItems(): Promise<ItemResult<ItemWithArtwork[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Fetch all items for descendant count calculation
  const allItems = await prisma.item.findMany({
    where: { userId: session.user.id },
    select: { id: true, parentId: true },
  });

  // Use helper to build descendant counter (DRY)
  const countDescendants = buildDescendantCounter(allItems);

  // Fetch ALL items with files and connection
  const items = await prisma.item.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: [{ depth: "asc" }, { order: "asc" }],
    include: {
      files: {
        select: { id: true, fileType: true, isPrimary: true },
      },
      connection: {
        select: { name: true },
      },
    },
  });

  // Transform to ItemWithArtwork with file counts and descendant count
  const itemsWithArtwork: ItemWithArtwork[] = items.map((item) => {
    const primaryArtwork = item.files.find(
      (f) => f.fileType === "ARTWORK" && f.isPrimary
    );
    const firstArtwork = item.files.find((f) => f.fileType === "ARTWORK");
    const artworkId = primaryArtwork?.id ?? firstArtwork?.id ?? null;

    const fileCounts = {
      media: item.files.filter((f) => f.fileType === "MEDIA").length,
      artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
      subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
    };

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      order: item.order,
      depth: item.depth,
      userId: item.userId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      sftpPath: item.sftpPath,
      sftpModifiedAt: item.sftpModifiedAt,
      connectionId: item.connectionId,
      artworkId,
      connectionName: item.connection?.name ?? null,
      fileCounts,
      childCount: countDescendants(item.id),
    };
  });

  return { success: true, data: itemsWithArtwork };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- --grep "getAllItems"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/item-actions.ts tests/unit/lib/item-actions.test.ts
git commit -m "feat: add getAllItems server action for full hierarchy"
```

---

## Task 2: Add `getAllItemsByConnection` Server Action

**Files:**

- Modify: `lib/sftp-actions.ts`
- Test: `tests/unit/lib/sftp-actions.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/sftp-actions.test.ts`:

```typescript
describe("getAllItemsByConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all items for connection regardless of parent", async () => {
    // Setup auth mock (using existing mockAuth and mockSession helpers)
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));

    const mockConnection = { id: "conn-1", userId: "user-123" };
    const mockItems = [
      { id: "root1", parentId: null, connectionId: "conn-1", depth: 0 },
      { id: "child1", parentId: "root1", connectionId: "conn-1", depth: 1 },
    ];

    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(
      mockConnection
    );
    vi.mocked(prisma.item.findMany)
      .mockResolvedValueOnce(mockItems) // For descendant count
      .mockResolvedValueOnce(
        mockItems.map((item) => ({
          ...item,
          name: "Item",
          description: null,
          order: 0,
          userId: "user-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          sftpPath: null,
          sftpModifiedAt: null,
          files: [],
          connection: { name: "Test Connection" },
        }))
      );

    const result = await getAllItemsByConnection("conn-1");

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getAllItemsByConnection("conn-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unauthorized");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- --grep "getAllItemsByConnection"`
Expected: FAIL with "getAllItemsByConnection is not defined"

**Step 3: Write minimal implementation**

Add to `lib/sftp-actions.ts` after the `getItemsByConnection` function.

**Note:** You'll need to import `buildDescendantCounter` from `lib/item-actions.ts`:

```typescript
import { buildDescendantCounter } from "@/lib/item-actions";
```

Then add the function:

```typescript
/**
 * Fetches ALL items for a connection with artwork thumbnails.
 * Returns full hierarchy (all levels) for inline tree display.
 *
 * @param connectionId - SFTP connection ID to filter by
 * @returns All items for connection with artworkId or error
 */
export async function getAllItemsByConnection(
  connectionId: string
): Promise<ActionResult<ItemWithArtwork[]>> {
  try {
    const userId = await requireAuth();

    // Verify connection ownership
    const connection = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }

    // Fetch all items for this connection for descendant count calculation
    const allConnectionItems = await prisma.item.findMany({
      where: { userId, connectionId },
      select: { id: true, parentId: true },
    });

    // Use helper to build descendant counter (DRY)
    const countDescendants = buildDescendantCounter(allConnectionItems);

    // Fetch ALL items for this connection
    const items = await prisma.item.findMany({
      where: { userId, connectionId },
      orderBy: [{ depth: "asc" }, { order: "asc" }],
      include: {
        files: {
          select: { id: true, fileType: true, isPrimary: true },
        },
        connection: {
          select: { name: true },
        },
      },
    });

    const itemsWithArtwork: ItemWithArtwork[] = items.map((item) => {
      const primaryArtwork = item.files.find(
        (f) => f.fileType === "ARTWORK" && f.isPrimary
      );
      const firstArtwork = item.files.find((f) => f.fileType === "ARTWORK");
      const artworkId = primaryArtwork?.id ?? firstArtwork?.id ?? null;

      const fileCounts = {
        media: item.files.filter((f) => f.fileType === "MEDIA").length,
        artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
        subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
      };

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        parentId: item.parentId,
        order: item.order,
        depth: item.depth,
        userId: item.userId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        sftpPath: item.sftpPath,
        sftpModifiedAt: item.sftpModifiedAt,
        connectionId: item.connectionId,
        artworkId,
        connectionName: item.connection?.name ?? null,
        fileCounts,
        childCount: countDescendants(item.id),
      };
    });

    return { success: true, data: itemsWithArtwork };
  } catch (error) {
    console.error("Get all items by connection error:", error);
    return { success: false, error: "Failed to fetch items" };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- --grep "getAllItemsByConnection"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/sftp-actions.ts tests/unit/lib/sftp-actions.test.ts
git commit -m "feat: add getAllItemsByConnection for full hierarchy by connection"
```

---

## Task 3: Update Root Page to Use `getAllItems`

**Files:**

- Modify: `app/(my-items)/my-items/page.tsx`

**Step 1: Update imports and fetch call**

Replace in `app/(my-items)/my-items/page.tsx`:

```typescript
// Old import
import { getItems } from "@/lib/item-actions";

// New import
import { getAllItems } from "@/lib/item-actions";
```

And update the fetch:

```typescript
// Old fetch (line 26-28)
const itemsResult = connectionId
  ? await getItemsByConnection(connectionId, null)
  : await getItems(null);

// New fetch
const itemsResult = connectionId
  ? await getAllItemsByConnection(connectionId)
  : await getAllItems();
```

Also update the import:

```typescript
import { getAllItemsByConnection } from "@/lib/sftp-actions";
```

**Step 2: Verify build passes**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add app/(my-items)/my-items/page.tsx
git commit -m "feat: use getAllItems for full tree hierarchy on root page"
```

---

## Task 4: Update Item Detail Page for Descendants

**Files:**

- Modify: `app/(my-items)/my-items/[itemId]/page.tsx`
- Modify: `lib/item-actions.ts` (add `getDescendants` function)
- Test: `tests/unit/lib/item-actions.test.ts`

**Step 1: Write failing test for getDescendants**

Add to `tests/unit/lib/item-actions.test.ts`:

```typescript
describe("getDescendants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all descendants of an item", async () => {
    // Setup auth mock (using existing mockAuth and mockSession helpers)
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));

    const mockItems = [
      { id: "child1", parentId: "parent1", depth: 1 },
      { id: "grandchild1", parentId: "child1", depth: 2 },
      { id: "grandchild2", parentId: "child1", depth: 2 },
    ];

    vi.mocked(prisma.item.findFirst).mockResolvedValue({
      id: "parent1",
      userId: "user-123",
    } as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValue(
      mockItems.map((item) => ({ id: item.id }))
    );
    vi.mocked(prisma.item.findMany)
      .mockResolvedValueOnce(mockItems) // For descendant count
      .mockResolvedValueOnce(
        mockItems.map((item) => ({
          ...item,
          name: "Item",
          description: null,
          order: 0,
          userId: "user-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          sftpPath: null,
          sftpModifiedAt: null,
          connectionId: null,
          files: [],
          connection: null,
        }))
      );

    const result = await getDescendants("parent1");

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3);
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getDescendants("parent1");

    expect(result.error).toBe("Unauthorized");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- --grep "getDescendants"`
Expected: FAIL

**Step 3: Write implementation**

Add to `lib/item-actions.ts`:

```typescript
/**
 * Fetches all descendants of an item (children, grandchildren, etc.).
 * Used for displaying full subtree on item detail pages.
 *
 * @param parentId - Parent item ID
 * @returns All descendant items with artworkId or error
 */
export async function getDescendants(
  parentId: string
): Promise<ItemResult<ItemWithArtwork[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Verify parent ownership
  const parent = await prisma.item.findFirst({
    where: { id: parentId, userId: session.user.id },
  });
  if (!parent) {
    return { error: "Item not found" };
  }

  // Use recursive CTE to get all descendants
  const descendants = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE descendants AS (
      SELECT id, "parentId"
      FROM "Item"
      WHERE "parentId" = ${parentId} AND "userId" = ${session.user.id}
      UNION ALL
      SELECT i.id, i."parentId"
      FROM "Item" i
      INNER JOIN descendants d ON i."parentId" = d.id
      WHERE i."userId" = ${session.user.id}
    )
    SELECT id FROM descendants
  `;

  const descendantIds = descendants.map((d) => d.id);

  if (descendantIds.length === 0) {
    return { success: true, data: [] };
  }

  // Build descendant count map using helper (DRY)
  const allItems = await prisma.item.findMany({
    where: { id: { in: descendantIds } },
    select: { id: true, parentId: true },
  });

  const countDescendants = buildDescendantCounter(allItems);

  // Fetch full item data
  const items = await prisma.item.findMany({
    where: { id: { in: descendantIds } },
    orderBy: [{ depth: "asc" }, { order: "asc" }],
    include: {
      files: {
        select: { id: true, fileType: true, isPrimary: true },
      },
      connection: {
        select: { name: true },
      },
    },
  });

  const itemsWithArtwork: ItemWithArtwork[] = items.map((item) => {
    const primaryArtwork = item.files.find(
      (f) => f.fileType === "ARTWORK" && f.isPrimary
    );
    const firstArtwork = item.files.find((f) => f.fileType === "ARTWORK");
    const artworkId = primaryArtwork?.id ?? firstArtwork?.id ?? null;

    const fileCounts = {
      media: item.files.filter((f) => f.fileType === "MEDIA").length,
      artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
      subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
    };

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      order: item.order,
      depth: item.depth,
      userId: item.userId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      sftpPath: item.sftpPath,
      sftpModifiedAt: item.sftpModifiedAt,
      connectionId: item.connectionId,
      artworkId,
      connectionName: item.connection?.name ?? null,
      fileCounts,
      childCount: countDescendants(item.id),
    };
  });

  return { success: true, data: itemsWithArtwork };
}
```

**Step 4: Run test**

Run: `pnpm run test:unit -- --grep "getDescendants"`
Expected: PASS

**Step 5: Update item detail page**

Modify `app/(my-items)/my-items/[itemId]/page.tsx`:

```typescript
// Update import
import { getItem, getDescendants } from "@/lib/item-actions";

// Update fetch (line 42-45)
const [childrenResult, filesResult] = await Promise.all([
  getDescendants(itemId), // Changed from getItems(itemId)
  getItemFiles(itemId),
]);
```

**Step 6: Commit**

```bash
git add lib/item-actions.ts app/(my-items)/my-items/[itemId]/page.tsx tests/unit/lib/item-actions.test.ts
git commit -m "feat: use getDescendants for full subtree on item detail pages"
```

---

## Task 5: Add Integration Tests

**Files:**

- Create: `tests/integration/items/item-descendants.test.ts`

**Step 1: Write integration tests**

Create `tests/integration/items/item-descendants.test.ts`:

```typescript
/**
 * Integration tests for descendant fetching.
 * Tests full hierarchy retrieval against real database.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getAllItems, getDescendants } from "@/lib/item-actions";
import "../setup";

// Mock auth to return our test user
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";

// Cast to bypass complex next-auth types
const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

// Use unique ID per test run to avoid conflicts
const TEST_USER_ID = `test-descendants-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `descendants-${Date.now()}@test.example.com`;

describe("Item Descendants Integration", () => {
  let rootItemId: string;
  let childItemId: string;
  let grandchildItemId: string;

  beforeAll(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        passwordHash: "test-hash",
      },
    });

    // Create hierarchy: root -> child -> grandchild
    const root = await prisma.item.create({
      data: {
        name: "Root",
        userId: TEST_USER_ID,
        depth: 0,
        order: 0,
      },
    });
    rootItemId = root.id;

    const child = await prisma.item.create({
      data: {
        name: "Child",
        userId: TEST_USER_ID,
        parentId: rootItemId,
        depth: 1,
        order: 0,
      },
    });
    childItemId = child.id;

    const grandchild = await prisma.item.create({
      data: {
        name: "Grandchild",
        userId: TEST_USER_ID,
        parentId: childItemId,
        depth: 2,
        order: 0,
      },
    });
    grandchildItemId = grandchild.id;
  });

  beforeEach(() => {
    // Mock auth to return test user for each test
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      expires: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  });

  it("getAllItems returns full hierarchy", async () => {
    const result = await getAllItems();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("getAllItems failed");

    // Should return all 3 items (root, child, grandchild)
    expect(result.data).toHaveLength(3);

    // Verify items are ordered by depth
    const names = result.data!.map((item) => item.name);
    expect(names).toContain("Root");
    expect(names).toContain("Child");
    expect(names).toContain("Grandchild");
  });

  it("getDescendants returns all nested items", async () => {
    const result = await getDescendants(rootItemId);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("getDescendants failed");

    // Should return child and grandchild (not root)
    expect(result.data).toHaveLength(2);

    const names = result.data!.map((item) => item.name);
    expect(names).toContain("Child");
    expect(names).toContain("Grandchild");
    expect(names).not.toContain("Root");
  });

  it("getDescendants returns empty for leaf item", async () => {
    const result = await getDescendants(grandchildItemId);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });
});
```

**Step 2: Commit**

```bash
git add tests/integration/items/item-descendants.test.ts
git commit -m "test: add integration tests for descendant fetching"
```

---

## Task 6: Update E2E Tests

**Files:**

- Modify: `e2e/journeys/items/items-crud.spec.ts`

**Step 1: Add test for hierarchy display**

Add to `e2e/journeys/items/items-crud.spec.ts`:

```typescript
test("tree view shows full hierarchy inline", async ({ itemsPage }) => {
  // Create nested structure
  await itemsPage.createItem("Parent");
  await itemsPage.clickItem("Parent");
  await itemsPage.createItem("Child");

  // Go back to root
  await itemsPage.goto();

  // Switch to tree view
  await itemsPage.switchToTreeView();

  // Verify both items visible (Parent expanded by default)
  await expect(itemsPage.getItemLocator("Parent")).toBeVisible();
  await expect(itemsPage.getItemLocator("Child")).toBeVisible();

  // Collapse parent
  await itemsPage.collapseItem("Parent");

  // Child should be hidden
  await expect(itemsPage.getItemLocator("Child")).not.toBeVisible();

  // Expand again
  await itemsPage.expandItem("Parent");
  await expect(itemsPage.getItemLocator("Child")).toBeVisible();
});
```

**Step 2: Add page object helper methods**

Add to `e2e/pages/items.page.ts`:

```typescript
/**
 * Collapses a tree item by clicking its collapse button.
 * The collapse button has aria-label="Collapse item".
 *
 * @param name - Name of the item to collapse
 */
async collapseItem(name: string): Promise<void> {
  const item = this.page.getByRole("listitem").filter({ hasText: name }).first();
  const collapseButton = item.getByRole("button", { name: "Collapse item" });
  await collapseButton.click();
}

/**
 * Expands a tree item by clicking its expand button.
 * The expand button has aria-label="Expand item".
 *
 * @param name - Name of the item to expand
 */
async expandItem(name: string): Promise<void> {
  const item = this.page.getByRole("listitem").filter({ hasText: name }).first();
  const expandButton = item.getByRole("button", { name: "Expand item" });
  await expandButton.click();
}
```

**Step 3: Run E2E tests**

Run: `pnpm run test:e2e --grep "tree view shows full hierarchy"`
Expected: PASS

**Step 4: Commit**

```bash
git add e2e/journeys/items/items-crud.spec.ts e2e/pages/items.page.ts
git commit -m "test: add E2E test for full hierarchy tree display"
```

---

## Task 7: Update Exports and Final Verification

**Files:**

- Modify: `lib/item-actions.ts` (ensure exports)
- Modify: `lib/sftp-actions.ts` (ensure exports)

**Step 1: Verify all exports**

Ensure `lib/item-actions.ts` exports:

```typescript
export {
  getItems,
  getAllItems,
  getItem,
  getDescendants,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
};
```

Ensure `lib/sftp-actions.ts` exports:

```typescript
export { getAllItemsByConnection, getItemsByConnection /* other exports */ };
```

**Step 2: Run full test suite**

Run:

```bash
pnpm run test:unit
pnpm run test:integration
pnpm run check
```

Expected: All pass

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete tree all descendants implementation"
```

---

## Summary of Changes

| File                                               | Change                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `lib/item-actions.ts`                              | Add `buildDescendantCounter()`, `getAllItems()`, `getDescendants()` |
| `lib/sftp-actions.ts`                              | Add `getAllItemsByConnection()`, import helper                      |
| `app/(my-items)/my-items/page.tsx`                 | Use `getAllItems()` / `getAllItemsByConnection()`                   |
| `app/(my-items)/my-items/[itemId]/page.tsx`        | Use `getDescendants()`                                              |
| `tests/unit/lib/item-actions.test.ts`              | Tests for `getAllItems()`, `getDescendants()`                       |
| `tests/unit/lib/sftp-actions.test.ts`              | Tests for `getAllItemsByConnection()`                               |
| `tests/integration/items/item-descendants.test.ts` | Integration tests with auth mocking                                 |
| `e2e/journeys/items/items-crud.spec.ts`            | E2E test for hierarchy display                                      |
| `e2e/pages/items.page.ts`                          | Add `collapseItem()`, `expandItem()` methods                        |

## Tests Summary

| Type        | Add                                    | Modify | Remove |
| ----------- | -------------------------------------- | ------ | ------ |
| Unit        | 6 tests (2 per function + auth checks) | 0      | 0      |
| Integration | 3 tests                                | 0      | 0      |
| E2E         | 1 test                                 | 0      | 0      |
