# Google Drive Links Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visible Google Drive links so users can verify sync and access files directly in Drive.

**Architecture:** Add "Open in Google Drive" links at three levels: (1) CanonCore root folder in Settings, (2) individual items via context menu, and (3) individual files in the settings dialog. Use existing `driveFileId` stored on Item and ItemFile models.

**Tech Stack:** React, shadcn/ui, lucide-react icons

---

## Problem Analysis

**User Issue:** After connecting Google Drive and creating folders, user cannot see the CanonCore folder or verify sync is working.

**Root Causes:**

1. No visible Drive links anywhere in the UI
2. Settings only shows email and last sync time, not folder location
3. No "Open in Drive" options in context menu or settings dialog

**Solution:** Add Drive links at three touch points:

1. Settings dialog → Link to CanonCore root folder
2. Item context menu → "Open in Google Drive" option
3. File combobox → Drive link icon per file

---

## Task 1: Add rootFolderId to Data Source (PREREQUISITE)

**Files:**

- Modify: `lib/google-drive-actions.ts` (add rootFolderId to select in getGoogleDriveConnection)

**Problem:** The `getGoogleDriveConnection()` function does NOT include `rootFolderId` in its select statement. Without this fix, the interfaces can be updated but the data won't be returned from the database.

**Step 1: Verify the current select statement**

Read `lib/google-drive-actions.ts` and find the `getGoogleDriveConnection()` function (around line 147-168). Note that `rootFolderId` is missing from the select.

**Step 2: Add rootFolderId to the select**

Modify `lib/google-drive-actions.ts` - add `rootFolderId: true` to the select object:

```typescript
export async function getGoogleDriveConnection() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  return prisma.googleDriveConnection.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      rootFolderId: true, // ADD THIS LINE
      isActive: true,
      needsReauth: true,
      lastSyncAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
```

**Step 3: Run type-check to verify**

Run: `pnpm run type-check`

Expected: PASS (no errors)

**Step 4: Commit**

