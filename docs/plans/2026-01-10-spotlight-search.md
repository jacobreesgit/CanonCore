# Spotlight Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add macOS Spotlight-style search with "/" keyboard shortcut to quickly find and navigate to items. Search is also accessible via a clickable nav item in the sidebar above "My Items".

**Architecture:** Use shadcn/ui Command component (built on cmdk library) for the command palette UI with its built-in fuzzy filtering. Create a SpotlightContext to manage global keyboard shortcuts and dialog state. Fetch all user items on dialog open and let cmdk handle client-side fuzzy search for instant, typo-tolerant filtering.

**Tech Stack:** shadcn/ui Command (cmdk), React Context, Next.js Server Actions, Prisma

---

## Task 1: Install shadcn/ui Command Component

**Files:**

- Modify: `package.json`
- Create: `components/ui/command.tsx`

**Step 1: Install Command component via shadcn CLI**

Run:

```bash
pnpm dlx shadcn@latest add command
```

Expected: Creates `components/ui/command.tsx` and adds `cmdk` dependency to `package.json`

**Step 2: Verify installation**

Run:

```bash
pnpm list cmdk
```

Expected: `cmdk@x.x.x`

**Step 3: Verify command component exists**

Run:

```bash
ls components/ui/command.tsx
```

Expected: File exists

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml components/ui/command.tsx
git commit -m "chore: add shadcn/ui command component for spotlight search"
```

---

## Task 2: Create Server Action to Fetch Searchable Items

**Files:**

- Modify: `lib/item-actions.ts`
- Test: `tests/unit/lib/item-actions.test.ts`

> **Note:** We fetch all items server-side and let cmdk handle fuzzy filtering client-side. This provides typo-tolerant search with instant results.

**Step 1: Write the failing test**

Add to `tests/unit/lib/item-actions.test.ts`:

```typescript
describe("getSearchableItems", () => {
  it("returns all items for authenticated user", async () => {
    const mockSession = { user: { id: "user-123" } };
    vi.mocked(auth).mockResolvedValue(mockSession as Session);

    const mockItems = [
      {
        id: "item-1",
        name: "Star Wars",
        parentId: null,
        depth: 0,
        description: "A classic movie",
        artworkId: null,
      },
      {
        id: "item-2",
        name: "Empire Strikes Back",
        parentId: "item-1",
        depth: 1,
        description: null,
        artworkId: "art-1",
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as Item[]);

    const result = await getSearchableItems();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      select: {
        id: true,
        name: true,
        parentId: true,
        depth: true,
        description: true,
        artworkId: true,
      },
      orderBy: { name: "asc" },
      take: 500,
    });
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await getSearchableItems();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });

  it("limits results to 500 items for performance", async () => {
    const mockSession = { user: { id: "user-123" } };
    vi.mocked(auth).mockResolvedValue(mockSession as Session);
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await getSearchableItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 500,
      })
    );
  });

  it("handles database errors gracefully", async () => {
    const mockSession = { user: { id: "user-123" } };
    vi.mocked(auth).mockResolvedValue(mockSession as Session);
    vi.mocked(prisma.item.findMany).mockRejectedValue(new Error("DB error"));

    const result = await getSearchableItems();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to fetch items");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- item-actions.test.ts`
Expected: FAIL with "getSearchableItems is not defined"

**Step 3: Add SearchableItem type to types.ts**

Add to `lib/types.ts`:

```typescript
/**
 * Item data for spotlight search display.
 * Minimal fields needed for search results.
 */
export interface SearchableItem {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  description: string | null;
  artworkId: string | null;
}
```

**Step 4: Write minimal implementation**

Add to `lib/item-actions.ts`:

```typescript
import { SearchableItem } from "@/lib/types";

/**
 * Fetch all items for spotlight search.
 * Returns up to 500 items - cmdk handles client-side fuzzy filtering.
 *
 * @returns All user items for search or error
 */
export async function getSearchableItems(): Promise<
  ItemResult<SearchableItem[]>
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const items = await prisma.item.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        parentId: true,
        depth: true,
        description: true,
        artworkId: true,
      },
      orderBy: { name: "asc" },
      take: 500,
    });

    return { success: true, data: items };
  } catch (error) {
    logger.error({ error }, "Failed to fetch searchable items");
    return { success: false, error: "Failed to fetch items" };
  }
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm run test:unit -- item-actions.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/item-actions.ts lib/types.ts tests/unit/lib/item-actions.test.ts
git commit -m "feat: add getSearchableItems for spotlight search"
```

---

## Task 3: Create Spotlight Context

**Files:**

- Create: `contexts/spotlight-context.tsx`
- Test: `tests/unit/contexts/spotlight-context.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/contexts/spotlight-context.test.tsx`:

```typescript
/**
 * Unit tests for SpotlightContext.
 * Tests dialog state management and keyboard shortcut handling.
 */

import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SpotlightProvider,
  useSpotlight,
  useSpotlightOptional,
} from "@/contexts/spotlight-context";

// Test component to access context
function TestConsumer() {
  const { isOpen, openSpotlight, closeSpotlight } = useSpotlight();
  return (
    <div>
      <span data-testid="is-open">{isOpen ? "open" : "closed"}</span>
      <button onClick={openSpotlight}>Open</button>
      <button onClick={closeSpotlight}>Close</button>
    </div>
  );
}

describe("SpotlightContext", () => {
  describe("useSpotlight", () => {
    it("throws when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useSpotlight must be used within SpotlightProvider");

      consoleSpy.mockRestore();
    });

    it("provides initial closed state", () => {
      render(
        <SpotlightProvider>
          <TestConsumer />
        </SpotlightProvider>
      );

      expect(screen.getByTestId("is-open")).toHaveTextContent("closed");
    });

    it("opens spotlight via openSpotlight", async () => {
      const user = userEvent.setup();
      render(
        <SpotlightProvider>
          <TestConsumer />
        </SpotlightProvider>
      );

      await user.click(screen.getByRole("button", { name: "Open" }));
      expect(screen.getByTestId("is-open")).toHaveTextContent("open");
    });

    it("closes spotlight via closeSpotlight", async () => {
      const user = userEvent.setup();
      render(
        <SpotlightProvider>
          <TestConsumer />
        </SpotlightProvider>
      );

      await user.click(screen.getByRole("button", { name: "Open" }));
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.getByTestId("is-open")).toHaveTextContent("closed");
    });
  });

  describe("useSpotlightOptional", () => {
    function OptionalConsumer() {
      const context = useSpotlightOptional();
      return <span data-testid="has-context">{context ? "yes" : "no"}</span>;
    }

    it("returns null outside provider", () => {
      render(<OptionalConsumer />);
      expect(screen.getByTestId("has-context")).toHaveTextContent("no");
    });

    it("returns context inside provider", () => {
      render(
        <SpotlightProvider>
          <OptionalConsumer />
        </SpotlightProvider>
      );
      expect(screen.getByTestId("has-context")).toHaveTextContent("yes");
    });
  });

  describe("keyboard shortcuts", () => {
    it("opens spotlight on / key press", async () => {
      render(
        <SpotlightProvider>
          <TestConsumer />
        </SpotlightProvider>
      );

      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "/" })
        );
      });

      expect(screen.getByTestId("is-open")).toHaveTextContent("open");
    });

    it("does not open spotlight when typing in input", async () => {
      render(
        <SpotlightProvider>
          <TestConsumer />
          <input data-testid="text-input" />
        </SpotlightProvider>
      );

      const input = screen.getByTestId("text-input");
      input.focus();

      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "/" })
        );
      });

      // Should remain closed when focus is in an input
      expect(screen.getByTestId("is-open")).toHaveTextContent("closed");
    });

    it("toggles spotlight when already open", async () => {
      render(
        <SpotlightProvider>
          <TestConsumer />
        </SpotlightProvider>
      );

      // Open
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "/" })
        );
      });
      expect(screen.getByTestId("is-open")).toHaveTextContent("open");

      // Toggle closed
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "/" })
        );
      });
      expect(screen.getByTestId("is-open")).toHaveTextContent("closed");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- spotlight-context.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `contexts/spotlight-context.tsx`:

```typescript
/**
 * Context for the global Spotlight search dialog.
 * Manages dialog state and keyboard shortcut ("/").
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

interface SpotlightContextValue {
  isOpen: boolean;
  openSpotlight: () => void;
  closeSpotlight: () => void;
}

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

/**
 * Provider for Spotlight search dialog state.
 * Registers global keyboard shortcut for "/" key.
 */
export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openSpotlight = useCallback(() => setIsOpen(true), []);
  const closeSpotlight = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (event.key === "/" && !isInput) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SpotlightContext.Provider
      value={{
        isOpen,
        openSpotlight,
        closeSpotlight,
      }}
    >
      {children}
    </SpotlightContext.Provider>
  );
}

