# Dark Mode, Sidebar Simplification & Fumadocs Design

**Date:** 2025-12-30
**Status:** Approved

## Overview

Three changes in one cohesive update:

1. **Dark Mode** - Add theme toggle in sidebar footer using `next-themes`
2. **Sidebar Simplification** - Strip down to: My Files, Get Help, Settings, User menu
3. **Fumadocs** - Install with empty shell, accessible via "Get Help" link

## Dark Mode Implementation

### Dependencies

- `next-themes` - handles theme persistence, system preference, and hydration

### Changes

1. **Root layout** (`app/layout.tsx`):
   - Wrap with `ThemeProvider` from `next-themes`
   - Set `attribute="class"` to use `.dark` class (matches existing CSS)
   - Enable `defaultTheme="system"` for OS preference detection

2. **Theme toggle component** (`components/theme-toggle.tsx`):
   - `Sun` and `Moon` icons from `lucide-react`
   - Simple light ↔ dark toggle button
   - Uses `useTheme()` hook from `next-themes`

3. **Sidebar footer** (`components/nav-user.tsx`):
   - Add theme toggle button next to user menu
   - Subtle icon, doesn't distract from user actions

**No CSS changes needed** - `globals.css` already has complete dark mode variables.

## Sidebar Simplification

### New Structure

```
┌─────────────────────────┐
│ CanonCore (logo)        │  ← Header (renamed from "Acme Inc.")
├─────────────────────────┤
│ My Files                │  ← Primary nav (links to /dashboard)
├─────────────────────────┤
│                         │
│      (spacer)           │
│                         │
├─────────────────────────┤
│ Get Help                │  ← Secondary nav (links to /docs)
│ Settings                │  ← Future settings page (keep as #)
├─────────────────────────┤
│ [☀] User Name ▾         │  ← Footer: theme toggle + user menu
└─────────────────────────┘
```

### Files to Modify

- `components/app-sidebar.tsx` - Remove NavDocuments, simplify navMain/navSecondary
- `components/nav-main.tsx` - Simplify to single item (My Files)
- `components/nav-user.tsx` - Add theme toggle next to user menu

### Files to Delete

- `components/nav-documents.tsx` - No longer used

## Fumadocs Setup

### Dependencies

- `fumadocs-ui` - UI components
- `fumadocs-core` - Core utilities
- `fumadocs-mdx` - MDX support

### Route Structure

```
app/
├── docs/
│   ├── layout.tsx        ← Fumadocs layout (matches app styling)
│   ├── [[...slug]]/
│   │   └── page.tsx      ← Dynamic docs page
├── (dashboard)/          ← Existing dashboard (unchanged)
```

### Content Location

```
content/
└── docs/
    └── index.mdx         ← "Getting Started" placeholder
```

### Integration

- "Get Help" sidebar link → `/docs`
- Fumadocs uses same font (Geist) and respects dark mode
- Separate layout from dashboard (no sidebar in docs)

## Testing Strategy

### Unit Tests

- `ThemeToggle` component - verify it renders and cycles themes
- Location: `tests/unit/components/theme-toggle.test.tsx`

### Integration Tests

- None needed (theme is client-side, Fumadocs is static content)

### E2E Tests

1. `e2e/journeys/theme/dark-mode.spec.ts`:
   - Toggle theme via sidebar button
   - Verify `.dark` class on `<html>`
   - Verify theme persists across page reload

2. `e2e/journeys/docs/docs-navigation.spec.ts`:
   - Navigate to `/docs` via "Get Help" link
   - Verify docs page renders
   - Verify dark mode works in docs

### Verification Commands

```bash
pnpm run check           # Format, lint, type-check, knip, build
pnpm run test:unit       # Unit tests
pnpm run test:e2e        # E2E tests
```

## File Changes Summary

### New Files

| File                                          | Purpose                     |
| --------------------------------------------- | --------------------------- |
| `components/theme-toggle.tsx`                 | Sun/Moon toggle button      |
| `components/providers/theme-provider.tsx`     | next-themes wrapper         |
| `app/docs/layout.tsx`                         | Fumadocs layout             |
| `app/docs/[[...slug]]/page.tsx`               | Fumadocs page               |
| `content/docs/index.mdx`                      | Getting Started placeholder |
| `source.config.ts`                            | Fumadocs source config      |
| `tests/unit/components/theme-toggle.test.tsx` | Unit test                   |
| `e2e/journeys/theme/dark-mode.spec.ts`        | E2E test                    |
| `e2e/journeys/docs/docs-navigation.spec.ts`   | E2E test                    |

### Modified Files

| File                         | Changes                                  |
| ---------------------------- | ---------------------------------------- |
| `app/layout.tsx`             | Wrap with ThemeProvider                  |
| `components/app-sidebar.tsx` | Simplify to My Files, Get Help, Settings |
| `components/nav-user.tsx`    | Add theme toggle in footer               |
| `package.json`               | Add next-themes, fumadocs-\*             |

### Deleted Files

- `components/nav-documents.tsx`

## Dependencies to Add

```bash
pnpm add next-themes fumadocs-ui fumadocs-core fumadocs-mdx
```
