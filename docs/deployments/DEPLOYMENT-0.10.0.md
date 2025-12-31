# Deployment 0.10.0 - User Documentation & Dark Mode

**Date:** 2025-12-31
**Branch:** development

## Summary

This release adds comprehensive user documentation powered by Fumadocs and introduces dark mode with a theme toggle. The documentation covers all app features with 16 MDX pages organized by topic.

## Changes

### User Documentation

- **Fumadocs integration** for MDX-based documentation at `/docs`
- **16 documentation pages** covering getting started, file management, views, account, and preferences
- **Hierarchical navigation** with sidebar and breadcrumbs
- **Theme-aware** - documentation respects the user's theme choice

### Dark Mode

- **Theme toggle** in the header bar (sun/moon icon)
- **System preference detection** on first visit
- **Persistent preference** saved across sessions via next-themes
- **Full coverage** across dashboard and documentation pages

### New E2E Tests

- **docs-navigation.spec.ts** - 6 tests for documentation navigation
- **dark-mode.spec.ts** - 4 tests for theme toggle functionality
- Test helpers for sidebar and theme interactions

### Component Updates

- **ThemeProvider** wraps app with next-themes context
- **ThemeToggle** button with animated sun/moon icons
- **Sidebar** updated with "Get Help" link to `/docs`
- **Removed** unused `nav-documents.tsx` component

## New Files

| File                                   | Purpose                                |
| -------------------------------------- | -------------------------------------- |
| `app/docs/layout.tsx`                  | Documentation layout with DocsLayout   |
| `app/docs/[[...slug]]/page.tsx`        | Dynamic documentation page renderer    |
| `components/providers/theme-provider.tsx` | next-themes provider wrapper        |
| `components/theme-toggle.tsx`          | Theme toggle button component          |
| `lib/source.ts`                        | Fumadocs source configuration          |
| `source.config.ts`                     | Fumadocs content config                |
| `mdx-components.tsx`                   | MDX component mappings                 |
| `content/docs/**/*.mdx`                | 16 documentation pages                 |
| `e2e/journeys/docs/docs-navigation.spec.ts` | Docs E2E tests                   |
| `e2e/journeys/theme/dark-mode.spec.ts` | Theme E2E tests                        |
| `e2e/pages/docs.page.ts`               | Docs page object model                 |
| `e2e/helpers/sidebar-helpers.ts`       | Sidebar test utilities                 |
| `e2e/helpers/theme-helpers.ts`         | Theme test utilities                   |

## Documentation Structure

```
content/docs/
├── index.mdx                    # Welcome page
├── meta.json                    # Navigation structure
├── getting-started/
│   ├── create-account.mdx
│   ├── sign-in.mdx
│   └── quick-tour.mdx
├── files-and-folders/
│   ├── create-folder.mdx
│   ├── rename-items.mdx
│   ├── delete-items.mdx
│   ├── navigation.mdx
│   └── organize.mdx
├── views/
│   ├── tree-view.mdx
│   ├── grid-view.mdx
│   └── drag-and-drop.mdx
├── account/
│   ├── password-reset.mdx
│   ├── security.mdx
│   └── sign-out.mdx
└── preferences/
    └── dark-mode.mdx
```

## New Dependencies

```json
{
  "fumadocs-core": "^15.2.7",
  "fumadocs-mdx": "^11.5.2",
  "fumadocs-ui": "^15.2.7",
  "next-themes": "^0.4.6"
}
```

## Modified Files

| File                          | Changes                                   |
| ----------------------------- | ----------------------------------------- |
| `app/layout.tsx`              | Added ThemeProvider wrapper               |
| `app/globals.css`             | Added Fumadocs CSS imports                |
| `components/app-sidebar.tsx`  | Simplified, added Get Help link           |
| `components/site-header.tsx`  | Added ThemeToggle component               |
| `next.config.mjs`             | Added createMDX wrapper                   |
| `tsconfig.json`               | Added .source path alias                  |
| `eslint.config.mjs`           | Ignored .source directory                 |
| `knip.json`                   | Added MDX and source config entries       |

## Test Coverage

- **E2E tests**: 56 total (28 desktop + 28 mobile)
  - 10 new tests for docs and theme functionality
- **Unit tests**: 58 total (1 new for ThemeToggle)
- **Integration tests**: 20 total (unchanged)

## Verification

All checks pass:

- Format, lint, type-check, knip, build
- 58 unit tests passed
- 20 integration tests passed
- 56 E2E tests passed (28 desktop + 28 mobile)