/**
 * Hook to access Spotlight dialog controls.
 * Throws if used outside SpotlightProvider.
 */
export function useSpotlight() {
  const context = useContext(SpotlightContext);
  if (!context) {
    throw new Error("useSpotlight must be used within SpotlightProvider");
  }
  return context;
}

/**
 * Optional hook that returns null if outside provider.
 * Use when component may render outside protected routes.
 */
export function useSpotlightOptional() {
  return useContext(SpotlightContext);
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- spotlight-context.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add contexts/spotlight-context.tsx tests/unit/contexts/spotlight-context.test.tsx
git commit -m "feat: add SpotlightContext with keyboard shortcut handling"
```

---

## Task 4: Create SpotlightSearch Component

**Files:**

- Create: `components/search/spotlight-search.tsx`
- Test: `tests/unit/components/search/spotlight-search.test.tsx`

> **Note:** Items are fetched once when dialog opens. cmdk handles fuzzy filtering client-side for instant, typo-tolerant search.

**Step 1: Write the failing test**

Create `tests/unit/components/search/spotlight-search.test.tsx`:

```typescript
/**
 * Unit tests for SpotlightSearch component.
 * Tests rendering, item loading, and navigation.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpotlightSearch } from "@/components/search/spotlight-search";
import { SpotlightProvider } from "@/contexts/spotlight-context";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock getSearchableItems server action
vi.mock("@/lib/item-actions", () => ({
  getSearchableItems: vi.fn(),
}));

import { getSearchableItems } from "@/lib/item-actions";

describe("SpotlightSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSearchableItems).mockResolvedValue({ success: true, data: [] });
  });

  it("renders when open", () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search items/i)).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch />
      </SpotlightProvider>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fetches items when dialog opens", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        { id: "1", name: "Item 1", parentId: null, depth: 0, description: null, artworkId: null },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(getSearchableItems).toHaveBeenCalledTimes(1);
    });
  });

  it("shows empty state when no items exist", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({ success: true, data: [] });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/no items found/i)).toBeInTheDocument();
    });
  });

  it("displays all items initially (cmdk filters as user types)", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        { id: "item-1", name: "Star Wars", parentId: null, depth: 0, description: null, artworkId: null },
        { id: "item-2", name: "Empire Strikes Back", parentId: null, depth: 0, description: null, artworkId: null },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Star Wars")).toBeInTheDocument();
      expect(screen.getByText("Empire Strikes Back")).toBeInTheDocument();
    });
  });

  it("navigates to item on selection", async () => {
    const user = userEvent.setup();
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        { id: "item-123", name: "My Movie", parentId: null, depth: 0, description: null, artworkId: null },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("My Movie")).toBeInTheDocument();
    });

    await user.click(screen.getByText("My Movie"));

    expect(mockPush).toHaveBeenCalledWith("/my-items/item-123");
  });

  it("shows keyboard shortcut hint", () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    // Should show "/" hint
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("shows item description when available", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [
        { id: "item-1", name: "My Item", parentId: null, depth: 0, description: "A great description", artworkId: null },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("A great description")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: false,
      error: "Failed to fetch",
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/no items found/i)).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching", async () => {
    let resolvePromise: (value: unknown) => void;
    vi.mocked(getSearchableItems).mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve; })
    );

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    resolvePromise!({ success: true, data: [] });

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- spotlight-search.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `components/search/spotlight-search.tsx`:

```typescript
/**
 * Spotlight search dialog component.
 * Provides macOS Spotlight-style search for items with fuzzy filtering.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSpotlight } from "@/contexts/spotlight-context";
import { getSearchableItems } from "@/lib/item-actions";
import { SearchableItem } from "@/lib/types";

interface SpotlightSearchProps {
  /** For testing - force dialog open state */
  defaultOpen?: boolean;
}

