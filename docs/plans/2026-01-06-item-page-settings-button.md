# Item Page Settings Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Settings button to item detail pages that opens the ItemSettingsDialog for the current item.

**Architecture:** Create a new `ItemPageActions` client component that renders a consistent action bar on all item detail page layouts. This component handles Settings button, Sync button (when SFTP connected), and manages the ItemSettingsDialog with proper page refresh after mutations.

**Tech Stack:** React, TypeScript, Next.js App Router, shadcn/ui Button, existing ItemSettingsDialog

---

## Task 1: Create ItemPageActions Component

**Files:**

- Create: `components/items/item-page-actions.tsx`

**Step 1: Create the component file**

```typescript
/**
 * Page-level action bar for item detail pages.
 * Provides Settings button and optional Sync button.
 * Handles dialog state and page refresh after mutations.
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemSettingsDialog } from "./item-settings-dialog";
import { ItemSyncButton } from "@/components/sftp";
import { updateItem } from "@/lib/item-actions";
import { getItemFiles } from "@/lib/item-file-actions";
import type { SerializedItemFile } from "@/lib/types";
import { toast } from "sonner";

interface ItemPageActionsProps {
  /** The current item being viewed. */
  item: {
    id: string;
    name: string;
    description: string | null;
  };
  /** Number of child items for stats display. */
  childCount?: number;
  /** Whether item is connected to SFTP (shows Sync button). */
  isSftpConnected?: boolean;
}

/**
 * Action bar for item detail pages with Settings and optional Sync.
 * Manages ItemSettingsDialog and refreshes page after mutations.
 *
 * @param item - Current item metadata
 * @param childCount - Number of child items
 * @param isSftpConnected - Whether to show Sync button
 */
export function ItemPageActions({
  item,
  childCount = 0,
  isSftpConnected = false,
}: ItemPageActionsProps) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [files, setFiles] = useState<{
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  }>({ media: [], artwork: [], subtitles: [] });

  // Fetch files when opening settings
  const handleOpenSettings = useCallback(async () => {
    setSettingsOpen(true);
    const result = await getItemFiles(item.id);
    if (result.success && result.data) {
      setFiles(result.data);
    }
  }, [item.id]);

  // Rename handler with page refresh
  const handleRename = useCallback(
    async (newName: string) => {
      const result = await updateItem(item.id, { name: newName });
      if (result.success) {
        toast.success("Item renamed");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to rename");
        throw new Error(result.error);
      }
    },
    [item.id, router]
  );

  // Description handler with page refresh
  const handleDescriptionChange = useCallback(
    async (description: string) => {
      const result = await updateItem(item.id, {
        description: description || null,
      });
      if (result.success) {
        toast.success("Description updated");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update description");
        throw new Error(result.error);
      }
    },
    [item.id, router]
  );

  // Refresh files after primary file change
  const handleSettingsChange = useCallback(async () => {
    const result = await getItemFiles(item.id);
    if (result.success && result.data) {
      setFiles(result.data);
    }
  }, [item.id]);

  return (
    <>
      <div className="flex items-center justify-end gap-3">
        {isSftpConnected && (
          <ItemSyncButton
            itemId={item.id}
            itemName={item.name}
            size="sm"
            onSyncComplete={() => router.refresh()}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenSettings}
          aria-label="Item Settings"
          className="gap-1.5"
        >
          <Settings2 className="size-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </div>

      <ItemSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        item={item}
        files={files}
        childCount={childCount}
        onRename={handleRename}
        onDescriptionChange={handleDescriptionChange}
        onSettingsChange={handleSettingsChange}
      />
    </>
  );
}
```

**Step 2: Export from index**

Add to `components/items/index.ts`:

```typescript
export { ItemPageActions } from "./item-page-actions";
```

---

## Task 2: Update Item Detail Page

**Files:**

- Modify: `app/(my-items)/my-items/[itemId]/page.tsx`

**Step 1: Import ItemPageActions**

