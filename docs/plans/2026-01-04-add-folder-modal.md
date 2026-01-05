# Add Folder Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the inline "Add Folder" expandable input with a modal dialog, unify the "Quick Create" sidebar button to use the same modal, and remove the unused Mail/Inbox button.

**Architecture:** Create a new `AddFolderDialog` component modeled after `ItemSettingsDialog`. The sidebar "Quick Create" uses React Context to open a global dialog in the dashboard layout (creates at root level). The "Add Folder" button in ItemsView uses a local dialog instance (creates in current context).

**Tech Stack:** React 19, shadcn/ui Dialog, TypeScript, Tailwind CSS 4, Vitest, Playwright

---

## Design Decision

**Two dialog instances, same component:**

1. **Global dialog** (dashboard layout) - Triggered by sidebar Quick Create, always creates at root
2. **Local dialog** (items-view) - Triggered by Add Folder button, creates in current folder/connection

This matches how ItemSettingsDialog works - a reusable component with local state controlled by the parent.

---

## Files Affected

| File                                               | Change Type | Purpose                                 |
| -------------------------------------------------- | ----------- | --------------------------------------- |
| `components/items/add-folder-dialog.tsx`           | CREATE      | New modal dialog component              |
| `components/items/add-item-button.tsx`             | DELETE      | No longer needed                        |
| `components/items/items-view.tsx`                  | MODIFY      | Use AddFolderDialog locally             |
| `components/items/item-context-menu.tsx`           | MODIFY      | Use AddFolderDialog for subfolder       |
| `components/nav-main.tsx`                          | MODIFY      | Remove Mail, use context to open dialog |
| `contexts/add-folder-context.tsx`                  | CREATE      | Context for global Quick Create dialog  |
| `app/(dashboard)/layout.tsx`                       | MODIFY      | Add provider and global dialog          |
| `e2e/pages/items.page.ts`                          | MODIFY      | Update selectors for modal              |
| `tests/unit/components/add-folder-dialog.test.tsx` | CREATE      | Unit tests                              |

---

## Task 1: Create AddFolderDialog Component

**Files:**

- Create: `components/items/add-folder-dialog.tsx`
- Test: `tests/unit/components/add-folder-dialog.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/add-folder-dialog.test.tsx`:

```tsx
/**
 * Unit tests for AddFolderDialog component.
 * Tests dialog rendering, form validation, and submission behavior.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AddFolderDialog } from "@/components/items/add-folder-dialog";

describe("AddFolderDialog", () => {
  it("renders dialog when open", () => {
    render(
      <AddFolderDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Create Folder")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <AddFolderDialog
        open={false}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("focuses input on open", async () => {
    render(
      <AddFolderDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    const input = screen.getByPlaceholderText(/folder name/i);
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });

  it("disables create button when input is empty", () => {
    render(
      <AddFolderDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    const button = screen.getByRole("button", { name: /^create$/i });
    expect(button).toBeDisabled();
  });

  it("calls onAdd with trimmed folder name on submit", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddFolderDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />
    );

    await user.type(
      screen.getByPlaceholderText(/folder name/i),
      "  New Folder  "
    );
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith("New Folder");
    });
  });

  it("closes dialog on successful creation", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <AddFolderDialog open={true} onOpenChange={onOpenChange} onAdd={onAdd} />
    );

    await user.type(screen.getByPlaceholderText(/folder name/i), "New Folder");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("keeps dialog open on error", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue("Error message");
    const onOpenChange = vi.fn();

    render(
      <AddFolderDialog open={true} onOpenChange={onOpenChange} onAdd={onAdd} />
    );

    await user.type(screen.getByPlaceholderText(/folder name/i), "New Folder");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalled();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("submits on Enter key", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <AddFolderDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />
    );

    await user.type(
      screen.getByPlaceholderText(/folder name/i),
      "New Folder{enter}"
    );

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith("New Folder");
    });
  });

  it("clears input when dialog reopens", async () => {
    const { rerender } = render(
      <AddFolderDialog
        open={false}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    rerender(
      <AddFolderDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    expect(screen.getByPlaceholderText(/folder name/i)).toHaveValue("");
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    let resolveAdd: (value: string | undefined) => void;
    const onAdd = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        })
    );

    render(
      <AddFolderDialog open={true} onOpenChange={() => {}} onAdd={onAdd} />
    );

    await user.type(screen.getByPlaceholderText(/folder name/i), "New Folder");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();

    resolveAdd!(undefined);
  });

  it("closes dialog when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <AddFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        onAdd={async () => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not submit when input is only whitespace", async () => {
    const user = userEvent.setup();

    render(
      <AddFolderDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
      />
    );

    await user.type(screen.getByPlaceholderText(/folder name/i), "   ");

    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("shows parent folder context in description", () => {
    render(
      <AddFolderDialog
        open={true}
        onOpenChange={() => {}}
        onAdd={async () => undefined}
        parentName="Movies"
      />
    );

    expect(
      screen.getByText(/create a new folder inside "Movies"/i)
    ).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/components/add-folder-dialog.test.tsx`
