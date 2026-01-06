# GridItem ProductCard1 Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign GridItem to match shadcnblocks ProductCard1 aesthetic with file counts instead of price. Also fix artwork sizing in both Grid and Tree views.

**Architecture:** Replace custom GridItem styling with shadcn Card primitives (CardHeader, CardContent, CardTitle, CardDescription). Use AspectRatio for consistent image sizing. Add file count aggregation to item queries.

**Tech Stack:** shadcn/ui (Card, AspectRatio, Badge), Prisma, React

---

## Visual Structure

```
┌─────────────────────────────┐
│ CardHeader (p-0)            │
│ ┌─────────────────────────┐ │
│ │ AspectRatio (1.27:1)    │ │
│ │                         │ │
│ │ [Connection Badge]      │ │
│ │  ↖ top-left overlay     │ │
│ │                         │ │
│ │   Artwork / Folder Icon │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ CardContent                 │
│                             │
│ CardTitle (truncate)        │
│ CardDescription (truncate)  │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🎬 2  🖼 1  📄 0        │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

## Design Decisions

| Decision                  | Choice                                            |
| ------------------------- | ------------------------------------------------- |
| Bottom section content    | File counts by type (media, artwork, subtitles)   |
| Empty state               | "No files attached" text hint                     |
| Connection badge position | Overlay on image top-left                         |
| Aspect ratio              | 1.27:1 (match ProductCard1)                       |
| Drag states               | Preserved from current implementation             |
| Card padding              | `p-0` override (Card defaults to `py-6 gap-6`)    |
| Text overflow             | `truncate` class on CardTitle and CardDescription |

---

## Validation Issues (Resolved)

### 🔴 Issue 1: Query Strategy (RESOLVED)

**Problem:** Prisma `_count` cannot return multiple conditional counts in one query.

**Solution:** Include files with minimal select and count in JS:

```ts
// In Prisma query
include: {
  files: {
    select: { fileType: true },  // Minimal - just need type for counting
  },
  // Keep existing artwork query
}

// In transform function
const fileCounts = {
  media: item.files.filter(f => f.fileType === 'MEDIA').length,
  artwork: item.files.filter(f => f.fileType === 'ARTWORK').length,
  subtitles: item.files.filter(f => f.fileType === 'SUBTITLE').length,
};
```

### 🔴 Issue 2: forwardRef Pattern (RESOLVED)

**Problem:** Current GridItem uses `forwardRef` for dnd-kit. Card doesn't use forwardRef.

**Solution:** Keep outer wrapper div with ref, Card as inner styling:

```tsx
export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  function GridItem({ ... }, ref) {
    return (
      <div
        ref={ref}           // ← dnd-kit ref on outer div
        data-id={String(id)}
        className={cn(isDragging && "...", isOverlay && "...")}
        {...handleProps}
      >
        <Card className="h-full overflow-hidden p-0">
          {/* Card content */}
        </Card>
      </div>
    );
  }
);
```

### 🟡 Issue 3: Card Default Padding (RESOLVED)

**Problem:** Card has `py-6 gap-6` by default.

**Solution:** Use `p-0` override like ProductCard1:

```tsx
<Card className="h-full overflow-hidden p-0">
```

### 🟡 Issue 4: Text Truncation (RESOLVED)

**Problem:** Plan didn't specify truncation behavior.

**Solution:** Add `truncate` class:

```tsx
<CardTitle className="truncate text-base font-semibold">{name}</CardTitle>
<CardDescription className="truncate">{description}</CardDescription>
```

---

## Artwork Sizing Fix

### Current Problem

| View     | Current Size         | Issue                                 |
| -------- | -------------------- | ------------------------------------- |
| TreeItem | `size-5` (20px)      | Extremely small, over-compressed      |
| GridItem | `h-24` (96px height) | Fixed height, doesn't scale with card |

### Solution

**GridItem (this redesign):**

- Use `AspectRatio` at 1.27:1 ratio
- Image fills full card width, height determined by ratio
- `object-cover` ensures proper scaling without distortion

```tsx
<AspectRatio ratio={1.268115942} className="overflow-hidden">
  <img
    src={`/api/artwork/${artworkId}`}
    alt=""
    className="size-full object-cover object-center"
  />
</AspectRatio>
```

**TreeItem (additional fix):**

- Increase from `size-5` (20px) to `size-8` (32px) for better visibility
- Add `aspect-square` for consistent shape

```tsx
// TreeItem.tsx line 181
<div className="size-8 overflow-hidden rounded">
  <img
    src={`/api/artwork/${artworkId}`}
    alt=""
    className="size-full object-cover"
  />
</div>
```

---

## File Counts Display

Match Item Settings dialog style (lines 250-268 of `item-settings-dialog.tsx`):

```tsx
{
  fileCounts ? (
    <div className="text-muted-foreground flex items-center gap-4 text-sm">
      <span className="flex items-center gap-1.5">
        <Film className="size-4" />
        {fileCounts.media}
      </span>
      <span className="flex items-center gap-1.5">
        <ImageIcon className="size-4" />
        {fileCounts.artwork}
      </span>
      <span className="flex items-center gap-1.5">
        <FileText className="size-4" />
        {fileCounts.subtitles}
      </span>
    </div>
  ) : (
    <span className="text-muted-foreground/60 text-xs">No files attached</span>
  );
}
```

---

## Implementation Scope

### Files to Modify

| File                                                        | Change                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `lib/types.ts`                                              | Add `fileCounts` to `ItemWithArtwork` type                     |
| `lib/item-actions.ts`                                       | Include `files: { select: { fileType: true } }`, add transform |
| `lib/sftp-actions.ts`                                       | Same query change for `getItemsByConnection`                   |
| `components/sortable-grid/GridItem.tsx`                     | Rewrite using Card, AspectRatio, Badge                         |
| `components/sortable-tree/components/TreeItem/TreeItem.tsx` | Increase artwork size to `size-8`                              |

### Files Unchanged

- `Grid.tsx` / `SortableGrid.tsx` - containers only
- `SortableGridItem.tsx` - wraps GridItem, no changes needed

### Cleanup After Implementation

Delete these reference files:

- `components/product-card1.tsx`
- `components/shadcnblocks/price.tsx`

---

## Props Interface

```ts
interface GridItemProps {
  id: UniqueIdentifier;
  name: string;
  description?: string | null;
  isDragging?: boolean;
  isOverlay?: boolean;
  handleProps?: Record<string, unknown>;
  onClick?(): void;
  sftpPath?: string | null;
  artworkId?: string | null;
  showArtwork?: boolean;
  showDescription?: boolean;
  connectionName?: string | null;
  // NEW
  fileCounts?: {
    media: number;
    artwork: number;
    subtitles: number;
  };
}
```

---

## Type Extension

```ts
// lib/types.ts
interface ItemWithArtwork {
  id: string;
  name: string;
  description: string | null;
  order: number;
  parentId: string | null;
  sftpPath: string | null;
  artworkId: string | null;
  connectionName: string | null;
  // NEW
  fileCounts: {
    media: number;
    artwork: number;
    subtitles: number;
  };
}
```

---

## Testing Checklist

- [ ] Grid view displays file counts correctly
- [ ] Empty items show "No files attached"
- [ ] Connection badge overlays on artwork
- [ ] Folder icon fallback when no artwork
- [ ] Drag and drop still works in edit mode
- [ ] Drag overlay renders correctly
- [ ] TreeItem artwork size increased and visible
- [ ] Long item names truncate properly
- [ ] Long descriptions truncate properly
- [ ] Dark mode styling correct
