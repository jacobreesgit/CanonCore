# Library Rename & Sync Badge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename "My Files" to "Library" and add clickable sync badges to items showing their source connection.

**Architecture:** Add a `SyncBadge` component that displays a sync icon with connection status. The badge shows a tooltip on hover with the connection name, and clicking navigates to the connection detail page. Pass connection data through existing item props.

**Tech Stack:** React, Next.js, Tailwind CSS, Radix Tooltip, Vitest, Playwright

---

## Task 1: Rename "My Files" to "Library" in Sidebar

**Files:**

- Modify: `components/app-sidebar.tsx:46-52`

**Step 1: Update the navigation label**

```typescript
/** Main navigation items for the dashboard. */
const dashboardNavMain = [
  {
    title: "Library",
    url: "/dashboard",
    icon: Folder,
  },
];
```

**Step 2: Run type-check to verify**

Run: `pnpm run type-check`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "refactor: rename My Files to Library in sidebar"
```

---

## Task 2: Create SyncBadge Component

**Files:**

- Create: `components/items/sync-badge.tsx`
- Create: `tests/unit/components/sync-badge.test.tsx`

**Step 1: Write failing tests for SyncBadge**

```typescript
/**
 * Unit tests for SyncBadge component.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyncBadge } from "@/components/items/sync-badge";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("SyncBadge", () => {
  it("should not render when connectionId is null", () => {
    const { container } = render(
      <SyncBadge connectionId={null} connectionName={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render sync icon when connectionId exists", () => {
    render(
      <SyncBadge connectionId="conn-123" connectionName="My Server" />
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should show tooltip with connection name on hover", async () => {
    const user = userEvent.setup();
    render(
      <SyncBadge connectionId="conn-123" connectionName="My Server" />
    );

    await user.hover(screen.getByRole("button"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("My Server");
  });

  it("should navigate to connection page on click", async () => {
    const user = userEvent.setup();
    const mockPush = vi.fn();
    vi.mocked(await import("next/navigation")).useRouter = () => ({
      push: mockPush,
    }) as ReturnType<typeof import("next/navigation").useRouter>;

    render(
      <SyncBadge connectionId="conn-123" connectionName="My Server" />
    );

    await user.click(screen.getByRole("button"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/connections/conn-123");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit -- tests/unit/components/sync-badge.test.tsx`
Expected: FAIL (module not found)

**Step 3: Create SyncBadge component**

```typescript
/**
 * Sync badge component showing connection status.
 * Displays tooltip on hover and navigates to connection on click.
 */

"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SyncBadgeProps {
  /** Connection ID for navigation. */
  connectionId: string | null;
  /** Connection name for tooltip. */
  connectionName: string | null;
  /** Additional class names. */
  className?: string;
}

/**
 * Renders a sync status badge that links to the connection.
 * Shows tooltip with connection name on hover.
 *
 * @param connectionId - ID of the SFTP connection
 * @param connectionName - Display name for tooltip
 * @param className - Additional styling
 */
export function SyncBadge({
  connectionId,
  connectionName,
  className,
}: SyncBadgeProps) {
  const router = useRouter();

  // Don't render if not synced to a connection
  if (!connectionId) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    router.push(`/dashboard/connections/${connectionId}`);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "flex-shrink-0 rounded p-0.5",
            "text-emerald-500/70 transition-colors duration-150",
            "hover:text-emerald-500 hover:bg-emerald-500/10",
            "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none",
            className
          )}
          aria-label={`Synced from ${connectionName || "connection"}`}
        >
          <RefreshCw className="size-3" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {connectionName || "Unknown connection"}
      </TooltipContent>
    </Tooltip>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- tests/unit/components/sync-badge.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/items/sync-badge.tsx tests/unit/components/sync-badge.test.tsx
git commit -m "feat: add SyncBadge component with tooltip and navigation"
```

---

## Task 3: Export SyncBadge from Items Index

**Files:**

- Modify: `components/items/index.ts`

**Step 1: Add export**

Add to the exports in `components/items/index.ts`:

```typescript
export { SyncBadge } from "./sync-badge";
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add components/items/index.ts
git commit -m "chore: export SyncBadge from items index"
```

---

## Task 4: Add Connection Name to Item Types

**Files:**

- Modify: `lib/types.ts`

**Step 1: Add connectionName to TreeItem type**

Add `connectionName` field after `connectionId` in the `TreeItem` interface:

```typescript
export interface TreeItem {
  id: UniqueIdentifier;
  name: string;
  description?: string | null;
  order: number;
  depth: number;
  parentId: UniqueIdentifier | null;
  children: TreeItem[];
  collapsed?: boolean;
  // SFTP-specific fields for display
  sftpPath?: string | null;
  connectionId?: string | null;
  connectionName?: string | null;
  // Artwork thumbnail
  artworkId?: string | null;
}
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add connectionName to TreeItem type"
```

---

## Task 5: Update Item Utils to Include Connection Name

**Files:**

- Modify: `lib/item-utils.ts`

**Step 1: Update itemsToTree to accept connection mapping**

Update the function signature and implementation to map connectionId to connectionName:

```typescript
/**
 * Converts flat items array to hierarchical tree structure.
 * Optionally maps connectionId to connectionName using provided lookup.
 *
 * @param items - Flat array of items with parentId
 * @param connectionMap - Optional map of connectionId to connectionName
 * @returns Hierarchical tree items array
 */
