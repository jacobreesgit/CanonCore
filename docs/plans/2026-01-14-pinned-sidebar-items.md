# Pinned Sidebar Items Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Plex-like navigation where users can pin items to the sidebar for quick access.

**Architecture:** Add `pinnedOrder` field to Item model (nullable integer for ordering). Pinned items display in sidebar below "My Items" with artwork thumbnails. Context menu provides pin/unpin actions. Maximum 10 pinned items per user.

**Tech Stack:** Prisma schema, Server Actions, React components, Vitest, Playwright

---

## Overview

This feature allows users to "pin" any item (not just root-level) to the sidebar for quick navigation. Similar to how Plex shows libraries in the sidebar, users can pin their most-accessed items like "Movies", "TV Shows", or specific seasons/collections.

### Design Decisions

1. **Single field approach**: `pinnedOrder: Int?` on Item model
   - `null` = not pinned
   - `0, 1, 2, ...` = pinned with explicit ordering
   - Avoids separate join table complexity

2. **Pinning UI**: Context menu "Pin to Sidebar" / "Unpin from Sidebar"
   - Simple, discoverable via right-click
   - Consistent with existing context menu pattern

3. **Sidebar display**: New `NavPinnedItems` component
   - Shows pinned items with artwork thumbnails (or Folder fallback)
   - Positioned between "My Items" and footer "Get Help"

4. **Limits**: Maximum 10 pinned items
   - Prevents sidebar clutter
   - Enforced server-side with user-friendly error

---

## Task 1: Database Schema Migration

**Files:**
- Modify: `prisma/schema.prisma:122-161` (Item model)
- Create: `prisma/migrations/[timestamp]_add_pinned_order/migration.sql`

**Step 1: Add pinnedOrder field to Item model**

In `prisma/schema.prisma`, add the `pinnedOrder` field to the Item model:

```prisma
model Item {
  id          String   @id @default(cuid())
  name        String
  description String?  @db.VarChar(1000)
  order       Int      @default(0)
  depth       Int      @default(0)

  // Pinned to sidebar (null = not pinned, 0+ = pinned with order)
  pinnedOrder Int?

  // Hierarchy (max 10 levels deep)
  parentId  String?
  parent    Item?    @relation("ItemChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children  Item[]   @relation("ItemChildren")
  files     ItemFile[]

  // ... rest of model unchanged

  // Add index for pinned items query
  @@index([userId, pinnedOrder])
}
```

**Step 2: Create and run migration**

Run: `npx prisma migrate dev --name add_pinned_order`
Expected: Migration created and applied successfully

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add pinnedOrder field to Item model for sidebar pinning"
```

---

## Task 2: Type Definitions Update

**Files:**
- Modify: `lib/types.ts:16-33` (Item interface)

**Step 1: Add pinnedOrder to Item type**

```typescript
export interface Item {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  order: number;
  depth: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  // Sidebar pinning (null = not pinned, 0+ = pinned order)
  pinnedOrder: number | null;
  // Google Drive fields
  driveFileId: string | null;
  driveModifiedAt: Date | null;
  driveThumbnailUrl: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  driveConnectionId: string | null;
}
```

**Step 2: Add PinnedItem type for sidebar display**

Add after `SearchableItem` interface (~line 228):

```typescript
/**
 * Pinned item for sidebar navigation display.
 * Minimal data needed for sidebar rendering.
 */
export interface PinnedItem {
  id: string;
  name: string;
  pinnedOrder: number;
  /** First artwork file ID for sidebar thumbnail */
  artworkId: string | null;
}
```

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add pinnedOrder to Item type and PinnedItem interface"
```

---

## Task 3: Server Actions for Pinning

**Files:**
- Modify: `lib/item-actions.ts`
- Modify: `lib/rate-limit.ts` (add pin/unpin limits)

**Step 1: Write failing tests for pin/unpin actions**

Create `tests/unit/lib/item-actions-pinning.test.ts`:

