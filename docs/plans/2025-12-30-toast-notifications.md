# Toast Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add toast notifications for all success and error messages across the platform using sonner.

**Architecture:** Use shadcn's sonner integration for consistent toast styling. Add Toaster to root layout. Update all item CRUD operations (create, rename, delete) to show success/error toasts. Remove inline error handling from AddItemButton. Update E2E tests to verify toast messages.

**Tech Stack:** sonner, shadcn/ui, Playwright for E2E, Vitest for unit tests

---

## Task 1: Install Sonner via shadcn

**Files:**

- Create: `components/ui/sonner.tsx`
- Modify: `package.json` (auto-updated by shadcn)

**Step 1: Run shadcn add sonner**

Run:

```bash
pnpm dlx shadcn@latest add sonner
```

Expected: Creates `components/ui/sonner.tsx` and adds sonner dependency

**Step 2: Verify the sonner component exists**

Run:

```bash
cat components/ui/sonner.tsx
```

Expected: File contains Toaster component export

**Step 3: Commit**

```bash
git add components/ui/sonner.tsx package.json pnpm-lock.yaml
git commit -m "feat: add sonner toast component via shadcn"
```

---

## Task 2: Add Toaster to Root Layout

**Files:**

- Modify: `app/layout.tsx`

**Step 1: Update root layout to include Toaster**

```tsx
/**
 * Root layout for the entire application.
 * Sets up fonts, session provider, toast notifications, and analytics.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "CanonCore",
  description: "CanonCore Dashboard",
};

/**
 * Wraps all pages with HTML structure, fonts, session context, and toast provider.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>{children}</SessionProvider>
        <Toaster position="bottom-right" richColors closeButton />
        <Analytics />
      </body>
    </html>
  );
}
```

**Step 2: Verify app builds successfully**

Run:

```bash
pnpm run build
```

Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add toast provider to root layout"
```

---

## Task 3: Update ItemsView to Use Toasts

**Files:**

- Modify: `components/items/items-view.tsx`

**Step 1: Add toast imports and update handlers**

```tsx
/**
 * Client-side items view with tree/grid toggle and drag-drop support.
 * Handles all item CRUD operations and reordering with toast notifications.
 */

"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconFolder, IconHome } from "@tabler/icons-react";
import { UniqueIdentifier } from "@dnd-kit/core";
import { toast } from "sonner";