Expected: FAIL with "Cannot find module '@/components/items/add-folder-dialog'"

**Step 3: Write the AddFolderDialog component**

Create `components/items/add-folder-dialog.tsx`:

```tsx
/**
 * Modal dialog for creating new folders.
 * Provides a clean, focused interface for folder creation.
 */

"use client";

import { useState, useEffect } from "react";
import { FolderPlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AddFolderDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback to create the folder. Returns error message or undefined on success. */
  onAdd: (name: string) => Promise<string | undefined>;
  /** Parent folder name for context (optional) */
  parentName?: string;
}

/**
 * Modal dialog for creating folders.
 * Auto-focuses input, supports Enter to submit, shows loading state.
 *
 * @param open - Whether dialog is visible
 * @param onOpenChange - Callback for visibility changes
 * @param onAdd - Async callback to create folder
 * @param parentName - Optional parent folder name for context
 */
export function AddFolderDialog({
  open,
  onOpenChange,
  onAdd,
  parentName,
}: AddFolderDialogProps) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setIsLoading(false);
    }
  }, [open]);

  async function handleSubmit() {
    if (!name.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const error = await onAdd(name.trim());
      if (!error) {
        onOpenChange(false);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && name.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const descriptionId = "folder-dialog-description";
  const description = parentName
    ? `Create a new folder inside "${parentName}".`
    : "Create a new folder to organize your files.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        aria-describedby={descriptionId}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById("folder-name")?.focus();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <FolderPlus className="text-primary size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Create Folder</DialogTitle>
              <DialogDescription id={descriptionId} className="text-sm">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter folder name..."
              disabled={isLoading}
              className="h-10"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/components/add-folder-dialog.test.tsx`
Expected: PASS (all 13 tests)

**Step 5: Commit**

```bash
git add components/items/add-folder-dialog.tsx tests/unit/components/add-folder-dialog.test.tsx
git commit -m "$(cat <<'EOF'
feat(items): add folder dialog component

Create modal dialog for folder creation, replacing inline expandable input.
Follows ItemSettingsDialog pattern with auto-focus, Enter submit, loading state.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update ItemsView to Use Local AddFolderDialog

**Files:**

- Modify: `components/items/items-view.tsx`
- Delete: `components/items/add-item-button.tsx`

**Step 1: Update imports and add state**

```tsx
// Remove:
import { AddItemButton } from "./add-item-button";

// Add:
import { AddFolderDialog } from "./add-folder-dialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
```

Add state after settingsDialog:

```tsx
const [addFolderOpen, setAddFolderOpen] = useState(false);
```

**Step 2: Replace AddItemButton usage**

Replace in controls section:

```tsx
{
  items.length > 0 && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setAddFolderOpen(true)}
      className="gap-1.5"
    >
      <Plus className="size-4" strokeWidth={2} />
      <span>Add Folder</span>
    </Button>
  );
}
```

Add dialog after ItemSettingsDialog:

```tsx
<AddFolderDialog
  open={addFolderOpen}
  onOpenChange={setAddFolderOpen}
  onAdd={handleCreateItem}