```typescript
import { ItemsView, ItemDetail, ItemPageActions } from "@/components/items";
```

**Step 2: Remove standalone ItemSyncButton import** (now inside ItemPageActions)

**Step 3: Update "no files" layout (~line 67)**

Add ItemPageActions above ItemsView:

```tsx
if (!hasFiles) {
  return (
    <>
      <SiteHeader
        title="My Items"
        titleHref="/my-items"
        breadcrumbs={breadcrumbs}
      />
      <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <ItemPageActions
          item={{
            id: item.id,
            name: item.name,
            description: item.description,
          }}
          childCount={childItems.length}
          isSftpConnected={isSftpConnected}
        />
        <ItemsView
          items={childItems}
          parentId={itemId}
          currentConnection={item.connection}
        />
      </div>
    </>
  );
}
```

**Step 4: Update "files only" layout (~line 92)**

Replace standalone ItemSyncButton with ItemPageActions:

```tsx
if (!hasChildren) {
  return (
    <>
      <SiteHeader
        title="My Items"
        titleHref="/my-items"
        breadcrumbs={breadcrumbs}
      />
      <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <ItemPageActions
          item={{
            id: item.id,
            name: item.name,
            description: item.description,
          }}
          childCount={0}
          isSftpConnected={isSftpConnected}
        />
        <ItemDetail item={item} files={files} />
      </div>
    </>
  );
}
```

**Step 5: Update "both" layout with tabs (~line 113)**

Add ItemPageActions before Tabs:

```tsx
return (
  <>
    <SiteHeader
      title="My Items"
      titleHref="/my-items"
      breadcrumbs={breadcrumbs}
    />
    <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
      <ItemPageActions
        item={{
          id: item.id,
          name: item.name,
          description: item.description,
        }}
        childCount={childItems.length}
        isSftpConnected={isSftpConnected}
      />
      <Tabs defaultValue="files" className="w-full">
        {/* ... existing tabs content ... */}
      </Tabs>
    </div>
  </>
);
```

**Step 6: Remove itemSyncProps from ItemsView calls**

The ItemPageActions now handles sync, so remove `itemSyncProps` prop from ItemsView.

---

## Task 3: Unit Tests

**Files:**

- Create: `tests/unit/components/items/item-page-actions.test.tsx`

**Step 1: Create test file**

```typescript
/**
 * Unit tests for ItemPageActions component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemPageActions } from "@/components/items/item-page-actions";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Mock server actions
vi.mock("@/lib/item-actions", () => ({
  updateItem: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/item-file-actions", () => ({
  getItemFiles: vi.fn().mockResolvedValue({
    success: true,
    data: { media: [], artwork: [], subtitles: [] },
  }),
}));

describe("ItemPageActions", () => {
  const defaultItem = {
    id: "item-1",
    name: "Test Item",
    description: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render Settings button", () => {
    render(<ItemPageActions item={defaultItem} />);
    expect(
      screen.getByRole("button", { name: "Item Settings" })
    ).toBeInTheDocument();
  });

  it("should not render Sync button when not SFTP connected", () => {
    render(<ItemPageActions item={defaultItem} isSftpConnected={false} />);
    expect(screen.queryByText(/sync/i)).not.toBeInTheDocument();
  });

  it("should render Sync button when SFTP connected", () => {
    render(<ItemPageActions item={defaultItem} isSftpConnected={true} />);
    expect(screen.getByRole("button", { name: /sync/i })).toBeInTheDocument();
  });

  it("should open settings dialog when Settings clicked", async () => {
    const user = userEvent.setup();
    render(<ItemPageActions item={defaultItem} />);

    await user.click(screen.getByRole("button", { name: "Item Settings" }));

    expect(
      screen.getByRole("dialog", { name: /item settings/i })
    ).toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

```bash
pnpm run test:unit -- tests/unit/components/items/item-page-actions.test.tsx
```

---

## Task 4: E2E Tests

**Files:**

- Create: `e2e/journeys/items/items-settings.spec.ts`

**Step 1: Create E2E test file**

```typescript
/**
 * E2E tests for item page Settings button.
 * Tests Settings button visibility and functionality across all page layouts.
 */

