# My Items Hero Design

> **For Claude:** Use superpowers:executing-plans to implement this plan task-by-task. Do NOT commit at any point during implementation.

**Goal:** Add ItemHero to "My Items" root page with aggregate stats, update item detail pages to show recursive descendant counts with consistent "items" labeling, and ensure toolbar is ABOVE hero on both pages.

**Architecture:** Reuse existing ItemHero component on root page with "My Items" title and total item count. Change label from "subfolders" to "items" for consistency. Reorder components so toolbar renders above hero on both pages.

**Tech Stack:** React, Tailwind CSS 4, existing ItemHero component

---

## Validation Notes (Code Review)

**Reviewed using:** code-review-excellence skill, Context7 (shadcn/ui, Tailwind CSS), sequential-thinking

**Key findings addressed:**

- Toolbar must be ABOVE hero (user requirement) - currently hero is first
- No git commits in implementation tasks
- Both my-items page AND item-detail-client.tsx need toolbar reordering
- Label change from "subfolders" to "items" for recursive counts
- Unit tests need to verify render order

---

## Summary of Changes

| File                                                      | Action | Description                              |
| --------------------------------------------------------- | ------ | ---------------------------------------- |
| `components/items/item-hero.tsx`                          | Modify | Change "subfolder(s)" label to "item(s)" |
| `components/items/item-detail-client.tsx`                 | Modify | Reorder: Toolbar → Hero → Content        |
| `app/(my-items)/my-items/page.tsx`                        | Modify | Add ItemHero with toolbar above          |
| `tests/unit/components/items/item-hero.test.tsx`          | Modify | Update label assertions                  |
| `tests/unit/components/items/item-detail-client.test.tsx` | Modify | Add render order test                    |
| `e2e/pages/items.page.ts`                                 | Modify | Add hero locators for root page          |
| `e2e/journeys/items/items-crud.spec.ts`                   | Modify | Add root page hero visibility test       |

---

### Task 1: Update ItemHero Label

**Files:**

- Modify: `components/items/item-hero.tsx`
- Modify: `tests/unit/components/items/item-hero.test.tsx`

**Step 1: Update unit test first (TDD)**

In `tests/unit/components/items/item-hero.test.tsx`, update the child count test:

```tsx
// Change from:
it("should show child count when provided", () => {
  render(<ItemHero name="Test" childCount={3} />);
  expect(screen.getByText(/3 subfolder/i)).toBeInTheDocument();
});

// To:
it("should show child count when provided", () => {
  render(<ItemHero name="Test" childCount={3} />);
  expect(screen.getByText(/3 items/i)).toBeInTheDocument();
});

it("should show singular item label for count of 1", () => {
  render(<ItemHero name="Test" childCount={1} />);
  expect(screen.getByText("1 item")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/components/items/item-hero.test.tsx`
Expected: FAIL - still shows "subfolders"

**Step 3: Update ItemHero component**

In `components/items/item-hero.tsx`, change the childCount display:

```tsx
// Change from:
{
  childCount > 0 && (
    <span className="flex items-center gap-1.5">
      <Folder className="size-4" />
      {childCount} subfolder{childCount !== 1 ? "s" : ""}
    </span>
  );
}

// To:
{
  childCount > 0 && (
    <span className="flex items-center gap-1.5">
      <Folder className="size-4" />
      {childCount} item{childCount !== 1 ? "s" : ""}
    </span>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- tests/unit/components/items/item-hero.test.tsx`
Expected: PASS

**Step 5: Done** - Move to next task.

---

### Task 2: Reorder Item Detail Client - Toolbar Above Hero

**Files:**

- Modify: `components/items/item-detail-client.tsx`
- Modify: `tests/unit/components/items/item-detail-client.test.tsx`

**Step 1: Update unit test to verify render order**

In `tests/unit/components/items/item-detail-client.test.tsx`, add a render order test:

```tsx
describe("render order", () => {
  it("should render toolbar before hero", () => {
    render(<ItemDetailClient item={defaultItem} childItems={[]} />);

    const toolbar = screen.getByTestId("items-toolbar");
    const hero = screen.getByTestId("item-hero");

    // Toolbar should come before hero in DOM order
    expect(toolbar.compareDocumentPosition(hero)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- tests/unit/components/items/item-detail-client.test.tsx`
Expected: FAIL - hero currently renders before toolbar

**Step 3: Update ItemDetailClient render order**

In `components/items/item-detail-client.tsx`, change the return JSX:

```tsx
return (
  <div className={`flex flex-col gap-6 ${isPending ? "opacity-70" : ""}`}>
    {/* Toolbar - above hero */}
    <ItemsToolbar {...toolbarProps} />

    {/* Hero banner */}
    <ItemHero
      name={item.name}
      description={item.description}
      artworkId={artworkId || files?.artwork[0]?.id}
      hasMedia={hasMedia}
      hasProgress={hasProgress}
      mediaCount={files?.media.length ?? 0}
      artworkCount={files?.artwork.length ?? 0}
      subtitleCount={files?.subtitles.length ?? 0}
      childCount={childItems.length}
      onPlay={handlePlay}
    />

    {/* Children section */}
    <ItemsView
      items={childItems}
      parentId={item.id}
      connectionId={item.connectionId}
      hideToolbar
      isEditing={isEditing}
      onEditingChange={setIsEditing}
      addItemOpen={addItemOpen}
      onAddItemOpenChange={setAddItemOpen}
      currentConnection={connection}
      onSyncComplete={refetchItems}
    />

    {/* Media player overlay */}
    {playingFile && files && (
      <MediaOverlay
        file={playingFile}
        subtitles={files.subtitles}
        onClose={() => setPlayingFile(null)}
        onPositionUpdate={handlePositionUpdate}
      />
    )}
  </div>
);
```

