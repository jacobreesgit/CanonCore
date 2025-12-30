# Lucide Icon Consolidation Design

**Date:** 2025-12-30
**Status:** Approved
**Author:** Claude

## Overview

Replace all `@tabler/icons-react` usage with `lucide-react` to consolidate the codebase to a single icon library.

### Benefits

- Reduced bundle size (removes ~300KB from `@tabler/icons-react`)
- Single source of truth for icons
- Consistent icon styling across the app
- Lucide has excellent tree-shaking

## Scope

**Files to modify:** 12 component files

| File                                                        | Tabler Icons Used     |
| ----------------------------------------------------------- | --------------------- |
| `components/app-sidebar.tsx`                                | 15 icons              |
| `components/nav-user.tsx`                                   | 5 icons               |
| `components/site-header.tsx`                                | 4 icons               |
| `components/nav-documents.tsx`                              | 5 icons + `type Icon` |
| `components/nav-main.tsx`                                   | 2 icons + `type Icon` |
| `components/nav-secondary.tsx`                              | `type Icon` only      |
| `components/items/item-context-menu.tsx`                    | 3 icons               |
| `components/items/add-item-button.tsx`                      | 2 icons               |
| `components/items/view-toggle.tsx`                          | 2 icons               |
| `components/items/items-view.tsx`                           | 2 icons               |
| `components/sortable-grid/GridItem.tsx`                     | 1 icon                |
| `components/sortable-tree/components/TreeItem/TreeItem.tsx` | 5 icons               |

## Icon Mapping

| Tabler Icon            | Lucide Equivalent | Notes                                       |
| ---------------------- | ----------------- | ------------------------------------------- |
| `IconCamera`           | `Camera`          | Direct match                                |
| `IconChartBar`         | `BarChart3`       | Lucide uses BarChart variants               |
| `IconChevronRight`     | `ChevronRight`    | Direct match                                |
| `IconCirclePlusFilled` | `CirclePlus`      | Add `fill="currentColor"` for filled effect |
| `IconCreditCard`       | `CreditCard`      | Direct match                                |
| `IconDashboard`        | `LayoutDashboard` | Direct match                                |
| `IconDatabase`         | `Database`        | Direct match                                |
| `IconDots`             | `MoreHorizontal`  | Direct match                                |
| `IconDotsVertical`     | `MoreVertical`    | Direct match                                |
| `IconEdit`             | `Pencil`          | Lucide uses Pencil for edit                 |
| `IconFileAi`           | `Sparkles`        | AI-related icon                             |
| `IconFileDescription`  | `FileText`        | Direct match                                |
| `IconFileWord`         | `FileType`        | Generic file type icon                      |
| `IconFolder`           | `Folder`          | Direct match                                |
| `IconFolderOpen`       | `FolderOpen`      | Direct match                                |
| `IconFolderPlus`       | `FolderPlus`      | Direct match                                |
| `IconGripVertical`     | `GripVertical`    | Direct match                                |
| `IconHelp`             | `HelpCircle`      | Direct match                                |
| `IconHome`             | `Home`            | Direct match                                |
| `IconInnerShadowTop`   | `Layers`          | Closest equivalent for logo                 |
| `IconLayoutGrid`       | `LayoutGrid`      | Direct match                                |
| `IconList`             | `List`            | Direct match                                |
| `IconListDetails`      | `ListTodo`        | Better semantic match                       |
| `IconLogout`           | `LogOut`          | Direct match                                |
| `IconMail`             | `Mail`            | Direct match                                |
| `IconNotification`     | `Bell`            | Lucide uses Bell                            |
| `IconPencil`           | `Pencil`          | Direct match                                |
| `IconPlus`             | `Plus`            | Direct match                                |
| `IconReport`           | `FileBarChart`    | Report with chart                           |
| `IconSearch`           | `Search`          | Direct match                                |
| `IconSettings`         | `Settings`        | Direct match                                |
| `IconShare3`           | `Share2`          | Direct match                                |
| `IconTrash`            | `Trash2`          | Lucide preferred variant                    |
| `IconUserCircle`       | `UserCircle`      | Direct match                                |
| `IconUsers`            | `Users`           | Direct match                                |
| `IconX`                | `X`               | Direct match                                |

**Type replacement:** `type Icon` from Tabler → `LucideIcon` from `lucide-react`

## Implementation

### Strategy

Direct find-and-replace per file, then remove the Tabler dependency.

### Steps

1. Update each component file:
   - Replace `@tabler/icons-react` imports with `lucide-react`
   - Rename icons per mapping table
   - Replace `type Icon` with `LucideIcon`

2. Handle special cases:
   - `IconCirclePlusFilled` → Add `fill="currentColor"` to `CirclePlus`
   - Verify icon sizes match (both use `size-4` pattern)

3. Remove Tabler dependency:
   - `pnpm remove @tabler/icons-react`

### File Order

1. `components/app-sidebar.tsx` (largest, sets the pattern)
2. `components/nav-main.tsx`
3. `components/nav-secondary.tsx`
4. `components/nav-documents.tsx`
5. `components/nav-user.tsx`
6. `components/site-header.tsx`
7. `components/items/item-context-menu.tsx`
8. `components/items/add-item-button.tsx`
9. `components/items/view-toggle.tsx`
10. `components/items/items-view.tsx`
11. `components/sortable-grid/GridItem.tsx`
12. `components/sortable-tree/components/TreeItem/TreeItem.tsx`

## Testing Strategy

### Unit Tests

- No new unit tests needed (icons are purely presentational)
- Existing tests should pass unchanged

### Integration Tests

- No changes needed (tests don't assert on specific icon rendering)

### E2E Tests

- Run full suite to verify visual rendering works
- Icons are not directly tested but will appear in screenshots
- Key flows to verify: sidebar navigation, item CRUD, context menus

### Manual Verification

- Visual check of all icon locations after migration
- Verify `CirclePlus` with `fill="currentColor"` looks correct
- Check icon sizing consistency across components

### Verification Commands

```bash
pnpm run check          # Format, lint, type-check, knip, build
pnpm run test:unit      # Unit tests
pnpm run test:e2e       # E2E tests (desktop + mobile)
```

## Risk Assessment

- **Risk Level:** Low
- **Breaking Changes:** None (purely cosmetic)
- **Bundle Impact:** ~300KB reduction

## Summary

- 12 component files updated
- 36 icon replacements
- 1 type replacement (`Icon` → `LucideIcon`)
- 1 dependency removed (`@tabler/icons-react`)
