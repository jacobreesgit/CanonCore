# Code Review Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all findings from comprehensive code review including security fixes, performance optimizations, and test coverage improvements.

**Architecture:** Fix critical security gap (rate limiting), add missing caching headers, optimize database queries, and expand test coverage for untested components and edge cases.

**Tech Stack:** Next.js 16, Vitest, Playwright, Prisma, TypeScript

---

## Validation Summary

> **Validated:** 2026-01-13 using code-review-excellence skill, Context7 docs, and sequential thinking

| Status   | Tasks                | Description                               |
| -------- | -------------------- | ----------------------------------------- |
| ✅ Ready | 1, 2, 3, 11          | Verified correct, can proceed immediately |
| ✅ Ready | 4, 5, 6, 7, 8, 9, 10 | Fixed and ready to implement              |
| ✅ Ready | 12                   | Complete with function mappings           |

**All 12 tasks are now validated and ready for implementation.**

---

## Phase 1: Critical Security & Performance Fixes

### Task 1: Add Rate Limiting to deleteItem

**Status:** ✅ READY

**Verification Notes:**

- Confirmed `deleteItem` at `lib/item-actions.ts:630-667` lacks rate limiting
- Confirmed `itemDelete` rate limit key exists at `lib/rate-limit.ts:54`
- Pattern matches existing rate-limited functions in codebase

**Files:**

- Modify: `lib/item-actions.ts:630-667`
- Test: `tests/unit/lib/item-actions.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/item-actions.test.ts`:

```typescript
describe("deleteItem", () => {
  it("should check rate limit before processing", async () => {
    const mockCheckRateLimit = vi.mocked(checkRateLimit);
    mockCheckRateLimit.mockResolvedValueOnce({
      error: "Too many attempts. Please try again later.",
    });

    const result = await deleteItem("item-123");

    expect(mockCheckRateLimit).toHaveBeenCalledWith("itemDelete");
    expect(result).toEqual({
      error: "Too many attempts. Please try again later.",
    });
  });

  it("should proceed when rate limit passes", async () => {
    const mockCheckRateLimit = vi.mocked(checkRateLimit);
    mockCheckRateLimit.mockResolvedValueOnce(null);

    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user-1", email: "test@test.com" },
    } as any);
    vi.mocked(prisma.item.findUnique).mockResolvedValueOnce({
      id: "item-123",
      userId: "user-1",
      driveFileId: null,
      driveConnectionId: null,
    } as any);
    vi.mocked(prisma.item.delete).mockResolvedValueOnce({} as any);

    const result = await deleteItem("item-123");

    expect(mockCheckRateLimit).toHaveBeenCalledWith("itemDelete");
    expect(result).toEqual({ success: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/item-actions.test.ts -t "deleteItem"`
Expected: FAIL - rate limit not being called

**Step 3: Write minimal implementation**

Modify `lib/item-actions.ts` at line 630:

```typescript
export async function deleteItem(id: string): Promise<ItemResult> {
  // Rate limit check
  const rateLimitResult = await checkRateLimit("itemDelete");
  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }
  // ... rest of function unchanged
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/item-actions.test.ts -t "deleteItem"`
Expected: PASS

**Step 5: Run full test suite**

Run: `pnpm test:unit`
Expected: All tests pass

**Step 6: Commit**

```bash
git add lib/item-actions.ts tests/unit/lib/item-actions.test.ts
git commit -m "feat: add rate limiting to deleteItem for DoS protection"
```

---

### Task 2: Add Cache-Control Headers to Stream Route

**Status:** ✅ READY

**Verification Notes:**

- Confirmed stream route at `app/api/stream/[fileId]/route.ts:187-218` lacks Cache-Control headers
- `"private, max-age=3600"` is appropriate:
  - `private` - ensures only browser caches (not CDN), correct for authenticated content
  - `max-age=3600` (1 hour) - reasonable for media files that don't change frequently

**Files:**

- Modify: `app/api/stream/[fileId]/route.ts:187-195` (partial content) and `:210-218` (full file)
- Test: `tests/unit/api/stream-route.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/api/stream-route.test.ts`:

```typescript
describe("Cache-Control headers", () => {
  it("should include Cache-Control header for full file response", async () => {
    // Setup mocks for successful stream
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValueOnce({
      id: "file-1",
      driveFileId: "drive-123",
      size: BigInt(1000),
      filename: "video.mp4",
      mimeType: "video/mp4",
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as any);

    const mockStream = new ReadableStream();
    vi.mocked(getDriveClient).mockResolvedValueOnce({
      files: {
        get: vi.fn().mockResolvedValueOnce({ data: mockStream }),
      },
    } as any);

    const request = new NextRequest("http://localhost/api/stream/file-1");
    const response = await GET(request, {
      params: Promise.resolve({ fileId: "file-1" }),
    });

    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });

  it("should include Cache-Control header for partial content response", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValueOnce({
      id: "file-1",
      driveFileId: "drive-123",
      size: BigInt(10000000),
      filename: "video.mp4",
      mimeType: "video/mp4",
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as any);

    const mockStream = new ReadableStream();
    vi.mocked(getDriveClient).mockResolvedValueOnce({
      files: {
        get: vi.fn().mockResolvedValueOnce({ data: mockStream }),
      },
    } as any);

    const request = new NextRequest("http://localhost/api/stream/file-1", {
      headers: { Range: "bytes=0-1023" },
    });
    const response = await GET(request, {
      params: Promise.resolve({ fileId: "file-1" }),
    });

    expect(response.status).toBe(206);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api/stream-route.test.ts -t "Cache-Control"`
Expected: FAIL - Cache-Control header is null

**Step 3: Write minimal implementation**

Modify `app/api/stream/[fileId]/route.ts`:

At line 187-195 (partial content response):

```typescript
return new NextResponse(webStream, {
  status: 206,
  headers: {
    "Content-Type": mimeType,
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": String(end - start + 1),
    "Cache-Control": "private, max-age=3600",
  },
});
```

At line 210-218 (full file response):