export function itemsToTree(
  items: ItemWithArtwork[],
  connectionMap?: Map<string, string>
): TreeItem[] {
  // ... existing logic, add connectionName mapping
  const treeItem: TreeItem = {
    id: item.id,
    name: item.name,
    description: item.description,
    order: item.order,
    depth: item.depth,
    parentId: item.parentId,
    children: [],
    sftpPath: item.sftpPath,
    connectionId: item.connectionId,
    connectionName:
      item.connectionId && connectionMap
        ? (connectionMap.get(item.connectionId) ?? null)
        : null,
    artworkId: item.artworkId,
  };
  // ... rest of existing logic
}
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/item-utils.ts
git commit -m "feat: add connectionName mapping to itemsToTree"
```

---

## Task 6: Update ItemsView to Fetch Connection Names

**Files:**

- Modify: `components/items/items-view.tsx`

**Step 1: Add prop for connection map and pass to tree conversion**

Update ItemsView to accept an optional `connectionMap` prop and pass it to `itemsToTree`:

```typescript
interface ItemsViewProps {
  items: ItemWithArtwork[];
  parentId: string | null;
  connectionId?: string;
  /** Map of connectionId to connection name for sync badges. */
  connectionMap?: Map<string, string>;
}
```

Then in the component, pass it to `itemsToTree`:

```typescript
const treeItems = itemsToTree(items, connectionMap);
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add components/items/items-view.tsx
git commit -m "feat: pass connectionMap to itemsToTree in ItemsView"
```

---

## Task 7: Update Dashboard Page to Build Connection Map

**Files:**

- Modify: `app/(dashboard)/dashboard/page.tsx`

**Step 1: Fetch connections and build map**

Add query to get user's connections and build a Map:

```typescript
// Fetch user's connections for sync badge display
const connections = await prisma.sftpConnection.findMany({
  where: { userId: session.user.id },
  select: { id: true, name: true },
});

const connectionMap = new Map(
  connections.map((c) => [c.id, c.name])
);

// Pass to ItemsView
<ItemsView items={items} parentId={parentId} connectionMap={connectionMap} />
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add app/(dashboard)/dashboard/page.tsx
git commit -m "feat: build connectionMap for sync badges on dashboard"
```

---

## Task 8: Add SyncBadge to TreeItem Component

**Files:**

- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Modify: `tests/unit/components/tree-item.test.tsx`

**Step 1: Write failing test for sync badge in TreeItem**

Add to `tests/unit/components/tree-item.test.tsx`:

```typescript
it("should render sync badge when connectionId exists", () => {
  render(
    <TreeItem
      {...defaultProps}
      connectionId="conn-123"
      connectionName="My Server"
    />
  );

  const syncBadge = screen.getByRole("button", { name: /synced from/i });
  expect(syncBadge).toBeInTheDocument();
});

