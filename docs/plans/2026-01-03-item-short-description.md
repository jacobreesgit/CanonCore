# Item Short Description Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an optional short description field to items, displayed in grid/tree views and editable via the settings dialog.

---

## Review Notes (2026-01-03)

**Validated against:** Context7 (Prisma, Zod docs), code-review-excellence skill, sequential-thinking MCP

### ✅ Verified Patterns

- Prisma `String? @db.VarChar(200)` - correct for PostgreSQL optional varchar
- Zod `.transform().pipe()` pattern for trim-before-validate
- Security: auth checks, rate limiting, input validation preserved
- Backward-compatible API design

### 🔧 Fixes Applied During Review

1. **Zod schema ordering** - Changed to `.transform(trim).pipe(max(200))` to validate after trimming
2. **Added boundary tests** - Tests for whitespace-padded strings at length boundary
3. **Task 11 expanded** - Added concrete code snippets for component prop passing

### 💡 Implementation Notes

- Consider consolidating name/description into single "Save Changes" button (UX improvement)
- The `maxLength={200}` on Input is defense-in-depth, server validation is authoritative
- **Edit mode hides description** - follows existing `showArtwork={false}` pattern for simplified drag UI

---

**Architecture:** Extend the existing Item model with an optional `description` field (max 200 chars). Update server actions to handle description CRUD. Modify UI components to display and edit descriptions. TDD approach with unit, integration, and E2E tests.

**Tech Stack:** Prisma (PostgreSQL), Next.js Server Actions, React, shadcn/ui, Vitest, Playwright

---

## Task 1: Add Description Field to Prisma Schema

**Files:**

- Modify: `prisma/schema.prisma:83-115`

**Step 1: Add description field to Item model**

Add the `description` field after `name` in the Item model:

```prisma
model Item {
  id          String   @id @default(cuid())
  name        String
  description String?  @db.VarChar(200)
  order       Int      @default(0)
  depth       Int      @default(0)
  // ... rest of model unchanged
}
```

**Step 2: Generate and run migration**

Run: `npx prisma migrate dev --name add-item-description`
Expected: Migration creates successfully, adds nullable `description` column

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add description field to Item model"
```

---

## Task 2: Add Description Validation Schema

**Files:**

- Modify: `lib/validations.ts:50-62`
- Test: `tests/unit/lib/validations.test.ts` (create if needed)

**Step 1: Write failing test for description validation**

Create or update `tests/unit/lib/validations.test.ts`:

```typescript
/**
 * Unit tests for validation schemas.
 */

import { describe, it, expect } from "vitest";
import { itemDescriptionSchema } from "@/lib/validations";