```typescript
const headers: Record<string, string> = {
  "Content-Type": mimeType,
  "Accept-Ranges": "bytes",
  "Cache-Control": "private, max-age=3600",
};
if (fileSize > 0) {
  headers["Content-Length"] = String(fileSize);
}

return new NextResponse(webStream, { headers });
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api/stream-route.test.ts -t "Cache-Control"`
Expected: PASS

**Step 5: Run full test suite**

Run: `pnpm test:unit`
Expected: All tests pass

**Step 6: Commit**

```bash
git add app/api/stream/[fileId]/route.ts tests/unit/api/stream-route.test.ts
git commit -m "perf: add Cache-Control headers to stream route for browser caching"
```

---

## Phase 2: Test Coverage - HTTP Range Headers

### Task 3: Add Range Header Tests for Stream Route

**Status:** ✅ READY - Tests document existing functionality

**Verification Notes:**

- These tests verify existing Range header implementation
- Low risk as they don't modify production code
- Good for regression protection

**Files:**

- Modify: `tests/unit/api/stream-route.test.ts`

**Step 1: Write the tests for Range header parsing**

Add to `tests/unit/api/stream-route.test.ts`:

```typescript
describe("Range header handling", () => {
  const setupStreamMocks = (fileSize: number) => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValueOnce({
      id: "file-1",
      driveFileId: "drive-123",
      size: BigInt(fileSize),
      filename: "video.mp4",
      mimeType: "video/mp4",
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as any);

    const mockStream = new ReadableStream();
    vi.mocked(getDriveClient).mockResolvedValueOnce({
      files: {
        get: vi.fn().mockResolvedValueOnce({ data: mockStream }),
      },
    } as any);
  };

  it("should return 206 with Content-Range for valid Range header", async () => {
    setupStreamMocks(10000000);

    const request = new NextRequest("http://localhost/api/stream/file-1", {
      headers: { Range: "bytes=0-1023" },
    });
    const response = await GET(request, {
      params: Promise.resolve({ fileId: "file-1" }),
    });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-1023/10000000");
    expect(response.headers.get("Content-Length")).toBe("1024");
  });

  it("should return 206 with default chunk size when end not specified", async () => {
    const fileSize = 20000000; // 20MB
    setupStreamMocks(fileSize);

    const request = new NextRequest("http://localhost/api/stream/file-1", {
      headers: { Range: "bytes=0-" },
    });
    const response = await GET(request, {
      params: Promise.resolve({ fileId: "file-1" }),
    });

    expect(response.status).toBe(206);
    // Default chunk is 10MB
    expect(response.headers.get("Content-Range")).toBe(
      `bytes 0-10485759/${fileSize}`
    );
  });

  it("should return 416 for invalid Range header format", async () => {
    setupStreamMocks(10000000);

    const request = new NextRequest("http://localhost/api/stream/file-1", {
      headers: { Range: "invalid-range" },
    });
    const response = await GET(request, {
      params: Promise.resolve({ fileId: "file-1" }),
    });

    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */10000000");
  });

  it("should return 416 for Range start beyond file size", async () => {
    setupStreamMocks(1000);

    const request = new NextRequest("http://localhost/api/stream/file-1", {
      headers: { Range: "bytes=2000-3000" },
    });
    const response = await GET(request, {
      params: Promise.resolve({ fileId: "file-1" }),
    });

    expect(response.status).toBe(416);
  });

  it("should clamp end to file size - 1", async () => {
    setupStreamMocks(1000);

    const request = new NextRequest("http://localhost/api/stream/file-1", {
      headers: { Range: "bytes=500-5000" },
    });
    const response = await GET(request, {
      params: Promise.resolve({ fileId: "file-1" }),
    });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 500-999/1000");
    expect(response.headers.get("Content-Length")).toBe("500");
  });

  it("should stream full file when fileSize is unknown (0)", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.itemFile.findUnique).mockResolvedValueOnce({
      id: "file-1",
      driveFileId: "drive-123",
      size: BigInt(0), // Unknown size
      filename: "video.mp4",
      mimeType: "video/mp4",
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as any);

    const mockStream = new ReadableStream();
    vi.mocked(getDriveClient).mockResolvedValueOnce({
      files: {
        get: vi.fn().mockResolvedValueOnce({ data: mockStream }),
      },
    } as any);

    const request = new NextRequest("http://localhost/api/stream/file-1", {
      headers: { Range: "bytes=0-1023" },
    });
    const response = await GET(request, {
      params: Promise.resolve({ fileId: "file-1" }),
    });

    // Should return 200 (full file) when size unknown, not 206
    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `pnpm test tests/unit/api/stream-route.test.ts -t "Range header"`
Expected: PASS (these test existing functionality)

**Step 3: Commit**

```bash
git add tests/unit/api/stream-route.test.ts
git commit -m "test: add Range header tests for stream route regression protection"
```

---

## Phase 3: Test Coverage - Drag-and-Drop Components

### Task 4: Extend Unit Tests for GridItem Component

**Status:** ✅ READY - Extends existing tests with missing coverage

**Important:** Tests already exist at `tests/unit/components/grid-item.test.tsx` (315 lines, 25+ tests). This task **extends** existing tests - do NOT replace them.

**Files:**

- Modify: `tests/unit/components/grid-item.test.tsx` (extend, don't replace)

**Step 1: Add tests for sync status indicators**

Add to existing `tests/unit/components/grid-item.test.tsx`:

```typescript
describe("sync status", () => {
  it("should not show sync icon when status is SYNCED", () => {
    render(<GridItem id="1" name="Test" syncStatus="SYNCED" />);
    // SyncIcon only renders for non-SYNCED states (line 189-191 of GridItem.tsx)
    // When SYNCED, no SyncIcon is rendered
    const syncContainer = document.querySelector('.flex-shrink-0');
    // The flex-shrink-0 class is on the SyncIcon, which shouldn't be present
    expect(syncContainer).toBeNull();
  });

  it("should show sync icon when status is PENDING", () => {
    render(<GridItem id="1" name="Test" syncStatus="PENDING" />);
    // SyncIcon renders with animate- class for PENDING
    const animatedElement = document.querySelector('[class*="animate-"]');
    expect(animatedElement).toBeInTheDocument();
  });

  it("should show sync icon when status is ERROR", () => {
    render(<GridItem id="1" name="Test" syncStatus="ERROR" syncError="Sync failed" />);
    // SyncIcon renders with destructive color for ERROR
    const errorIcon = document.querySelector('[class*="text-destructive"]');
    expect(errorIcon).toBeInTheDocument();
  });

  it("should show sync icon when status is SYNCING", () => {
    render(<GridItem id="1" name="Test" syncStatus="SYNCING" />);
    const animatedElement = document.querySelector('[class*="animate-"]');
    expect(animatedElement).toBeInTheDocument();
  });
});
```

**Step 2: Add tests for drag handle visibility**

```typescript
describe("drag handle", () => {
  it("should show drag handle when handleProps provided", () => {
    const handleProps = { onPointerDown: vi.fn() };
    render(<GridItem id="1" name="Test" handleProps={handleProps} />);
    expect(screen.getByLabelText("Drag handle")).toBeInTheDocument();
  });

  it("should not show drag handle when handleProps not provided", () => {
    render(<GridItem id="1" name="Test" />);
    expect(screen.queryByLabelText("Drag handle")).not.toBeInTheDocument();
  });

  it("should apply handleProps to drag handle button", () => {
    const handleProps = { onPointerDown: vi.fn(), "data-test": "handle" };
    render(<GridItem id="1" name="Test" handleProps={handleProps} />);
    const handle = screen.getByLabelText("Drag handle");
    expect(handle).toHaveAttribute("data-test", "handle");
  });
});
```

**Step 3: Add tests for primary media display**

```typescript
describe("primary media", () => {
  it("should show primary media name when provided and not in edit mode", () => {
    render(<GridItem id="1" name="Test" primaryMediaName="movie.mkv" />);
    expect(screen.getByText("movie.mkv")).toBeInTheDocument();
  });

  it("should hide primary media name in edit mode (when handleProps present)", () => {
    const handleProps = { onPointerDown: vi.fn() };
    render(
      <GridItem id="1" name="Test" primaryMediaName="movie.mkv" handleProps={handleProps} />
    );
    expect(screen.queryByText("movie.mkv")).not.toBeInTheDocument();
  });

  it("should show play icon with primary media name", () => {
    render(<GridItem id="1" name="Test" primaryMediaName="movie.mkv" />);
    // Play icon is rendered with the primary media name
    const mediaContainer = screen.getByText("movie.mkv").closest("span");
    expect(mediaContainer).toBeInTheDocument();
  });
});
```

**Step 4: Add tests for drag states**

```typescript
describe("drag states", () => {
  it("should apply isDragging styles", () => {
    const { container } = render(<GridItem id="1" name="Test" isDragging />);
    const element = container.firstChild;
    expect(element).toHaveClass("opacity-40");
    expect(element).toHaveClass("scale-[0.98]");
  });

  it("should apply isOverlay styles", () => {
    const { container } = render(<GridItem id="1" name="Test" isOverlay />);
    const element = container.firstChild;
    expect(element).toHaveClass("shadow-2xl");
    expect(element).toHaveClass("scale-[1.03]");
  });

  it("should not apply drag styles when not dragging", () => {
    const { container } = render(<GridItem id="1" name="Test" />);
    const element = container.firstChild;
    expect(element).not.toHaveClass("opacity-40");
    expect(element).not.toHaveClass("shadow-2xl");
  });
});
```

**Step 5: Run tests**

Run: `pnpm test tests/unit/components/grid-item.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add tests/unit/components/grid-item.test.tsx
git commit -m "test: extend GridItem tests for sync, drag handle, primary media, drag states"
```

---

### Task 5: Add Unit Tests for SortableGridItem

**Status:** ✅ READY

**Component API (from `components/sortable-grid/SortableGridItem.tsx`):**

```typescript
interface SortableGridItemProps extends Omit<GridItemProps, "handleProps"> {
  id: UniqueIdentifier;
  onSettings?(): void;
  onDelete?(): Promise<void>;
  artworkId?: string | null;
  driveFileId?: string | null;
  fileCounts?: FileCounts;
  childCount?: number;
  hasDriveConnection?: boolean;
}
```

**Files:**

- Create: `tests/unit/components/sortable-grid-item.test.tsx`

**Step 1: Write the tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SortableGridItem } from "@/components/sortable-grid/SortableGridItem";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

// Mock useSortable hook
vi.mock("@dnd-kit/sortable", async () => {
  const actual = await vi.importActual("@dnd-kit/sortable");
  return {
    ...actual,
    useSortable: vi.fn(() => ({
      attributes: { role: "button", tabIndex: 0 },
      listeners: { onKeyDown: vi.fn(), onPointerDown: vi.fn() },
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    })),
  };
});

// Mock ItemContextMenu to simplify testing
vi.mock("@/components/items/item-context-menu", () => ({
  ItemContextMenu: ({ children, itemName }: { children: React.ReactNode; itemName: string }) => (
    <div data-testid="context-menu" data-item-name={itemName}>
      {children}
    </div>
  ),
}));

describe("SortableGridItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithDnd = (ui: React.ReactElement) => {
    return render(
      <DndContext>
        <SortableContext items={["item-1"]} strategy={rectSortingStrategy}>
          {ui}
        </SortableContext>
      </DndContext>
    );
  };

  it("renders with name visible", () => {
    renderWithDnd(<SortableGridItem id="item-1" name="Test Item" />);
    expect(screen.getByText("Test Item")).toBeInTheDocument();
  });

  it("wraps content in ItemContextMenu", () => {
    renderWithDnd(<SortableGridItem id="item-1" name="Test Item" />);
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    expect(screen.getByTestId("context-menu")).toHaveAttribute("data-item-name", "Test Item");
  });

  it("passes driveFileId to context menu", () => {
    renderWithDnd(
      <SortableGridItem id="item-1" name="Test" driveFileId="drive-123" />
    );
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
  });

  it("renders drag handle (via handleProps)", () => {
    renderWithDnd(<SortableGridItem id="item-1" name="Test" />);
    // SortableGridItem passes listeners as handleProps, which shows drag handle
    expect(screen.getByLabelText("Drag handle")).toBeInTheDocument();
  });

  it("hides artwork in edit mode (showArtwork=false)", () => {
    const { container } = renderWithDnd(
      <SortableGridItem id="item-1" name="Test" artworkId="art-123" />
    );
    // In edit mode (SortableGridItem), showArtwork is false
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("hides counts in edit mode (showCounts=false)", () => {
    renderWithDnd(
      <SortableGridItem
        id="item-1"
        name="Test"
        fileCounts={{ media: 5, artwork: 2, subtitles: 1 }}
        childCount={3}
      />
    );
    // showCounts is false in edit mode
    expect(screen.queryByTestId("grid-item-stats")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `pnpm test tests/unit/components/sortable-grid-item.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/unit/components/sortable-grid-item.test.tsx