/**
 * Global spotlight search dialog.
 * Opens with "/" keyboard shortcut or sidebar button.
 * Fetches all items on open, cmdk handles fuzzy filtering client-side.
 */
export function SpotlightSearch({ defaultOpen }: SpotlightSearchProps) {
  const router = useRouter();
  const { isOpen, closeSpotlight } = useSpotlight();
  const [items, setItems] = useState<SearchableItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Use defaultOpen for testing, otherwise use context
  const open = defaultOpen ?? isOpen;

  // Fetch items when dialog opens
  useEffect(() => {
    if (!open) {
      return;
    }

    setIsLoading(true);
    getSearchableItems().then((result) => {
      if (result.success) {
        setItems(result.data ?? []);
      } else {
        setItems([]);
      }
      setIsLoading(false);
    });
  }, [open]);

  const handleSelect = useCallback(
    (itemId: string) => {
      closeSpotlight();
      router.push(`/my-items/${itemId}`);
    },
    [closeSpotlight, router]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeSpotlight();
      }
    },
    [closeSpotlight]
  );

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput placeholder="Search items..." />
      <CommandList>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <>
            <CommandEmpty>No items found.</CommandEmpty>
            {items.length > 0 && (
              <CommandGroup heading="Items">
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.description || ""}`}
                    onSelect={() => handleSelect(item.id)}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{item.name}</span>
                      {item.description && (
                        <span className="text-muted-foreground text-xs">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
      <div className="border-t px-3 py-2 text-muted-foreground text-xs">
        <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
          /
        </kbd>
        <span className="ml-2">to toggle search</span>
      </div>
    </CommandDialog>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- spotlight-search.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/search/spotlight-search.tsx tests/unit/components/search/spotlight-search.test.tsx
git commit -m "feat: add SpotlightSearch component with search and navigation"
```

---

## Task 5: Create GlobalSpotlight Component

**Files:**

- Create: `components/search/global-spotlight.tsx`

**Step 1: Create the component**

Create `components/search/global-spotlight.tsx`:

```typescript
/**
 * Global spotlight search wrapper.
 * Renders at layout level to provide search across all protected pages.
 */

"use client";

import { SpotlightSearch } from "./spotlight-search";

/**
 * Renders the global spotlight search dialog.
 * Should be placed in the protected routes layout.
 */
export function GlobalSpotlight() {
  return <SpotlightSearch />;
}
```

**Step 2: Commit**

```bash
git add components/search/global-spotlight.tsx
git commit -m "feat: add GlobalSpotlight wrapper component"
```

---

## Task 6: Integrate Spotlight into Protected Layout

**Files:**

- Modify: `components/my-items-providers.tsx`

**Step 1: Add SpotlightProvider and GlobalSpotlight**

Modify `components/my-items-providers.tsx` to add the spotlight provider and global dialog:

```typescript
/**
 * Client-side providers for the protected my-items routes.
 * Wraps children with QuickCreate and Spotlight contexts.
 */

"use client";

import { ReactNode } from "react";
import { QuickCreateProvider } from "@/contexts/add-item-context";
import { SpotlightProvider } from "@/contexts/spotlight-context";
import { GlobalAddItemDialog } from "./items/global-add-item-dialog";
import { GlobalSpotlight } from "./search/global-spotlight";

interface MyItemsProvidersProps {
  children: ReactNode;
}

/**
 * Providers wrapper for protected routes.
 * Includes QuickCreate and Spotlight functionality.
 */
export function MyItemsProviders({ children }: MyItemsProvidersProps) {
  return (
    <QuickCreateProvider>
      <SpotlightProvider>
        {children}
        <GlobalAddItemDialog />
        <GlobalSpotlight />
      </SpotlightProvider>
    </QuickCreateProvider>
  );
}
```

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add components/my-items-providers.tsx
git commit -m "feat: integrate SpotlightProvider into protected routes"
```

---

## Task 7: Add Spotlight Trigger to Sidebar

**Files:**

- Modify: `components/nav-main.tsx`
- Test: `tests/unit/components/nav-main.test.tsx`

> **Design Reference:** Search nav item positioned above "My Items" with "/" keyboard shortcut badge (see reference image showing sidebar with Search as first nav item with "/" indicator).

**Step 1: Write the failing test**

Add to `tests/unit/components/nav-main.test.tsx`:

```typescript
describe("Spotlight search button", () => {
  it("renders search button with keyboard shortcut", () => {
    render(<NavMain items={mockItems} />);

    const searchButton = screen.getByRole("button", { name: /search/i });
    expect(searchButton).toBeInTheDocument();
  });

  it("displays / keyboard shortcut", () => {
    render(<NavMain items={mockItems} />);

    // Should show "/" shortcut
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("renders search button before other nav items", () => {
    render(<NavMain items={mockItems} />);

    const menuItems = screen.getAllByRole("button");
    const searchIndex = menuItems.findIndex((item) =>
      item.textContent?.includes("Search")
    );
    const myItemsIndex = menuItems.findIndex((item) =>
      item.textContent?.includes("My Items")
    );

    expect(searchIndex).toBeLessThan(myItemsIndex);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- nav-main.test.tsx`
Expected: FAIL with "Unable to find role"

**Step 3: Add search button to NavMain**

Modify `components/nav-main.tsx` to add a search nav item above "My Items":

Add imports:

```typescript
import { Search } from "lucide-react";
import { useSpotlightOptional } from "@/contexts/spotlight-context";
```

Add before the navigation items mapping:

```typescript
const spotlight = useSpotlightOptional();
```

Add search nav item in the sidebar content (BEFORE the items mapping):

```typescript
{spotlight && (
  <SidebarMenuItem>
    <SidebarMenuButton
      onClick={spotlight.openSpotlight}
      tooltip="Search"
    >
      <Search />
      <span>Search</span>
      <kbd className="ml-auto bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
        /
      </kbd>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- nav-main.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/nav-main.tsx tests/unit/components/nav-main.test.tsx
git commit -m "feat: add spotlight search button to sidebar navigation"
```

---

## Task 8: Add E2E Tests for Spotlight Search

**Files:**

- Create: `e2e/journeys/items/spotlight-search.spec.ts`
- Create: `e2e/pages/SpotlightPage.ts`

**Step 1: Create Page Object Model**

Create `e2e/pages/SpotlightPage.ts`:

```typescript
/**
 * Page Object Model for Spotlight Search functionality.
 */

import { Page, expect } from "@playwright/test";

export class SpotlightPage {
  constructor(private page: Page) {}

  /** Get the spotlight dialog */
  get dialog() {
    return this.page.getByRole("dialog");
  }

  /** Get the search input */
  get searchInput() {
    return this.page.getByPlaceholderText(/search items/i);
  }

  /** Open spotlight with keyboard shortcut */
  async openWithKeyboard() {
    await this.page.keyboard.press("/");
  }

  /** Open spotlight via sidebar button */
  async openViaSidebar() {
    await this.page.getByRole("button", { name: /search/i }).click();
  }

  /** Search for items */
  async search(query: string) {
    await this.searchInput.fill(query);
  }

  /** Click on a search result */
  async selectResult(name: string) {
    await this.page.getByRole("option", { name }).click();
  }

  /** Verify spotlight is open */
  async expectOpen() {
    await expect(this.dialog).toBeVisible();
  }

  /** Verify spotlight is closed */
  async expectClosed() {
    await expect(this.dialog).not.toBeVisible();
  }

  /** Verify search result is visible */
  async expectResultVisible(name: string) {
    await expect(this.page.getByRole("option", { name })).toBeVisible();
  }

  /** Verify empty state is shown */
  async expectNoResults() {
    await expect(this.page.getByText(/no items found/i)).toBeVisible();
  }
}
```

**Step 2: Create E2E tests**

Create `e2e/journeys/items/spotlight-search.spec.ts`:

```typescript
/**
 * E2E tests for Spotlight Search functionality.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";
import { SpotlightPage } from "../../pages/SpotlightPage";

test.describe("Spotlight Search Journey", () => {
  let spotlightPage: SpotlightPage;

  test.beforeEach(async ({ page, signUpPage, itemsPage }) => {
    const email = generateUniqueEmail("spotlight");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Create test items for searching
    await itemsPage.createItem("Star Wars");
    await itemsPage.createItem("Empire Strikes Back");
    await itemsPage.createItem("Return of the Jedi");
    await itemsPage.createItemWithDescription(
      "Documentary Film",
      "nature wildlife"
    );

    spotlightPage = new SpotlightPage(page);
  });

  test("opens spotlight with keyboard shortcut", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();
  });

  test("opens spotlight via sidebar button", async ({ page }) => {
    // Ensure sidebar is visible
    const searchButton = page.getByRole("button", { name: /search/i });
    if (!(await searchButton.isVisible())) {
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
      await page.waitForTimeout(300);
    }

    await spotlightPage.openViaSidebar();
    await spotlightPage.expectOpen();
  });

  test("closes spotlight with Escape key", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();

    await page.keyboard.press("Escape");
    await spotlightPage.expectClosed();
  });

  test("finds items by name", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.search("Star");

    await spotlightPage.expectResultVisible("Star Wars");
  });

  test("fuzzy matches with typos", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    // cmdk's fuzzy filtering should match despite typo
    await spotlightPage.search("Satr");

    await spotlightPage.expectResultVisible("Star Wars");
  });

  test("finds items by description", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    // Search by description text
    await spotlightPage.search("wildlife");

    await spotlightPage.expectResultVisible("Documentary Film");
  });

  test("shows no results for non-matching query", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.search("xyznonexistent");

    await spotlightPage.expectNoResults();
  });

  test("navigates to item on selection", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.search("Empire");
    await spotlightPage.selectResult("Empire Strikes Back");

    // Should navigate to item detail page
    await expect(page).toHaveURL(/\/my-items\/[a-z0-9-]+/);
    await expect(page.getByText("Empire Strikes Back")).toBeVisible();
  });

  test("clears search when dialog reopens", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.search("Star");
    await page.keyboard.press("Escape");

    await spotlightPage.openWithKeyboard();
    await expect(spotlightPage.searchInput).toHaveValue("");
  });

  test("keyboard navigation through results", async ({ page }) => {
    await spotlightPage.openWithKeyboard();
    await spotlightPage.search("a"); // Matches all items with 'a'

    // Use arrow keys to navigate
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Should navigate to selected item
    await expect(page).toHaveURL(/\/my-items\/[a-z0-9-]+/);
  });

  test("shows keyboard shortcut hint", async ({ page }) => {
    await spotlightPage.openWithKeyboard();

    // Should display "/" keyboard shortcut
    await expect(page.getByText("/")).toBeVisible();
  });
});

test.describe("Spotlight Search - Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("spotlight works on mobile", async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("spotlight-mobile");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    const spotlightPage = new SpotlightPage(page);

    // Use keyboard shortcut (works even on mobile)
    await spotlightPage.openWithKeyboard();
    await spotlightPage.expectOpen();
  });
});
```

**Step 3: Run E2E tests**

Run: `pnpm run test:e2e -- spotlight-search.spec.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add e2e/journeys/items/spotlight-search.spec.ts e2e/pages/SpotlightPage.ts
git commit -m "test: add E2E tests for spotlight search functionality"
```

---

## Task 9: Run Full Test Suite and Verify

**Step 1: Run all checks**

Run: `pnpm run check`
Expected: All checks pass (format, lint, type-check, knip, build)

**Step 2: Run unit tests**

Run: `pnpm run test`
Expected: All tests pass

**Step 3: Run E2E tests**

Run: `pnpm run test:e2e`
Expected: All tests pass

**Step 4: Final commit with version bump**

```bash
git add -A
git commit -m "feat: complete spotlight search implementation (v1.6.0)"
```

---

## Testing Summary

### New Tests Added

**Unit Tests:**

- `tests/unit/lib/item-actions.test.ts` - 4 new tests for `getSearchableItems`
- `tests/unit/contexts/spotlight-context.test.tsx` - 8 new tests for context and keyboard shortcuts
- `tests/unit/components/search/spotlight-search.test.tsx` - 9 new tests for search component
- `tests/unit/components/nav-main.test.tsx` - 2 new tests for sidebar search button

**E2E Tests:**

- `e2e/journeys/items/spotlight-search.spec.ts` - 12 new tests covering:
  - Keyboard shortcut opening
  - Sidebar button opening
  - Search functionality
  - Fuzzy matching with typos
  - Description search
  - Navigation on selection
  - Keyboard navigation
  - Mobile support

### Existing Tests to Verify (No Changes Needed)

The following existing tests should continue to pass without modification:

- All items CRUD tests
- Quick Create tests
- Navigation tests
- Theme tests
- Auth tests

### Test Coverage Target

The new spotlight feature should add approximately:

- 23 new unit tests
- 12 new E2E tests

---

## Files Summary

### Files to Create

- `components/ui/command.tsx` (via shadcn CLI)
- `components/search/spotlight-search.tsx`
- `components/search/global-spotlight.tsx`
- `contexts/spotlight-context.tsx`
- `tests/unit/contexts/spotlight-context.test.tsx`
- `tests/unit/components/search/spotlight-search.test.tsx`
- `e2e/journeys/items/spotlight-search.spec.ts`
- `e2e/pages/SpotlightPage.ts`

### Files to Modify

- `package.json` (add cmdk dependency)
- `lib/item-actions.ts` (add getSearchableItems)
- `lib/types.ts` (add SearchableItem type)
- `tests/unit/lib/item-actions.test.ts` (add getSearchableItems tests)
- `components/my-items-providers.tsx` (add SpotlightProvider)
- `components/nav-main.tsx` (add search button)
- `tests/unit/components/nav-main.test.tsx` (add search button tests)

---

## Validation Notes

This plan was validated using the code-review-excellence skill, Context7 (cmdk library docs), and sequential thinking analysis.

### Validation Checklist

✅ **Security**

- [x] Auth check before data fetch (getSearchableItems uses auth())
- [x] User isolation (items filtered by userId)
- [x] Limited data exposure (only id, name, parentId, depth, description, artworkId)
- [x] DoS protection (500 item limit)

✅ **Performance**

- [x] 500 item limit within cmdk's 2-3k capacity (Context7 verified)
- [x] Client-side filtering eliminates network latency per keystroke
- [x] Single fetch per dialog open

✅ **Architecture**

- [x] SpotlightContext follows QuickCreateContext pattern
- [x] GlobalSpotlight follows GlobalAddItemDialog pattern
- [x] Integration into existing MyItemsProviders structure

✅ **Edge Cases**

- [x] "/" shortcut ignored when typing in inputs (INPUT, TEXTAREA, contentEditable)
- [x] Empty state handled when no items exist
- [x] Fetch error handled gracefully
- [x] Loading state during fetch

### Implementation Notes

- **cmdk behavior**: Fuzzy filtering is built-in but not guaranteed for all typo patterns. The E2E test "fuzzy matches with typos" may need adjustment based on actual cmdk behavior.
- **Escape key**: cmdk's CommandDialog handles Escape to close automatically via Radix Dialog primitive.
- **Search input focus**: When dialog opens, CommandInput auto-focuses, so "/" typed inside won't trigger the global shortcut (input exclusion works correctly).

### Key Technical Decisions

1. **Library Choice**: shadcn/ui Command (cmdk) is the correct choice because:
   - Already in the shadcn ecosystem matching existing UI patterns
   - Built-in accessibility (ARIA, keyboard navigation, screen reader support)
   - React 18 compatible with proper hydration handling

2. **Keyboard Shortcut**: "/" (slash) key because:
   - Single key press - faster than modifier combinations
   - Well-established pattern (GitHub, Slack, YouTube, etc.)
   - Discoverable via sidebar nav item with "/" badge
   - Automatically ignores key press when user is typing in inputs

3. **Sidebar Placement**: Search nav item positioned above "My Items" because:
   - Primary action should be prominently placed
   - Clickable alternative for users who prefer mouse
   - Shows "/" keyboard hint for discoverability

4. **Client-Side Fuzzy Filtering**: Using cmdk's built-in filtering because:
   - **Typo tolerance**: "Satr Wars" matches "Star Wars"
   - **Instant results**: No network latency on each keystroke
   - **No debounce needed**: Filtering is synchronous client-side
   - **Simpler implementation**: Fetch once on open, cmdk handles the rest
   - **500 item limit**: cmdk handles up to 2,000-3,000 items without virtualization

5. **Data Fetching Strategy**: Fetch all items when dialog opens:
   - Single server request per dialog open
   - Items cached in component state while dialog is open
   - Fresh data on each open (no stale cache issues)

### Potential Future Enhancements

These were considered but deferred to keep scope focused:

- **Breadcrumb paths in results**: Show "Movies / Star Wars / Deleted Scenes" for nested items
- **Artwork thumbnails**: Display item artwork in search results
- **Virtualization**: If users exceed 500 items, add virtualization for performance
- **Recent searches**: Track and display recent search queries
- **Search in description**: Include description in cmdk's filter value

### Sources

- [cmdk GitHub](https://github.com/pacocoursey/cmdk) - Command menu library
- [shadcn/ui Command](https://ui.shadcn.com/docs/components/command) - Component documentation
- [kbar](https://github.com/timc1/kbar) - Alternative considered but shadcn/ui integration preferred