it("should not render sync badge when connectionId is null", () => {
  render(<TreeItem {...defaultProps} connectionId={null} />);

  const syncBadge = screen.queryByRole("button", { name: /synced from/i });
  expect(syncBadge).not.toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit -- tests/unit/components/tree-item.test.tsx`
Expected: FAIL (no sync badge)

**Step 3: Add connectionName prop and SyncBadge to TreeItem**

Update props interface:

```typescript
/** Connection name for sync badge tooltip. */
connectionName?: string | null;
```

Import and add SyncBadge after the item name:

```typescript
import { SyncBadge } from "@/components/items/sync-badge";

// In render, after the name span, add:
{!ghost && (
  <SyncBadge
    connectionId={connectionId ?? null}
    connectionName={connectionName ?? null}
  />
)}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- tests/unit/components/tree-item.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/sortable-tree/components/TreeItem/TreeItem.tsx tests/unit/components/tree-item.test.tsx
git commit -m "feat: add SyncBadge to TreeItem component"
```

---

## Task 9: Add SyncBadge to GridItem Component

**Files:**

- Modify: `components/sortable-grid/GridItem.tsx`
- Modify: `tests/unit/components/grid-item.test.tsx`

**Step 1: Write failing test for sync badge in GridItem**

Add to `tests/unit/components/grid-item.test.tsx`:

```typescript
it("should render sync badge when connectionId exists", () => {
  render(
    <GridItem
      {...defaultProps}
      connectionId="conn-123"
      connectionName="My Server"
    />
  );

  const syncBadge = screen.getByRole("button", { name: /synced from/i });
  expect(syncBadge).toBeInTheDocument();
});

it("should not render sync badge when connectionId is null", () => {
  render(<GridItem {...defaultProps} connectionId={null} />);

  const syncBadge = screen.queryByRole("button", { name: /synced from/i });
  expect(syncBadge).not.toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit -- tests/unit/components/grid-item.test.tsx`
Expected: FAIL

**Step 3: Add connectionName prop and SyncBadge to GridItem**

Update props interface:

```typescript
/** Connection ID for sync badge. */
connectionId?: string | null;
/** Connection name for sync badge tooltip. */
connectionName?: string | null;
```

Add SyncBadge in the name/description area:

```typescript
import { SyncBadge } from "@/components/items/sync-badge";

// In the item name row, add after the name span:
<SyncBadge
  connectionId={connectionId ?? null}
  connectionName={connectionName ?? null}
/>
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- tests/unit/components/grid-item.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/sortable-grid/GridItem.tsx tests/unit/components/grid-item.test.tsx
git commit -m "feat: add SyncBadge to GridItem component"
```

---

## Task 10: Pass connectionName Through Tree/Grid Components

**Files:**

- Modify: `components/sortable-tree/Tree.tsx`
- Modify: `components/sortable-tree/SortableTree.tsx`
- Modify: `components/sortable-grid/Grid.tsx`
- Modify: `components/sortable-grid/SortableGrid.tsx`

**Step 1: Update Tree.tsx to pass connectionName**

In the TreeItem render, add connectionName prop:

```typescript
connectionName={item.connectionName}
```

**Step 2: Update SortableTree.tsx similarly**

Pass connectionName to TreeItem in both the main render and overlay.

**Step 3: Update Grid.tsx to pass connectionName**

```typescript
connectionName={item.connectionName}
```

**Step 4: Update SortableGrid.tsx similarly**

Pass connectionName to GridItem.

**Step 5: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add components/sortable-tree/Tree.tsx components/sortable-tree/SortableTree.tsx components/sortable-grid/Grid.tsx components/sortable-grid/SortableGrid.tsx
git commit -m "feat: pass connectionName through tree and grid components"
```

---

## Task 11: Write E2E Test for Sync Badge

**Files:**

- Create: `e2e/journeys/items/items-sync-badge.spec.ts`

**Step 1: Create E2E test file**

```typescript
/**
 * E2E tests for sync badge functionality.
 * Verifies badge display, tooltip, and navigation.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Sync Badge", () => {
  test.beforeEach(async ({ page, signUpPage, connectionsPage, sftpConfig }) => {
    // Create user and sign in
    const userEmail = generateUniqueEmail("sync-badge");
    await signUpPage.goto();
    await signUpPage.signUp(userEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Create SFTP connection
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Test Server",
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      credential: sftpConfig.password,
      basePath: sftpConfig.basePath,
    });
    await connectionsPage.submitForm();
    await expect(page).toHaveURL("/dashboard/connections", { timeout: 10000 });

    // Navigate to connection and sync
    const card = connectionsPage.getConnectionCard("Test Server");
    await card.click();
    await page.waitForLoadState("networkidle");
  });

  test("shows sync badge on items from connection", async ({ page }) => {
    // Create a folder in the connection
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/folder name/i).fill("synced-folder");
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");

    // Go to Library (main dashboard)
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Verify sync badge is visible
    const syncBadge = page.getByRole("button", { name: /synced from/i });
    await expect(syncBadge).toBeVisible();
  });

  test("sync badge shows connection name tooltip on hover", async ({
    page,
  }) => {
    // Create a folder
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/folder name/i).fill("hover-test");
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");

    // Go to Library
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Hover sync badge and check tooltip
    const syncBadge = page.getByRole("button", { name: /synced from/i });
    await syncBadge.hover();
    await expect(page.getByRole("tooltip")).toContainText("Test Server");
  });

  test("clicking sync badge navigates to connection detail", async ({
    page,
  }) => {
    // Create a folder
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/folder name/i).fill("nav-test");
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");

    // Go to Library
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Click sync badge
    const syncBadge = page.getByRole("button", { name: /synced from/i });
    await syncBadge.click();

    // Should navigate to connection detail page
    await expect(page).toHaveURL(/\/dashboard\/connections\/[^/]+$/);
  });
});
```

**Step 2: Run E2E test**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium -g "Sync Badge"`
Expected: PASS (after all component work is done)

**Step 3: Commit**

```bash
git add e2e/journeys/items/items-sync-badge.spec.ts
git commit -m "test: add E2E tests for sync badge functionality"
```

---

## Task 12: Run Full Test Suite and Checks

**Files:** None (verification only)

**Step 1: Run all checks**

Run: `pnpm run check`
Expected: PASS (format, lint, type-check, knip, build)

**Step 2: Run unit tests**

Run: `pnpm run test:unit`
Expected: All tests pass

**Step 3: Run E2E tests**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium`
Expected: All tests pass

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: fix any remaining issues from test suite"
```

---

## Summary

**Changes:**

1. Sidebar: "My Files" → "Library"
2. New `SyncBadge` component with tooltip and navigation
3. TreeItem and GridItem display sync badges for connected items
4. Connection name passed through component hierarchy
5. Dashboard page fetches connections for badge display

**Testing:**

- Unit tests for SyncBadge component
- Unit tests for TreeItem and GridItem with sync badge
- E2E tests for badge display, tooltip, and navigation