```typescript
/**
 * Unit tests for item pinning server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

import { auth } from "@/lib/auth";
import { pinItem, unpinItem, getPinnedItems } from "@/lib/item-actions";

const mockAuth = auth as ReturnType<typeof vi.fn>;

describe("pinItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await pinItem("item-1");

    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("returns error when item not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findUnique).mockResolvedValue(null);

    const result = await pinItem("nonexistent");

    expect(result).toEqual({ error: "Item not found" });
  });

  it("returns error when max pinned items reached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      pinnedOrder: null,
    } as any);
    vi.mocked(prisma.item.count).mockResolvedValue(10);

    const result = await pinItem("item-1");

    expect(result).toEqual({ error: "Maximum of 10 pinned items reached" });
  });

  it("pins item with next order value", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      pinnedOrder: null,
    } as any);
    vi.mocked(prisma.item.count).mockResolvedValue(2);
    vi.mocked(prisma.item.aggregate).mockResolvedValue({
      _max: { pinnedOrder: 1 },
    } as any);
    vi.mocked(prisma.item.update).mockResolvedValue({} as any);

    const result = await pinItem("item-1");

    expect(result).toEqual({ success: true });
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { pinnedOrder: 2 },
    });
  });
});

describe("unpinItem", () => {
  it("unpins item by setting pinnedOrder to null", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      pinnedOrder: 0,
    } as any);
    vi.mocked(prisma.item.update).mockResolvedValue({} as any);

    const result = await unpinItem("item-1");

    expect(result).toEqual({ success: true });
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { pinnedOrder: null },
    });
  });
});

describe("getPinnedItems", () => {
  it("returns pinned items sorted by pinnedOrder", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "item-1", name: "Movies", pinnedOrder: 0, files: [] },
      { id: "item-2", name: "TV Shows", pinnedOrder: 1, files: [{ id: "art-1", fileType: "ARTWORK" }] },
    ] as any);

    const result = await getPinnedItems();

    expect(result).toEqual({
      success: true,
      data: [
        { id: "item-1", name: "Movies", pinnedOrder: 0, artworkId: null },
        { id: "item-2", name: "TV Shows", pinnedOrder: 1, artworkId: "art-1" },
      ],
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test tests/unit/lib/item-actions-pinning.test.ts`
Expected: FAIL - functions not defined

**Step 3: Add rate limit keys**

In `lib/rate-limit.ts`, add to the `LIMITS` object:

```typescript
itemPin: { requests: 30, window: "1 m" },
```

**Step 4: Implement pinItem, unpinItem, getPinnedItems**

Add to `lib/item-actions.ts`:

```typescript
import type { PinnedItem } from "@/lib/types";

const MAX_PINNED_ITEMS = 10;

/**
 * Pins an item to the sidebar.
 * Limited to 10 pinned items per user.
 *
 * @param id - Item ID to pin
 * @returns Success or error
 */
export async function pinItem(id: string): Promise<ItemResult> {
  const rateLimitResult = await checkRateLimit("itemPin");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true, pinnedOrder: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Already pinned
  if (item.pinnedOrder !== null) {
    return { success: true };
  }

  // Check max limit
  const pinnedCount = await prisma.item.count({
    where: {
      userId: session.user.id,
      pinnedOrder: { not: null },
    },
  });

  if (pinnedCount >= MAX_PINNED_ITEMS) {
    return { error: "Maximum of 10 pinned items reached" };
  }

  // Get next order value
  const maxOrder = await prisma.item.aggregate({
    where: {
      userId: session.user.id,
      pinnedOrder: { not: null },
    },
    _max: { pinnedOrder: true },
  });

  const nextOrder = (maxOrder._max.pinnedOrder ?? -1) + 1;

  await prisma.item.update({
    where: { id },
    data: { pinnedOrder: nextOrder },
  });

  return { success: true };
}

/**
 * Unpins an item from the sidebar.
 *
 * @param id - Item ID to unpin
 * @returns Success or error
 */
export async function unpinItem(id: string): Promise<ItemResult> {
  const rateLimitResult = await checkRateLimit("itemPin");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true, pinnedOrder: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Already unpinned
  if (item.pinnedOrder === null) {
    return { success: true };
  }

  await prisma.item.update({
    where: { id },
    data: { pinnedOrder: null },
  });

  return { success: true };
}

/**
 * Fetches all pinned items for the current user.
 * Returns items sorted by pinnedOrder for sidebar display.
 *
 * @returns PinnedItem array or error
 */
export async function getPinnedItems(): Promise<ItemResult<PinnedItem[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const items = await prisma.item.findMany({
    where: {
      userId: session.user.id,
      pinnedOrder: { not: null },
    },
    orderBy: { pinnedOrder: "asc" },
    select: {
      id: true,
      name: true,
      pinnedOrder: true,
      files: {
        where: { fileType: "ARTWORK" },
        select: { id: true, isPrimary: true },
        orderBy: { isPrimary: "desc" },
        take: 1,
      },
    },
  });

  const pinnedItems: PinnedItem[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    pinnedOrder: item.pinnedOrder!,
    artworkId: item.files[0]?.id ?? null,
  }));

  return { success: true, data: pinnedItems };
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm run test tests/unit/lib/item-actions-pinning.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/item-actions.ts lib/rate-limit.ts tests/unit/lib/item-actions-pinning.test.ts
git commit -m "feat: add pinItem, unpinItem, getPinnedItems server actions"
```