```bash
git add lib/google-drive-actions.ts
git commit -m "fix(drive): include rootFolderId in getGoogleDriveConnection select

Required for displaying Drive folder links in UI.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Add Drive Folder Link to Settings Section

**Files:**

- Modify: `components/nav-user.tsx` (add rootFolderId to interface)
- Modify: `components/profile/settings-dialog.tsx` (add rootFolderId to interface)
- Modify: `components/google-drive/settings-section.tsx` (add link)
- Create: `tests/unit/components/google-drive/settings-section.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/google-drive/settings-section.test.tsx`:

```tsx
/**
 * Unit tests for GoogleDriveSettingsSection component.
 * Tests Drive link display and connection status.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoogleDriveSettingsSection } from "@/components/google-drive/settings-section";

vi.mock("@/lib/google-drive-actions", () => ({
  initiateGoogleDriveOAuth: vi.fn(),
  disconnectGoogleDrive: vi.fn(),
}));

describe("GoogleDriveSettingsSection", () => {
  const mockConnection = {
    email: "test@gmail.com",
    rootFolderId: "folder-abc123",
    isActive: true,
    needsReauth: false,
    lastSyncAt: new Date("2026-01-10T12:00:00Z"),
    lastError: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Drive Folder Link", () => {
    it("should display Open in Drive link when connected with rootFolderId", () => {
      render(
        <GoogleDriveSettingsSection
          connection={mockConnection}
          onConnectionChange={vi.fn()}
        />
      );

      const driveLink = screen.getByRole("link", { name: /open in drive/i });
      expect(driveLink).toBeInTheDocument();
      expect(driveLink).toHaveAttribute(
        "href",
        "https://drive.google.com/drive/folders/folder-abc123"
      );
      expect(driveLink).toHaveAttribute("target", "_blank");
      expect(driveLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should not display Drive link when not connected", () => {
      render(
        <GoogleDriveSettingsSection
          connection={null}
          onConnectionChange={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("link", { name: /open in drive/i })
      ).not.toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/components/google-drive/settings-section.test.tsx`

Expected: FAIL - rootFolderId not in interface, no link rendered

**Step 3: Add rootFolderId to interfaces**

Update `components/nav-user.tsx` interface:

```tsx
interface GoogleDriveConnection {
  email: string;
  rootFolderId: string | null; // Add this
  isActive: boolean;
  needsReauth: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
}
```

Update `components/profile/settings-dialog.tsx` interface:

```tsx
interface GoogleDriveConnection {
  email: string;
  rootFolderId: string | null; // Add this
  isActive: boolean;
  needsReauth: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
}
```

Update `components/google-drive/settings-section.tsx` interface:

```tsx
interface GoogleDriveConnection {
  email: string;
  rootFolderId: string | null; // Add this
  isActive: boolean;
  needsReauth: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
}
```

**Step 4: Add Drive link to settings section**

Modify `components/google-drive/settings-section.tsx`:

```tsx
// ExternalLink is already imported, verify it's there

// Add after the lastSyncAt paragraph, before lastError:
{
  connection.rootFolderId && (
    <a
      href={`https://drive.google.com/drive/folders/${connection.rootFolderId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
    >
      <ExternalLink className="h-3 w-3" />
      Open in Drive
    </a>
  );
}
```

**Step 5: Update data source to include rootFolderId**

Find where driveConnection is fetched (likely in a layout or page) and ensure `rootFolderId` is selected from the database.

**Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/components/google-drive/settings-section.test.tsx`

Expected: PASS

**Step 7: Commit**

```bash
git add components/nav-user.tsx components/profile/settings-dialog.tsx components/google-drive/settings-section.tsx tests/unit/components/google-drive/settings-section.test.tsx
git commit -m "feat(drive): add Open in Drive link to settings section

- Display link to CanonCore root folder when connected
- Add rootFolderId to GoogleDriveConnection interfaces
- Opens in new tab with security attributes

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add "Open in Google Drive" to Item Context Menu

**Files:**

- Modify: `components/items/item-context-menu.tsx`
- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Modify: `components/sortable-grid/GridItem.tsx`
- Create: `tests/unit/components/items/item-context-menu.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/items/item-context-menu.test.tsx`:

```tsx
/**
 * Unit tests for ItemContextMenu component.
 * Tests context menu options including Drive link.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemContextMenu } from "@/components/items/item-context-menu";

vi.mock("@/lib/item-actions", () => ({
  deleteItem: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ItemContextMenu", () => {
  const defaultProps = {
    itemId: "item-1",
    itemName: "Test Item",
    driveFileId: null as string | null,
    onOpenSettings: vi.fn(),
    onAddChild: vi.fn(),
    onDeleted: vi.fn(),
    children: <button>Trigger</button>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Open in Drive option", () => {
    it("should show Open in Drive when item has driveFileId", async () => {
      const user = userEvent.setup();
      render(
        <ItemContextMenu {...defaultProps} driveFileId="drive-folder-123" />
      );

      await user.click(screen.getByRole("button", { name: /trigger/i }));

      const driveOption = screen.getByRole("menuitem", {
        name: /open in drive/i,
      });
      expect(driveOption).toBeInTheDocument();
    });

    it("should not show Open in Drive when item has no driveFileId", async () => {
      const user = userEvent.setup();
      render(<ItemContextMenu {...defaultProps} driveFileId={null} />);

      await user.click(screen.getByRole("button", { name: /trigger/i }));

      expect(
        screen.queryByRole("menuitem", { name: /open in drive/i })
      ).not.toBeInTheDocument();
    });

    it("should have correct Drive folder link href", async () => {
      const user = userEvent.setup();
      render(
        <ItemContextMenu {...defaultProps} driveFileId="drive-folder-123" />
      );

      await user.click(screen.getByRole("button", { name: /trigger/i }));

      const link = screen.getByRole("link", { name: /open in drive/i });
      expect(link).toHaveAttribute(
        "href",
        "https://drive.google.com/drive/folders/drive-folder-123"
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/components/items/item-context-menu.test.tsx`

Expected: FAIL - driveFileId prop doesn't exist

**Step 3: Add driveFileId prop and Drive menu item**

Modify `components/items/item-context-menu.tsx`:

```tsx
// Add to imports
import { ExternalLink } from "lucide-react";

// Update props interface - add driveFileId
interface ItemContextMenuProps {
  itemId: string;
  itemName: string;
  driveFileId: string | null;  // Add this
  onOpenSettings: () => void;
  onAddChild: () => void;
  onDeleted: () => void;
  children: React.ReactNode;
}

// Add to function params
export function ItemContextMenu({
  itemId,
  itemName,
  driveFileId,  // Add this
  onOpenSettings,
  onAddChild,
  onDeleted,
  children,
}: ItemContextMenuProps) {

// Add menu item after Settings, before separator/Add Child:
{driveFileId && (
  <ContextMenuItem asChild>
    <a
      href={`https://drive.google.com/drive/folders/${driveFileId}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      Open in Drive
    </a>
  </ContextMenuItem>
)}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/components/items/item-context-menu.test.tsx`

Expected: PASS

**Step 5: Update TreeItem to pass driveFileId**

Modify `components/sortable-tree/components/TreeItem/TreeItem.tsx`:

```tsx
// Find the ItemContextMenu usage and add driveFileId prop:
<ItemContextMenu
  itemId={item.id}
  itemName={item.name}
  driveFileId={item.driveFileId}  // Add this
  onOpenSettings={...}
  onAddChild={...}
  onDeleted={...}
>
```

**Step 6: Update GridItem to pass driveFileId**

Modify `components/sortable-grid/GridItem.tsx` similarly.

**Step 7: Commit**

```bash
git add components/items/item-context-menu.tsx components/sortable-tree/components/TreeItem/TreeItem.tsx components/sortable-grid/GridItem.tsx tests/unit/components/items/item-context-menu.test.tsx
git commit -m "feat(drive): add Open in Drive to item context menu

- Show option only for items with driveFileId
- Opens folder in new tab
- Pass driveFileId from TreeItem and GridItem

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Add Drive Link Icon to File Combobox

**Files:**

- Modify: `components/items/file-type-combobox.tsx`
- Modify: `tests/unit/components/items/file-type-combobox.test.tsx`

**Step 1: Write the failing test**

Add to `tests/unit/components/items/file-type-combobox.test.tsx`:

```tsx
describe("Drive Link", () => {
  it("should show Drive link icon for synced files", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const files = [
      createMockFile({
        id: "m1",
        filename: "movie.mp4",
        isPrimary: true,
        driveFileId: "drive-file-123",
      }),
    ];
    render(<FileTypeCombobox {...defaultProps} files={files} />);

    await user.click(screen.getByRole("combobox"));

    const driveLink = screen.getByTestId("drive-link-m1");
    expect(driveLink).toBeInTheDocument();
    expect(driveLink).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/drive-file-123/view"
    );
  });

  it("should not show Drive link for files without driveFileId", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const filesWithoutDrive = [
      createMockFile({
        id: "m1",
        filename: "local.mp4",
        isPrimary: true,
      }),
    ];
    // Override driveFileId to null
    filesWithoutDrive[0].driveFileId = null;

    render(<FileTypeCombobox {...defaultProps} files={filesWithoutDrive} />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.queryByTestId("drive-link-m1")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/components/items/file-type-combobox.test.tsx`

Expected: FAIL - no drive-link test id

**Step 3: Add Drive link icon to file items**

Modify `components/items/file-type-combobox.tsx` - in the CommandItem for each file, add before delete button:

```tsx
// Add ExternalLink to imports if not already there
import { ExternalLink } from "lucide-react";

// Inside file item rendering, add before the delete button:
{
  file.driveFileId && (
    <a
      href={`https://drive.google.com/file/d/${file.driveFileId}/view`}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`drive-link-${file.id}`}
      className="hover:bg-accent rounded p-1"
      onClick={(e) => e.stopPropagation()}
      title="Open in Google Drive"
    >
      <ExternalLink className="text-muted-foreground h-3.5 w-3.5" />
    </a>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/components/items/file-type-combobox.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add components/items/file-type-combobox.tsx tests/unit/components/items/file-type-combobox.test.tsx
git commit -m "feat(drive): add Drive link icon to file combobox

- Show external link icon for files with driveFileId
- Opens file in Drive in new tab
- Click doesn't trigger file selection

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Add E2E Test for Drive Links

**Files:**

- Modify: `e2e/journeys/google-drive/drive-connection.spec.ts`

**Step 1: Add E2E test for Drive link visibility**

Add to `e2e/journeys/google-drive/drive-connection.spec.ts`:

```typescript
test("should show Drive folder link in settings after connection", async ({
  page,
  setupDriveConnection,
  testUser,
}) => {
  await setupDriveConnection(testUser.id);

  // Open user menu and click settings
  await page.getByRole("button", { name: testUser.email }).click();
  await page.getByRole("menuitem", { name: /settings/i }).click();

  // Should see the Drive link in settings
  const driveLink = page.getByRole("link", { name: /open in drive/i });
  await expect(driveLink).toBeVisible();
  await expect(driveLink).toHaveAttribute(
    "href",
    expect.stringContaining("drive.google.com/drive/folders/")
  );
});

test("should show Open in Drive in context menu for synced items", async ({
  page,
  itemsPage,
  setupDriveConnection,
  testUser,
}) => {
  await setupDriveConnection(testUser.id);

  await itemsPage.goto();
  await itemsPage.createItem("Drive Link Test Item");
  await itemsPage.waitForToastToDisappear();

  // Wait for sync to complete
  await expect(async () => {
    const item = await prisma.item.findFirst({
      where: { userId: testUser.id, name: "Drive Link Test Item" },
    });
    expect(item?.driveFileId).not.toBeNull();
  }).toPass({ timeout: 15000 });

  // Open context menu
  await itemsPage.openContextMenu("Drive Link Test Item");

  // Should see Open in Drive option
  const driveOption = page.getByRole("menuitem", { name: /open in drive/i });
  await expect(driveOption).toBeVisible();
});
```

**Step 2: Run E2E test**

Run: `pnpm test:e2e --grep "Drive"` (requires GOOGLE_TEST_REFRESH_TOKEN)

Expected: PASS

**Step 3: Commit**

```bash
git add e2e/journeys/google-drive/drive-connection.spec.ts
git commit -m "test(e2e): add tests for Drive link visibility

- Test Drive link in settings after connection
- Test context menu Drive option for synced items

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Final Verification

**Step 1: Run all checks**

```bash
pnpm run check
```

Expected: All pass (format, lint, type-check, knip, build)

**Step 2: Run unit tests**

```bash
pnpm run test:unit
```

Expected: All pass

**Step 3: Run integration tests**

```bash
pnpm run test:integration
```

Expected: All pass

**Step 4: Run E2E tests (if Drive credentials available)**

```bash
pnpm run test:e2e --project=chromium
```

Expected: All pass

**Step 5: Commit if any final changes**

```bash
git add -A
git commit -m "chore: final verification for Drive links feature

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary of Changes

| Task | Location                      | Change                     | User Benefit                 |
| ---- | ----------------------------- | -------------------------- | ---------------------------- |
| 1    | `lib/google-drive-actions.ts` | Add rootFolderId to select | Data available for UI        |
| 2    | Settings dialog               | Link to CanonCore folder   | Verify where Drive folder is |
| 3    | Item context menu             | "Open in Drive" option     | Access synced item in Drive  |
| 4    | File combobox                 | Drive link icon            | Access synced file in Drive  |

## Test Coverage

| Test Type | Tests Added                           |
| --------- | ------------------------------------- |
| Unit      | Settings section Drive link (2 tests) |
| Unit      | Context menu Drive option (3 tests)   |
| Unit      | File combobox Drive link (2 tests)    |
| E2E       | Drive link in settings (1 test)       |
| E2E       | Context menu Drive option (1 test)    |

**Total: 6 tasks, 7 unit tests, 2 E2E tests**