/>
```

**Step 3: Update EmptyState**

```tsx
function EmptyState({ onOpenAddFolder }: { onOpenAddFolder: () => void }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16",
        "border-border/60 rounded-xl border-2 border-dashed",
        "bg-muted/20"
      )}
    >
      <div
        className={cn(
          "flex size-16 items-center justify-center rounded-full",
          "bg-muted/60 text-muted-foreground"
        )}
      >
        <Folder className="size-8" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <h3 className="text-foreground text-lg font-medium">No folders yet</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Create your first folder to get started
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenAddFolder}
        className="gap-1.5"
      >
        <Plus className="size-4" strokeWidth={2} />
        <span>Add Folder</span>
      </Button>
    </div>
  );
}
```

Update usage:

```tsx
<EmptyState onOpenAddFolder={() => setAddFolderOpen(true)} />
```

**Step 4: Delete add-item-button.tsx and verify**

```bash
rm components/items/add-item-button.tsx
pnpm run build
```

**Step 5: Commit**

```bash
git add components/items/items-view.tsx
git rm components/items/add-item-button.tsx
git commit -m "$(cat <<'EOF'
refactor(items): replace inline add button with modal dialog

Migrate from AddItemButton to AddFolderDialog. Local dialog instance
creates folders in current context (folder/connection).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create Context for Global Quick Create Dialog

**Files:**

- Create: `contexts/add-folder-context.tsx`

**Step 1: Create the context**

```tsx
/**
 * Context for the global Quick Create dialog.
 * Manages dialog state for sidebar Quick Create button.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createItem } from "@/lib/item-actions";
import { toast } from "sonner";

interface QuickCreateContextValue {
  isOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  handleCreate: (name: string) => Promise<string | undefined>;
}

const QuickCreateContext = createContext<QuickCreateContextValue | null>(null);

/**
 * Provider for Quick Create dialog state.
 * Handles folder creation at dashboard root level.
 */
export function QuickCreateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const openDialog = useCallback(() => setIsOpen(true), []);
  const closeDialog = useCallback(() => setIsOpen(false), []);

  const handleCreate = useCallback(
    async (name: string): Promise<string | undefined> => {
      try {
        const result = await createItem(null, name);
        if (result.success && result.data) {
          toast.success(`Created "${name}"`);
          router.refresh();
          return undefined;
        }
        toast.error(result.error || "Failed to create folder");
        return result.error;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create folder";
        toast.error(message);
        return message;
      }
    },
    [router]
  );

  return (
    <QuickCreateContext.Provider
      value={{ isOpen, openDialog, closeDialog, handleCreate }}
    >
      {children}
    </QuickCreateContext.Provider>
  );
}

/**
 * Hook to access Quick Create dialog controls.
 */
export function useQuickCreate() {
  const context = useContext(QuickCreateContext);
  if (!context) {
    throw new Error("useQuickCreate must be used within QuickCreateProvider");
  }
  return context;
}

/**
 * Optional hook that returns null if outside provider.
 */
export function useQuickCreateOptional() {
  return useContext(QuickCreateContext);
}
```

**Step 2: Commit**

```bash
git add contexts/add-folder-context.tsx
git commit -m "$(cat <<'EOF'
feat(context): add Quick Create dialog context

Context owns dialog state and handles root-level folder creation.
No state syncing needed - context is single source of truth.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update Dashboard Layout with Provider and Dialog

**Files:**

- Modify: `app/(dashboard)/layout.tsx`

**Step 1: Add provider and dialog to layout**

> **Note:** The dashboard layout is already a client component (`"use client"`), so GlobalAddFolderDialog can be defined inline.

Add imports:

```tsx
import {
  QuickCreateProvider,
  useQuickCreate,
} from "@/contexts/add-folder-context";
import { AddFolderDialog } from "@/components/items/add-folder-dialog";
```

Create a helper component for the dialog (inside the same file since layout is already `"use client"`):

```tsx
function GlobalAddFolderDialog() {
  const { isOpen, closeDialog, handleCreate } = useQuickCreate();

  return (
    <AddFolderDialog
      open={isOpen}
      onOpenChange={(open) => !open && closeDialog()}
      onAdd={handleCreate}
    />
  );
}
```

Wrap layout content with provider:

```tsx
<QuickCreateProvider>
  {/* existing layout */}
  <GlobalAddFolderDialog />
</QuickCreateProvider>
```

**Step 2: Commit**

```bash
git add app/(dashboard)/layout.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): add global Quick Create dialog

Provider in layout owns dialog state. Dialog creates folders at root.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update NavMain - Wire Quick Create and Remove Mail Button