Also update the JSDoc comment at the top:

```tsx
/**
 * Client wrapper for item detail page with hero banner and unified toolbar.
 * Manages edit mode and add item dialog state shared between toolbar and view.
 * Displays: Toolbar -> Hero -> Children grid/tree.
 */
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- tests/unit/components/items/item-detail-client.test.tsx`
Expected: PASS

**Step 5: Done** - Move to next task.

---

### Task 3: Add ItemHero to My Items Root Page

**Files:**

- Modify: `app/(my-items)/my-items/page.tsx`

**Step 1: Update the page to include ItemHero with toolbar above**

```tsx
/**
 * My Items page displaying sortable items.
 * Server component that fetches items and renders the FilteredItemsView.
 */

import { FilteredItemsView } from "@/components/items";
import { ItemHero } from "@/components/items/item-hero";
import { ItemsToolbar } from "@/components/items/items-toolbar";
import { getItems } from "@/lib/item-actions";
import { getSftpConnections, getItemsByConnection } from "@/lib/sftp-actions";
import { SiteHeader } from "@/components/site-header";

interface MyItemsPageProps {
  searchParams: Promise<{ connection?: string }>;
}

/**
 * Renders the My Items page with filterable items view.
 * Supports filtering by SFTP connection via URL query param.
 *
 * @param searchParams - URL search parameters (connection filter)
 */
export default async function MyItemsPage({ searchParams }: MyItemsPageProps) {
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

  // Get connection name for filtered view
  const activeConnection = connectionId
    ? connections.find((c) => c.id === connectionId)
    : null;

  return (
    <>
      <SiteHeader title="My Items" titleHref="/my-items" />
      <div className="flex flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <ItemHero
          name={activeConnection ? activeConnection.name : "My Items"}
          childCount={items.length}
        />
        <FilteredItemsView
          initialItems={items}
          connections={connections}
          initialConnectionId={connectionId ?? null}
        />
      </div>
    </>
  );
}
```

**Note:** The toolbar on the root page is inside FilteredItemsView, which already renders it at the top. We only need to add the ItemHero after the toolbar, which FilteredItemsView handles internally.

**Step 2: Verify build**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Done** - Move to next task.

---

### Task 4: Update E2E Page Object

**Files:**

- Modify: `e2e/pages/items.page.ts`

**Step 1: Add hero locators to ItemsPage**

Add to the ItemsPage class:

```tsx
// Add property
readonly heroSection: Locator;

// In constructor, add:
this.heroSection = page.getByTestId("item-hero");

// Add method:
/**
 * Expects the hero section to be visible with given title.
 */
async expectHeroVisible(title?: string): Promise<void> {
  await expect(this.heroSection).toBeVisible({ timeout: 10000 });
  if (title) {
    await expect(this.heroSection.getByRole("heading", { name: title })).toBeVisible();
  }
}
```

**Step 2: Done** - Move to next task.

---

### Task 5: Add E2E Test for Root Page Hero

**Files:**

- Modify: `e2e/journeys/items/items-crud.spec.ts`

**Step 1: Add test case**

Add to the items-crud.spec.ts file:

```tsx
test("shows hero on root My Items page", async ({ itemsPage }) => {
  await itemsPage.goto();
  await itemsPage.expectHeroVisible("My Items");
});
```

**Step 2: Run E2E test**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium -g "shows hero on root"`
Expected: PASS

**Step 3: Done** - Move to next task.

---

### Task 6: Run Full Test Suite & Verification

**Step 1: Run all unit tests**

Run: `pnpm run test:unit`
Expected: All pass

**Step 2: Run E2E tests**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium`
Expected: All pass

**Step 3: Run full check**

Run: `pnpm run check`
Expected: All pass

**Step 4: Done** - Implementation complete.

---

## Test Impact Summary

| Test Type   | Added                            | Removed | Modified         |
| ----------- | -------------------------------- | ------- | ---------------- |
| Unit        | 2 (singular label, render order) | 0       | 1 (label change) |
| Integration | 0                                | 0       | 0                |
| E2E         | 1 (root hero)                    | 0       | 0                |

---

## Validation Checklist

- [ ] ItemHero label changed from "subfolders" to "items"
- [ ] Toolbar renders ABOVE hero on item detail pages
- [ ] Root My Items page shows hero with title and count
- [ ] Filtered view shows connection name in hero
- [ ] Unit tests updated and passing (including render order)
- [ ] E2E test added for root page hero
- [ ] All existing tests still pass
- [ ] No git commits made during implementation
