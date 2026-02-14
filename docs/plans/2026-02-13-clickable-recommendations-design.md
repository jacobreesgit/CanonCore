# Clickable Recommendations Design

**Date:** 2026-02-13
**Status:** Approved

## Overview

Make recommendation cards on the About tab interactive. Currently, clicking a recommendation shows a toast suggesting the user search manually. This design replaces that with real navigation and add-to-library flows based on whether the recommended item already exists in the user's library, is publicly available, or is new.

## Behaviour Matrix

| Condition | Badge | Render | Click Action |
|---|---|---|---|
| Item exists in user's library (TMDB ID match) | "Yours" (User icon) | `<Link>` | Navigate to own item |
| Item is public on Explore (not user's own) | None | `<Link>` | Navigate to `/u/[username]/[itemId]` |
| New item (logged-in user) | None | `<button>` | Open Add Item dialog with TMDB pre-selected |
| New item (guest) | None | `<div>` | Non-interactive |

**Priority:** If the item exists in the user's library AND is also public, "Yours" takes precedence — always navigate to the user's own item.

**Matching:** TMDB ID only (exact match on `tmdbId` field). No fuzzy title matching.

## Section 1 — Server-Side Resolution

### `resolveRecommendationMatches()` in `lib/tmdb-utils.ts`

```typescript
interface ResolvedRecommendation extends Recommendation {
  matchType: 'yours' | 'public' | 'new';
  href?: string;
  itemId?: string;
}

async function resolveRecommendationMatches(
  recommendations: Recommendation[],
  userId: string | null
): Promise<ResolvedRecommendation[]>
```

**Single DB query approach:**
1. Collect all TMDB IDs from recommendations
2. Query items table: `WHERE tmdbId IN (...) AND (userId = currentUser OR (isPublic = true AND inheritVisibility = false))`
3. For each recommendation, resolve in priority order: yours → public → new
4. Attach `href` for yours/public matches, leave undefined for new

**For guests** (`userId: null`): Skip the "yours" check, only resolve public matches. All non-public items resolve as `matchType: 'new'` with no click handler (rendered as non-interactive `<div>`).

**Performance:** Single indexed query on `tmdbId`. Recommendations are typically 10-20 items, so the `IN` clause is small.

## Section 2 — PosterCard Badge & Interaction

### Badge Pattern (matching GridItem)

PosterCard gains the same badge system already used by `GridItem` (`components/sortable-grid/grid-item.tsx:307-327`):

- **Position:** `absolute top-2 left-2 z-30`
- **Style:** `rounded-full px-1.5 py-0.5 bg-black/50 backdrop-blur-sm text-[10px] font-medium text-white/70`
- **"Yours" variant:** User icon + "Yours" text
- **"In Library" variant:** Green Check icon + "In Library" text (for future fork detection)

### New PosterCard Props

```typescript
interface PosterCardProps {
  // ... existing props
  isOwn?: boolean;       // Shows "Yours" badge
  isForked?: boolean;    // Shows "In Library" badge
  disabled?: boolean;    // Renders as non-interactive <div>
}
```

### Render Logic

| Props | Element |
|---|---|
| `href` (no `onClick`) | `<Link>` (existing) |
| `onClick` (no `href`) | `<button>` (existing) |
| `disabled` | `<div>` with no hover/focus effects |

### Aria Labels

| matchType | aria-label |
|---|---|
| `yours` | `Go to "{title}"` |
| `public` | `View "{title}" by @{username}` |
| `new` | `Add "{title}" to library` |
| `new` (guest) | `{title}` (no action) |

## Section 3 — Recommendations Component Changes

### Props Change

```typescript
// Before
interface RecommendationsProps {
  recommendations: Recommendation[];
  // ...
}

// After
interface RecommendationsProps {
  recommendations: ResolvedRecommendation[];
  onAddRecommendation?: (rec: ResolvedRecommendation) => void;
  // ...
}
```

- Remove `handleAddClick` toast logic
- Map `matchType` to PosterCard props: `isOwn`, `href`, `onClick`, `disabled`
- When `onAddRecommendation` is not provided, "new" items render as disabled

### Add Item Integration

When a "new" recommendation is clicked:
1. `onAddRecommendation({ tmdbId, title, mediaType })` fires
2. Parent opens Add Item dialog/sheet
3. `useAddItemForm` hook gains `openWithTmdbMatch({ tmdbId, title, mediaType })`:
   - Sets search query to the title
   - Fires TMDB search
   - Auto-selects the result matching `tmdbId`
   - Advances wizard to step 1 (metadata preview)

## Section 4 — Wiring & Data Flow

### Where Resolution Happens

- `app/(public)/u/[username]/[itemId]/page.tsx` — public item detail
- Authenticated item detail page (if separate)
- Server component calls `resolveRecommendationMatches()` with `userId` from `auth()`
- Passes `ResolvedRecommendation[]` as prop to About tab content

### `useAddItemForm` Hook Changes

Add new method:

```typescript
openWithTmdbMatch(match: { tmdbId: number; title: string; mediaType: 'movie' | 'tv' }): void
```

This keeps all TMDB search and wizard state inside the existing hook.

### File Changes Summary

| File | Change |
|---|---|
| `lib/tmdb-utils.ts` | Add `resolveRecommendationMatches()` |
| `lib/tmdb-client.ts` | Export `ResolvedRecommendation` type |
| `components/items/poster-card.tsx` | Add `isOwn`, `isForked`, `disabled` props + badge markup |
| `components/items/recommendations.tsx` | Accept `ResolvedRecommendation[]`, map to PosterCard props |
| `hooks/use-add-item-form.ts` | Add `openWithTmdbMatch()` method |
| `app/(public)/u/[username]/[itemId]/page.tsx` | Call `resolveRecommendationMatches()` |
| Authenticated item detail page | Same resolution call |

## Testing Plan

### Unit Tests

| Test File | Coverage |
|---|---|
| `tests/unit/lib/resolve-recommendation-matches.test.ts` | yours/public/new resolution, priority (yours > public), no user (guests), empty recs, no TMDB IDs |
| `tests/unit/components/poster-card.test.tsx` | Badge rendering with `isOwn`/`isForked`, disabled renders `<div>`, aria-labels |
| `tests/unit/components/recommendations.test.tsx` | Correct badge/href/onClick per matchType, guest disabled state, onAddRecommendation callback |

### Integration Tests

| Test File | Coverage |
|---|---|
| `tests/integration/resolve-recommendation-matches.test.ts` | Real DB query with TMDB ID matching, yours vs public priority |

### E2E Tests

| Scenario | Assertion |
|---|---|
| Click "Yours" recommendation | Navigates to own item page |
| Click "public" recommendation | Navigates to public item page |
| Click "new" recommendation (logged in) | Opens Add Item dialog with TMDB pre-populated |
| Guest views recommendations | Cards are non-interactive (no pointer cursor) |
| "Yours" badge visible | Badge shows on matched items |

### Existing Tests to Update

- Any existing recommendation rendering tests that assert on the toast behaviour
- Storybook stories for Recommendations component (add variants for each matchType)