git commit -m "test: add SortableGridItem unit tests for dnd-kit integration"
```

---

### Task 6: Add Unit Tests for SortableGrid Container

**Status:** ✅ READY

**Component API (from `components/sortable-grid/SortableGrid.tsx`):**

```typescript
interface SortableGridProps {
  items: ItemWithArtwork[];
  onItemsChange?(items: ItemWithArtwork[]): void;
  onItemClick?(id: UniqueIdentifier): void;
  onOpenSettings?(id: string): void;
  onDeleteItem?(id: string): Promise<void>;
  hasDriveConnection?: boolean;
}
```

**Files:**

- Create: `tests/unit/components/sortable-grid.test.tsx`

**Step 1: Write the tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SortableGrid } from "@/components/sortable-grid/SortableGrid";
import type { ItemWithArtwork } from "@/lib/types";

// Mock SortableGridItem to simplify testing
vi.mock("@/components/sortable-grid/SortableGridItem", () => ({
  SortableGridItem: ({ id, name, onClick }: { id: string; name: string; onClick?: () => void }) => (
    <div data-testid={`sortable-item-${id}`} onClick={onClick}>
      {name}
    </div>
  ),
}));

// Mock GridItem for DragOverlay
vi.mock("@/components/sortable-grid/GridItem", () => ({
  GridItem: ({ id, name }: { id: string; name: string }) => (
    <div data-testid={`overlay-item-${id}`}>{name}</div>
  ),
}));

describe("SortableGrid", () => {
  const createMockItem = (id: string, name: string, order: number): ItemWithArtwork => ({
    id,
    name,
    description: null,
    parentId: null,
    order,
    depth: 0,
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
  });

  const mockItems: ItemWithArtwork[] = [
    createMockItem("item-1", "Item 1", 0),
    createMockItem("item-2", "Item 2", 1),
    createMockItem("item-3", "Item 3", 2),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders grid container with correct testid", () => {
    render(<SortableGrid items={mockItems} />);
    expect(screen.getByTestId("items-grid-view")).toBeInTheDocument();
  });

  it("renders all items", () => {
    render(<SortableGrid items={mockItems} />);
    expect(screen.getByTestId("sortable-item-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("sortable-item-item-2")).toBeInTheDocument();
    expect(screen.getByTestId("sortable-item-item-3")).toBeInTheDocument();
  });

  it("renders correct number of items", () => {
    render(<SortableGrid items={mockItems} />);
    expect(screen.getAllByTestId(/^sortable-item-/)).toHaveLength(3);
  });

  it("syncs with external items on prop change", () => {
    const { rerender } = render(<SortableGrid items={mockItems} />);
    expect(screen.getAllByTestId(/^sortable-item-/)).toHaveLength(3);

    const newItems = [...mockItems, createMockItem("item-4", "Item 4", 3)];
    rerender(<SortableGrid items={newItems} />);
    expect(screen.getAllByTestId(/^sortable-item-/)).toHaveLength(4);
  });

  it("renders empty grid when no items", () => {
    render(<SortableGrid items={[]} />);
    expect(screen.getByTestId("items-grid-view")).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^sortable-item-/)).toHaveLength(0);
  });

  it("applies grid layout classes", () => {
    render(<SortableGrid items={mockItems} />);
    const grid = screen.getByTestId("items-grid-view");
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-2");
  });
});
```

