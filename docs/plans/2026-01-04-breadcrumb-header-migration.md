# Breadcrumb Header Migration Design

## Overview

Move breadcrumb navigation from `ItemsView` component into `SiteHeader` for item detail pages. Root dashboard and connection list pages continue showing title-only headers.

## Scope Clarification

| Page Type       | Has Breadcrumbs | Example                                                                  |
| --------------- | --------------- | ------------------------------------------------------------------------ |
| Root dashboard  | No              | `/dashboard` → "My Files" only                                           |
| Connection list | No              | `/dashboard/connections` → "Connections" only                            |
| Item detail     | Yes             | `/dashboard/[itemId]` → "My Files / Movies / Action"                     |
| Connection item | Yes             | `/dashboard/connections/[id]/[itemId]` → "Connections / Server / Movies" |

## Current State

- `SiteHeader` has breadcrumb support via props (currently unused)
- `DashboardHeader` wraps `SiteHeader` with auto-detected title based on pathname
- `ItemsView` renders its own breadcrumb nav internally (lines 368-416)
- Item pages pass breadcrumbs from server components to `ItemsView`

## Proposed Change

- Remove breadcrumb nav from `ItemsView` entirely
- Item detail pages render `SiteHeader` directly with breadcrumbs
- Remove `DashboardHeader` from layout; each page renders its own header
- Root pages render `SiteHeader` with title only (no breadcrumbs)

## Architecture Decision

**Approach B: Page-specific headers** - Each page renders its own header variant.

| Approach                  | Pros             | Cons                                |
| ------------------------- | ---------------- | ----------------------------------- |
| Props through layout      | Clean data flow  | Requires layout changes, complex    |
| **Page-specific headers** | Simple, explicit | Some duplication                    |
| React Context             | Flexible         | Adds complexity, hydration concerns |

Chosen for simplicity and explicit data flow.

## Implementation Details

### Files to Modify

1. **`components/items/items-view.tsx`**
   - Remove breadcrumb `<nav>` element (lines 368-416)
   - Keep controls section (Add, Edit, ViewToggle)
   - Remove unused imports (already cleaned up)

2. **`app/(dashboard)/dashboard/[itemId]/page.tsx`**
   - Import and render `SiteHeader` with breadcrumbs
   - Compute breadcrumb hrefs in server component before passing to SiteHeader
   - Pass `title="My Files"` and `titleHref="/dashboard"`

3. **`app/(dashboard)/dashboard/connections/[id]/[itemId]/page.tsx`**
   - Import and render `SiteHeader` with breadcrumbs
   - Compute connection-aware hrefs in server component
   - Pass `title="Connections"` and `titleHref="/dashboard/connections"`

4. **`app/(dashboard)/dashboard/page.tsx`**
   - Import and render `SiteHeader` with title only (no breadcrumbs)

5. **`app/(dashboard)/dashboard/connections/page.tsx`**
   - Import and render `SiteHeader` with title only (no breadcrumbs)

6. **`app/(dashboard)/layout.tsx`**
   - Remove `DashboardHeader` from layout (each page renders its own header)

7. **`components/dashboard-header.tsx`**
   - Delete file (no longer needed)

### Breadcrumb Data Flow

```
Server Component (page.tsx)
    ↓ getItem() returns { item, ancestors }
    ↓ Map to BreadcrumbItem[] with hrefs
SiteHeader (breadcrumbs prop)
    ↓ Renders breadcrumb nav
```

### Href Generation

```typescript
// Regular items
const breadcrumbs = ancestors.map((a) => ({
  id: a.id,
  name: a.name,
  href: `/dashboard/${a.id}`,
}));

// Connection items
const breadcrumbs = ancestors.map((a, i) => ({
  id: a.id,
  name: a.name,
  href:
    i === 0
      ? `/dashboard/connections/${connectionId}`
      : `/dashboard/connections/${connectionId}/${a.id}`,
}));
```

## Testing Strategy

### E2E Tests (Playwright)

| Test                  | File                       | Description                                         |
| --------------------- | -------------------------- | --------------------------------------------------- |
| Breadcrumb navigation | `items-navigation.spec.ts` | Click breadcrumb links in header, verify navigation |
| Breadcrumb display    | `items-navigation.spec.ts` | Drill into folders, verify header shows path        |
| Root pages            | `items-crud.spec.ts`       | Verify `/dashboard` shows "My Files" title only     |
| Connection pages      | `connections-crud.spec.ts` | Verify "Connections" title only, no breadcrumbs     |

### Existing Tests to Update

| File                                          | Change Needed                                                     |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `e2e/journeys/items/items-navigation.spec.ts` | Update breadcrumb selectors to target header instead of ItemsView |
| `e2e/pages/items.page.ts`                     | Update breadcrumb locators if any exist                           |

### Unit Tests (Vitest)

| Test                             | File                                         | Description                    |
| -------------------------------- | -------------------------------------------- | ------------------------------ |
| `SiteHeader` renders breadcrumbs | `tests/unit/components/site-header.test.tsx` | When breadcrumbs prop provided |
| `SiteHeader` renders title only  | `tests/unit/components/site-header.test.tsx` | When breadcrumbs empty         |
| Breadcrumb truncation            | `tests/unit/components/site-header.test.tsx` | Long names truncated correctly |

### Test IDs

- `site-header-breadcrumb-root` - Root title link
- `site-header-breadcrumb-item` - Each breadcrumb item

### Integration Tests

None needed - purely UI/component change, no server actions affected.

### Mobile Behavior

Header already handles overflow with `min-w-0` on nav and `truncate` on breadcrumb items. Mobile Chrome E2E project will verify.

## Migration Steps

1. Remove breadcrumb `<nav>` from `ItemsView` component
2. Update `/dashboard/page.tsx` to render `SiteHeader` with title only
3. Update `/dashboard/[itemId]/page.tsx` to render `SiteHeader` with breadcrumbs
4. Update `/dashboard/connections/page.tsx` to render `SiteHeader` with title only
5. Update `/dashboard/connections/[id]/page.tsx` to render `SiteHeader` with title only
6. Update `/dashboard/connections/[id]/[itemId]/page.tsx` to render `SiteHeader` with breadcrumbs
7. Remove `DashboardHeader` from layout.tsx
8. Delete `components/dashboard-header.tsx`
9. Add test IDs to `SiteHeader` breadcrumb elements
10. Update E2E tests for breadcrumb navigation (update selectors)
11. Add unit tests for `SiteHeader` breadcrumb rendering
12. Run full test suite to verify

## Risks & Mitigations

| Risk                   | Mitigation                                                         |
| ---------------------- | ------------------------------------------------------------------ |
| Header rendered twice  | Remove header from layout entirely; each page renders its own      |
| Breadcrumb hrefs wrong | Compute hrefs in server component using existing logic pattern     |
| Mobile layout breaks   | Test on mobile Chrome (existing E2E project)                       |
| Pages missing header   | Verify all dashboard pages render SiteHeader during implementation |

## Out of Scope

- Context menu (rename/delete) in header - already exists, unchanged
- Docs page breadcrumbs - separate layout, not affected
- Connection list page breadcrumbs (`/dashboard/connections`) - title only, no hierarchy