describe("itemDescriptionSchema", () => {
  it("accepts empty string", () => {
    const result = itemDescriptionSchema.safeParse("");
    expect(result.success).toBe(true);
  });

  it("accepts valid description", () => {
    const result = itemDescriptionSchema.safeParse("A short description");
    expect(result.success).toBe(true);
  });

  it("accepts description with special characters", () => {
    const result = itemDescriptionSchema.safeParse(
      "Movie (2024) - Director's Cut!"
    );
    expect(result.success).toBe(true);
  });

  it("accepts max length description (200 chars)", () => {
    const result = itemDescriptionSchema.safeParse("a".repeat(200));
    expect(result.success).toBe(true);
  });

  it("rejects description over 200 characters", () => {
    const result = itemDescriptionSchema.safeParse("a".repeat(201));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain("200");
  });

  it("trims whitespace", () => {
    const result = itemDescriptionSchema.safeParse("  trimmed  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("trimmed");
    }
  });

  it("trims then validates length (whitespace-padded 201 chars trims to valid)", () => {
    // 198 chars + 3 spaces = 201 total, but trims to 198
    const result = itemDescriptionSchema.safeParse("a".repeat(198) + "   ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("a".repeat(198));
    }
  });

  it("rejects when trimmed result still exceeds 200 chars", () => {
    // 201 chars with surrounding whitespace
    const result = itemDescriptionSchema.safeParse(
      "  " + "a".repeat(201) + "  "
    );
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/lib/validations.test.ts`
Expected: FAIL with "itemDescriptionSchema is not exported"

**Step 3: Add description schema to validations.ts**

Add after `itemNameSchema` in `lib/validations.ts`:

```typescript
/**
 * Item description validation schema.
 * Optional field, max 200 characters.
 * Trims whitespace before validation to prevent edge cases.
 * Allows any printable characters for flexibility.
 */
export const itemDescriptionSchema = z
  .string()
  .transform((val) => val.trim())
  .pipe(z.string().max(200, "Description must be 200 characters or less"));
```

Note: The `.transform().pipe()` pattern ensures whitespace is trimmed BEFORE length validation, preventing edge cases where padded whitespace causes false rejections.

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit tests/unit/lib/validations.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/validations.ts tests/unit/lib/validations.test.ts
git commit -m "feat(validation): add itemDescriptionSchema for item descriptions"
```

---

## Task 3: Update Types with Description Field

**Files:**

- Modify: `lib/types.ts:14-27`
- Modify: `lib/types.ts:33-46`
- Modify: `lib/types.ts:150-153`

**Step 1: Add description to Item interface**

Update the `Item` interface in `lib/types.ts`:

```typescript
/**
 * Database Item type (from Prisma).
 * Represents a container in the item hierarchy.
 * Items can have children (sub-items) and attached files (ItemFile).
 */
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
  // SFTP-specific fields
  sftpPath: string | null;
  sftpModifiedAt: Date | null;
  connectionId: string | null;
}
```

**Step 2: Add description to TreeItem interface**

Update the `TreeItem` interface:

```typescript
/**
 * Tree item for hierarchical display.
 * Used by SortableTree component.
 */
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
  // Artwork thumbnail
  artworkId?: string | null;
}
```

**Step 3: Add description to ItemWithArtwork interface**

Update the `ItemWithArtwork` interface:

```typescript
/**
 * Item with optional artwork thumbnail for list views.
 * Used by grid and tree views to display item thumbnails.
 */
export interface ItemWithArtwork extends Item {
  /** First artwork file ID for thumbnail display */
  artworkId: string | null;
}
```

Note: `ItemWithArtwork` extends `Item`, so it already inherits `description`.

**Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): add description field to Item and TreeItem interfaces"
```

---

## Task 4: Update Unit Tests for Item Actions

**Files:**

- Modify: `tests/unit/lib/item-actions.test.ts`

**Step 1: Update mockItem helper to include description**

Update the `mockItem` helper function:

```typescript
/** Helper to create a mock item with all required fields */
const mockItem = (overrides: {
  id: string;
  name: string;
  description?: string | null;
  parentId: string | null;
  order: number;
  depth: number;
  userId: string;
  artworkId?: string | null;
}) => ({
  ...overrides,
  description: overrides.description ?? null,
  type: "FOLDER" as const,
  sftpPath: null,
  mimeType: null,
  size: null,
  checksum: null,
  syncStatus: "SYNCED" as const,
  lastSyncedAt: null,
  sftpModifiedAt: null,
  connectionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  files: overrides.artworkId ? [{ id: overrides.artworkId }] : [],
});
```

**Step 2: Add tests for createItem with description**

Add to the `createItem` describe block:

```typescript
it("creates item with description", async () => {
  mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
  vi.mocked(prisma.item.aggregate).mockResolvedValue({
    _max: { order: null },
  } as never);
  vi.mocked(prisma.item.create).mockResolvedValue(
    mockItem({
      id: "new-item",
      name: "Folder",
      description: "A test folder",
      parentId: null,
      order: 0,
      depth: 0,
      userId: "user-1",
    })
  );

  const result = await createItem(null, "Folder", "A test folder");

  expect(result.success).toBe(true);
  expect(prisma.item.create).toHaveBeenCalledWith({
    data: {
      name: "Folder",
      description: "A test folder",
      parentId: null,
      order: 0,
      depth: 0,
      userId: "user-1",
    },
  });
});

it("creates item without description when not provided", async () => {
  mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
  vi.mocked(prisma.item.aggregate).mockResolvedValue({
    _max: { order: null },
  } as never);
  vi.mocked(prisma.item.create).mockResolvedValue(
    mockItem({
      id: "new-item",
      name: "Folder",
      parentId: null,
      order: 0,
      depth: 0,
      userId: "user-1",
    })
  );

  const result = await createItem(null, "Folder");

  expect(result.success).toBe(true);
  expect(prisma.item.create).toHaveBeenCalledWith({
    data: {
      name: "Folder",
      description: null,
      parentId: null,
      order: 0,
      depth: 0,
      userId: "user-1",
    },
  });
});

it("returns validation error for description over 200 chars", async () => {
  mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));

  const result = await createItem(null, "Folder", "a".repeat(201));

  expect(result.error).toContain("200");
});
```

**Step 3: Add tests for updateItem with description**

Add to the `updateItem` describe block:

```typescript
it("updates item description", async () => {
  mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
  vi.mocked(prisma.item.findUnique).mockResolvedValue({
    userId: "user-1",
  } as never);
  vi.mocked(prisma.item.update).mockResolvedValue({} as never);

  const result = await updateItem("item-1", { description: "New description" });

  expect(result.success).toBe(true);
  expect(prisma.item.update).toHaveBeenCalledWith({
    where: { id: "item-1" },
    data: { description: "New description" },
  });
});

it("clears description when set to empty string", async () => {
  mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
  vi.mocked(prisma.item.findUnique).mockResolvedValue({
    userId: "user-1",
  } as never);
  vi.mocked(prisma.item.update).mockResolvedValue({} as never);

  const result = await updateItem("item-1", { description: "" });

  expect(result.success).toBe(true);
  expect(prisma.item.update).toHaveBeenCalledWith({
    where: { id: "item-1" },
    data: { description: null },
  });
});

it("updates both name and description", async () => {
  mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
  vi.mocked(prisma.item.findUnique).mockResolvedValue({
    userId: "user-1",
  } as never);
  vi.mocked(prisma.item.update).mockResolvedValue({} as never);

  const result = await updateItem("item-1", {
    name: "New Name",
    description: "New description",
  });

  expect(result.success).toBe(true);
  expect(prisma.item.update).toHaveBeenCalledWith({
    where: { id: "item-1" },
    data: { name: "New Name", description: "New description" },
  });
});
```

**Step 4: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/lib/item-actions.test.ts`
Expected: FAIL - createItem/updateItem don't accept description parameter yet

**Step 5: Commit test file**

```bash
git add tests/unit/lib/item-actions.test.ts
git commit -m "test(unit): add description tests for item actions"
```

---

## Task 5: Update Server Actions for Description

**Files:**

- Modify: `lib/item-actions.ts:130-193` (createItem)
- Modify: `lib/item-actions.ts:203-247` (updateItem)

**Step 1: Update createItem to accept description**

Update the `createItem` function signature and implementation:

```typescript
/**
 * Creates a new item.
 * Enforces max depth of 10 levels.
 *
 * @param parentId - Parent item ID or null for root
 * @param name - Item name
 * @param description - Optional short description (max 200 chars)
 * @returns Created item or error
 */
export async function createItem(
  parentId: string | null,
  name: string,
  description?: string
): Promise<ItemResult<Item>> {
  // Rate limit check
  const rateLimitResult = await checkRateLimit("itemCreate");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  // Validate name
  const nameValidation = itemNameSchema.safeParse(name);
  if (!nameValidation.success) {
    return { error: nameValidation.error.issues[0].message };
  }

  // Validate description if provided
  let validatedDescription: string | null = null;
  if (description !== undefined && description !== "") {
    const descValidation = itemDescriptionSchema.safeParse(description);
    if (!descValidation.success) {
      return { error: descValidation.error.issues[0].message };
    }
    validatedDescription = descValidation.data || null;
  }

  let depth = 0;

  // Check parent exists and user owns it
  if (parentId) {
    const parent = await prisma.item.findUnique({
      where: { id: parentId },
      select: { depth: true, userId: true },
    });

    if (!parent || parent.userId !== session.user.id) {
      return { error: "Parent not found" };
    }

    if (parent.depth >= MAX_DEPTH - 1) {
      return { error: "Maximum nesting depth reached" };
    }

    depth = parent.depth + 1;
  }

  // Get max order for siblings
  const maxOrderResult = await prisma.item.aggregate({
    where: {
      userId: session.user.id,
      parentId: parentId,
    },
    _max: { order: true },
  });

  const order = (maxOrderResult._max.order ?? -1) + 1;

  const item = await prisma.item.create({
    data: {
      name: nameValidation.data,
      description: validatedDescription,
      parentId,
      order,
      depth,
      userId: session.user.id,
    },
  });

  return { success: true, data: item as Item };
}
```

**Step 2: Update updateItem to accept description**

Update the `updateItem` function:

```typescript
/**
 * Updates an item's properties.
 * Verifies ownership before update.
 *
 * @param id - Item ID
 * @param data - Partial item data to update (name and/or description)
 * @returns Success or error
 */
export async function updateItem(
  id: string,
  data: { name?: string; description?: string }
): Promise<ItemResult> {
  // Rate limit check
  const rateLimitResult = await checkRateLimit("itemUpdate");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Build update data
  const updateData: { name?: string; description?: string | null } = {};

  // Validate name if provided
  if (data.name !== undefined) {
    const validation = itemNameSchema.safeParse(data.name);
    if (!validation.success) {
      return { error: validation.error.issues[0].message };
    }
    updateData.name = validation.data;
  }

  // Validate description if provided
  if (data.description !== undefined) {
    if (data.description === "") {
      // Empty string clears the description
      updateData.description = null;
    } else {
      const validation = itemDescriptionSchema.safeParse(data.description);
      if (!validation.success) {
        return { error: validation.error.issues[0].message };
      }
      updateData.description = validation.data || null;
    }
  }

  await prisma.item.update({
    where: { id },
    data: updateData,
  });

  return { success: true };
}
```

**Step 3: Add import for itemDescriptionSchema**

Update imports at top of `lib/item-actions.ts`:

```typescript
import { itemNameSchema, itemDescriptionSchema } from "@/lib/validations";
```

**Step 4: Run unit tests to verify they pass**

Run: `pnpm run test:unit tests/unit/lib/item-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/item-actions.ts
git commit -m "feat(actions): add description support to createItem and updateItem"
```

---

## Task 6: Update Integration Tests

**Files:**

- Modify: `tests/integration/items/item-crud.test.ts`

**Step 1: Add integration tests for description**

Add to the describe block in `tests/integration/items/item-crud.test.ts`:

```typescript
it("creates item with description", async () => {
  const createResult = await createItem(
    null,
    "Described Folder",
    "This is a test description"
  );
  expect(createResult.success).toBe(true);
  if (!createResult.success) throw new Error("Failed to create item");
  expect(createResult.data?.name).toBe("Described Folder");
  expect(createResult.data?.description).toBe("This is a test description");
});

it("creates item without description", async () => {
  const createResult = await createItem(null, "No Description Folder");
  expect(createResult.success).toBe(true);
  if (!createResult.success) throw new Error("Failed to create item");
  expect(createResult.data?.description).toBeNull();
});

it("updates item description", async () => {
  const createResult = await createItem(null, "Update Desc Test");
  if (!createResult.success) throw new Error("Failed to create item");
  const itemId = createResult.data!.id;

  await updateItem(itemId, { description: "Updated description" });

  const getResult = await getItem(itemId);
  if (!getResult.success) throw new Error("Failed to get item");
  expect(getResult.data?.item.description).toBe("Updated description");
});

it("clears item description with empty string", async () => {
  const createResult = await createItem(
    null,
    "Clear Desc Test",
    "Initial description"
  );
  if (!createResult.success) throw new Error("Failed to create item");
  const itemId = createResult.data!.id;

  await updateItem(itemId, { description: "" });

  const getResult = await getItem(itemId);
  if (!getResult.success) throw new Error("Failed to get item");
  expect(getResult.data?.item.description).toBeNull();
});

it("rejects description over 200 characters", async () => {
  const longDescription = "a".repeat(201);
  const result = await createItem(null, "Long Desc Test", longDescription);
  expect(result.error).toContain("200");
});
```

**Step 2: Run integration tests**

Run: `pnpm run test:integration tests/integration/items/item-crud.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/items/item-crud.test.ts
git commit -m "test(integration): add description tests for item CRUD"
```

---

## Task 7: Update ItemSettingsDialog for Description

**Files:**

- Modify: `components/items/item-settings-dialog.tsx`

**Step 1: Update props interface**

Update `ItemSettingsDialogProps`:

```typescript
interface ItemSettingsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** The item being configured */
  item: { id: string; name: string; description: string | null };
  /** Files attached to this item, grouped by type (serialized for client) */
  files: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
  /** Callback to rename the item */
  onRename: (newName: string) => Promise<void>;
  /** Callback to update the description */
  onDescriptionChange: (description: string) => Promise<void>;
  /** Optional callback when settings change (for refreshing data) */
  onSettingsChange?: () => void;
}
```

**Step 2: Add description state and handler**

Update the component to include description state:

```typescript
export function ItemSettingsDialog({
  open,
  onOpenChange,
  item,
  files,
  onRename,
  onDescriptionChange,
  onSettingsChange,
}: ItemSettingsDialogProps) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

  // Sync state when item prop changes
  useEffect(() => {
    setName(item.name);
    setDescription(item.description ?? "");
  }, [item.name, item.description]);

  // ... existing code ...

  const handleSaveDescription = useCallback(async () => {
    if (description === (item.description ?? "")) return;
    setIsSavingDescription(true);
    try {
      await onDescriptionChange(description);
    } catch {
      toast.error("Failed to update description");
    } finally {
      setIsSavingDescription(false);
    }
  }, [description, item.description, onDescriptionChange]);
```

**Step 3: Add description field to dialog UI**

Add after the Name section in the dialog:

```tsx
{
  /* Description Section */
}
<div className="space-y-3">
  <Label htmlFor="item-description" className="text-sm font-medium">
    Description
  </Label>
  <div className="flex gap-2">
    <Input
      id="item-description"
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && handleSaveDescription()}
      placeholder="Short description (optional)"
      maxLength={200}
      className="h-10"
    />
    <Button
      onClick={handleSaveDescription}
      disabled={description === (item.description ?? "") || isSavingDescription}
      size="default"
      className="shrink-0 px-4"
    >
      {isSavingDescription ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        "Save"
      )}
    </Button>
  </div>
  <p className="text-muted-foreground text-xs">
    {description.length}/200 characters
  </p>
</div>;
```

**Step 4: Commit**

```bash
git add components/items/item-settings-dialog.tsx
git commit -m "feat(ui): add description field to item settings dialog"
```

---

## Task 8: Update Items-View to Handle Description

**Files:**

- Modify: `components/items/items-view.tsx`

**Step 1: Add description update handler**

Add handler function in items-view.tsx:

```typescript
const handleUpdateDescription = useCallback(
  async (itemId: string, description: string) => {
    const result = await updateItem(itemId, { description });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Description updated");
      await refresh();
    }
  },
  [refresh]
);
```

**Step 2: Update ItemSettingsDialog call**

Update the `ItemSettingsDialog` component invocation to include description:

```tsx
<ItemSettingsDialog
  open={settingsDialogOpen}
  onOpenChange={setSettingsDialogOpen}
  item={{
    id: settingsItem.id,
    name: settingsItem.name,
    description: settingsItem.description,
  }}
  files={settingsFiles}
  onRename={(newName) => handleRenameItem(settingsItem.id, newName)}
  onDescriptionChange={(description) =>
    handleUpdateDescription(settingsItem.id, description)
  }
  onSettingsChange={refresh}
/>
```

**Step 3: Commit**

```bash
git add components/items/items-view.tsx
git commit -m "feat(ui): wire up description handling in items-view"
```

---

## Task 9: Display Description in GridItem

**Files:**

- Modify: `components/sortable-grid/GridItem.tsx`

**Step 1: Add description prop**

Update `GridItemProps`:

```typescript
export interface GridItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "id"
> {
  id: UniqueIdentifier;
  name: string;
  description?: string | null;
  isDragging?: boolean;
  isOverlay?: boolean;
  handleProps?: Record<string, unknown>;
  onClick?(): void;
  /** SFTP path if linked to remote server. */
  sftpPath?: string | null;
  /** Artwork file ID for thumbnail display. */
  artworkId?: string | null;
  /** Whether to show artwork thumbnail. Defaults to true. */
  showArtwork?: boolean;
  /** Whether to show description. Defaults to true. Hidden in edit mode. */
  showDescription?: boolean;
}
```

**Step 2: Display description in card**

Update the Item Name section to include description:

```tsx
{
  /* Item Name and Description */
}
<div className="flex flex-col gap-0.5 p-3">
  <div className="flex items-center gap-2">
    <Folder
      className={cn(
        "size-4 shrink-0 transition-colors duration-200",
        "text-muted-foreground/70",
        "group-hover:text-primary/80"
      )}
      strokeWidth={1.75}
    />
    <span
      className={cn(
        "truncate text-sm font-medium",
        "text-foreground/85 transition-colors duration-150",
        "group-hover:text-foreground"
      )}
    >
      {name}
    </span>
  </div>
  {showDescription && description && (
    <p
      className={cn(
        "text-muted-foreground truncate pl-6 text-xs",
        "transition-colors duration-150"
      )}
    >
      {description}
    </p>
  )}
</div>;
```

Note: Add `showDescription = true` to the component destructure (defaults to true for view mode).

**Step 3: Commit**

```bash
git add components/sortable-grid/GridItem.tsx
git commit -m "feat(ui): display description in grid item cards"
```

---

## Task 10: Display Description in TreeItem

**Files:**

- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`

**Step 1: Add description prop**

Update `TreeItemProps`:

```typescript
export interface TreeItemProps extends Omit<
  HTMLAttributes<HTMLLIElement>,
  "id"
> {
  id: UniqueIdentifier;
  value: string;
  description?: string | null;
  depth: number;
  // ... rest unchanged
  /** Whether to show description. Defaults to true. Hidden in edit mode. */
  showDescription?: boolean;
}
```

**Step 2: Display description in tree item**

Update the Item Name section:

```tsx
{
  /* Item Name and Description */
}
{
  !ghost && (
    <div className="min-w-0 flex-1">
      <span
        className={cn(
          "block truncate text-sm font-medium",
          "text-foreground/90 group-hover:text-foreground",
          "transition-colors duration-150"
        )}
      >
        {value}
      </span>
      {showDescription && description && (
        <span
          className={cn(
            "text-muted-foreground block truncate text-xs",
            "transition-colors duration-150"
          )}
        >
          {description}
        </span>
      )}
    </div>
  );
}
```

Note: Add `showDescription = true` to the component destructure (defaults to true for view mode).

**Step 3: Commit**

```bash
git add components/sortable-tree/components/TreeItem/TreeItem.tsx
git commit -m "feat(ui): display description in tree item rows"
```

---

## Task 11: Pass Description Through View Components

**Files:**

- Modify: `components/sortable-grid/Grid.tsx` (view mode - show description)
- Modify: `components/sortable-grid/SortableGridItem.tsx` (edit mode - hide description)
- Modify: `components/sortable-tree/Tree.tsx` (view mode - show description)
- Modify: `components/sortable-tree/SortableTree.tsx` (edit mode - hide description)

**Step 1: Update Grid.tsx to pass description (view mode)**

In `components/sortable-grid/Grid.tsx`, add `description` to the GridItem:

```tsx
{
  items.map((item) => (
    <ItemContextMenu
      key={item.id}
      itemName={item.name}
      showAddChild={false}
      onSettings={onOpenSettings ? () => onOpenSettings(item.id) : undefined}
      onDelete={onDeleteItem ? () => onDeleteItem(item.id) : undefined}
    >
      <GridItem
        id={item.id}
        name={item.name}
        description={item.description} // ADD THIS LINE
        showDescription={true} // Explicit - view mode shows description
        onClick={() => onItemClick?.(item.id)}
        sftpPath={item.sftpPath}
        artworkId={item.artworkId}
        showArtwork={true}
      />
    </ItemContextMenu>
  ));
}
```

**Step 2: Update SortableGrid.tsx - NO description in edit mode**

In `components/sortable-grid/SortableGrid.tsx`, the SortableGridItem does NOT pass description.
Edit mode is intentionally simplified for drag operations (similar to `showArtwork={false}`).

In `components/sortable-grid/SortableGridItem.tsx`, ensure GridItem gets `showDescription={false}`:

```tsx
<GridItem
  ref={setNodeRef}
  id={id}
  name={name}
  style={style}
  isDragging={isDragging}
  handleProps={{
    ...attributes,
    ...listeners,
  }}
  sftpPath={sftpPath}
  artworkId={artworkId}
  showArtwork={false} // Already exists - simplified for drag
  showDescription={false} // ADD THIS - hide description in edit mode
  {...props}
/>
```

**Step 3: Update Tree.tsx to pass description (view mode)**

In `components/sortable-tree/Tree.tsx`, add `description` to the destructure and TreeItem:

```tsx
{
  flattenedItems.map(
    (
      { id, name, description, children, depth, sftpPath, artworkId } // ADD description
    ) => (
      <ItemContextMenu
        key={id}
        itemName={name}
        // ... context menu props
      >
        <TreeItem
          id={id}
          value={name}
          description={description} // ADD THIS LINE
          showDescription={true} // Explicit - view mode shows description
          depth={depth}
          indentationWidth={indentationWidth}
          collapsed={isCollapsed(id)}
          onCollapse={
            children.length > 0 ? () => toggleCollapse(id) : undefined
          }
          onClick={() => onItemClick?.(String(id))}
          sftpPath={sftpPath}
          artworkId={artworkId}
          showArtwork={true}
          showDragHandle={false}
        />
      </ItemContextMenu>
    )
  );
}
```

**Step 4: Update SortableTree.tsx - NO description in edit mode**

In `components/sortable-tree/SortableTree.tsx`, ensure TreeItem gets `showDescription={false}`:

```tsx
<TreeItem
  ref={ref}
  id={id}
  value={value}
  depth={depth}
  // ... other props
  showArtwork={false} // Already exists - simplified for drag
  showDescription={false} // ADD THIS - hide description in edit mode
/>
```

Note: The SortableTree uses a different component structure. Find where TreeItem is rendered
inside SortableTreeItem (or equivalent) and add `showDescription={false}`.

**Step 5: Commit**

```bash
git add components/sortable-grid/Grid.tsx components/sortable-grid/SortableGridItem.tsx
git add components/sortable-tree/Tree.tsx components/sortable-tree/SortableTree.tsx
git commit -m "feat(ui): show description in view mode, hide in edit mode"
```

---

## Task 12: Update Item Utilities for Description

**Files:**

- Modify: `lib/item-utils.ts`

**Step 1: Update conversion functions**

Ensure `itemsToTreeItems` and related functions include description in the transformation:

```typescript
// In the map function, include description
const treeItem: TreeItem = {
  id: item.id,
  name: item.name,
  description: item.description,
  order: item.order,
  depth: item.depth,
  parentId: item.parentId,
  children: [],
  artworkId: item.artworkId,
  sftpPath: item.sftpPath,
  connectionId: item.connectionId,
};
```

**Step 2: Commit**

```bash
git add lib/item-utils.ts
git commit -m "feat(utils): include description in tree item transformations"
```

---

## Task 13: E2E Tests for Description Feature

**Files:**

- Create: `e2e/journeys/items/items-description.spec.ts`

**Step 1: Create E2E test file**

```typescript
/**
 * E2E tests for item description feature.
 * Tests adding, editing, and displaying descriptions.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Item Description Feature", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("items-desc");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("can add description via settings dialog", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Folder With Description");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Folder With Description");

    // Fill in description
    const descInput = itemsPage.page.getByLabel(/description/i);
    await descInput.fill("This is a test description");
    await itemsPage.page
      .getByRole("button", { name: /^save$/i })
      .last()
      .click();

    // Wait for success
    await itemsPage.expectSuccessToast("Description updated");

    await itemsPage.closeSettingsDialog();
  });

  test("shows character count for description", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Char Count Test");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Char Count Test");

    const descInput = itemsPage.page.getByLabel(/description/i);
    await descInput.fill("Hello");

    // Should show 5/200
    await expect(itemsPage.page.getByText("5/200")).toBeVisible();

    await itemsPage.closeSettingsDialog();
  });

  test("displays description in grid view", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Grid Desc Test");
    await itemsPage.waitForToastToDisappear();

    // Add description
    await itemsPage.openSettingsViaContextMenu("Grid Desc Test");
    await itemsPage.page.getByLabel(/description/i).fill("Visible in grid");
    await itemsPage.page
      .getByRole("button", { name: /^save$/i })
      .last()
      .click();
    await itemsPage.expectSuccessToast("Description updated");
    await itemsPage.closeSettingsDialog();

    // Switch to grid view and check description is visible
    await itemsPage.switchToGridView();
    await expect(itemsPage.page.getByText("Visible in grid")).toBeVisible();
  });

  test("displays description in tree view", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Tree Desc Test");
    await itemsPage.waitForToastToDisappear();

    // Add description
    await itemsPage.openSettingsViaContextMenu("Tree Desc Test");
    await itemsPage.page.getByLabel(/description/i).fill("Visible in tree");
    await itemsPage.page
      .getByRole("button", { name: /^save$/i })
      .last()
      .click();
    await itemsPage.expectSuccessToast("Description updated");
    await itemsPage.closeSettingsDialog();

    // Switch to tree view and check description is visible
    await itemsPage.switchToTreeView();
    await expect(itemsPage.page.getByText("Visible in tree")).toBeVisible();
  });

  test("can clear description", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Clear Desc Test");
    await itemsPage.waitForToastToDisappear();

    // Add description first
    await itemsPage.openSettingsViaContextMenu("Clear Desc Test");
    await itemsPage.page.getByLabel(/description/i).fill("To be cleared");
    await itemsPage.page
      .getByRole("button", { name: /^save$/i })
      .last()
      .click();
    await itemsPage.expectSuccessToast("Description updated");

    // Clear description
    await itemsPage.page.getByLabel(/description/i).clear();
    await itemsPage.page
      .getByRole("button", { name: /^save$/i })
      .last()
      .click();
    await itemsPage.expectSuccessToast("Description updated");

    await itemsPage.closeSettingsDialog();

    // Description should not be visible
    await expect(itemsPage.page.getByText("To be cleared")).not.toBeVisible();
  });

  test("description save button disabled when unchanged", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Unchanged Desc");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Unchanged Desc");

    // Find the description save button (second save button in dialog)
    const saveButtons = itemsPage.page.getByRole("button", { name: /^save$/i });
    const descSaveButton = saveButtons.last();

    // Should be disabled initially (no description, empty field matches null)
    await expect(descSaveButton).toBeDisabled();

    // Type something
    await itemsPage.page.getByLabel(/description/i).fill("New description");
    await expect(descSaveButton).toBeEnabled();

    // Clear it
    await itemsPage.page.getByLabel(/description/i).clear();
    await expect(descSaveButton).toBeDisabled();

    await itemsPage.closeSettingsDialog();
  });
});
```

**Step 2: Run E2E tests**

Run: `pnpm run test:e2e e2e/journeys/items/items-description.spec.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add e2e/journeys/items/items-description.spec.ts
git commit -m "test(e2e): add item description feature tests"
```

---

## Task 14: Run Full Test Suite

**Step 1: Run all unit tests**

Run: `pnpm run test:unit`
Expected: All tests pass

**Step 2: Run all integration tests**

Run: `pnpm run test:integration`
Expected: All tests pass

**Step 3: Run all E2E tests**

Run: `pnpm run test:e2e`
Expected: All tests pass

**Step 4: Run full check**

Run: `pnpm run check`
Expected: All checks pass (format, lint, type-check, knip, build)

**Step 5: Commit any fixes**

If any tests fail or checks identify issues, fix them and commit.

---

## Task 15: Final Integration and Cleanup

**Step 1: Verify feature works end-to-end**

1. Start dev server: `pnpm run dev`
2. Sign in and create a folder
3. Right-click → Settings
4. Add a description and save
5. Verify description appears in both tree and grid views
6. Edit description and verify changes persist
7. Clear description and verify it's removed

**Step 2: Update any remaining type errors**

Run: `pnpm run type-check`
Fix any TypeScript errors.

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: add short description support to items (v0.17.0)"
```

---

## Summary

This implementation adds:

1. **Database**: New nullable `description` field on Item model (max 200 chars)
2. **Validation**: `itemDescriptionSchema` with length limit and trimming
3. **Server Actions**: Updated `createItem` and `updateItem` to handle descriptions
4. **Types**: Updated `Item`, `TreeItem`, and `ItemWithArtwork` interfaces
5. **UI Components**:
   - ItemSettingsDialog: Description input with character count
   - GridItem: Displays description below item name
   - TreeItem: Displays description as secondary line
6. **Testing**:
   - 7 new unit tests for validation
   - 6 new unit tests for server actions
   - 5 new integration tests
   - 6 new E2E tests

Total estimated new tests: ~24 tests across all levels.
