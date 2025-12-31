# Unified Layout Design

**Date:** 2025-12-31
**Status:** Approved

---

## Overview

Unify the layout across homepage, dashboard, and docs pages using a single `AppSidebar` component that swaps its navigation items based on context.

## Current State

| Route          | Layout                       |
| -------------- | ---------------------------- |
| `/` (homepage) | No sidebar - standalone hero |
| `/dashboard/*` | AppSidebar + SiteHeader      |
| `/docs/*`      | Fumadocs separate sidebar    |

## Target State

| Route          | Layout                          |
| -------------- | ------------------------------- |
| `/` (homepage) | AppSidebar (guest) + SiteHeader |
| `/dashboard/*` | AppSidebar (auth) + SiteHeader  |
| `/docs/*`      | AppSidebar (docs) + SiteHeader  |

All pages use the same sidebar shell with context-aware navigation content.

---

## Sidebar Content by Context

| Context     | Sidebar Content                                                                |
| ----------- | ------------------------------------------------------------------------------ |
| `dashboard` | My Files, Get Help, Settings + User menu                                       |
| `docs`      | Back to Dashboard, Docs navigation tree + User menu (or auth buttons if guest) |
| `home`      | Get Help + Sign In/Sign Up buttons                                             |

---

## Component Changes

### AppSidebar

**Current**: Takes `user` prop, hardcoded nav items.

**New**: Takes `user` (optional), `context`, and `docsTree` (for docs context).

```tsx
interface AppSidebarProps {
  user?: SidebarUser | null;
  context: "dashboard" | "docs" | "home";
  docsTree?: PageTree; // Required when context="docs"
}
```

Structure:

- **Header**: Logo (links to /dashboard if auth, / if guest)
- **Content**: Swaps based on context
- **Footer**: NavUser if authenticated, AuthButtons if guest

### New Components

1. **`nav-docs.tsx`** - Renders Fumadocs pageTree using sidebar components
2. **`nav-guest.tsx`** - Guest nav with Get Help link and Sign In/Sign Up buttons

---

## File Structure (Final)

### New Files

```
components/
├── nav-docs.tsx          # Docs tree navigation
├── nav-guest.tsx         # Guest navigation with auth buttons
└── ui/collapsible.tsx    # Collapsible component for docs folders

app/
├── (public)/
│   ├── layout.tsx        # Public layout with guest sidebar
│   └── page.tsx          # Homepage
└── (docs)/
    ├── layout.tsx        # Docs layout with docs sidebar
    └── docs/
        └── [[...slug]]/
            └── page.tsx  # Fumadocs content
```

### Modified Files

- `components/app-sidebar.tsx` - Add context prop, conditional rendering
- `app/(dashboard)/layout.tsx` - Pass context="dashboard"

### Deleted Files

- `app/page.tsx` - Moved to (public)
- `app/docs/layout.tsx` - Replaced by (docs)/layout.tsx
- `app/docs/[[...slug]]/page.tsx` - Moved to (docs)/docs

---

## Layout Hierarchy (Final)

```
app/layout.tsx (root - providers only)
├── (auth)/ - Sign in/up (no sidebar)
├── (public)/layout.tsx - SidebarProvider + AppSidebar (home context)
│   └── page.tsx - Homepage
├── (docs)/layout.tsx - SidebarProvider + AppSidebar (docs context)
│   └── docs/[[...slug]]/page.tsx - Fumadocs content
└── (dashboard)/layout.tsx - SidebarProvider + AppSidebar (dashboard context)
    └── dashboard/... - Dashboard pages
```

Note: Each route group has its own layout to avoid nesting SidebarProviders.

---

## Implementation Steps

1. Create `nav-docs.tsx` component
2. Create `nav-guest.tsx` component
3. Modify `app-sidebar.tsx` to accept context prop
4. Create `app/(public)/layout.tsx`
5. Move homepage to `app/(public)/page.tsx`
6. Move docs to `app/(public)/docs/`
7. Update `app/(dashboard)/layout.tsx` to pass context
8. Update E2E tests for new sidebar structure
9. Run checks and verify all tests pass

---

## E2E Test Impact

- `docs-navigation.spec.ts` - Update selectors for unified sidebar
- Mobile tests should become more stable (same sidebar behavior everywhere)
- "Back to Dashboard" link now in our sidebar (not Fumadocs)
