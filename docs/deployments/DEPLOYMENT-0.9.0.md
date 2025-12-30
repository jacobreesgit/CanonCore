# Deployment 0.9.0 - Lucide Icon Consolidation

**Date:** 2025-12-30
**Branch:** development

## Summary

This release consolidates all icons to use Lucide React, removing the `@tabler/icons-react` dependency. This reduces bundle size and standardizes the icon library across the codebase.

## Changes

### Icon Library Migration

- **Replaced all Tabler icons** with Lucide React equivalents across 12 component files
- **Removed `@tabler/icons-react`** dependency from package.json
- **Standardized icon naming** using Lucide conventions

### Icon Mapping

| Tabler Icon          | Lucide Equivalent |
| -------------------- | ----------------- |
| IconCamera           | Camera            |
| IconChartBar         | BarChart3         |
| IconChevronRight     | ChevronRight      |
| IconCirclePlusFilled | CirclePlus        |
| IconDashboard        | LayoutDashboard   |
| IconDatabase         | Database          |
| IconDots             | MoreHorizontal    |
| IconDotsVertical     | MoreVertical      |
| IconEdit             | Pencil            |
| IconFileAi           | Sparkles          |
| IconFileDescription  | FileText          |
| IconFileWord         | FileType          |
| IconFolder           | Folder            |
| IconFolderOpen       | FolderOpen        |
| IconFolderPlus       | FolderPlus        |
| IconGripVertical     | GripVertical      |
| IconHelp             | HelpCircle        |
| IconHome             | Home              |
| IconInnerShadowTop   | Layers            |
| IconLayoutGrid       | LayoutGrid        |
| IconList             | List              |
| IconListDetails      | ListTodo          |
| IconMail             | Mail              |
| IconPencil           | Pencil            |
| IconPlus             | Plus              |
| IconReport           | FileBarChart      |
| IconSearch           | Search            |
| IconSettings         | Settings          |
| IconShare3           | Share2            |
| IconTrash            | Trash2            |
| IconUsers            | Users             |
| IconX                | X                 |
| type Icon            | LucideIcon        |

## Modified Files

| File                                        | Changes                                  |
| ------------------------------------------- | ---------------------------------------- |
| `components/app-sidebar.tsx`                | Replaced 16 Tabler icons with Lucide     |
| `components/nav-main.tsx`                   | Replaced CirclePlus and Mail icons       |
| `components/nav-secondary.tsx`              | Updated icon type to LucideIcon          |
| `components/nav-documents.tsx`              | Replaced Folder, MoreHorizontal, icons   |
| `components/nav-user.tsx`                   | Replaced Bell, CreditCard, LogOut icons  |
| `components/site-header.tsx`                | Replaced ChevronRight, MoreVertical, etc |
| `components/items/add-item-button.tsx`      | Replaced Plus and X icons                |
| `components/items/item-context-menu.tsx`    | Replaced Pencil, FolderPlus, Trash2      |
| `components/items/items-view.tsx`           | Replaced Home and Folder icons           |
| `components/items/view-toggle.tsx`          | Replaced List and LayoutGrid icons       |
| `components/sortable-grid/GridItem.tsx`     | Replaced Folder icon                     |
| `components/sortable-tree/.../TreeItem.tsx` | Replaced 5 icons (grip, chevron, etc)    |
| `package.json`                              | Removed @tabler/icons-react dependency   |

## Removed Dependencies

```json
{
  "@tabler/icons-react": "3.35.0"
}
```

## Bundle Size Impact

- Removed `@tabler/icons-react` (~2.3MB unpacked)
- Lucide React was already a dependency, no new packages added
- Net reduction in bundle size

## Verification

All checks pass:

- Format, lint, type-check, knip, build
- 57 unit tests passed
