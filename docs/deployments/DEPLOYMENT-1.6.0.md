# Deployment 1.6.0 - Spotlight Search

**Date**: 2026-01-11
**Branch**: development

## Summary

Find your items instantly with the new Spotlight search. Press "/" anywhere in the app to open a macOS Spotlight-style search dialog. Start typing to fuzzy-filter through all your items, complete with artwork thumbnails and breadcrumb paths showing where each item lives in your hierarchy.

## Features

### Instant search with "/" keyboard shortcut

Press "/" to open the search dialog from any page. Type to filter items using fuzzy matching. Press Enter to navigate to the selected item, or Escape to close.

The search button also appears in the sidebar with a "/" keyboard hint, so you can click it if you prefer.

### Artwork thumbnails in search results

Each search result shows the item's artwork thumbnail (if available) or a folder icon. The search respects your primary artwork selection - if you've designated a primary artwork file, that's what shows. Otherwise, it falls back to the first available artwork.

### Breadcrumb paths for nested items

Nested items display their parent path below the name. For example, "Deleted Scenes" might show "Movies / Star Wars" underneath, so you know exactly where to find it in your hierarchy.

### Available on all pages

Spotlight search now works everywhere for signed-in people - not just on the My Items page. Whether you're on the homepage, reading docs, or deep in your items, press "/" to search.

### SWR-style caching

The search dialog shows cached results immediately while fetching fresh data in the background. This means instant results on repeat searches, with automatic updates when your items change.

## Files Changed

### Added

```
components/search/global-spotlight.tsx           # Wrapper that renders SpotlightSearch
components/search/spotlight-search.tsx           # Main search dialog component
components/ui/command.tsx                        # cmdk Command component (shadcn)
components/ui/kbd.tsx                            # Keyboard shortcut display component
contexts/spotlight-context.tsx                   # Spotlight state and "/" shortcut handler
e2e/journeys/items/spotlight-search.spec.ts      # 27 E2E tests
e2e/pages/spotlight.page.ts                      # Page object for E2E tests
tests/unit/components/search/spotlight-search.test.tsx  # 14 unit tests
tests/unit/contexts/spotlight-context.test.tsx   # 12 unit tests
```

### Modified

```
app/(docs)/layout.tsx              # Wraps with SpotlightProvider for authenticated users
app/(public)/layout.tsx            # Wraps with SpotlightProvider for authenticated users
components/app-sidebar.tsx         # Logo always links to homepage, NavMain for all auth users
components/my-items-providers.tsx  # Includes GlobalSpotlight component
components/nav-main.tsx            # Adds search button with "/" keyboard hint
components/nav-user.tsx            # Minor style updates
lib/item-actions.ts                # New getSearchableItems server action
lib/rate-limit.ts                  # Added itemSearch rate limit
lib/types.ts                       # Added SearchableItem type
package.json                       # Added cmdk dependency, version bump
pnpm-lock.yaml                     # Lock file updated
tests/unit/components/nav-main.test.tsx  # Tests for search button visibility
tests/unit/lib/item-actions.test.ts      # Tests for getSearchableItems
```

## Technical Details

### SpotlightContext manages dialog state

The context provides `isOpen`, `openSpotlight`, and `closeSpotlight`. It registers a global keyboard listener for "/" that toggles the dialog:

```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    const activeElement = document.activeElement as HTMLElement | null;
    const isInput =
      activeElement?.tagName === "INPUT" ||
      activeElement?.tagName === "TEXTAREA" ||
      activeElement?.isContentEditable;

    if (event.key === "/" && !isInput) {
      event.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

### SWR-style caching for instant results

A module-level cache stores the last fetch result. When the dialog opens, it shows cached data immediately while fetching fresh data:

```typescript
let cachedItems: SearchableItem[] | null = null;

// In the effect:
if (cachedItems !== null) {
  setItems(cachedItems); // Show cached immediately
} else {
  setIsLoading(true);
}

const result = await getSearchableItems();
if (result.success) {
  cachedItems = result.data ?? []; // Update cache
  setItems(cachedItems);
}
```

### Artwork fallback logic

The search query gets all artwork files ordered by `isPrimary` descending, then uses the first one:

```typescript
files: {
  where: { fileType: "ARTWORK" },
  select: { id: true, isPrimary: true },
  orderBy: { isPrimary: "desc" },
}

// Mapping uses first artwork (primary if exists, otherwise first available)
artworkId: item.files[0]?.id ?? null,
```

### Rate limiting

Search requests are rate-limited to prevent abuse:

```typescript
// In rate-limit.ts
itemSearch: { limit: 30, window: "1m" },
```

## Test Results

| Suite      | Result     |
| ---------- | ---------- |
| Unit tests | 668 passed |
| Lint       | 0 errors   |
| Types      | 0 errors   |
| Knip       | 0 unused   |

New test coverage:

- 14 tests for SpotlightSearch component
- 12 tests for SpotlightContext
- 8 tests for getSearchableItems server action
- 27 E2E tests for search flows

## Deployment Steps

1. Pull latest changes
2. Run `pnpm install` (new dependency: cmdk)
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No database migrations or environment variable changes required.

## Version History

| Version | Date       | Summary                                       |
| ------- | ---------- | --------------------------------------------- |
| 1.6.0   | 2026-01-11 | Spotlight search with artwork and breadcrumbs |
| 1.5.0   | 2026-01-11 | Dropzone upload for settings dialog           |
| 1.4.0   | 2026-01-11 | Google Drive improvements, sidebar cleanup    |
| 1.3.0   | 2026-01-10 | Dedicated password and email change modals    |
| 1.2.0   | 2026-01-10 | Sync behavior improvements, auth page polish  |
| 1.1.0   | 2026-01-10 | Test coverage expansion, auth UX improvements |
| 1.0.0   | 2026-01-10 | Google Drive integration replacing SFTP       |
