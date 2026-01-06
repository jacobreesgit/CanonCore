# Connection Filter Context-Aware UI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make sync button text and connection badges context-aware based on filter selection.

**Architecture:** Derive `showConnectionBadge` from filter state in ItemsView, pass down to Grid/Tree components. Conditionally render SyncAllButton vs SyncButton based on filter.

**Tech Stack:** React, TypeScript, existing component patterns

---

## Behavior Matrix

| Filter State          | Sync Button                                    | Connection Badges  |
| --------------------- | ---------------------------------------------- | ------------------ |
| "All Items"           | "Sync All" (syncs all connections)             | Visible on items   |
| Individual connection | "Sync Connection" (syncs only that connection) | Hidden (redundant) |

## Data Flow

```
ConnectionFilter selection
    ↓
selectedConnectionId (null = all, string = specific)
    ↓
ItemsView derives:
  - isFilteredToConnection = selectedConnectionId !== null
  - showConnectionBadge = !isFilteredToConnection
    ↓
Passes showConnectionBadge to Grid/Tree
    ↓
Grid/Tree passes to GridItem/TreeItem
    ↓
Items conditionally render badge
```

## Component Changes

### 1. ItemsView (`components/items/items-view.tsx`)

Derive state from filter and conditionally render sync buttons:

```tsx
// Derive from filter state
// Handle single connection auto-selection (ConnectionFilter auto-selects when only 1 exists)
const effectiveSelectedConnection = connections.length === 1
  ? connections[0].id
  : selectedConnectionId;
const isFilteredToConnection = effectiveSelectedConnection !== null;
const showConnectionBadge = !isFilteredToConnection;

// In JSX - conditional sync button:
{connections.length > 0 && !isFilteredToConnection && (
  <SyncAllButton
    connectionCount={connections.length}
    size="sm"
    onSyncComplete={...}
  />
)}
{connections.length > 0 && isFilteredToConnection && (
  <SyncButton
    connectionId={effectiveSelectedConnection}
    label="Sync Connection"
    size="sm"
    onSyncComplete={...}
  />
)}

// Pass to Grid/Tree:
<Grid
  items={currentLevelItems}
  showConnectionBadge={showConnectionBadge}
  ...
/>
<Tree
  items={treeItems}
  showConnectionBadge={showConnectionBadge}
  ...
/>
```

### 2. SyncButton (`components/sftp/sync-button.tsx`)

Add optional `label` prop:

```tsx
interface SyncButtonProps {
  connectionId: string;
  /** Custom button label. Defaults to "Sync". */
  label?: string;
  // ... existing props
}

// In component:
<span>{status === "syncing" ? "Syncing..." : (label ?? "Sync")}</span>;
```

### 3. GridItem (`components/sortable-grid/GridItem.tsx`)

Add `showConnectionBadge` prop:

```tsx
interface GridItemProps {
  // ... existing props
  /** Whether to show connection badge. Defaults to true. */
  showConnectionBadge?: boolean;
}

// In component (default to true):
const { showConnectionBadge = true, connectionName, ... } = props;

// Conditional render:
{connectionName && showConnectionBadge && (
  <Badge variant="secondary" className="...">
    {connectionName}
  </Badge>
)}
```

### 4. TreeItem (`components/sortable-tree/components/TreeItem/TreeItem.tsx`)

Same pattern as GridItem:

```tsx
interface TreeItemProps {
  // ... existing props
  /** Whether to show connection badge. Defaults to true. */
  showConnectionBadge?: boolean;
}

// Conditional render:
{
  connectionName && showConnectionBadge && (
    <span className="...">
      <Server className="size-2.5" />
      {connectionName}
    </span>
  );
}
```

### 5. Grid (`components/sortable-grid/Grid.tsx`)

Pass prop to children:

```tsx
interface GridProps {
  items: ItemWithArtwork[];
  /** Whether to show connection badges on items. Defaults to true. */
  showConnectionBadge?: boolean;
  // ... existing props
}

// Pass to GridItem:
<GridItem
  ...
  showConnectionBadge={showConnectionBadge}
/>
```

### 6. SortableGrid (`components/sortable-grid/SortableGrid.tsx`)

Same pattern as Grid.

### 7. Tree (`components/sortable-tree/Tree.tsx`)

Pass prop to TreeItem children:

```tsx
interface TreeProps {
  items: TreeItems;
  /** Whether to show connection badges on items. Defaults to true. */
  showConnectionBadge?: boolean;
  // ... existing props
}

// Pass to TreeItem in renderItem:
<TreeItem
  ...
  showConnectionBadge={showConnectionBadge}
/>
```

