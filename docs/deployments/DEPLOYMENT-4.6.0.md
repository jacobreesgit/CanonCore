# Deployment 4.6.0 - Global Search for Public Users and Items

**Date**: 2026-01-21
**Branch**: development

## Summary

This release extends Spotlight Search to discover public users and items across the platform. Users can now press "/" to search their own library, public collections, and user profiles in one unified interface with independent loading states.

## Features

### Global Spotlight Search

Extended spotlight search to include three result sections:

```
Spotlight Search Dialog:
┌─────────────────────────────────────────────────┐
│ 🔍 Search...                                    │
├─────────────────────────────────────────────────┤
│ Your Items                                      │
│ ┌──────┐ Star Wars                              │
│ │ 🎬   │ Movies / Star Wars                     │
│ └──────┘                                        │
├─────────────────────────────────────────────────┤
│ Public Collections                              │
│ ┌──────┐ Breaking Bad                           │
│ │ 📺   │ @filmfan                              │
│ └──────┘                                        │
├─────────────────────────────────────────────────┤
│ People                                          │
│ ┌──────┐ filmfan                                │
│ │ 👤   │ Film Fan                              │
│ └──────┘                                        │
└─────────────────────────────────────────────────┘
```

**Key features:**

- **Three sections**: "Your Items" (existing), "Public Collections" (new), "People" (new)
- **Independent loading**: Each section shows skeleton/content independently
- **SWR-style caching**: 60-second TTL module-level cache for instant results
- **Parallel fetching**: All three sections fetch concurrently
- **Rate limiting**: userSearch and publicItemSearch limiters (60/min each)

**Search logic:**

| Section            | Data Source            | Filter                                                                                  |
| ------------------ | ---------------------- | --------------------------------------------------------------------------------------- |
| Your Items         | `getSearchableItems()` | User's own items                                                                        |
| Public Collections | `searchPublicItems()`  | Explicitly public items (`isPublic: true`, `inheritVisibility: false`) from other users |
| People             | `searchPublicUsers()`  | Public profiles (`isPublic: true`)                                                      |

**Navigation:**

- Clicking a user result navigates to `/u/[username]`
- Clicking a public item navigates to `/u/[username]/[itemId]`
- Clicking own item navigates to `/my-items/[itemId]`

### New Types

Added interfaces for public search results:

```typescript
interface SearchableUser {
  id: string;
  username: string;
  name: string | null;
}

interface SearchablePublicItem {
  id: string;
  name: string;
  description: string | null;
  artworkId: string | null;
  ownerUsername: string;
  ownerName: string | null;
}
```

### User Thumbnail Component

New component for displaying user avatars in search results:

- Fetches avatar from `/api/public/avatar?username=[username]`
- Falls back to initials-based placeholder
- Supports loading state with skeleton

### Public Items Tree Utility

New `publicItemsToTree()` function for converting public items to hierarchical tree structure:

- Handles relative depth calculation for proper nesting
- Supports progress data passthrough (for owner's own items)
- Used in public item detail pages for tree view

### Seed Configuration Updates

Restructured seed user content for visual variety:

| User         | Theme               | Movies                               | Shows                                        |
| ------------ | ------------------- | ------------------------------------ | -------------------------------------------- |
| demo         | Classic Cinema Buff | Shawshank, Godfather series, Matrix  | Breaking Bad, Sopranos                       |
| filmfan      | International Film  | Spirited Away, Parasite, Amélie      | Squid Game, Dark                             |
| bingewatcher | Peak TV             | Dark Knight, Inception, Interstellar | Game of Thrones, Stranger Things, The Office |
| scifi_jordan | Sci-Fi/Fantasy      | Blade Runner, Dune, Arrival          | Doctor Who, The Expanse, Black Mirror        |

**Key change**: Zero content overlap between users for distinct visual variety.

## Files Changed

### Added

```
components/search/user-thumbnail.tsx          # User avatar thumbnail component
docs/plans/2026-01-21-public-username-search.md  # Implementation plan
docs/plans/2026-01-21-seed-unique-content-per-user.md  # Seed plan
scripts/check-artwork.ts                      # Artwork verification utility
tests/integration/public/search-public.test.ts  # Search integration tests
tests/unit/components/search/user-thumbnail.test.tsx  # Thumbnail unit tests
tests/unit/lib/item-utils-tree.test.ts        # Tree utility tests
tests/unit/lib/search-public-items.test.ts    # Public item search tests
tests/unit/lib/search-public-users.test.ts    # Public user search tests
```

### Modified

```
app/(my-items)/my-items/[itemId]/page.tsx     # Minor updates
app/(my-items)/my-items/page.tsx              # Minor updates
app/(public)/explore/explore-client.tsx       # UI refinements
app/(public)/explore/page.tsx                 # Server component updates
app/(public)/u/[username]/[itemId]/page.tsx   # Public item routing
app/(public)/u/[username]/[itemId]/public-item-client.tsx  # Tree view support
app/(public)/u/[username]/page.tsx            # Profile page updates
app/(public)/u/[username]/public-profile-client.tsx  # UI improvements
components/items/item-detail-client.tsx       # Spotlight integration
components/items/items-view.tsx               # Spotlight integration
components/nav-user.tsx                       # Profile dropdown updates
components/search/spotlight-search.tsx        # Global search implementation
components/sortable-grid/Grid.tsx             # Description link support
components/sortable-grid/GridItem.tsx         # Public item support
e2e/journeys/public/public-profile.spec.ts    # Search E2E tests
e2e/pages/public-profile.page.ts              # Page object updates
lib/item-utils.ts                             # publicItemsToTree function
lib/public-auth.ts                            # searchPublicUsers, searchPublicItems
lib/rate-limit.ts                             # userSearch, publicItemSearch limiters
lib/types.ts                                  # SearchableUser, SearchablePublicItem
lib/user-actions.ts                           # Minor updates
prisma/seed-config.ts                         # Unique content per user
prisma/seed.ts                                # Seed improvements
tests/integration/public/public-profile.test.ts  # Extended coverage
tests/unit/components/search/spotlight-search.test.tsx  # Extended tests
tests/unit/lib/public-auth.test.ts            # Search function tests
tests/unit/prisma/seed-config.test.ts         # Config tests
```

## Test Coverage Impact

| Area                     | Before | After | Change |
| ------------------------ | ------ | ----- | ------ |
| Spotlight search tests   | ~150   | ~580  | +430   |
| User thumbnail tests     | 0      | ~53   | +53    |
| Public auth search tests | 0      | ~291  | +291   |
| Item utils tree tests    | ~100   | ~305  | +205   |
| Seed config tests        | ~80    | ~161  | +81    |

## Breaking Changes

None. All changes are additive.

## Migration Notes

1. **No database migration required** - no schema changes.

2. **New rate limiters** - `userSearch` and `publicItemSearch` added. Ensure Upstash Redis is configured.

3. **Seed changes** - Re-running seed will create different content distribution per user. This is intentional for visual variety.