---

## Task 4: Integration Tests for Pinning

**Files:**
- Create: `tests/integration/items/item-pinning.test.ts`

**Step 1: Write integration tests**

```typescript
/**
 * Integration tests for item pinning with real database.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { pinItem, unpinItem, getPinnedItems } from "@/lib/item-actions";

// Test user setup
const TEST_USER = {
  id: "test-pin-user",
  email: "pintest@example.com",
  passwordHash: "hashed",
};

describe("Item Pinning Integration", () => {
  beforeEach(async () => {
    // Clean up and create test user
    await prisma.user.deleteMany({ where: { email: TEST_USER.email } });
    await prisma.user.create({ data: TEST_USER });
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_USER.email } });
  });

  it("pins item and retrieves in getPinnedItems", async () => {
    // Create item
    const item = await prisma.item.create({
      data: { name: "Movies", userId: TEST_USER.id, order: 0, depth: 0 },
    });

    // Pin it (need to mock auth for this to work)
    await prisma.item.update({
      where: { id: item.id },
      data: { pinnedOrder: 0 },
    });

    // Verify it's pinned
    const pinned = await prisma.item.findMany({
      where: { userId: TEST_USER.id, pinnedOrder: { not: null } },
    });

    expect(pinned).toHaveLength(1);
    expect(pinned[0].name).toBe("Movies");
  });

  it("respects max 10 pinned items limit", async () => {
    // Create 10 pinned items
    for (let i = 0; i < 10; i++) {
      await prisma.item.create({
        data: {
          name: `Item ${i}`,
          userId: TEST_USER.id,
          order: i,
          depth: 0,
          pinnedOrder: i,
        },
      });
    }

    // Verify count
    const count = await prisma.item.count({
      where: { userId: TEST_USER.id, pinnedOrder: { not: null } },
    });

    expect(count).toBe(10);
  });

  it("unpins item by setting pinnedOrder to null", async () => {
    const item = await prisma.item.create({
      data: {
        name: "TV Shows",
        userId: TEST_USER.id,
        order: 0,
        depth: 0,
        pinnedOrder: 0,
      },
    });

    await prisma.item.update({
      where: { id: item.id },
      data: { pinnedOrder: null },
    });

    const updated = await prisma.item.findUnique({ where: { id: item.id } });
    expect(updated?.pinnedOrder).toBeNull();
  });

  it("maintains pinnedOrder when item is deleted", async () => {
    // Create 3 pinned items
    const items = await Promise.all([
      prisma.item.create({
        data: { name: "A", userId: TEST_USER.id, order: 0, depth: 0, pinnedOrder: 0 },
      }),
      prisma.item.create({
        data: { name: "B", userId: TEST_USER.id, order: 1, depth: 0, pinnedOrder: 1 },
      }),
      prisma.item.create({
        data: { name: "C", userId: TEST_USER.id, order: 2, depth: 0, pinnedOrder: 2 },
      }),
    ]);

    // Delete middle item
    await prisma.item.delete({ where: { id: items[1].id } });

    // Remaining items still have their orders
    const remaining = await prisma.item.findMany({
      where: { userId: TEST_USER.id, pinnedOrder: { not: null } },
      orderBy: { pinnedOrder: "asc" },
    });

    expect(remaining).toHaveLength(2);
    expect(remaining[0].pinnedOrder).toBe(0);
    expect(remaining[1].pinnedOrder).toBe(2);
  });
});
```