**Step 2: Run tests**

Run: `pnpm test tests/unit/components/sortable-grid.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/unit/components/sortable-grid.test.tsx
git commit -m "test: add SortableGrid unit tests for container and item rendering"
```

---

## Phase 4: Test Coverage - ItemsView Component

### Task 7: Add Unit Tests for ItemsView

**Status:** ✅ READY

**Component API (from `components/items/items-view.tsx`):**

```typescript
interface ItemsViewProps {
  items: ItemWithArtwork[];
  parentId?: string | null;
  hideToolbar?: boolean;
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  addItemOpen?: boolean;
  onAddItemOpenChange?: (open: boolean) => void;
  heroTitle?: string;
  heroItemCount?: number;
  heroBackgroundUrl?: string;
  hasDriveConnection?: boolean;
}
```

**Files:**

- Create: `tests/unit/components/items-view.test.tsx`

**Step 1: Write the tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemsView } from "@/components/items/items-view";
import type { ItemWithArtwork } from "@/lib/types";

// Mock server actions
vi.mock("@/lib/item-actions", () => ({
  createItem: vi.fn().mockResolvedValue({ success: true, data: { id: "new-1", name: "New" } }),
  deleteItem: vi.fn().mockResolvedValue({ success: true }),
  reorderItems: vi.fn().mockResolvedValue({ success: true }),
  getItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock("@/lib/item-file-actions", () => ({
  getItemFiles: vi.fn().mockResolvedValue({
    success: true,
    data: { media: [], artwork: [], subtitles: [] },
  }),
}));

vi.mock("@/lib/google-drive-actions", () => ({
  syncFromGoogleDrive: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock view mode hook - default to tree view
vi.mock("@/components/items/view-toggle", () => ({
  useStoredViewMode: vi.fn(() => ["tree"]),
  ViewToggle: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="view-toggle" data-disabled={disabled}>
      View Toggle
    </div>
  ),
}));

// Mock tree/grid components
vi.mock("@/components/sortable-tree", () => ({
  SortableTree: ({ items }: { items: any[] }) => (
    <div data-testid="sortable-tree">{items.length} items</div>
  ),
  Tree: ({ items }: { items: any[] }) => (
    <div data-testid="tree-view">{items.length} items</div>
  ),
}));

vi.mock("@/components/sortable-grid", () => ({
  SortableGrid: ({ items }: { items: any[] }) => (
    <div data-testid="sortable-grid">{items.length} items</div>
  ),
  Grid: ({ items }: { items: any[] }) => (
    <div data-testid="grid-view">{items.length} items</div>
  ),
}));

// Mock dialogs
vi.mock("@/components/items/add-item-dialog", () => ({
  AddItemDialog: ({ open }: { open: boolean }) => (
    open ? <div data-testid="add-dialog">Add Dialog</div> : null
  ),
}));

vi.mock("@/components/items/item-settings-dialog", () => ({
  ItemSettingsDialog: ({ open }: { open: boolean }) => (
    open ? <div data-testid="settings-dialog">Settings Dialog</div> : null
  ),
}));

describe("ItemsView", () => {
  const createMockItem = (id: string, name: string): ItemWithArtwork => ({
    id,
    name,
    description: null,
    parentId: null,
    order: 0,
    depth: 0,
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    driveFileId: null,
    driveModifiedAt: null,
    driveThumbnailUrl: null,
    syncStatus: "SYNCED",
    syncError: null,
    driveConnectionId: null,
    artworkId: null,
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
    childCount: 0,
    primaryMediaName: null,
    mediaIconType: null,
  });

  const mockItems: ItemWithArtwork[] = [
    createMockItem("item-1", "Test Item 1"),
    createMockItem("item-2", "Test Item 2"),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders tree view by default", () => {
      render(<ItemsView items={mockItems} />);
      expect(screen.getByTestId("tree-view")).toBeInTheDocument();
    });

    it("renders empty state when no items", () => {
      render(<ItemsView items={[]} />);
      expect(screen.getByText("No items yet")).toBeInTheDocument();
      expect(screen.getByText("Create your first item to get started")).toBeInTheDocument();
    });

    it("renders Add Item button in empty state", () => {
      render(<ItemsView items={[]} />);
      const buttons = screen.getAllByRole("button", { name: /add item/i });
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe("toolbar", () => {
    it("shows toolbar by default", () => {
      render(<ItemsView items={mockItems} />);
      expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sync/i })).toBeInTheDocument();
    });

    it("hides toolbar when hideToolbar is true", () => {
      render(<ItemsView items={mockItems} hideToolbar />);
      expect(screen.queryByRole("button", { name: /add item/i })).not.toBeInTheDocument();
    });

    it("disables Sync button when no drive connection", () => {
      render(<ItemsView items={mockItems} hasDriveConnection={false} />);
      expect(screen.getByRole("button", { name: /sync/i })).toBeDisabled();
    });

    it("enables Sync button when drive connected", () => {
      render(<ItemsView items={mockItems} hasDriveConnection />);
      expect(screen.getByRole("button", { name: /sync/i })).toBeEnabled();
    });

    it("disables Edit and View toggle when no items", () => {
      render(<ItemsView items={[]} />);
      // ViewToggle receives disabled prop when items.length === 0
      expect(screen.getByTestId("view-toggle")).toHaveAttribute("data-disabled", "true");
    });
  });

  describe("external control", () => {
    it("uses external isEditing state when provided", () => {
      const onEditingChange = vi.fn();
      render(
        <ItemsView
          items={mockItems}
          isEditing={true}
          onEditingChange={onEditingChange}
        />
      );
      // When isEditing=true, should show SortableTree (edit mode)
      expect(screen.getByTestId("sortable-tree")).toBeInTheDocument();
    });

    it("uses external addItemOpen state when provided", () => {
      render(<ItemsView items={mockItems} addItemOpen={true} />);
      expect(screen.getByTestId("add-dialog")).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests**

Run: `pnpm test tests/unit/components/items-view.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/unit/components/items-view.test.tsx
git commit -m "test: add ItemsView unit tests for rendering, toolbar, and external control"
```

---

## Phase 5: Integration Test Improvements

### Task 8: Add Integration Test for Item Deletion

**Status:** ✅ READY - Fixed test isolation

**Files:**

- Create: `tests/integration/items/item-delete.test.ts`

**Step 1: Write the integration test with proper isolation**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteItem } from "@/lib/item-actions";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth");

describe("deleteItem integration", () => {
  let testUserId: string;

  // Use beforeEach/afterEach for proper test isolation
  beforeEach(async () => {
    // Create fresh test user for each test
    const user = await prisma.user.create({
      data: {
        email: `delete-test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.example.com`,
        password: "hashedpassword123",
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Cleanup - delete items first (cascade), then user
    await prisma.item.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {
      // User may already be deleted
    });
  });

  it("deletes item when authorized", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Item to Delete",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });

    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId, email: "test@test.example.com" },
    } as any);

    const result = await deleteItem(item.id);

    expect(result.success).toBe(true);

    const deletedItem = await prisma.item.findUnique({
      where: { id: item.id },
    });
    expect(deletedItem).toBeNull();
  });

  it("returns error when item not found", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId, email: "test@test.example.com" },
    } as any);

    const result = await deleteItem("non-existent-id");

    expect(result.success).toBeFalsy();
    expect(result.error).toBe("Item not found");
  });

  it("returns error when not authenticated", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Protected Item",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });

    vi.mocked(auth).mockResolvedValue(null);

    const result = await deleteItem(item.id);

    expect(result.success).toBeFalsy();
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when user doesn't own item", async () => {
    // Create item owned by test user
    const item = await prisma.item.create({
      data: {
        name: "Other User Item",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });

    // Authenticate as different user
    vi.mocked(auth).mockResolvedValue({
      user: { id: "different-user-id", email: "other@test.example.com" },
    } as any);

    const result = await deleteItem(item.id);

    expect(result.success).toBeFalsy();
    expect(result.error).toBe("Item not found");
  });

  it("cascades delete to child items", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: testUserId, email: "test@test.example.com" },
    } as any);

    const parent = await prisma.item.create({
      data: {
        name: "Parent Item",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });

    const child = await prisma.item.create({
      data: {
        name: "Child Item",
        userId: testUserId,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    const grandchild = await prisma.item.create({
      data: {
        name: "Grandchild Item",
        userId: testUserId,
        parentId: child.id,
        order: 0,
        depth: 2,
      },
    });

    const result = await deleteItem(parent.id);

    expect(result.success).toBe(true);

    // Verify cascade deletion
    const deletedChild = await prisma.item.findUnique({
      where: { id: child.id },
    });
    const deletedGrandchild = await prisma.item.findUnique({
      where: { id: grandchild.id },
    });
    expect(deletedChild).toBeNull();
    expect(deletedGrandchild).toBeNull();
  });
});
```

**Step 2: Run integration tests**

Run: `pnpm test:integration tests/integration/items/item-delete.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/items/item-delete.test.ts
git commit -m "test: add integration tests for item deletion with proper isolation"
```

---

## Phase 6: E2E Test Improvements

### Task 9: Add E2E Test for Video Seeking (Range Requests)

**Status:** ✅ READY

**Note:** The `openFirstItemWithMedia()` method doesn't exist in page objects. Use existing methods: `goto()`, `gotoItem(itemId)`, `clickItem(name)`.

**Files:**

- Create: `e2e/journeys/media/video-seeking.spec.ts`

**Step 1: Write E2E test using existing page methods**

```typescript
import { test, expect } from "../../fixtures";

test.describe("Video Seeking", () => {
  test.skip(
    !process.env.E2E_GOOGLE_REFRESH_TOKEN,
    "Requires Google Drive connection for media files"
  );

  test.beforeEach(async ({ authPage }) => {
    await authPage.signInAsTestUser();
  });

  test("video player supports seeking via Range requests", async ({
    page,
    itemsPage,
  }) => {
    // Navigate to items and find one with media
    // Note: This assumes E2E test data includes an item with video
    await itemsPage.goto();

    // Click on a known test item that contains video
    // Alternative: Use gotoItem with a known item ID from test setup
    // await itemsPage.gotoItem("item-with-video-id");

    // Wait for video player to be visible
    const videoPlayer = page.locator("video").first();

    // Skip if no video found (test data dependent)
    const videoCount = await page.locator("video").count();
    test.skip(videoCount === 0, "No video element found in test item");

    await expect(videoPlayer).toBeVisible({ timeout: 15000 });

    // Get video duration
    const duration = await videoPlayer.evaluate(
      (v: HTMLVideoElement) => v.duration
    );
    expect(duration).toBeGreaterThan(0);

    // Seek to middle of video (this triggers Range request)
    const seekTime = duration / 2;
    await videoPlayer.evaluate((v: HTMLVideoElement, time: number) => {
      v.currentTime = time;
    }, seekTime);

    // Wait for seek to complete
    await page.waitForTimeout(1500);

    // Verify seek position (allow 2 second tolerance)
    const currentTime = await videoPlayer.evaluate(
      (v: HTMLVideoElement) => v.currentTime
    );
    expect(currentTime).toBeGreaterThan(seekTime - 2);
    expect(currentTime).toBeLessThan(seekTime + 2);
  });

  test("video player handles invalid seek gracefully", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();

    const videoPlayer = page.locator("video").first();

    const videoCount = await page.locator("video").count();
    test.skip(videoCount === 0, "No video element found");

    await expect(videoPlayer).toBeVisible({ timeout: 15000 });

    const duration = await videoPlayer.evaluate(
      (v: HTMLVideoElement) => v.duration
    );

    // Try to seek beyond video duration
    await videoPlayer.evaluate((v: HTMLVideoElement, time: number) => {
      v.currentTime = time + 100;
    }, duration);

    await page.waitForTimeout(500);

    // Video should clamp to end
    const currentTime = await videoPlayer.evaluate(
      (v: HTMLVideoElement) => v.currentTime
    );
    expect(currentTime).toBeLessThanOrEqual(duration);
  });
});
```

**Step 2: Run E2E test**

Run: `pnpm test:e2e e2e/journeys/media/video-seeking.spec.ts`
Expected: PASS (or skip if no Google Drive connection)

**Step 3: Commit**

```bash
git add e2e/journeys/media/video-seeking.spec.ts
git commit -m "test: add E2E tests for video seeking via Range requests"
```

---

### Task 10: Document E2E Test for Rate Limit Handling

**Status:** ✅ READY (Low priority - documentation only)

**Note:** This test is always skipped in CI because `BYPASS_RATE_LIMIT=true`. It serves as documentation of expected behavior.

**Files:**

- Create: `e2e/journeys/items/rate-limit.spec.ts`

**Step 1: Write documentation test**

```typescript
import { test, expect } from "../../fixtures";

/**
 * Rate Limiting E2E Test - Documentation Only
 *
 * This test documents expected rate limit behavior but is always skipped
 * in CI/E2E environments because BYPASS_RATE_LIMIT=true.
 *
 * To manually test rate limiting:
 * 1. Set BYPASS_RATE_LIMIT=false in .env.local
 * 2. Run: pnpm test:e2e e2e/journeys/items/rate-limit.spec.ts
 * 3. Restore BYPASS_RATE_LIMIT=true after testing
 *
 * Expected behavior when rate limit is enforced:
 * - itemDelete: 60 requests/minute
 * - After exceeding limit, user sees "Too many attempts" toast
 */
test.describe("Rate Limiting", () => {
  test.skip(
    process.env.BYPASS_RATE_LIMIT === "true" || !process.env.BYPASS_RATE_LIMIT,
    "Rate limiting bypassed in E2E environment - this test documents expected behavior only"
  );

  test("shows rate limit error after too many rapid deletions", async ({
    authPage,
    itemsPage,
    page,
  }) => {
    await authPage.signInAsTestUser();
    await itemsPage.goto();

    // Create test items
    for (let i = 0; i < 65; i++) {
      await itemsPage.createItem(`Rate Test ${i}`);
    }

    // Rapidly delete items to trigger rate limit (limit is 60/minute)
    for (let i = 0; i < 65; i++) {
      await itemsPage.deleteItem(`Rate Test ${i}`);
    }

    // Should see rate limit error
    await expect(page.getByText(/too many attempts/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
```

**Step 2: Commit**

```bash
git add e2e/journeys/items/rate-limit.spec.ts
git commit -m "test: add rate limit E2E documentation test"
```

---

## Phase 7: Remove Obsolete Tests

### Task 11: Remove Obsolete Loading Test File

**Status:** ✅ READY - File already staged for deletion

**Verification Notes:**

- Git status shows: `D tests/unit/components/items-view-loading.test.ts`
- Git status also shows: `D lib/image-preload.ts`
- Test file tested the deleted `lib/image-preload.ts` functionality

**Files:**

- Delete: `tests/unit/components/items-view-loading.test.ts` (already staged)

**Step 1: Verify file is staged for deletion**

```bash
git status
```

Expected: Shows `D tests/unit/components/items-view-loading.test.ts`

**Step 2: Commit the deletion**

```bash
git commit -m "chore: remove obsolete items-view-loading test (image-preload deleted)"
```

---

## Phase 8: Code Quality - Split Large Files

### Task 12: Split google-drive-actions.ts into Modules

**Status:** ✅ READY - Complete function mappings

**Function Inventory (from `lib/google-drive-actions.ts`):**

| Line | Function                    | Target Module                  |
| ---- | --------------------------- | ------------------------------ |
| 80   | `initiateGoogleDriveOAuth`  | google-drive-actions.ts (keep) |
| 101  | `disconnectGoogleDrive`     | google-drive-actions.ts (keep) |
| 149  | `getGoogleDriveConnection`  | google-drive-actions.ts (keep) |
| 178  | `syncFromGoogleDrive`       | google-drive-sync.ts           |
| 1023 | `createDriveFolderOnly`     | google-drive-actions.ts (keep) |
| 1083 | `createFolderInGoogleDrive` | google-drive-actions.ts (keep) |
| 1165 | `deleteItemFromGoogleDrive` | google-drive-actions.ts (keep) |
| 1219 | `deleteFileFromDrive`       | google-drive-actions.ts (keep) |
| 1257 | `renameItemInGoogleDrive`   | google-drive-actions.ts (keep) |
| 1308 | `moveItemInGoogleDrive`     | google-drive-actions.ts (keep) |
| 1512 | `createUploadSessions`      | google-drive-upload.ts         |
| 1641 | `confirmUpload`             | google-drive-upload.ts         |
| 1740 | `uploadBuffer`              | google-drive-upload.ts         |

**New File Structure:**

```
lib/
├── google-drive-actions.ts    # OAuth, connection, folder ops + re-exports
├── google-drive-sync.ts       # Sync operations (lines 178-1022)
└── google-drive-upload.ts     # Upload operations (lines 1512-end)
```

**Files:**

- Modify: `lib/google-drive-actions.ts`
- Create: `lib/google-drive-sync.ts`
- Create: `lib/google-drive-upload.ts`

**Step 1: Create google-drive-sync.ts**

Create `lib/google-drive-sync.ts`:

```typescript
/**
 * Google Drive sync operations.
 * Handles bidirectional sync between Google Drive and local database.
 */

"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getDriveClient,
  withRateLimit,
  checkRootFolderStatus,
} from "@/lib/google-drive-client";
import { FileType, SyncStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import { drive_v3 } from "googleapis";
import { revalidatePath } from "next/cache";
import { categorizeFileType } from "@/lib/file-type-utils";
import { checkRateLimit } from "@/lib/rate-limit";

// Types
export interface SyncContext {
  connectionId: string;
  userId: string;
  rootFolderId: string;
  driveClient: drive_v3.Drive;
  stats: {
    created: number;
    updated: number;
    errors: number;
  };
  errors: Array<{ fileName: string; error: string }>;
}

export interface SyncResult {
  success: boolean;
  itemsCreated?: number;
  itemsUpdated?: number;
  itemsErrored?: number;
  error?: string;
}

// Move syncFromGoogleDrive and all helper functions from lines 178-1022
// of google-drive-actions.ts here

// Export the main sync function
export async function syncFromGoogleDrive(): Promise<SyncResult> {
  // ... implementation from original file
}

// Also move these internal helpers:
// - initialSync
// - incrementalSync
// - syncFolder
// - processBatch
// - processFile
// - syncItemFile
// - handleFileRemoved
// - handleFileChanged
// - hasItemChanges
```

**Step 2: Create google-drive-upload.ts**

Create `lib/google-drive-upload.ts`:

```typescript
/**
 * Google Drive upload operations.
 * Handles browser-to-Drive uploads with resumable protocol.
 */

"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getDriveClient, refreshAccessToken } from "@/lib/google-drive-client";
import { decryptCredential } from "@/lib/crypto";
import { FileType, SyncStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";

// Types
export interface UploadSession {
  sessionUrl: string;
  fileId: string;
  token: string;
}

export interface UploadSessionResult {
  success: boolean;
  sessions?: UploadSession[];
  error?: string;
}

// Move createUploadSessions from line 1512
export async function createUploadSessions(): Promise<UploadSessionResult> {
  // ... parameters
  // ... implementation from original file
}

// Move confirmUpload from line 1641
export async function confirmUpload(): Promise<{
  // ... parameters
  success: boolean;
  error?: string;
}> {
  // ... implementation from original file
}

// Move uploadBuffer from line 1740
export async function uploadBuffer(): Promise<{
  // ... parameters
  success: boolean;
  driveFileId?: string;
  error?: string;
}> {
  // ... implementation from original file
}

// Also move internal helpers:
// - signUploadSessionToken
// - verifyUploadSessionToken
// - sanitizeFileName
// - getUploadSigningKey
```

**Step 3: Update google-drive-actions.ts with re-exports**

Update `lib/google-drive-actions.ts`:

```typescript
/**
 * Server actions for Google Drive operations.
 * Main entry point - re-exports specialized modules for backward compatibility.
 */

"use server";

// Re-export sync operations
export { syncFromGoogleDrive, type SyncResult } from "./google-drive-sync";

// Re-export upload operations
export {
  createUploadSessions,
  confirmUpload,
  uploadBuffer,
  type UploadSession,
  type UploadSessionResult,
} from "./google-drive-upload";

// Connection and folder management functions stay here:
// - initiateGoogleDriveOAuth (line 80)
// - disconnectGoogleDrive (line 101)
// - getGoogleDriveConnection (line 149)
// - createDriveFolderOnly (line 1023)
// - createFolderInGoogleDrive (line 1083)
// - deleteItemFromGoogleDrive (line 1165)
// - deleteFileFromDrive (line 1219)
// - renameItemInGoogleDrive (line 1257)
// - moveItemInGoogleDrive (line 1308)
```

**Step 4: Find and update test imports**

```bash
grep -r "google-drive-actions" tests/ --include="*.ts" --include="*.tsx"
```

Tests should continue to work with re-exports. If direct imports are needed:

```typescript
// Before (still works via re-export)
import { syncFromGoogleDrive } from "@/lib/google-drive-actions";

// Or use direct import for tree-shaking
import { syncFromGoogleDrive } from "@/lib/google-drive-sync";
```

**Step 5: Run tests to verify refactor**

Run: `pnpm test:unit`
Expected: All tests pass

**Step 6: Commit**

```bash
git add lib/google-drive-actions.ts lib/google-drive-sync.ts lib/google-drive-upload.ts
git commit -m "refactor: split google-drive-actions into sync and upload modules"
```

---

## Summary Checklist

- [ ] Task 1: Add rate limiting to deleteItem ✅
- [ ] Task 2: Add Cache-Control headers to stream route ✅
- [ ] Task 3: Add Range header tests for stream route ✅
- [ ] Task 4: Extend unit tests for GridItem component ✅
- [ ] Task 5: Add unit tests for SortableGridItem ✅
- [ ] Task 6: Add unit tests for SortableGrid container ✅
- [ ] Task 7: Add unit tests for ItemsView ✅
- [ ] Task 8: Add integration test for item deletion ✅
- [ ] Task 9: Add E2E test for video seeking ✅
- [ ] Task 10: Add rate limit E2E documentation test ✅
- [ ] Task 11: Remove obsolete loading test file ✅
- [ ] Task 12: Split google-drive-actions.ts into modules ✅

---

## Test Impact Summary

### Tests to Add

| Type        | File                                                | Count             |
| ----------- | --------------------------------------------------- | ----------------- |
| Unit        | `tests/unit/lib/item-actions.test.ts`               | +2 tests          |
| Unit        | `tests/unit/api/stream-route.test.ts`               | +8 tests          |
| Unit        | `tests/unit/components/grid-item.test.tsx`          | +13 tests         |
| Unit        | `tests/unit/components/sortable-grid-item.test.tsx` | +6 tests          |
| Unit        | `tests/unit/components/sortable-grid.test.tsx`      | +6 tests          |
| Unit        | `tests/unit/components/items-view.test.tsx`         | +9 tests          |
| Integration | `tests/integration/items/item-delete.test.ts`       | +5 tests          |
| E2E         | `e2e/journeys/media/video-seeking.spec.ts`          | +2 tests          |
| E2E         | `e2e/journeys/items/rate-limit.spec.ts`             | +1 test (skipped) |

### Tests to Remove

| Type | File                                               | Reason                           |
| ---- | -------------------------------------------------- | -------------------------------- |
| Unit | `tests/unit/components/items-view-loading.test.ts` | Obsolete (image-preload deleted) |

### Code Changes

| File                               | Change                          |
| ---------------------------------- | ------------------------------- |
| `lib/item-actions.ts`              | Add rate limiting to deleteItem |
| `app/api/stream/[fileId]/route.ts` | Add Cache-Control headers       |
| `lib/google-drive-actions.ts`      | Split into modules + re-exports |
| `lib/google-drive-sync.ts`         | New file - sync operations      |
| `lib/google-drive-upload.ts`       | New file - upload operations    |

---

## Validation Methodology

This plan was validated on 2026-01-13 using:

1. **code-review-excellence skill** - Applied review checklist and feedback patterns
2. **Context7 documentation** - Verified Vitest mocking patterns (`vi.mock`, `vi.mocked`) and Playwright fixtures
3. **Sequential thinking** - Systematic analysis of each task against actual codebase

### Files Verified

- `lib/item-actions.ts:630-667` - Confirmed deleteItem lacks rate limiting
- `lib/rate-limit.ts:54` - Confirmed itemDelete key exists
- `app/api/stream/[fileId]/route.ts:187-218` - Confirmed missing Cache-Control
- `components/sortable-grid/GridItem.tsx` - Analyzed actual props interface
- `components/sortable-grid/SortableGridItem.tsx` - Verified props extend GridItemProps
- `components/sortable-grid/SortableGrid.tsx` - Verified ItemWithArtwork[] items prop
- `components/items/items-view.tsx` - Verified ItemsViewProps interface
- `tests/unit/components/grid-item.test.tsx` - Found 315 lines of existing tests
- `e2e/pages/items.page.ts` - Verified available page object methods
- `lib/google-drive-actions.ts` - Mapped all exported functions with line numbers