### 8. SortableTree (`components/sortable-tree/SortableTree.tsx`)

Same pattern as Tree.

## Files Changed

### Components (8 files)

| File                                                        | Change                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `components/items/items-view.tsx`                           | Conditional sync button, derive `showConnectionBadge`, pass to Grid/Tree |
| `components/sftp/sync-button.tsx`                           | Add optional `label` prop                                                |
| `components/sortable-grid/GridItem.tsx`                     | Add `showConnectionBadge` prop                                           |
| `components/sortable-grid/Grid.tsx`                         | Add `showConnectionBadge` prop, pass to children                         |
| `components/sortable-grid/SortableGrid.tsx`                 | Add `showConnectionBadge` prop, pass to children                         |
| `components/sortable-tree/components/TreeItem/TreeItem.tsx` | Add `showConnectionBadge` prop                                           |
| `components/sortable-tree/Tree.tsx`                         | Add `showConnectionBadge` prop, pass to children                         |
| `components/sortable-tree/SortableTree.tsx`                 | Add `showConnectionBadge` prop, pass to children                         |

### Tests (4 files)

| File                                              | Change                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| `tests/unit/components/grid-item.test.tsx`        | Add `showConnectionBadge` tests                   |
| `tests/unit/components/tree.test.tsx`             | Add `showConnectionBadge` tests                   |
| `tests/unit/components/sftp/sync-button.test.tsx` | Add `label` prop tests                            |
| `e2e/journeys/sftp/sftp-sync.spec.ts`             | Add filter + sync button + badge visibility tests |

## Testing Strategy

### Unit Tests

**grid-item.test.tsx:**

```typescript
describe("showConnectionBadge prop", () => {
  it("should show connection badge by default when connectionName provided", () => {
    render(<GridItem id="1" name="Test" connectionName="Server" />);
    expect(screen.getByText("Server")).toBeInTheDocument();
  });

  it("should show connection badge when showConnectionBadge is true", () => {
    render(<GridItem id="1" name="Test" connectionName="Server" showConnectionBadge />);
    expect(screen.getByText("Server")).toBeInTheDocument();
  });

  it("should hide connection badge when showConnectionBadge is false", () => {
    render(<GridItem id="1" name="Test" connectionName="Server" showConnectionBadge={false} />);
    expect(screen.queryByText("Server")).not.toBeInTheDocument();
  });
});
```

**tree.test.tsx:**

- Same pattern for TreeItem badge visibility

**sync-button.test.tsx:**

```typescript
describe("label prop", () => {
  it("should show default label 'Sync' when no label provided", () => {
    render(<SyncButton connectionId="123" />);
    expect(screen.getByText("Sync")).toBeInTheDocument();
  });

  it("should show custom label when provided", () => {
    render(<SyncButton connectionId="123" label="Sync Connection" />);
    expect(screen.getByText("Sync Connection")).toBeInTheDocument();
  });

  it("should show 'Syncing...' during sync regardless of custom label", async () => {
    render(<SyncButton connectionId="123" label="Sync Connection" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Syncing...")).toBeInTheDocument();
  });
});
```

### E2E Tests

**sftp-sync.spec.ts:**

```typescript
test.describe("Connection filter sync behavior", () => {
  test("shows Sync All button when All Items selected", async ({ page }) => {
    // Navigate to items with multiple connections
    // Verify filter shows "All Items"
    // Verify "Sync All" button visible
  });

  test("shows Sync Connection button when individual connection selected", async ({
    page,
  }) => {
    // Select specific connection in filter
    // Verify "Sync Connection" button visible
    // Verify "Sync All" button NOT visible
  });

  test("hides connection badges when filtered to individual connection", async ({
    page,
  }) => {
    // Select specific connection in filter
    // Verify no connection badges on items
  });

  test("shows connection badges when All Items selected", async ({ page }) => {
    // Select "All Items" in filter
    // Verify connection badges visible on synced items
  });

  test("shows Sync Connection when only one connection exists", async ({
    page,
  }) => {
    // User with single SFTP connection
    // Filter auto-selects the single connection (disabled)
    // Verify "Sync Connection" button visible (not "Sync All")
    // Verify connection badges hidden on items
  });
});
```

## JSDoc Standards

All new props follow CLAUDE.md JSDoc conventions:

```typescript
/** Whether to show connection badge. Defaults to true. */
showConnectionBadge?: boolean;

/** Custom button label. Defaults to "Sync". */
label?: string;
```
