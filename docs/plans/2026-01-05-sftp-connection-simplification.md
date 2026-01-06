# SFTP Connection Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify SFTP connection navigation by removing connection detail pages and integrating connection filtering directly into the my-items page.

**Architecture:** Remove the connection detail/browse pages (`[id]/page.tsx` and `[id]/[itemId]/page.tsx`). Make connection card clicks navigate directly to the edit form. Add connection filtering to the my-items page. Display connection badges on items in tree/grid views.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, shadcn/ui, Playwright, Vitest

---

## Summary of Changes

| Area                    | Before                                                   | After                                              |
| ----------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| Connection card click   | Navigates to `/my-items/connections/[id]` (file browser) | Navigates to `/my-items/connections/[id]/edit`     |
| Ellipsis menu           | Edit, Delete                                             | Delete only                                        |
| Connection file browser | Separate pages at `/my-items/connections/[id]/...`       | Integrated into `/my-items` with connection filter |
| Item display            | No connection indicator                                  | Shows connection badge/name                        |
| Route structure         | 5 connection routes                                      | 3 connection routes (list, new, edit)              |

---

## Task 1: Update Connection Card Click Behavior

**Files:**

- Modify: `components/sftp/connection-card.tsx`

**Step 1: Read the current implementation**

Already read - the card wraps in a `<Link>` to `/my-items/connections/${connection.id}`.

**Step 2: Change card link to point to edit page**

```tsx
// Line 91-94: Change href from detail to edit
<Link
  href={`/my-items/connections/${connection.id}/edit`}
  className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
>
```

**Step 3: Remove Edit option from dropdown menu**

Remove lines 132-139 (the Edit menu item and its Link):

```tsx
// REMOVE these lines:
// <DropdownMenuItem asChild>
//   <Link href={`/my-items/connections/${connection.id}/edit`}>
//     <Pencil className="mr-2 size-4" />
//     Edit
//   </Link>
// </DropdownMenuItem>
// <DropdownMenuSeparator />
```

Also remove `Pencil` from the imports (line 30).

**Step 4: Verify build passes**

Run: `pnpm run type-check`
Expected: No type errors

**Step 5: Commit**

```bash
git add components/sftp/connection-card.tsx
git commit -m "refactor: connection card click navigates to edit form"
```

---

## Task 2: Update Connection Form Redirect

**Files:**

- Modify: `components/sftp/connection-form.tsx`

**Step 1: Read the form redirect logic**

The form currently redirects to `/my-items/connections` after save. This should remain unchanged - after editing, user returns to the connections list.

**Step 2: Verify no changes needed**

Check the form's success redirect - it should already redirect to `/my-items/connections` which is correct.

**Step 3: Commit (if changes made)**

Skip if no changes needed.

---

## Task 3: Remove Connection Detail Pages

**Files:**

- Delete: `app/(my-items)/my-items/connections/[id]/page.tsx`
- Delete: `app/(my-items)/my-items/connections/[id]/[itemId]/page.tsx`
- Keep: `app/(my-items)/my-items/connections/[id]/edit/page.tsx` (this stays)

**Step 1: Delete the connection detail page**

```bash
rm app/(my-items)/my-items/connections/[id]/page.tsx
```

**Step 2: Delete the connection item detail page**

```bash
rm "app/(my-items)/my-items/connections/[id]/[itemId]/page.tsx"
```

**Step 3: Verify build passes**