import { SortableTree } from "@/components/sortable-tree";
import { SortableGrid } from "@/components/sortable-grid";
import { ViewToggle } from "./view-toggle";
import { AddItemButton } from "./add-item-button";
import type { Item, TreeItems } from "@/lib/types";
import { itemsToTree, treeToItemUpdates } from "@/lib/item-utils";
import {
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
} from "@/lib/item-actions";
import { cn } from "@/lib/utils";
```

**Step 2: Update handleCreateItem to show toasts**

```tsx
// Handle creating new item at root level
const handleCreateItem = useCallback(
  async (name: string): Promise<void> => {
    const result = await createItem(parentId, name);
    if (result.success && result.data) {
      const newItem = result.data;
      setItems((prev) => [...prev, newItem]);
      startTransition(() => refetchItems());
      toast.success(`Folder "${name}" created`);
    } else {
      toast.error(result.error || "Failed to create folder");
    }
  },
  [parentId, refetchItems]
);
```

**Step 3: Update handleRenameItem to show toasts**

```tsx
// Handle renaming an item
const handleRenameItem = useCallback(
  async (id: string, newName: string) => {
    const result = await updateItem(id, { name: newName });
    if (result.success) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, name: newName } : item))
      );
      startTransition(() => refetchItems());
      toast.success(`Folder renamed to "${newName}"`);
    } else {
      toast.error(result.error || "Failed to rename folder");
    }
  },
  [refetchItems]
);
```

**Step 4: Update handleDeleteItem to show toasts**

```tsx
// Handle deleting an item
const handleDeleteItem = useCallback(
  async (id: string) => {
    const result = await deleteItem(id);
    if (result.success) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      startTransition(() => refetchItems());
      toast.success("Folder deleted");
    } else {
      toast.error(result.error || "Failed to delete folder");
    }
  },
  [refetchItems]
);
```

**Step 5: Update handleAddChild to show toasts**

```tsx
// Handle adding child item
const handleAddChild = useCallback(
  async (parentItemId: string, name: string): Promise<void> => {
    const result = await createItem(parentItemId, name);
    if (result.success && result.data) {
      const newItem = result.data;
      setItems((prev) => [...prev, newItem]);
      startTransition(() => refetchItems());
      toast.success(`Subfolder "${name}" created`);
    } else {
      toast.error(result.error || "Failed to create subfolder");
    }
  },
  [refetchItems]
);
```

**Step 6: Update EmptyState props type**

```tsx
// Empty state component
function EmptyState({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  // ... rest unchanged
}
```

**Step 7: Verify type-check passes**

Run:

```bash
pnpm run type-check
```

Expected: No type errors

**Step 8: Commit**

```bash
git add components/items/items-view.tsx
git commit -m "feat: add toast notifications to item operations"
```

---

## Task 4: Simplify AddItemButton (Remove Inline Error Handling)

**Files:**

- Modify: `components/items/add-item-button.tsx`

**Step 1: Update AddItemButton to use simple void callback**

```tsx
/**
 * Inline add item button with expandable input field.
 * Smooth expand/collapse animation with refined interactions.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AddItemButtonProps {
  onAdd(name: string): Promise<void>;
  placeholder?: string;
  className?: string;
}

/**
 * Expandable button that reveals an input field for creating new items.
 * Closes on click outside or escape key.
 */
export function AddItemButton({
  onAdd,
  placeholder = "Folder name...",
  className,
}: AddItemButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (isOpen && !isLoading) {
          setIsOpen(false);
          setName("");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isLoading]);

  async function handleSubmit() {
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      await onAdd(name.trim());
      setName("");
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setName("");
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        {isOpen ? (
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              className="h-9 w-48 min-w-0"
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!name.trim() || isLoading}
              className="h-9 shrink-0"
            >
              {isLoading ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                "Add"
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsOpen(false);
                setName("");
              }}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground size-9 shrink-0"
            >
              <IconX className="size-4" strokeWidth={2} />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="gap-1.5"
          >
            <IconPlus className="size-4" strokeWidth={2} />
            <span>Add Folder</span>
          </Button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify type-check passes**

Run:

```bash
pnpm run type-check
```

Expected: No type errors

**Step 3: Commit**

```bash
git add components/items/add-item-button.tsx
git commit -m "refactor: simplify AddItemButton, remove inline error handling"
```

---

## Task 5: Add Toast Helper to E2E Page Object

**Files:**

- Modify: `e2e/pages/items.page.ts`

**Step 1: Add toast locators and methods**

Add after the constructor locators:

```ts
readonly toastContainer: Locator;
readonly toastMessage: Locator;

// In constructor:
this.toastContainer = page.locator('[data-sonner-toaster]');
this.toastMessage = page.locator('[data-sonner-toast]');
```

**Step 2: Add toast assertion methods**

```ts
/**
 * Waits for a success toast with the given message.
 *
 * @param message - Text to match in the toast
 */
async expectSuccessToast(message: string | RegExp): Promise<void> {
  const toast = this.page.locator('[data-sonner-toast][data-type="success"]');
  if (typeof message === "string") {
    await expect(toast.getByText(message, { exact: false })).toBeVisible({
      timeout: 5000,
    });
  } else {
    await expect(toast.getByText(message)).toBeVisible({ timeout: 5000 });
  }
}

/**
 * Waits for an error toast with the given message.
 *
 * @param message - Text to match in the toast
 */
async expectErrorToast(message: string | RegExp): Promise<void> {
  const toast = this.page.locator('[data-sonner-toast][data-type="error"]');
  if (typeof message === "string") {
    await expect(toast.getByText(message, { exact: false })).toBeVisible({
      timeout: 5000,
    });
  } else {
    await expect(toast.getByText(message)).toBeVisible({ timeout: 5000 });
  }
}

/**
 * Dismisses all visible toasts by clicking close buttons.
 */
async dismissToasts(): Promise<void> {
  const closeButtons = this.page.locator(
    '[data-sonner-toast] button[aria-label="Close toast"]'
  );
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    await closeButtons.nth(i).click();
  }
}
```

**Step 3: Update createItem to NOT wait for visibility (toast handles feedback)**

```ts
async createItem(name: string) {
  await this.addItemButton.click();
  await expect(this.addItemInput).toBeVisible({ timeout: 5000 });
  await this.addItemInput.fill(name);
  await expect(this.addItemSubmit).toBeEnabled({ timeout: 2000 });
  await this.addItemSubmit.click();
  // Wait for input to close (indicates submission complete)
  await expect(this.addItemInput).not.toBeVisible({ timeout: 5000 });
}
```

**Step 4: Remove createItemExpectError (no longer needed)**

Delete the `createItemExpectError` method as toasts handle errors now.

**Step 5: Commit**

```bash
git add e2e/pages/items.page.ts
git commit -m "feat: add toast assertion helpers to items page object"
```

---

## Task 6: Update items-crud.spec.ts to Verify Toasts

**Files:**

- Modify: `e2e/journeys/items/items-crud.spec.ts`

**Step 1: Update tests to verify success toasts**

```ts
/**
 * E2E tests for items CRUD operations.
 * Tests create, rename, and delete folder functionality with toast feedback.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Items CRUD Journey", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("items-crud");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("shows empty state when no items exist", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.expectEmptyState();
  });

  test("can create a new folder with success toast", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("My First Folder");
    await itemsPage.expectSuccessToast('Folder "My First Folder" created');
    await itemsPage.expectItemVisible("My First Folder");
  });

  test("can rename a folder via context menu with success toast", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Original Name");
    await itemsPage.dismissToasts();
    await itemsPage.renameItemViaContextMenu("Original Name", "Renamed Folder");
    await itemsPage.expectSuccessToast('Folder renamed to "Renamed Folder"');
    await itemsPage.expectItemVisible("Renamed Folder");
    await itemsPage.expectItemNotVisible("Original Name");
  });

  test("can delete a folder via context menu with success toast", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("To Delete");
    await itemsPage.dismissToasts();
    await itemsPage.deleteItemViaContextMenu("To Delete");
    await itemsPage.expectSuccessToast("Folder deleted");
    await itemsPage.expectItemNotVisible("To Delete");
  });
});
```

**Step 2: Run E2E tests to verify**

Run:

```bash
BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium e2e/journeys/items/items-crud.spec.ts
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add e2e/journeys/items/items-crud.spec.ts
git commit -m "test: add toast verification to items CRUD E2E tests"
```

---

## Task 7: Update items-max-depth.spec.ts for Toast Errors

**Files:**

- Modify: `e2e/journeys/items/items-max-depth.spec.ts`

**Step 1: Update max depth test to verify error toast**

Update the "cannot create folder beyond max depth via UI" test:

```ts
test("cannot create folder beyond max depth via UI", async ({
  page,
  signUpPage,
  itemsPage,
}) => {
  test.setTimeout(120000);

  const email = generateUniqueEmail("items-max-depth");
  await signUpPage.goto();
  await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
  await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  await itemsPage.goto();

  // Create 9 levels of nesting (depth 0-8)
  for (let i = 1; i <= 9; i++) {
    await itemsPage.createItem(`Level ${i}`);
    await itemsPage.dismissToasts();
    await itemsPage.clickItem(`Level ${i}`);
    await expect(page).toHaveURL(/\/dashboard\/[\w-]+/, { timeout: 5000 });
  }

  // Now at depth 8, create level 9 (depth 9 - the max allowed)
  await itemsPage.createItem("Level 9");
  await itemsPage.expectSuccessToast('Folder "Level 9" created');
  await itemsPage.dismissToasts();
  await itemsPage.clickItem("Level 9");
  await expect(page).toHaveURL(/\/dashboard\/[\w-]+/, { timeout: 5000 });

  // Now at depth 9 (max), try to create level 10 - should show error toast
  await itemsPage.createItem("Level 10");
  await itemsPage.expectErrorToast("Maximum nesting depth reached");

  // Level 10 should NOT be visible in list
  await itemsPage.expectItemNotVisible("Level 10");
});
```

**Step 2: Run the test**

Run:

```bash
BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium e2e/journeys/items/items-max-depth.spec.ts
```

Expected: All 4 tests pass

**Step 3: Commit**

```bash
git add e2e/journeys/items/items-max-depth.spec.ts
git commit -m "test: update max depth test to verify error toast"
```

---

## Task 8: Run Full E2E Test Suite

**Step 1: Run all items E2E tests**

Run:

```bash
BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium --project=mobile-chrome e2e/journeys/items/
```

Expected: All tests pass for both chromium and mobile-chrome

**Step 2: Run full check suite**

Run:

```bash
pnpm run check
```

Expected: All checks pass (format, lint, type-check, knip, build)

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete toast notification implementation

- Add sonner toast component via shadcn
- Add Toaster to root layout
- Update all item operations with success/error toasts
- Update E2E tests to verify toast messages
- Remove inline error handling from AddItemButton"
```

---

## Summary

| Task | Files Modified                               | Tests Updated           |
| ---- | -------------------------------------------- | ----------------------- |
| 1    | `components/ui/sonner.tsx`                   | -                       |
| 2    | `app/layout.tsx`                             | -                       |
| 3    | `components/items/items-view.tsx`            | -                       |
| 4    | `components/items/add-item-button.tsx`       | -                       |
| 5    | `e2e/pages/items.page.ts`                    | -                       |
| 6    | `e2e/journeys/items/items-crud.spec.ts`      | 4 E2E tests             |
| 7    | `e2e/journeys/items/items-max-depth.spec.ts` | 1 E2E test              |
| 8    | -                                            | Full suite verification |

**Toast Messages:**

- Create: `Folder "{name}" created` (success) / error message (error)
- Rename: `Folder renamed to "{name}"` (success) / error message (error)
- Delete: `Folder deleted` (success) / error message (error)
- Add Child: `Subfolder "{name}" created` (success) / error message (error)
