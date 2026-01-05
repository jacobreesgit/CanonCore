# Sidebar Active Styling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add active state styling to all sidebar navigation items, highlighting the current page's nav item.

**Architecture:** Extend the existing pattern from `nav-docs.tsx` (using `usePathname()` + `isActive` prop) to `nav-main.tsx`, `nav-guest.tsx`, and the sidebar footer items in `app-sidebar.tsx`. The `SidebarMenuButton` already supports `isActive` prop with proper CSS styling via `data-[active=true]`.

**Tech Stack:** Next.js (usePathname hook), React, shadcn/ui sidebar components, Vitest, Playwright

---

## Review Notes (2026-01-05)

**Validated against:** Context7 (Next.js, React Testing Library docs), code-review-excellence skill, sequential-thinking MCP

### ✅ Verified Patterns

- `usePathname()` from `next/navigation` - official Next.js recommended approach per docs
- Pattern `pathname === url || pathname.startsWith(\`${url}/\`)` correctly handles hierarchical routes
- Trailing slash in `startsWith()` prevents false positives (e.g., `/my-items-other` won't match `/my-items/`)
- Follows existing pattern from `nav-docs.tsx` for consistency
- Uses existing `SidebarMenuButton` `isActive` prop - no new components needed

### 🔧 Fixes Applied During Review

1. **Added edge case test** - Test that `/my-items-other` doesn't falsely match `/my-items` (prevents prefix collision)
2. **Added code comment** - Document the trailing slash pattern for future maintainers
3. **Verified E2E URLs** - Confirmed tests use `/my-items` not old `/dashboard` routes

### 💡 Implementation Notes

- The active state logic is duplicated across 3 components (nav-main, nav-guest, app-sidebar) - this is acceptable per YAGNI; extracting a utility would be over-engineering for this simple pattern
- `usePathname()` is lightweight and causes no additional re-renders (components already client-side)
- Security: No user input handling, pure UI state from browser URL

---

## Task 1: Add Unit Tests for NavMain Active State

**Files:**

- Create: `tests/unit/components/nav-main.test.tsx`

**Step 1: Write failing tests for nav-main active state**

Create `tests/unit/components/nav-main.test.tsx`:

```typescript
/**
 * Unit tests for NavMain component.
 * Tests navigation item active state styling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavMain } from "@/components/nav-main";
import { Folder } from "lucide-react";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock sidebar context
vi.mock("@/components/ui/sidebar", () => ({
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-group">{children}</div>
  ),
  SidebarGroupContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="sidebar-group-content" className={className}>
      {children}
    </div>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul data-testid="sidebar-menu">{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li data-testid="sidebar-menu-item">{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
    tooltip,
    asChild,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    tooltip?: string;
    asChild?: boolean;
    className?: string;
    onClick?: () => void;
  }) => (
    <button
      data-testid="sidebar-menu-button"
      data-active={isActive}
      data-tooltip={tooltip}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

// Mock add-folder-context
vi.mock("@/contexts/add-folder-context", () => ({
  useQuickCreateOptional: () => null,
}));

const testItems = [
  { title: "My Items", url: "/my-items", icon: Folder },
];

describe("NavMain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders My Items button as active on /my-items", () => {
    mockPathname.mockReturnValue("/my-items");
    render(<NavMain items={testItems} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    // Second button is My Items (first is Quick Create)
    const myItemsButton = buttons[1];
    expect(myItemsButton.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as active on nested path /my-items/123", () => {
    mockPathname.mockReturnValue("/my-items/abc123");
    render(<NavMain items={testItems} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const myItemsButton = buttons[1];
    expect(myItemsButton.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as active on /my-items/connections", () => {
    mockPathname.mockReturnValue("/my-items/connections");
    render(<NavMain items={testItems} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const myItemsButton = buttons[1];
    expect(myItemsButton.getAttribute("data-active")).toBe("true");
  });

  it("renders My Items button as inactive on /docs", () => {
    mockPathname.mockReturnValue("/docs");
    render(<NavMain items={testItems} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const myItemsButton = buttons[1];
    expect(myItemsButton.getAttribute("data-active")).toBe("false");
  });

  it("renders My Items button as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<NavMain items={testItems} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const myItemsButton = buttons[1];
    expect(myItemsButton.getAttribute("data-active")).toBe("false");
  });

  it("renders My Items button as inactive on /my-items-other (no false positive)", () => {
    // Edge case: paths that START with /my-items but are NOT children
    // The trailing slash in startsWith() prevents this false positive
    mockPathname.mockReturnValue("/my-items-other");
    render(<NavMain items={testItems} />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const myItemsButton = buttons[1];
    expect(myItemsButton.getAttribute("data-active")).toBe("false");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/components/nav-main.test.tsx`
Expected: FAIL - NavMain doesn't use isActive prop yet

**Step 3: Commit test file**

```bash
git add tests/unit/components/nav-main.test.tsx
git commit -m "test(unit): add nav-main active state tests"
```

---

## Task 2: Implement Active State in NavMain

**Files:**

- Modify: `components/nav-main.tsx`

**Step 1: Add usePathname and isActive logic**

Update `components/nav-main.tsx`:

```typescript
/**
 * Main navigation section for the sidebar.
 * Contains primary navigation items and quick create action.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
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
              <CirclePlus />
              <span>Quick Create</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            // Active when on exact path OR any nested child path
            // Trailing slash prevents false positives (e.g., /my-items-other won't match /my-items/)
            const isActive =
              pathname === item.url || pathname.startsWith(`${item.url}/`);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={item.title} asChild isActive={isActive}>
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

**Step 2: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/components/nav-main.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add components/nav-main.tsx
git commit -m "feat(nav): add active state to NavMain items"
```

---

## Task 3: Add Unit Tests for NavGuest Active State

**Files:**

- Create: `tests/unit/components/nav-guest.test.tsx`

**Step 1: Write failing tests for nav-guest active state**

Create `tests/unit/components/nav-guest.test.tsx`:

```typescript
/**
 * Unit tests for NavGuest (AuthButtons) component.
 * Tests navigation item active state styling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthButtons } from "@/components/nav-guest";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock sidebar components
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul data-testid="sidebar-menu">{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li data-testid="sidebar-menu-item">{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
    asChild,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    asChild?: boolean;
  }) => (
    <button data-testid="sidebar-menu-button" data-active={isActive}>
      {children}
    </button>
  ),
}));

describe("AuthButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Get Help as active on /docs", () => {
    mockPathname.mockReturnValue("/docs");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getHelpButton = buttons[0];
    expect(getHelpButton.getAttribute("data-active")).toBe("true");
  });

  it("renders Get Help as active on /docs/getting-started", () => {
    mockPathname.mockReturnValue("/docs/getting-started");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getHelpButton = buttons[0];
    expect(getHelpButton.getAttribute("data-active")).toBe("true");
  });

  it("renders Get Help as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getHelpButton = buttons[0];
    expect(getHelpButton.getAttribute("data-active")).toBe("false");
  });

  it("renders Get Started as active on /sign-in", () => {
    mockPathname.mockReturnValue("/sign-in");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getStartedButton = buttons[1];
    expect(getStartedButton.getAttribute("data-active")).toBe("true");
  });

  it("renders Get Started as inactive on /", () => {
    mockPathname.mockReturnValue("/");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getStartedButton = buttons[1];
    expect(getStartedButton.getAttribute("data-active")).toBe("false");
  });

  it("renders Get Started as inactive on /sign-up", () => {
    mockPathname.mockReturnValue("/sign-up");
    render(<AuthButtons />);

    const buttons = screen.getAllByTestId("sidebar-menu-button");
    const getStartedButton = buttons[1];
    expect(getStartedButton.getAttribute("data-active")).toBe("false");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/components/nav-guest.test.tsx`
Expected: FAIL - AuthButtons doesn't use isActive prop yet

**Step 3: Commit test file**

```bash
git add tests/unit/components/nav-guest.test.tsx
git commit -m "test(unit): add nav-guest active state tests"
```

---

## Task 4: Implement Active State in NavGuest

**Files:**

- Modify: `components/nav-guest.tsx`

**Step 1: Add usePathname and isActive logic**

Update `components/nav-guest.tsx`:

```typescript
/**
 * Guest navigation component.
 * Shows Get Help link and auth button for unauthenticated users.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, HelpCircle } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Renders help and auth buttons for the sidebar footer.
 * Shows Get Help and Get Started for guests.
 */
export function AuthButtons() {
  const pathname = usePathname();

  // Docs uses prefix matching (hierarchical), sign-in uses exact matching
  const isDocsActive = pathname === "/docs" || pathname.startsWith("/docs/");
  const isSignInActive = pathname === "/sign-in";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isDocsActive}>
          <Link href="/docs">
            <HelpCircle className="size-4" />
            <span>Get Help</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isSignInActive}>
          <Link href="/sign-in">
            <ArrowRight className="size-4" />
            <span>Get Started</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

**Step 2: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/components/nav-guest.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add components/nav-guest.tsx
git commit -m "feat(nav): add active state to AuthButtons"
```

---

## Task 5: Add Unit Tests for AppSidebar Footer Active State

**Files:**

- Create: `tests/unit/components/app-sidebar.test.tsx`

**Step 1: Write failing tests for sidebar footer active state**

Create `tests/unit/components/app-sidebar.test.tsx`:

```typescript
/**
 * Unit tests for AppSidebar component.
 * Tests footer navigation item active state styling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppSidebar } from "@/components/app-sidebar";

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock child components
vi.mock("@/components/nav-main", () => ({
  NavMain: () => <div data-testid="nav-main">NavMain</div>,
}));

vi.mock("@/components/nav-user", () => ({
  NavUser: () => <div data-testid="nav-user">NavUser</div>,
}));

vi.mock("@/components/nav-docs", () => ({
  NavDocs: () => <div data-testid="nav-docs">NavDocs</div>,
}));

vi.mock("@/components/nav-guest", () => ({
  AuthButtons: () => <div data-testid="auth-buttons">AuthButtons</div>,
}));

// Mock sidebar components
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <aside data-testid="sidebar">{children}</aside>
  ),
  SidebarHeader: ({ children }: { children: React.ReactNode }) => (
    <header data-testid="sidebar-header">{children}</header>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-content">{children}</div>
  ),
  SidebarFooter: ({ children }: { children: React.ReactNode }) => (
    <footer data-testid="sidebar-footer">{children}</footer>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <ul data-testid="sidebar-menu">{children}</ul>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <li data-testid="sidebar-menu-item">{children}</li>
  ),
  SidebarMenuButton: ({
    children,
    isActive,
    tooltip,
    asChild,
    className,
  }: {
    children: React.ReactNode;
    isActive?: boolean;
    tooltip?: string;
    asChild?: boolean;
    className?: string;
  }) => (
    <button
      data-testid="sidebar-menu-button"
      data-active={isActive}
      data-tooltip={tooltip}
      className={className}
    >
      {children}
    </button>
  ),
}));

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
};

describe("AppSidebar footer active state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when authenticated on my-items context", () => {
    it("renders Connections as active on /my-items/connections", () => {
      mockPathname.mockReturnValue("/my-items/connections");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByTestId("sidebar-footer");
      const buttons = footer.querySelectorAll('[data-testid="sidebar-menu-button"]');

      // First footer button is Connections
      const connectionsButton = buttons[0];
      expect(connectionsButton.getAttribute("data-active")).toBe("true");
    });

    it("renders Connections as active on /my-items/connections/123/edit", () => {
      mockPathname.mockReturnValue("/my-items/connections/123/edit");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByTestId("sidebar-footer");
      const buttons = footer.querySelectorAll('[data-testid="sidebar-menu-button"]');

      const connectionsButton = buttons[0];
      expect(connectionsButton.getAttribute("data-active")).toBe("true");
    });

    it("renders Connections as inactive on /my-items", () => {
      mockPathname.mockReturnValue("/my-items");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByTestId("sidebar-footer");
      const buttons = footer.querySelectorAll('[data-testid="sidebar-menu-button"]');

      const connectionsButton = buttons[0];
      expect(connectionsButton.getAttribute("data-active")).toBe("false");
    });

    it("renders Get Help as active on /docs", () => {
      mockPathname.mockReturnValue("/docs");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByTestId("sidebar-footer");
      const buttons = footer.querySelectorAll('[data-testid="sidebar-menu-button"]');

      // Second footer button is Get Help
      const getHelpButton = buttons[1];
      expect(getHelpButton.getAttribute("data-active")).toBe("true");
    });

    it("renders Get Help as active on /docs/getting-started", () => {
      mockPathname.mockReturnValue("/docs/getting-started");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByTestId("sidebar-footer");
      const buttons = footer.querySelectorAll('[data-testid="sidebar-menu-button"]');

      const getHelpButton = buttons[1];
      expect(getHelpButton.getAttribute("data-active")).toBe("true");
    });

    it("renders Get Help as inactive on /my-items", () => {
      mockPathname.mockReturnValue("/my-items");
      render(<AppSidebar user={mockUser} context="my-items" />);

      const footer = screen.getByTestId("sidebar-footer");
      const buttons = footer.querySelectorAll('[data-testid="sidebar-menu-button"]');

      const getHelpButton = buttons[1];
      expect(getHelpButton.getAttribute("data-active")).toBe("false");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/components/app-sidebar.test.tsx`
Expected: FAIL - AppSidebar footer doesn't use isActive prop yet

**Step 3: Commit test file**

```bash
git add tests/unit/components/app-sidebar.test.tsx
git commit -m "test(unit): add app-sidebar footer active state tests"
```

---

## Task 6: Implement Active State in AppSidebar Footer

**Files:**

- Modify: `components/app-sidebar.tsx`

**Step 1: Add usePathname and isActive logic to footer items**

Update `components/app-sidebar.tsx`:

```typescript
/**
 * Main application sidebar component.
 * Adapts navigation content based on context (my-items, docs, or home).
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cable, Folder, HelpCircle } from "lucide-react";
import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import type { SidebarUser } from "@/lib/auth";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { NavDocs } from "@/components/nav-docs";
import { AuthButtons } from "@/components/nav-guest";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Sidebar context determines which navigation items to display.
 */
type SidebarContext = "my-items" | "docs" | "home";

/**
 * Props for AppSidebar component.
 */
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  /** Current user (null for guests) */
  user?: SidebarUser | null;
  /** Context determines navigation content */
  context: SidebarContext;
  /** Fumadocs page tree (required when context="docs") */
  docsTree?: PageTreeRoot;
}

/** Main navigation items for authenticated users. */
const myItemsNavMain = [
  {
    title: "My Items",
    url: "/my-items",
    icon: Folder,
  },
];

/**
 * Renders the collapsible sidebar with context-aware navigation.
 * Supports offcanvas mode for mobile viewports.
 *
 * @param user - Current user data (null for guests)
 * @param context - Determines which navigation items to display
 * @param docsTree - Fumadocs page tree for docs context
 */
export function AppSidebar({
  user,
  context,
  docsTree,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname();

  // Logo links to my-items if authenticated, home if guest
  const logoHref = user ? "/my-items" : "/";

  // Active state for footer nav items
  // Pattern: exact match OR prefix with trailing slash (prevents false positives)
  const isConnectionsActive =
    pathname === "/my-items/connections" ||
    pathname.startsWith("/my-items/connections/");
  const isDocsActive = pathname === "/docs" || pathname.startsWith("/docs/");

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={logoHref}>
                <span className="text-base font-semibold">CanonCore</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Show my-items nav for my-items context, or for authenticated users on home */}
        {(context === "my-items" || (context === "home" && user)) && (
          <NavMain items={myItemsNavMain} />
        )}

        {context === "docs" && docsTree && (
          <NavDocs tree={docsTree} isAuthenticated={!!user} />
        )}
      </SidebarContent>

      <SidebarFooter>
        {/* Show footer nav for my-items context, or for authenticated users on home */}
        {(context === "my-items" || (context === "home" && user)) && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Connections"
                isActive={isConnectionsActive}
              >
                <Link href="/my-items/connections">
                  <Cable />
                  <span>Connections</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Get Help"
                isActive={isDocsActive}
              >
                <Link href="/docs">
                  <HelpCircle />
                  <span>Get Help</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        {user ? <NavUser user={user} /> : <AuthButtons />}
      </SidebarFooter>
    </Sidebar>
  );
}
```

**Step 2: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/components/app-sidebar.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "feat(nav): add active state to sidebar footer items"
```

---

## Task 7: Add E2E Tests for Active State Visual Verification

**Files:**

- Create: `e2e/journeys/navigation/nav-active-state.spec.ts`

**Step 1: Create E2E test file**

```typescript
/**
 * E2E tests for sidebar navigation active state styling.
 * Verifies nav items are visually highlighted when their page is active.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Navigation Active State", () => {
  test.describe("authenticated user", () => {
    test.beforeEach(async ({ page, signUpPage }) => {
      const email = generateUniqueEmail("nav-active");
      await signUpPage.goto();
      await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
      await expect(page).toHaveURL("/my-items", { timeout: 10000 });
    });

    test("My Items nav is active on /my-items", async ({ page }) => {
      // Find the My Items nav button in sidebar
      const myItemsNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "My Items",
      });

      await expect(myItemsNav).toHaveAttribute("data-active", "true");
    });

    test("My Items nav is active on nested folder", async ({
      page,
      itemsPage,
    }) => {
      await itemsPage.createItem("Test Folder");
      await itemsPage.clickItem("Test Folder");

      // Should still show My Items as active
      const myItemsNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "My Items",
      });
      await expect(myItemsNav).toHaveAttribute("data-active", "true");
    });

    test("Connections nav is active on /my-items/connections", async ({
      page,
    }) => {
      await page.goto("/my-items/connections");

      const connectionsNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Connections",
      });
      await expect(connectionsNav).toHaveAttribute("data-active", "true");
    });

    test("Get Help nav is active on /docs", async ({ page }) => {
      await page.goto("/docs");

      const getHelpNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Get Help",
      });
      await expect(getHelpNav).toHaveAttribute("data-active", "true");
    });

    test("Get Help nav is active on nested docs page", async ({ page }) => {
      await page.goto("/docs/getting-started");

      const getHelpNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Get Help",
      });
      await expect(getHelpNav).toHaveAttribute("data-active", "true");
    });
  });

  test.describe("guest user", () => {
    test("Get Help nav is active on /docs", async ({ page }) => {
      await page.goto("/docs");

      const getHelpNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Get Help",
      });
      await expect(getHelpNav).toHaveAttribute("data-active", "true");
    });

    test("Get Started nav is active on /sign-in", async ({ page }) => {
      await page.goto("/sign-in");

      const getStartedNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Get Started",
      });
      await expect(getStartedNav).toHaveAttribute("data-active", "true");
    });

    test("Get Started nav is inactive on home page", async ({ page }) => {
      await page.goto("/");

      const getStartedNav = page.locator('[data-slot="sidebar-menu-button"]', {
        hasText: "Get Started",
      });
      await expect(getStartedNav).toHaveAttribute("data-active", "false");
    });
  });
});
```

**Step 2: Create navigation directory if needed**

Run: `mkdir -p e2e/journeys/navigation`

**Step 3: Run E2E tests**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e e2e/journeys/navigation/nav-active-state.spec.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add e2e/journeys/navigation/
git commit -m "test(e2e): add navigation active state tests"
```

---

## Task 8: Run Full Test Suite and Verify

**Step 1: Run all unit tests**

Run: `pnpm run test:unit`
Expected: All tests pass

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: No type errors

**Step 3: Run lint**

Run: `pnpm run lint`
Expected: No lint errors

**Step 4: Run format check**

Run: `pnpm run format:check`
Expected: No formatting issues (or run `pnpm run format` to fix)

**Step 5: Run E2E tests**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e`
Expected: All tests pass

**Step 6: Run full check**

Run: `pnpm run check`
Expected: All checks pass

**Step 7: Final commit**

```bash
git add .
git commit -m "feat: add active state styling to all sidebar nav items"
```

---

## Summary

This implementation adds active state styling to all sidebar navigation items:

1. **NavMain** (`nav-main.tsx`): "My Items" link now shows active styling when on `/my-items` or any nested path
2. **AuthButtons** (`nav-guest.tsx`): "Get Help" active on `/docs/*`, "Get Started" active on `/sign-in`
3. **AppSidebar footer**: "Connections" active on `/my-items/connections/*`, "Get Help" active on `/docs/*`

**Pattern used:**

- `usePathname()` from `next/navigation` to get current route
- `isActive = pathname === url || pathname.startsWith(\`\${url}/\`)` for hierarchical routes
- `isActive = pathname === url` for exact routes (like /sign-in)
- `SidebarMenuButton` `isActive` prop triggers `data-[active=true]` CSS styling

**Testing:**

- 5 unit tests for NavMain
- 6 unit tests for AuthButtons
- 6 unit tests for AppSidebar footer
- 8 E2E tests for visual verification

Total: ~25 new tests