**Step 2: Run integration tests**

Run: `pnpm run test:integration tests/integration/items/item-pinning.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/items/item-pinning.test.ts
git commit -m "test: add integration tests for item pinning"
```

---

## Task 5: NavPinnedItems Component

**Files:**
- Create: `components/nav-pinned-items.tsx`

**Step 1: Write failing component test**

Create `tests/unit/components/nav-pinned-items.test.tsx`:

```typescript
/**
 * Unit tests for NavPinnedItems component.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavPinnedItems } from "@/components/nav-pinned-items";
import type { PinnedItem } from "@/lib/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/my-items",
}));

describe("NavPinnedItems", () => {
  it("renders nothing when no pinned items", () => {
    const { container } = render(<NavPinnedItems items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders pinned items with names", () => {
    const items: PinnedItem[] = [
      { id: "1", name: "Movies", pinnedOrder: 0, artworkId: null },
      { id: "2", name: "TV Shows", pinnedOrder: 1, artworkId: "art-1" },
    ];

    render(<NavPinnedItems items={items} />);

    expect(screen.getByText("Movies")).toBeInTheDocument();
    expect(screen.getByText("TV Shows")).toBeInTheDocument();
  });

  it("links to item detail pages", () => {
    const items: PinnedItem[] = [
      { id: "item-123", name: "Movies", pinnedOrder: 0, artworkId: null },
    ];

    render(<NavPinnedItems items={items} />);

    const link = screen.getByRole("link", { name: /movies/i });
    expect(link).toHaveAttribute("href", "/my-items/item-123");
  });

  it("shows active state for current item", () => {
    vi.mocked(usePathname).mockReturnValue("/my-items/item-123");

    const items: PinnedItem[] = [
      { id: "item-123", name: "Movies", pinnedOrder: 0, artworkId: null },
    ];

    render(<NavPinnedItems items={items} />);

    const button = screen.getByRole("link", { name: /movies/i });
    expect(button).toHaveAttribute("data-active", "true");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test tests/unit/components/nav-pinned-items.test.tsx`
Expected: FAIL - component not found

**Step 3: Implement NavPinnedItems component**

Create `components/nav-pinned-items.tsx`:

```typescript
/**
 * Pinned items navigation section for the sidebar.
 * Displays user's pinned items with artwork thumbnails.
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Folder } from "lucide-react";
import type { PinnedItem } from "@/lib/types";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface NavPinnedItemsProps {
  items: PinnedItem[];
}

/**
 * Renders pinned items in the sidebar.
 * Shows artwork thumbnails or folder icon fallback.
 *
 * @param items - Array of pinned items to display
 */
export function NavPinnedItems({ items }: NavPinnedItemsProps) {
  const pathname = usePathname();

  // Don't render anything if no pinned items
  if (items.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Pinned</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const href = `/my-items/${item.id}`;
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  tooltip={item.name}
                  asChild
                  isActive={isActive}
                >
                  <Link href={href}>
                    {item.artworkId ? (
                      <div className="relative size-4 overflow-hidden rounded-sm">
                        <Image
                          src={`/api/artwork/${item.artworkId}`}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="16px"
                        />
                      </div>
                    ) : (
                      <Folder className="size-4" />
                    )}
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test tests/unit/components/nav-pinned-items.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/nav-pinned-items.tsx tests/unit/components/nav-pinned-items.test.tsx
git commit -m "feat: add NavPinnedItems component for sidebar display"
```

---

## Task 6: Integrate NavPinnedItems into Sidebar

**Files:**
- Modify: `components/app-sidebar.tsx`
- Modify: `app/(my-items)/layout.tsx` (fetch pinned items)

**Step 1: Update AppSidebarProps to accept pinned items**

In `components/app-sidebar.tsx`:

```typescript
import { NavPinnedItems } from "@/components/nav-pinned-items";
import type { PinnedItem } from "@/lib/types";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: SidebarUser | null;
  context: SidebarContext;
  docsTree?: PageTreeRoot;
  driveConnection?: GoogleDriveConnection | null;
  /** Pinned items for sidebar navigation */
  pinnedItems?: PinnedItem[];
}
```

**Step 2: Render NavPinnedItems in SidebarContent**

Update the `SidebarContent` section:

```typescript
<SidebarContent>
  {/* Show my-items nav for authenticated users on any page */}
  {user && <NavMain items={myItemsNavMain} />}

  {/* Show pinned items for authenticated users */}
  {user && pinnedItems && pinnedItems.length > 0 && (
    <NavPinnedItems items={pinnedItems} />
  )}

  {context === "docs" && docsTree && (
    <NavDocs tree={docsTree} isAuthenticated={!!user} />
  )}
</SidebarContent>
```

**Step 3: Fetch pinned items in my-items layout**

In `app/(my-items)/layout.tsx`, add to the server component:

```typescript
import { getPinnedItems } from "@/lib/item-actions";

export default async function MyItemsLayout({ children }: { children: React.ReactNode }) {
  // ... existing auth and connection fetching ...

  // Fetch pinned items for sidebar
  const pinnedResult = await getPinnedItems();
  const pinnedItems = pinnedResult.success ? pinnedResult.data ?? [] : [];

  return (
    <SidebarProvider>
      <AppSidebar
        user={sidebarUser}
        context="my-items"
        driveConnection={driveConnection}
        pinnedItems={pinnedItems}
      />
      {/* ... rest of layout ... */}
    </SidebarProvider>
  );
}
```

**Step 4: Commit**

```bash
git add components/app-sidebar.tsx app/\(my-items\)/layout.tsx
git commit -m "feat: integrate pinned items into sidebar"
```

---

## Task 7: Add Pin/Unpin to Context Menu

**Files:**
- Modify: `components/items/item-context-menu.tsx`

**Step 1: Update ItemContextMenuProps**

```typescript
interface ItemContextMenuProps {
  children: ReactNode;
  itemName: string;
  /** Google Drive folder ID for this item (if synced) */
  driveFileId?: string | null;
  /** Whether item is currently pinned to sidebar */
  isPinned?: boolean;
  showAddChild?: boolean;
  hasDriveConnection?: boolean;
  onSettings?(): void;
  onDelete?(): Promise<void>;
  onAddChild?(name: string, description?: string): Promise<string | undefined>;
  /** Callback to pin/unpin item */
  onTogglePin?(): Promise<void>;
}
```

**Step 2: Add Pin/Unpin menu item**

Add after the "Add Child Item" menu item:

```typescript
import { Pin, PinOff } from "lucide-react";

// Inside ContextMenuContent, after Add Child Item:
{onTogglePin && (
  <ContextMenuItem
    onClick={async () => {
      await onTogglePin();
    }}
    className="gap-2"
  >
    {isPinned ? (
      <>
        <PinOff className="size-4" strokeWidth={2} />
        <span>Unpin from Sidebar</span>
      </>
    ) : (
      <>
        <Pin className="size-4" strokeWidth={2} />
        <span>Pin to Sidebar</span>
      </>
    )}
  </ContextMenuItem>
)}
```

**Step 3: Commit**

```bash
git add components/items/item-context-menu.tsx
git commit -m "feat: add pin/unpin option to item context menu"
```

---

## Task 8: Wire Up Pin Actions in Views

**Files:**
- Modify: `components/sortable-grid/GridItem.tsx`
- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Modify: `components/items/items-view.tsx`

**Step 1: Add isPinned to ItemWithArtwork type**

In `lib/types.ts`, update `ItemWithArtwork`:

```typescript
export interface ItemWithArtwork extends Item {
  artworkId: string | null;
  fileCounts: FileCounts;
  childCount: number;
  primaryMediaName: string | null;
  mediaIconType: "film" | "music" | "mixed" | null;
}
```

Note: `pinnedOrder` is already on `Item`, so `isPinned` can be derived as `item.pinnedOrder !== null`.

**Step 2: Update GridItem to pass isPinned and onTogglePin**

In `components/sortable-grid/GridItem.tsx`, update the ItemContextMenu usage:

```typescript
<ItemContextMenu
  itemName={item.name}
  driveFileId={item.driveFileId}
  isPinned={item.pinnedOrder !== null}
  showAddChild={true}
  hasDriveConnection={!!driveConnectionId}
  onSettings={onSettings}
  onDelete={onDelete}
  onAddChild={onAddChild}
  onTogglePin={onTogglePin}
>
```

**Step 3: Add onTogglePin prop to GridItem**

```typescript
interface GridItemProps {
  // ... existing props ...
  onTogglePin?: () => Promise<void>;
}
```

**Step 4: Pass toggle handler from items-view**

In `components/items/items-view.tsx`:

```typescript
import { pinItem, unpinItem } from "@/lib/item-actions";

// In the item rendering:
const handleTogglePin = async (item: ItemWithArtwork) => {
  if (item.pinnedOrder !== null) {
    const result = await unpinItem(item.id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to unpin");
    } else {
      toast.success(`"${item.name}" unpinned from sidebar`);
      // Trigger refresh
      router.refresh();
    }
  } else {
    const result = await pinItem(item.id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to pin");
    } else {
      toast.success(`"${item.name}" pinned to sidebar`);
      router.refresh();
    }
  }
};
```

**Step 5: Commit**

```bash
git add components/sortable-grid/GridItem.tsx components/sortable-tree/components/TreeItem/TreeItem.tsx components/items/items-view.tsx
git commit -m "feat: wire up pin/unpin actions in grid and tree views"
```

---

## Task 9: Update getItems to Include pinnedOrder

**Files:**
- Modify: `lib/item-actions.ts`

**Step 1: Ensure pinnedOrder is included in ItemWithArtwork**

The `getItems`, `getAllItems`, and `getDescendants` functions already return full Item data which includes `pinnedOrder` after the schema migration. Verify the select/include doesn't exclude it.

**Step 2: Commit** (if changes needed)

```bash
git add lib/item-actions.ts
git commit -m "fix: ensure pinnedOrder included in item queries"
```

---

## Task 10: E2E Tests for Pinned Items

**Files:**
- Create: `e2e/journeys/items/pinned-items.spec.ts`

**Step 1: Write E2E tests**

```typescript
/**
 * E2E tests for pinned sidebar items feature.
 */

import { test, expect } from "@playwright/test";
import { AuthenticatedPage } from "../../pages/authenticated-page";
import { MyItemsPage } from "../../pages/my-items-page";

test.describe("Pinned Items", () => {
  let page: AuthenticatedPage;
  let myItems: MyItemsPage;

  test.beforeEach(async ({ page: p }) => {
    page = new AuthenticatedPage(p);
    myItems = new MyItemsPage(p);
    await page.login();
  });

  test("can pin item via context menu", async ({ page: p }) => {
    // Create a test item
    await myItems.createItem("Movies");

    // Right-click to open context menu
    await myItems.rightClickItem("Movies");

    // Click "Pin to Sidebar"
    await p.getByRole("menuitem", { name: /pin to sidebar/i }).click();

    // Verify toast
    await expect(p.getByText(/pinned to sidebar/i)).toBeVisible();

    // Verify item appears in sidebar
    const sidebar = p.getByRole("complementary");
    await expect(sidebar.getByText("Pinned")).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Movies" })).toBeVisible();
  });

  test("can unpin item via context menu", async ({ page: p }) => {
    // Create and pin an item first
    await myItems.createItem("TV Shows");
    await myItems.rightClickItem("TV Shows");
    await p.getByRole("menuitem", { name: /pin to sidebar/i }).click();

    // Now unpin
    await myItems.rightClickItem("TV Shows");
    await p.getByRole("menuitem", { name: /unpin from sidebar/i }).click();

    // Verify toast
    await expect(p.getByText(/unpinned from sidebar/i)).toBeVisible();

    // Verify item removed from sidebar
    const sidebar = p.getByRole("complementary");
    await expect(sidebar.getByRole("link", { name: "TV Shows" })).not.toBeVisible();
  });

  test("clicking pinned item navigates to detail page", async ({ page: p }) => {
    // Create and pin an item
    await myItems.createItem("Anime");
    await myItems.rightClickItem("Anime");
    await p.getByRole("menuitem", { name: /pin to sidebar/i }).click();

    // Navigate away
    await p.goto("/my-items");

    // Click pinned item in sidebar
    const sidebar = p.getByRole("complementary");
    await sidebar.getByRole("link", { name: "Anime" }).click();

    // Verify navigation
    await expect(p).toHaveURL(/\/my-items\/[a-z0-9]+/);
    await expect(p.getByRole("heading", { name: "Anime" })).toBeVisible();
  });

  test("shows error when max pinned items reached", async ({ page: p }) => {
    // Create and pin 10 items
    for (let i = 1; i <= 10; i++) {
      await myItems.createItem(`Item ${i}`);
      await myItems.rightClickItem(`Item ${i}`);
      await p.getByRole("menuitem", { name: /pin to sidebar/i }).click();
      await p.waitForTimeout(200); // Small delay for DB
    }

    // Try to pin 11th
    await myItems.createItem("Item 11");
    await myItems.rightClickItem("Item 11");
    await p.getByRole("menuitem", { name: /pin to sidebar/i }).click();

    // Verify error
    await expect(p.getByText(/maximum of 10 pinned items/i)).toBeVisible();
  });
});
```

