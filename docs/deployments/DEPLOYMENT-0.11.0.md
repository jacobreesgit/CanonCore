# Deployment 0.11.0 - Unified Layout Architecture

**Date:** 2025-12-31
**Branch:** development

## Summary

This release introduces a unified layout architecture with context-aware sidebar navigation. All pages now share the same sidebar shell with content that adapts based on context (dashboard, docs, or home). Guest users see auth buttons while authenticated users see their profile.

## Changes

### Unified Layout System

- **Route groups** reorganized: `(dashboard)`, `(docs)`, `(public)`
- **Context-aware sidebar** adapts navigation based on current section
- **Guest navigation** with Sign In/Sign Up buttons for unauthenticated users
- **Consistent header** across all pages with customizable title and breadcrumbs

### New Navigation Components

- **NavDocs** - Renders Fumadocs page tree with collapsible folders
- **NavGuest** - Shows Get Help link and auth buttons for guests
- **AuthButtons** - Sign In/Sign Up buttons in sidebar footer

### Auth Improvements

- **extractSidebarUser()** helper function extracts user data for sidebar display
- **SidebarUser** type exported from `lib/auth.ts` for consistent typing
- **Optional user** support in AppSidebar for guest pages

### E2E Test Enhancements

- **Test data attributes** added: `data-testid="items-grid-view"`, `data-testid="items-tree-view"`, `data-testid="add-item-cancel"`
- **Improved selectors** in page objects for more reliable tests

## New Files

| File                            | Purpose                             |
| ------------------------------- | ----------------------------------- |
| `app/(docs)/layout.tsx`         | Docs layout with sidebar navigation |
| `app/(public)/layout.tsx`       | Public layout for homepage          |
| `components/nav-docs.tsx`       | Docs navigation from Fumadocs tree  |
| `components/nav-guest.tsx`      | Guest navigation with auth buttons  |
| `components/ui/collapsible.tsx` | shadcn/ui collapsible component     |

## Modified Files

| File                                        | Changes                                     |
| ------------------------------------------- | ------------------------------------------- |
| `app/(dashboard)/layout.tsx`                | Uses extractSidebarUser, passes context     |
| `app/(docs)/docs/[[...slug]]/page.tsx`      | Renamed from `app/docs/`, simplified layout |
| `components/app-sidebar.tsx`                | Context-aware navigation, guest support     |
| `components/site-header.tsx`                | Added titleHref prop                        |
| `components/items/add-item-button.tsx`      | Added data-testid for cancel button         |
| `components/sortable-grid/SortableGrid.tsx` | Added data-testid                           |
| `components/sortable-tree/SortableTree.tsx` | Added data-testid                           |
| `lib/auth.ts`                               | Added SidebarUser type, extractSidebarUser  |
| `e2e/pages/*.page.ts`                       | Updated selectors for new layout            |

## Deleted Files

| File                  | Reason                                      |
| --------------------- | ------------------------------------------- |
| `app/docs/layout.tsx` | Replaced by unified `app/(docs)/layout.tsx` |

## Route Structure

```
app/
├── (auth)/                    # Auth pages (no sidebar)
│   ├── forgot-password/
│   ├── reset-password/
│   ├── sign-in/
│   └── sign-up/
├── (dashboard)/               # Protected dashboard (authenticated users)
│   ├── dashboard/
│   │   ├── [itemId]/page.tsx
│   │   └── page.tsx
│   └── layout.tsx
├── (docs)/                    # Documentation (all users)
│   ├── docs/
│   │   └── [[...slug]]/page.tsx
│   └── layout.tsx
├── (public)/                  # Public pages (landing)
│   ├── layout.tsx
│   └── page.tsx
└── layout.tsx                 # Root layout with providers
```

## Design Documents

- `docs/plans/2025-12-31-unified-layout-design.md` - Layout architecture design
- `docs/plans/2025-12-31-code-quality-patterns-design.md` - Code quality analysis
- `docs/plans/2025-12-31-e2e-code-review.md` - E2E test patterns review

## Verification

All checks pass:

- Format, lint, type-check, knip, build
- 58 unit tests passed
- 20 integration tests passed
- 56 E2E tests passed (28 desktop + 28 mobile)