Run: `pnpm run build`
Expected: Build succeeds (edit page still works)

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove connection detail pages"
```

---

## Task 4: Add Connection Filter to My Items Page

**Files:**

- Modify: `app/(my-items)/my-items/page.tsx`
- Create: `components/items/connection-filter.tsx`
- Modify: `components/items/items-view.tsx`
- Modify: `lib/item-actions.ts`

### Step 4.1: Write failing unit test for connection filter component

**Test file:** `tests/unit/components/items/connection-filter.test.tsx`

```tsx
/**
 * Unit tests for ConnectionFilter component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConnectionFilter } from "@/components/items/connection-filter";

describe("ConnectionFilter", () => {
  const mockConnections = [
    { id: "conn-1", name: "Media Server" },
    { id: "conn-2", name: "Backup Server" },
  ];

  it("renders 'All Items' option by default", () => {
    render(
      <ConnectionFilter
        connections={mockConnections}
        selectedConnectionId={null}
        onConnectionChange={vi.fn()}
      />
    );

    // shadcn Select trigger uses button role
    const trigger = screen.getByRole("button", { name: /all items/i });
    expect(trigger).toBeInTheDocument();
  });

  it("shows selected connection name", () => {
    render(
      <ConnectionFilter
        connections={mockConnections}
        selectedConnectionId="conn-1"
        onConnectionChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("Media Server");
  });

  it("calls onConnectionChange when selection changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ConnectionFilter
        connections={mockConnections}
        selectedConnectionId={null}
        onConnectionChange={onChange}
      />
    );

    // Open select dropdown
    await user.click(screen.getByRole("button"));
    // Click option (shadcn uses role="option")
    await user.click(screen.getByRole("option", { name: "Media Server" }));

    expect(onChange).toHaveBeenCalledWith("conn-1");
  });

  it("is disabled when connections array is empty", () => {
    render(
      <ConnectionFilter
        connections={[]}
        selectedConnectionId={null}
        onConnectionChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("button");
    expect(trigger).toBeDisabled();
  });
});
```

**Step 4.2: Run test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/components/items/connection-filter.test.tsx`
Expected: FAIL - component doesn't exist

### Step 4.3: Create ConnectionFilter component

**File:** `components/items/connection-filter.tsx`

```tsx
/**
 * Dropdown filter for SFTP connections.
 * Allows users to filter items by connection.
 */

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Server } from "lucide-react";

interface ConnectionFilterProps {
  connections: Array<{ id: string; name: string }>;
  selectedConnectionId: string | null;
  onConnectionChange: (connectionId: string | null) => void;
}

/**
 * Dropdown to filter items by SFTP connection.
 *
 * @param connections - Available SFTP connections
 * @param selectedConnectionId - Currently selected connection ID (null for all)
 * @param onConnectionChange - Callback when selection changes
 */