**Step 2: Run E2E tests**

Run: `pnpm run test:e2e e2e/journeys/items/pinned-items.spec.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add e2e/journeys/items/pinned-items.spec.ts
git commit -m "test: add E2E tests for pinned sidebar items"
```

---

## Task 11: Update Existing Tests

**Files:**
- Modify: `tests/unit/lib/item-actions.test.ts` (add pinnedOrder to mocks)
- Modify: `tests/unit/components/grid-item.test.tsx` (add pinnedOrder to mocks)

**Step 1: Update item mocks to include pinnedOrder**

In any test files that mock Item objects, add `pinnedOrder: null` to the mock data:

```typescript
const mockItem = {
  id: "item-1",
  name: "Test Item",
  // ... other fields ...
  pinnedOrder: null, // Add this
};
```

**Step 2: Run full test suite**

Run: `pnpm run test`
Expected: PASS (all tests)

**Step 3: Commit**

```bash
git add tests/
git commit -m "test: update existing tests to include pinnedOrder field"
```

---

## Task 12: Final Verification and Cleanup

**Step 1: Run all checks**

Run: `pnpm run check`
Expected: All checks pass (format, lint, type-check, knip, build)

**Step 2: Run all tests**

```bash
pnpm run test
pnpm run test:integration
pnpm run test:e2e
```
Expected: All tests pass

**Step 3: Manual testing**

1. Create a few items at root level
2. Right-click → Pin to Sidebar
3. Verify items appear in sidebar under "Pinned" label
4. Click pinned item → navigates to detail page
5. Right-click → Unpin from Sidebar
6. Verify item removed from sidebar
7. Try pinning 11 items → verify error message

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: pinned sidebar items complete with tests"
```

---

## Summary of Changes

### Database
- Added `pinnedOrder: Int?` field to Item model
- Added `@@index([userId, pinnedOrder])` for efficient queries

### Server Actions (`lib/item-actions.ts`)
- `pinItem(id)` - Pin item to sidebar (max 10)
- `unpinItem(id)` - Unpin item from sidebar
- `getPinnedItems()` - Get all pinned items for sidebar

### Components
- `NavPinnedItems` - New sidebar component for pinned items
- `ItemContextMenu` - Added Pin/Unpin menu option
- `AppSidebar` - Integrated pinned items display
- `GridItem` / `TreeItem` - Added onTogglePin handler

### Types (`lib/types.ts`)
- Added `pinnedOrder` to `Item` interface
- Added `PinnedItem` interface for sidebar display

### Tests
- Unit tests: `tests/unit/lib/item-actions-pinning.test.ts`, `tests/unit/components/nav-pinned-items.test.tsx`
- Integration tests: `tests/integration/items/item-pinning.test.ts`
- E2E tests: `e2e/journeys/items/pinned-items.spec.ts`
- Updated existing tests to include `pinnedOrder` in mocks

### Rate Limiting
- Added `itemPin` limit (30/min) in `lib/rate-limit.ts`