import { test, expect } from "../../fixtures";

test.describe("Item Page Settings Button", () => {
  test("should show Settings button on item detail page (no files)", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Test Item");
    await itemsPage.clickItem("Test Item");

    await expect(
      itemsPage.page.getByRole("button", { name: "Item Settings" })
    ).toBeVisible();
  });

  test("should NOT show Settings button on root my-items page", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Test Item");

    // On root page, no Settings button
    await expect(
      itemsPage.page.getByRole("button", { name: "Item Settings" })
    ).not.toBeVisible();
  });

  test("should open settings dialog and show item name", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("My Test Item");
    await itemsPage.clickItem("My Test Item");

    await itemsPage.page.getByRole("button", { name: "Item Settings" }).click();

    const dialog = itemsPage.page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Name")).toHaveValue("My Test Item");
  });

  test("should update item name and refresh breadcrumbs", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Original Name");
    await itemsPage.clickItem("Original Name");

    // Open settings
    await itemsPage.page.getByRole("button", { name: "Item Settings" }).click();

    // Edit name
    const nameInput = itemsPage.page.getByLabel("Name");
    await nameInput.clear();
    await nameInput.fill("Updated Name");
    await itemsPage.page.getByRole("button", { name: "Save" }).first().click();

    // Wait for toast and verify breadcrumb updated
    await expect(itemsPage.page.getByText("Item renamed")).toBeVisible();
    await expect(
      itemsPage.page.getByRole("link", { name: "Updated Name" })
    ).toBeVisible();
  });

  test("should update item description", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Test Item");
    await itemsPage.clickItem("Test Item");

    await itemsPage.page.getByRole("button", { name: "Item Settings" }).click();

    // Add description
    const descInput = itemsPage.page.getByLabel("Description");
    await descInput.fill("A short description");
    await itemsPage.page.getByRole("button", { name: "Save" }).last().click();

    await expect(itemsPage.page.getByText("Description updated")).toBeVisible();
  });
});
```

**Step 2: Run E2E tests**

```bash
pnpm run test:e2e --project=chromium -g "Item Page Settings"
```

---

## Task 5: Verification

**Step 1: Run all checks**

```bash
pnpm run check
```

**Step 2: Manual verification**

Test all three page layouts:

1. **Root page** (`/my-items`):
   - Settings button should NOT appear

2. **Item with children only** (no files):
   - Navigate to item → Settings button visible
   - Click Settings → dialog opens
   - Edit name → breadcrumb updates

3. **Item with files only** (no children):
   - Settings button visible above ItemDetail
   - All settings functionality works

4. **Item with both files and children**:
   - Settings button visible above Tabs
   - Works in both tabs

---

## Summary

| Change                           | File                                                     |
| -------------------------------- | -------------------------------------------------------- |
| Create ItemPageActions component | `components/items/item-page-actions.tsx`                 |
| Export component                 | `components/items/index.ts`                              |
| Use in all page layouts          | `app/(my-items)/my-items/[itemId]/page.tsx`              |
| Unit tests                       | `tests/unit/components/items/item-page-actions.test.tsx` |
| E2E tests                        | `e2e/journeys/items/items-settings.spec.ts`              |

## Validation Notes

This design was validated using:

- **code-review-excellence skill**: Checklist-based review
- **sequential-thinking MCP**: Systematic issue identification
- **context7 MCP**: Next.js best practices for `router.refresh()` vs `revalidatePath()`

Key fixes from validation:

1. Created dedicated `ItemPageActions` component (not modifying ItemsView)
2. Component appears in ALL three page layouts
3. Uses `router.refresh()` after mutations to update breadcrumbs
4. Dedicated handlers that call `updateItem` directly (not child item handlers)
