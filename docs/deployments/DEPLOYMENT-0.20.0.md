# Deployment 0.20.0 - Route Rename: Dashboard to My Items

**Date**: 2026-01-05
**Branch**: development

## Summary

This release renames all "dashboard" references to "my-items" throughout the codebase. The URL structure changes from `/dashboard` to `/my-items`, aligning routes with the user-facing terminology. This is a breaking change for existing bookmarks.

## Changes

### Route Structure

All protected routes now use `/my-items` instead of `/dashboard`:

| Old Route                          | New Route                         |
| ---------------------------------- | --------------------------------- |
| `/dashboard`                       | `/my-items`                       |
| `/dashboard/[itemId]`              | `/my-items/[itemId]`              |
| `/dashboard/connections`           | `/my-items/connections`           |
| `/dashboard/connections/[id]`      | `/my-items/connections/[id]`      |
| `/dashboard/connections/new`       | `/my-items/connections/new`       |
| `/dashboard/connections/[id]/edit` | `/my-items/connections/[id]/edit` |

### Component Renames

All component, type, and variable names updated:

| Old Name             | New Name           |
| -------------------- | ------------------ |
| `DashboardPage`      | `MyItemsPage`      |
| `DashboardLayout`    | `MyItemsLayout`    |
| `DashboardProviders` | `MyItemsProviders` |
| `dashboardNavMain`   | `myItemsNavMain`   |
| `dashboardPage`      | `myItemsPage`      |

### File Renames

| Old File                             | New File                            |
| ------------------------------------ | ----------------------------------- |
| `app/(dashboard)/`                   | `app/(my-items)/`                   |
| `app/(dashboard)/dashboard/`         | `app/(my-items)/my-items/`          |
| `components/dashboard-providers.tsx` | `components/my-items-providers.tsx` |
| `e2e/pages/dashboard.page.ts`        | `e2e/pages/my-items.page.ts`        |

### Test ID Renames

| Old Test ID                 | New Test ID                |
| --------------------------- | -------------------------- |
| `dashboard-user-menu`       | `my-items-user-menu`       |
| `dashboard-sign-out-button` | `my-items-sign-out-button` |
| `dashboard-welcome-message` | `my-items-welcome-message` |

### Type Changes

The `SidebarContext` type changed from `"dashboard"` to `"my-items"`:

```typescript
// Before
type SidebarContext = "dashboard" | "docs" | "home";

// After
type SidebarContext = "my-items" | "docs" | "home";
```

### User Documentation Updates

Fumadocs articles updated with new route references:

- `content/docs/getting-started/create-account.mdx`
- `content/docs/getting-started/quick-tour.mdx`
- `content/docs/getting-started/sign-in.mdx`
- `content/docs/files-and-folders/navigation.mdx`

## Files Changed

```
# Renamed folders
app/(dashboard)/          → app/(my-items)/
app/(dashboard)/dashboard/→ app/(my-items)/my-items/

# Renamed files
components/dashboard-providers.tsx → components/my-items-providers.tsx
e2e/pages/dashboard.page.ts        → e2e/pages/my-items.page.ts

# Modified files (58 total)
app/(auth)/sign-in/page.tsx
app/(auth)/sign-up/page.tsx
app/(my-items)/layout.tsx
app/(my-items)/my-items/**/*.tsx
app/(public)/page.tsx
components/app-sidebar.tsx
components/items/items-view.tsx
components/my-items-providers.tsx
components/nav-docs.tsx
components/nav-user.tsx
components/sftp/connection-*.tsx
components/site-header.tsx
contexts/add-folder-context.tsx
e2e/**/*.ts
lib/item-file-actions.ts
lib/sftp-actions.ts
tests/unit/components/site-header.test.tsx
content/docs/**/*.mdx
```

## Test Results

- **Unit tests**: 289 passed
- **Integration tests**: 53 passed
- **E2E tests**: 106 passed

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install`
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No new environment variables required.

## Breaking Changes

**URL Change**: All `/dashboard` URLs now redirect to `/my-items`. Update any:

- Bookmarks
- External links
- Documentation references
- API integrations using dashboard routes

## Migration Notes

The route change is immediate - old `/dashboard` URLs will return 404. If backward compatibility is needed, consider adding redirects in `next.config.mjs`:

```javascript
async redirects() {
  return [
    {
      source: '/dashboard/:path*',
      destination: '/my-items/:path*',
      permanent: true,
    },
  ];
}
```