export function ConnectionFilter({
  connections,
  selectedConnectionId,
  onConnectionChange,
}: ConnectionFilterProps) {
  const hasConnections = connections.length > 0;

  return (
    <Select
      value={selectedConnectionId ?? "all"}
      onValueChange={(value) =>
        onConnectionChange(value === "all" ? null : value)
      }
      disabled={!hasConnections}
    >
      <SelectTrigger className="w-[180px]">
        <Server className="mr-2 size-4" />
        <SelectValue placeholder="All Items" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Items</SelectItem>
        {connections.map((connection) => (
          <SelectItem key={connection.id} value={connection.id}>
            {connection.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Step 4.4: Run test to verify it passes

Run: `pnpm run test:unit -- tests/unit/components/items/connection-filter.test.tsx`
Expected: PASS

### Step 4.5: Export from items index

**Modify:** `components/items/index.ts`

Add export:

```tsx
export { ConnectionFilter } from "./connection-filter";
```

### Step 4.6: Update my-items page to fetch connections

**Modify:** `app/(my-items)/my-items/page.tsx`

Add connection fetching and URL-based filter state:

```tsx
import { getSftpConnections } from "@/lib/sftp-actions";

// In the component, after auth check:
const connectionsResult = await getSftpConnections();
const connections = connectionsResult.success
  ? (connectionsResult.data ?? [])
  : [];

// Pass connections to client component wrapper
```

### Step 4.7: Create client wrapper for filtered items view

**Create:** `components/items/filtered-items-view.tsx`

```tsx
/**
 * Client-side wrapper for ItemsView with connection filtering.
 * Manages filter state and refetches items when filter changes.
 */

"use client";

import { Suspense, useState, useCallback, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ItemsView } from "./items-view";
import { ConnectionFilter } from "./connection-filter";
import type { ItemWithArtwork } from "@/lib/types";
import { getItems } from "@/lib/item-actions";
import { getItemsByConnection } from "@/lib/sftp-actions";

interface FilteredItemsViewProps {
  initialItems: ItemWithArtwork[];
  connections: Array<{ id: string; name: string }>;
  /** Initial connection filter from server-side searchParams */
  initialConnectionId: string | null;
}

/**
 * Inner component that uses useSearchParams (requires Suspense boundary).
 */
function FilteredItemsViewInner({
  initialItems,
  connections,
  initialConnectionId,
}: FilteredItemsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Get filter from URL, fallback to initial server value
  const connectionId = searchParams.get("connection") ?? initialConnectionId;
  const [items, setItems] = useState<ItemWithArtwork[]>(initialItems);

  const handleConnectionChange = useCallback(
    async (newConnectionId: string | null) => {
      // Update URL
      const params = new URLSearchParams(searchParams.toString());
      if (newConnectionId) {
        params.set("connection", newConnectionId);
      } else {
        params.delete("connection");
      }
      router.push(`${pathname}?${params.toString()}`);

      // Fetch filtered items
      startTransition(async () => {
        const result = newConnectionId
          ? await getItemsByConnection(newConnectionId, null)
          : await getItems(null);

        if (result.success && result.data) {
          setItems(result.data);
        }
      });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Show filter only if connections exist */}
      {connections.length > 0 && (
        <div className="flex items-center gap-3">
          <ConnectionFilter
            connections={connections}
            selectedConnectionId={connectionId}
            onConnectionChange={handleConnectionChange}
          />
          {isPending && (
            <span className="text-muted-foreground text-sm">Loading...</span>
          )}
        </div>
      )}

      <ItemsView items={items} parentId={null} connectionId={connectionId} />
    </div>
  );
}

/**
 * ItemsView with connection filtering support.
 * Wrapped in Suspense for useSearchParams hydration safety.
 *
 * @param initialItems - Initial items to display (pre-filtered on server)
 * @param connections - Available SFTP connections for filtering
 * @param initialConnectionId - Connection filter from server searchParams
 */
export function FilteredItemsView(props: FilteredItemsViewProps) {
  return (
    <Suspense
      fallback={<div className="text-muted-foreground">Loading...</div>}
    >
      <FilteredItemsViewInner {...props} />
    </Suspense>
  );
}
```

### Step 4.8: Update my-items page.tsx to use server-side searchParams

**Modify:** `app/(my-items)/my-items/page.tsx`

The page component receives `searchParams` as a prop. Use it to pre-filter items on the server:

```tsx
interface MyItemsPageProps {
  searchParams: Promise<{ connection?: string }>;
}

export default async function MyItemsPage({ searchParams }: MyItemsPageProps) {
  // ... auth check ...

  const { connection: connectionId } = await searchParams;

  // Fetch items based on filter (server-side)
  const itemsResult = connectionId
    ? await getItemsByConnection(connectionId, null)
    : await getItems(null);

  const items = itemsResult.success ? (itemsResult.data ?? []) : [];

  // Fetch connections for filter dropdown
  const connectionsResult = await getSftpConnections();
  const connections = connectionsResult.success
    ? (connectionsResult.data ?? []).map((c) => ({ id: c.id, name: c.name }))
    : [];

  return (
    <FilteredItemsView
      initialItems={items}
      connections={connections}
      initialConnectionId={connectionId ?? null}
    />
  );
}
```

### Step 4.8: Commit

```bash
git add -A
git commit -m "feat: add connection filter to my-items page"
```

---

## Task 5: Add Connection Badge to Tree/Grid Items

**Files:**

- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Modify: `components/sortable-grid/GridItem.tsx`
- Modify: `lib/types.ts`

### Step 5.1: Extend ItemWithArtwork type to include connection name

**Modify:** `lib/types.ts`

Add `connectionName` field to `ItemWithArtwork`:

```tsx
export interface ItemWithArtwork extends Item {
  /** First artwork file ID for thumbnail display */
  artworkId: string | null;
  /** Connection name for display (optional) */
  connectionName?: string | null;
}
```

### Step 5.2: Update TreeItem to show connection badge

**Modify:** `components/sortable-tree/components/TreeItem/TreeItem.tsx`

Add `connectionName` prop and display badge:

```tsx
// Add to TreeItemProps interface:
/** Connection name for badge display. */
connectionName?: string | null;

// In the component, after the name span:
{connectionName && !ghost && (
  <span
    className={cn(
      "ml-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5",
      "bg-primary/10 text-primary text-[10px] font-medium"
    )}
  >
    <Server className="size-2.5" />
    {connectionName}
  </span>
)}
```

Add `Server` to imports from lucide-react.

### Step 5.3: Update GridItem to show connection badge

**Modify:** `components/sortable-grid/GridItem.tsx`

Add `connectionName` prop and display badge:

```tsx
// Add to GridItemProps interface:
/** Connection name for badge display. */
connectionName?: string | null;

// In the component, after the name div, before description:
{connectionName && (
  <div className="flex items-center gap-1 pl-6">
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5",
        "bg-primary/10 text-primary text-[10px] font-medium"
      )}
    >
      <Server className="size-2.5" />
      {connectionName}
    </span>
  </div>
)}
```

Add `Server` to imports from lucide-react.

### Step 5.4: Update item fetching to include connection name

**Modify:** `lib/item-actions.ts` - `getItems` function

```tsx
// In the Prisma query, add include for connection:
include: {
  files: {
    where: { fileType: "ARTWORK" },
    take: 1,
    select: { id: true },
  },
  connection: {
    select: { name: true },
  },
},

// Map to include connectionName:
data: items.map((item) => ({
  ...item,
  artworkId: item.files[0]?.id ?? null,
  connectionName: item.connection?.name ?? null,
})),
```

### Step 5.5: Update SFTP item fetching to include connection name

**Modify:** `lib/sftp-actions.ts` - `getItemsByConnection` function

Same pattern - include connection name in the response.

### Step 5.6: Run type-check

Run: `pnpm run type-check`
Expected: PASS

### Step 5.7: Commit

```bash
git add -A
git commit -m "feat: display connection name badge on items"
```

---

## Task 6: Write Unit Tests for Updated Components

**Files:**

- Modify: `tests/unit/components/items/connection-filter.test.tsx` (already done)
- Create: `tests/unit/components/sftp/connection-card.test.tsx`

### Step 6.1: Write ConnectionCard unit test

**File:** `tests/unit/components/sftp/connection-card.test.tsx`

```tsx
/**
 * Unit tests for ConnectionCard component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConnectionCard } from "@/components/sftp/connection-card";

// Mock server action
vi.mock("@/lib/sftp-actions", () => ({
  deleteSftpConnection: vi.fn(),
}));

describe("ConnectionCard", () => {
  const mockConnection = {
    id: "conn-123",
    name: "Test Server",
    host: "test.example.com",
    port: 22,
    username: "testuser",
    authType: "PASSWORD" as const,
    basePath: "/data",
    isActive: true,
    lastConnectedAt: new Date(),
    lastError: null,
  };

  it("renders connection details", () => {
    render(<ConnectionCard connection={mockConnection} />);

    expect(screen.getByText("Test Server")).toBeInTheDocument();
    expect(screen.getByText("test.example.com:22")).toBeInTheDocument();
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("links to edit page when clicked", () => {
    render(<ConnectionCard connection={mockConnection} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/my-items/connections/conn-123/edit");
  });

  it("does not show Edit in dropdown menu", async () => {
    const user = userEvent.setup();
    render(<ConnectionCard connection={mockConnection} />);

    // Open dropdown
    const menuButton = screen.getByRole("button", {
      name: "Connection actions",
    });
    await user.click(menuButton);

    // Edit should not be present
    expect(
      screen.queryByRole("menuitem", { name: "Edit" })
    ).not.toBeInTheDocument();
    // Delete should still be present
    expect(
      screen.getByRole("menuitem", { name: /delete/i })
    ).toBeInTheDocument();
  });
});
```

### Step 6.2: Run unit tests

Run: `pnpm run test:unit`
Expected: PASS

### Step 6.3: Commit

```bash
git add tests/unit/
git commit -m "test: add unit tests for connection card and filter"
```

---

## Task 7: Update E2E Tests

**Files:**

- Modify: `e2e/pages/connections.page.ts`
- Modify: `e2e/journeys/connections/connections-crud.spec.ts`
- Modify: `e2e/journeys/sftp/sftp-sync.spec.ts`
- Modify: `e2e/journeys/sftp/sftp-server-to-web.spec.ts`
- Modify: `e2e/journeys/sftp/sftp-web-to-server.spec.ts`

### Step 7.1: Update ConnectionsPage POM

**Modify:** `e2e/pages/connections.page.ts`

Remove `editConnection` method that uses menu (card click handles edit now):

```tsx
// REMOVE this method:
// async editConnection(name: string) {
//   await this.openConnectionActions(name);
//   await this.page.getByRole("menuitem", { name: "Edit" }).click();
// }

// ADD this method:
/** Click connection card to go to edit page. */
async clickConnectionCard(name: string) {
  const card = this.getConnectionCard(name);
  await card.click();
}
```

### Step 7.2: Update connections-crud.spec.ts

**Modify:** `e2e/journeys/connections/connections-crud.spec.ts`

Update the edit test to use card click instead of menu:

```tsx
// Line 92: Change from:
// await connectionsPage.editConnection("Server To Edit");
// To:
await connectionsPage.clickConnectionCard("Server To Edit");
```

### Step 7.3: Create SFTP filter tests

**Create:** `e2e/journeys/items/items-connection-filter.spec.ts`

```tsx
/**
 * E2E tests for connection filtering in my-items page.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Connection Filter", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("conn-filter");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("shows connection filter when connections exist", async ({
    page,
    connectionsPage,
  }) => {
    // Create a connection first
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Filter Test Server",
      host: "filter.example.com",
      username: "user",
      credential: "pass",
    });
    await connectionsPage.submitForm();
    await expect(page).toHaveURL("/my-items/connections", { timeout: 10000 });

    // Go to my-items
    await page.goto("/my-items");

    // Filter dropdown should be visible
    const filter = page.getByRole("combobox");
    await expect(filter).toBeVisible();
    await expect(filter).toHaveText("All Items");
  });

  test("hides connection filter when no connections exist", async ({
    page,
  }) => {
    await page.goto("/my-items");

    // Filter dropdown should not be visible
    const filter = page.getByRole("combobox");
    await expect(filter).not.toBeVisible();
  });
});
```

### Step 7.4: Update SFTP sync tests

**Modify:** `e2e/journeys/sftp/sftp-sync.spec.ts`

The sync tests currently navigate via connection card click. Update them to:

1. Navigate to my-items
2. Use the connection filter dropdown to select the connection
3. Then trigger sync

```tsx
// Replace card click navigation with:
await page.goto("/my-items");
await page.getByRole("combobox").click();
await page.getByRole("option", { name: "Test SFTP Server" }).click();
```

### Step 7.5: Add E2E test for connection badges

**Append to:** `e2e/journeys/items/items-connection-filter.spec.ts`

```tsx
test("displays connection badge on synced items", async ({
  page,
  connectionsPage,
  itemsPage,
  sftpFixture,
}) => {
  // Setup: Create connection and sync some files
  const { connectionName } = await sftpFixture.setupWithFiles();

  // Navigate to my-items
  await page.goto("/my-items");

  // Select the connection filter
  await page.getByRole("button", { name: /all items/i }).click();
  await page.getByRole("option", { name: connectionName }).click();

  // Verify synced items show connection badge
  const badge = page.locator(`text=${connectionName}`).first();
  await expect(badge).toBeVisible();

  // Badge should be styled as a small pill
  await expect(badge).toHaveClass(/rounded-full/);
});
```

### Step 7.6: Run E2E tests

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium`
Expected: All tests pass

### Step 7.7: Commit

```bash
git add e2e/
git commit -m "test: update E2E tests for connection simplification"
```

---

## Task 8: Update Integration Tests

**Files:**

- Modify: `tests/integration/items/items-crud.test.ts` (if needed)
- Modify: `tests/integration/sftp/sftp-connections.test.ts` (if needed)

### Step 8.1: Run integration tests

Run: `pnpm run test:integration`
Expected: PASS (most are server-side, shouldn't need changes)

### Step 8.2: Fix any failing tests

Address any failures related to the removed pages or changed behavior.

### Step 8.3: Commit

```bash
git add tests/integration/
git commit -m "test: update integration tests for connection simplification"
```

---

## Task 9: Clean Up Unused Code

**Files:**

- Review: `lib/sftp-actions.ts` - remove any actions only used by deleted pages
- Review: `components/sftp/` - remove unused components

### Step 9.1: Run knip to find unused exports

Run: `pnpm run knip`
Expected: Identify any newly unused code

### Step 9.2: Remove unused code

Delete or fix any exports flagged by knip.

### Step 9.3: Run full check suite

Run: `pnpm run check`
Expected: All checks pass

### Step 9.4: Commit

```bash
git add -A
git commit -m "chore: remove unused code after connection simplification"
```

---

## Task 10: Final Verification

### Step 10.1: Run all tests

```bash
pnpm run test:unit
pnpm run test:integration
BYPASS_RATE_LIMIT=true pnpm run test:e2e
```

Expected: All tests pass

### Step 10.2: Manual testing checklist

- [ ] Click connection card → goes to edit form
- [ ] Edit form save → returns to connections list
- [ ] Delete connection → works from dropdown menu
- [ ] My Items page shows connection filter when connections exist
- [ ] Selecting connection in filter shows only that connection's items
- [ ] Items show connection name badge
- [ ] Sync button works when connection is selected in filter

### Step 10.3: Run full check suite

Run: `pnpm run check`
Expected: All checks pass

### Step 10.4: Final commit

```bash
git add -A
git commit -m "feat: SFTP connection simplification complete (v0.22.0)"
```

---

## Testing Summary

| Test Type | Files                                                    | Count    |
| --------- | -------------------------------------------------------- | -------- |
| Unit      | `tests/unit/components/items/connection-filter.test.tsx` | ~4 tests |
| Unit      | `tests/unit/components/sftp/connection-card.test.tsx`    | ~3 tests |
| E2E       | `e2e/journeys/connections/connections-crud.spec.ts`      | Updated  |
| E2E       | `e2e/journeys/items/items-connection-filter.spec.ts`     | ~2 tests |
| E2E       | `e2e/journeys/sftp/*.spec.ts`                            | Updated  |

---

## Rollback Plan

If issues arise:

1. Restore deleted pages from git: `git checkout HEAD~1 -- app/(my-items)/my-items/connections/[id]/`
2. Revert connection card changes: `git checkout HEAD~1 -- components/sftp/connection-card.tsx`
3. Remove new filter component: `rm components/items/connection-filter.tsx`

---

## Notes

- The connection detail page (`[id]/page.tsx`) contains the "Synced Content" stats card. Consider moving this to the connection card or the filter dropdown as a future enhancement.
- Items at `/my-items/[itemId]` still work for viewing item details - only the connection-scoped routes are removed.
- The breadcrumb in the removed pages referenced "Connections" - the new my-items page should show the active filter in breadcrumbs.

## Security Recommendation

Add connectionId format validation in `lib/sftp-actions.ts` to prevent invalid IDs from reaching the database:

```tsx
// Add at top of getItemsByConnection function
const CUID_REGEX = /^c[a-z0-9]{24}$/;

export async function getItemsByConnection(
  connectionId: string,
  parentId: string | null
): Promise<ItemResult<ItemWithArtwork[]>> {
  // Validate connectionId format
  if (!CUID_REGEX.test(connectionId)) {
    return { error: "Invalid connection ID format" };
  }
  // ... rest of function
}
```

## Validation Checklist (from code review)

- [x] Suspense boundary for useSearchParams ✓
- [x] Server-side searchParams for SSR ✓
- [x] Unit test imports fixed ✓
- [x] shadcn Select role selectors fixed ✓
- [x] E2E test for connection badges ✓
- [ ] ConnectionId format validation (recommended)
- [ ] Consider moving stats card to connection cards (future)