**Files:**

- Modify: `components/nav-main.tsx`

**Step 1: Update NavMain**

```tsx
/**
 * Main navigation section for the sidebar.
 * Contains primary navigation items and quick create action.
 */

"use client";

import Link from "next/link";
import { CirclePlus, type LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useQuickCreateOptional } from "@/contexts/add-folder-context";

/**
 * Renders the main navigation section with quick create action.
 *
 * @param items - Array of navigation items with title, url, and optional icon
 */
export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
  }[];
}) {
  const quickCreate = useQuickCreateOptional();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Quick Create"
              onClick={() => quickCreate?.openDialog()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
            >
              <CirclePlus fill="currentColor" />
              <span>Quick Create</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title} asChild>
                <Link href={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

**Step 2: Commit**

```bash
git add components/nav-main.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): wire Quick Create, remove Mail button

Quick Create opens global dialog via context.
Remove unused Mail/Inbox button.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Refactor ItemContextMenu to Use AddFolderDialog

**Files:**

- Modify: `components/items/item-context-menu.tsx`

**Step 1: Replace inline dialog with AddFolderDialog**

Remove the add child dialog JSX and replace with:

```tsx
import { AddFolderDialog } from "./add-folder-dialog";

// In the component, replace the Add Child Dialog section with:
<AddFolderDialog
  open={addChildOpen}
  onOpenChange={setAddChildOpen}
  onAdd={async (name) => {
    if (!onAddChild) return "No handler";
    return onAddChild(name);
  }}
  parentName={itemName}
/>;
```

Remove unused imports: `Input`

**Step 2: Commit**

```bash
git add components/items/item-context-menu.tsx
git commit -m "$(cat <<'EOF'
refactor(items): use AddFolderDialog in context menu (DRY)

Replace inline add subfolder dialog with shared component.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update E2E Tests

**Files:**

- Modify: `e2e/pages/items.page.ts`
- Create: `e2e/journeys/items/items-quick-create.spec.ts`

**Step 1: Update page object selectors**

```tsx
// Replace old locators with:
readonly addFolderDialog: Locator;
readonly addFolderInput: Locator;
readonly addFolderSubmit: Locator;

// In constructor:
this.addFolderDialog = page.getByRole("dialog", { name: /create folder/i });
this.addFolderInput = page.getByLabel(/folder name/i);
this.addFolderSubmit = page.getByRole("button", { name: /^create$/i });
```

Update `createItem` method to use dialog flow.

**Step 2: Create Quick Create test**

```tsx
/**
 * E2E tests for Quick Create sidebar functionality.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Quick Create Journey", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("quick-create");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("Quick Create button opens add folder dialog", async ({ page }) => {
    await page.getByRole("button", { name: /quick create/i }).click();
    await expect(
      page.getByRole("dialog", { name: /create folder/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("can create folder via Quick Create", async ({ page, itemsPage }) => {
    await page.getByRole("button", { name: /quick create/i }).click();
    await page.getByLabel(/folder name/i).fill("Quick Created Folder");
    await page.getByRole("button", { name: /^create$/i }).click();

    await itemsPage.expectItemVisible("Quick Created Folder");
    await itemsPage.expectSuccessToast('Created "Quick Created Folder"');
  });
});
```

**Step 3: Commit**

```bash
git add e2e/pages/items.page.ts e2e/journeys/items/items-quick-create.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): update tests for modal dialog

Update page object selectors and add Quick Create tests.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Run Full Test Suite

**Step 1: Run all checks**

```bash
pnpm run check
pnpm run test:unit
BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium
```

---

## Summary

| Component              | Before                  | After                                |
| ---------------------- | ----------------------- | ------------------------------------ |
| Add Folder UI          | Inline expandable input | Modal dialog                         |
| Quick Create           | Non-functional          | Opens global modal (creates at root) |
| Mail button            | Present (unused)        | Removed                              |
| Context menu subfolder | Inline dialog           | Reuses AddFolderDialog               |

### New Files

- `components/items/add-folder-dialog.tsx`
- `contexts/add-folder-context.tsx`
- `tests/unit/components/add-folder-dialog.test.tsx`
- `e2e/journeys/items/items-quick-create.spec.ts`

### Deleted Files

- `components/items/add-item-button.tsx`
