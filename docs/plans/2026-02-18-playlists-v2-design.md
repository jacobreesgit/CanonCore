# Playlists v2 Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Upgrade playlists from basic CRUD to full feature parity with items — artwork upload, unlisted sharing, improved metadata, tabs, tree view, edit mode, mobile sheets, toolbar parity, and comprehensive test coverage.

**Architecture:** Three new features (artwork bytes-in-DB, share token for unlisted access, enhanced JSON-LD/OG), plus exhaustive parity fixes across all playlist surfaces (detail page, cards, profile, explore, sidebar, search, mobile), plus complete test coverage backfill.

**Guiding principle:** Playlists should be exactly like items in every way, except they are freeform (any item from anywhere) and have no forking.

---

## Table of Contents

1. [New Features](#1-new-features)
   - [1.1 Artwork Upload](#11-artwork-upload)
   - [1.2 Unlisted Sharing](#12-unlisted-sharing)
   - [1.3 JSON-LD / OpenGraph Improvements](#13-json-ld--opengraph-improvements)
2. [Parity Fixes](#2-parity-fixes)
   - [2.1 Tier 1 — Structural Parity (Detail Page)](#21-tier-1--structural-parity-detail-page)
   - [2.2 Tier 2 — Card & Grid Parity](#22-tier-2--card--grid-parity)
   - [2.3 Tier 3 — Surface Parity (Sidebar, Search, Explore, Profile)](#23-tier-3--surface-parity-sidebar-search-explore-profile)
   - [2.4 Tier 4 — Mobile Parity](#24-tier-4--mobile-parity)
   - [2.5 Tier 5 — Polish](#25-tier-5--polish)
3. [Test Coverage Plan](#3-test-coverage-plan)
   - [3.1 Component RTL Tests](#31-component-rtl-tests-unit)
   - [3.2 Hook Tests](#32-hook-tests-unit)
   - [3.3 Integration Tests](#33-integration-tests-new)
   - [3.4 E2E Tests](#34-e2e-tests-new)
   - [3.5 Existing Tests to Modify](#35-existing-tests-to-modify)
4. [Schema Changes Summary](#4-schema-changes-summary)
5. [Dropped from Scope](#5-dropped-from-scope)

---

## 1. New Features

### 1.1 Artwork Upload

Custom cover images for playlists, matching the user profile hero banner pattern (bytes stored in PostgreSQL).

**Schema change:**
```prisma
model Playlist {
  // existing fields...
  artworkUrl      String?   // REMOVE — unused, never written to
  artworkImage    Bytes?    // NEW — raw image bytes (max 2MB)
  artworkMime     String?   // NEW — MIME type (image/jpeg, image/png, image/webp)
}
```

**Migration:** Drop `artworkUrl` (always null), add `artworkImage` and `artworkMime`.

**New API route:** `app/api/playlist/artwork/route.ts`
- `GET ?playlistId={id}` — serves artwork bytes with Content-Type, ETag, cache headers
- Access: allowed if playlist is public, OR viewer has valid share token, OR viewer is the owner
- Pattern: mirrors `app/api/user/hero/route.ts` exactly
- Cache: `Cache-Control: public, max-age=3600` for public playlists, `private` for owner-only

**Server action changes** (`lib/playlist-actions.ts`):
- `updatePlaylist` signature changes to accept `FormData` instead of a plain object, with an optional `artwork` file field
- Validates: image magic bytes (JPEG/PNG/WebP), max 2MB, allowed MIME types
- Strips EXIF metadata for privacy (same utility as user hero upload)
- Stores processed `Uint8Array` in `artworkImage` + MIME in `artworkMime`
- New `removePlaylistArtwork(playlistId)` action — sets both fields to null

**Validation:** New `playlistArtworkSchema` for file validation (magic bytes, size, MIME).

**UI changes:**
- `EditPlaylistDialog` — artwork upload section: file input with drag-drop, image preview (current artwork or placeholder), remove button. Positioned above the name field.
- `PlaylistCard` — when `artworkImage` exists, display the custom artwork via `/api/playlist/artwork?playlistId={id}` instead of the 2x2 collage. Fallback chain: custom artwork → 2x2 collage → empty icon.
- `PlaylistDetailClient` hero — when custom artwork exists, use it as the hero background instead of the first item's artwork.
- `CinematicHero` needs no changes — the playlist detail page already passes `backgroundUrl` which will now point to the artwork API route.

**Type changes:**
- `PlaylistWithCount` — replace `artworkUrl: string | null` with `hasArtwork: boolean`
- `PlaylistWithItems` — same replacement
- `PublicPlaylistCard` — add `hasArtwork: boolean`
- Display URL constructed at render time: `hasArtwork ? /api/playlist/artwork?playlistId={id} : null`

---

### 1.2 Unlisted Sharing

Private playlists can be shared via a secret token URL, like Google Docs "anyone with the link" sharing.

**Schema change:**
```prisma
model Playlist {
  // existing fields...
  shareToken    String?   @unique  // NEW — nanoid(21) for unlisted access
}
```

**Index:** `@@index([shareToken])` for fast token lookups.

**Access model (three states):**

| `isPublic` | `shareToken` | Behaviour |
|---|---|---|
| `true` | any | Visible on profile, explore, sitemap, search. Accessible by anyone. |
| `false` | non-null | Hidden from profile/explore/search. Accessible via `/u/{username}/playlists/{id}?token={shareToken}`. |
| `false` | null | Fully private, owner only. |

**Server action changes:**
- `updatePlaylist` accepts optional `enableSharing: boolean`:
  - `true` → generate `nanoid(21)` and store in `shareToken`
  - `false` → set `shareToken` to null (revoke)
- `regenerateShareToken(playlistId)` — new action, generates a fresh token (invalidates old links)

**Public auth changes** (`lib/public-auth.ts`):
- `getPublicPlaylist(playlistId, token?)` — if playlist is private but `token` matches `shareToken`, return it (still filtering private items from view). If `isPublic`, token is ignored.
- All other public queries (`getPublicPlaylistsForUser`, `getExplorePlaylists`, `searchPublicPlaylists`, sitemap) remain unchanged — they only return `isPublic = true` playlists.

**Route change:** `app/(public)/u/[username]/playlists/[playlistId]/page.tsx`
- Read `searchParams.token` from the URL
- Pass token to `getPublicPlaylist(id, token)`
- Metadata, JSON-LD, and OG image all generate for unlisted playlists too (they're meant to be shared)

**OG image route** needs the token parameter:
- `opengraph-image.tsx` — accept `searchParams.token`, pass to `getPublicPlaylist`

**UI changes:**
- `EditPlaylistDialog` — new "Shareable link" section:
  - Only visible when `isPublic = false`
  - Toggle switch to enable/disable sharing
  - When enabled: read-only URL input with copy button + regenerate button
  - Regenerate shows confirmation ("This will invalidate the old link")
- Share button in playlist detail hero:
  - Public playlist: copies `/u/{username}/playlists/{id}`
  - Unlisted playlist (owner): copies `/u/{username}/playlists/{id}?token={shareToken}`
  - Unlisted playlist (viewer): copies current URL (includes token)
- Viewer of unlisted playlist sees a subtle "Shared via link" indicator (small badge or text below the hero title)

**Validation:** `shareToken` is server-generated only (never user-input), so no Zod schema needed.

---

### 1.3 JSON-LD / OpenGraph Improvements

**JSON-LD (viewer mode, `page.tsx`):**

Current:
```json
{
  "@type": "ItemList",
  "name": "...",
  "description": "...",
  "numberOfItems": 12,
  "itemListElement": [...]
}
```

Enhanced:
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Weekend Watchlist",
  "description": "My favourite films for lazy Sundays",
  "author": {
    "@type": "Person",
    "name": "Jacob",
    "url": "https://canoncore.com/u/jacob"
  },
  "numberOfItems": 12,
  "dateCreated": "2026-01-15T00:00:00Z",
  "dateModified": "2026-02-18T00:00:00Z",
  "image": "https://canoncore.com/api/playlist/artwork?playlistId=xxx",
  "itemListElement": [...]
}
```

Additions: `author` (Person with name + URL), `dateCreated`, `dateModified`, `image` (if custom artwork exists).

**OpenGraph improvements (`generateMetadata`):**
- Change `type` from `"website"` to `"article"` (matches item pages)
- Add `article:author` pointing to profile URL
- Add `article:modified_time` from `updatedAt`
- Richer description format: `"{description}" — {itemCount} items curated by @{username}`
- Works for both public and unlisted playlists

**Unlisted playlist metadata:**
- Unlisted playlists generate full metadata and OG images when accessed via token
- This is intentional — unlisted links are meant for sharing on social media / messaging

---

## 2. Parity Fixes

Exhaustive inconsistencies between playlist and item UX patterns, organised by category. The goal: playlists should feel identical to items except they hold any item from anywhere and have no forking.

### Reference: ItemDetailClient features (579 lines)

| Feature | Items | Playlists | Gap |
|---|---|---|---|
| Tabs (Contents/About) | UnderlineTabs + SwipeableUnderlineTabs | None | **Missing** |
| Tree view (descendants) | SortableTree for children | Flat grid only | **Missing** |
| Edit mode toggle | EditModeToggle + SortableGrid | None | **Missing** |
| Drag-to-reorder | dnd-kit SortableGrid | None (action exists, no UI) | **Missing** |
| "Add" button in toolbar | Plus button opens AddItemDialog | None | **Missing** |
| View mode (grid/list/tree) | viewMode URL param + ItemsView | Grid only | **Missing** |
| Filter chips | FilterDropdown (TMDB types) | None | **Missing** |
| Mobile bottom sheet | MobileItemSheet (935 lines) | None | **Missing** |
| Settings dialog | ItemSettingsDialog (desktop) | EditPlaylistDialog (basic) | **Partial** |
| Content toolbar actions | Add + EditMode + Sync | Sort only | **Missing** |
| isPending loading state | useTransition + opacity overlay | None | **Missing** |
| URL state management | 4 params (sort, filter, view, tab) | 1 param (sort) | **Missing** |
| "More options" button on items | ItemMoreButton on GridItem hover | None | **Missing** |
| Confirmation for remove | N/A (items use delete) | No confirmation for remove | **Missing** |
| Hero progress bar | ProgressBar in hero | None | N/A (playlists don't track progress) |
| Hero TMDB metadata | Tagline, year, runtime, rating, genres | None | N/A (playlists don't have TMDB) |
| Sync button | Drive sync handler | None | N/A (playlists aren't synced) |
| Media playback | MediaOverlay for files | None | N/A (playlists don't play media) |

### Reference: GridItem vs PlaylistCard

| Feature | GridItem (459 lines, 26+ props) | PlaylistCard (103 lines, 3 props) | Gap |
|---|---|---|---|
| Glassmorphism hover overlay | Full overlay with description, backdrop-blur | Scale-up only (no overlay) | **Missing** |
| Lazy image loading | useLazyImage + useImageLoaded | Direct `<Image>` | **Missing** |
| Context menu integration | Via parent wrapper | Never wired | **Missing** |
| Drag handle | GripVertical icon, handleProps | None | **Missing** |
| Selection checkbox | Checkbox with isSelected/onSelectionChange | None | N/A |
| Progress bar | ProgressBar overlay | None | N/A |
| Sync status badge | SyncIcon overlay | None | N/A |
| Owner attribution | UserThumbnail for forked items | None | N/A |
| Visibility badge | None (item-level) | None | **Needed for playlists** |
| Description preview | Via hover overlay | None | **Missing** |
| `forwardRef` | Yes, for parent composition | No | **Missing** |
| "More options" button | ItemMoreButton on hover | None | **Missing** |

### 2.1 Tier 1 — Structural Parity (Detail Page)

These make `PlaylistDetailClient` structurally match `ItemDetailClient`.

**1. Contents/About tabs**
- Add `UnderlineTabs` (desktop) and `SwipeableUnderlineTabs` (mobile, lazy-loaded) to `PlaylistDetailClient`
- Contents tab: content toolbar + items grid (current content moves here)
- About tab: playlist description, metadata (creator, dates, item count), and item type breakdown
- Uses `usePlaylistUrlState` expanded to include `tab` param (matching `useItemsUrlState`)
- Desktop: `UnderlineTabs` with `defaultTab="contents"`
- Mobile: `SwipeableUnderlineTabs` with `activeTab` controlled, `swipeEnabled` disabled during edit mode
- Requires `useIsMobile` + `useSyncExternalStore` mount guard (same pattern as ItemDetailClient)

**2. Tree view for playlist items with children**
- When a playlist contains items that have children, those children should appear in a tree view
- **Data fetching:** New server action `getPlaylistItemDescendants(playlistId)` — runs a batched recursive CTE query to fetch all descendants of all items in the playlist
- **CTE approach:** Single query that takes all item IDs from the playlist, recursively finds all descendants via `parentId`, returns flat list with depth + parentId for tree construction
- **Tree rendering:** Use existing `Tree` component (from `components/sortable-tree/`) to render the combined flat list
- **View mode "tree":** When selected, playlist items display in `Tree` format showing parent→child relationships
- **Items without children:** Appear as top-level leaf nodes in the tree
- **Performance:** CTE query is batched (one query per render, not N+1), cached per playlist with `revalidatePath`

**3. Edit mode / drag-to-reorder**
- Add `EditModeToggle` to Contents tab toolbar actions (owner only)
- When active: `SortableGrid` wraps the items grid with drag handles on each `GridItem`
- On drop: call `reorderPlaylistItems` server action (already exists)
- Only available when sort is "Custom Order" (matching item pattern)
- Disable swipe gestures when editing (pass `swipeEnabled={!isEditing}` to `SwipeableUnderlineTabs`)

**4. "Add Items" button in toolbar**
- New button in Contents tab toolbar actions (owner only): "Add" with Plus icon
- Opens a search/browse dialog that lets owners search their library items
- Items already in the playlist shown as checked/disabled
- On select: call `addItemToPlaylists` to add the item
- This is the reverse of `AddToPlaylistDialog` — instead of "which playlists for this item", it's "which items for this playlist"

**5. View mode switching (grid/list/tree)**
- Add `viewMode` to `usePlaylistUrlState` (matching `useItemsUrlState` pattern)
- Grid mode: current behaviour (default)
- List mode: single-column list with thumbnails (matches ItemsView list mode)
- Tree mode: hierarchical view showing parent→child relationships (uses data from parity fix #2)
- Wire `ContentToolbar` viewMode/onViewChange props

**6. Filter chips**
- Add TMDB type filter to Contents tab toolbar (Movie, TV, etc.)
- Uses existing `FilterDropdown` component pattern from item detail
- Filters based on items' `tmdbType` field
- Only show filter dropdown when playlist has items with TMDB metadata
- Add `filters`, `toggleFilter`, `clearFilters` to `usePlaylistUrlState`

**7. Content toolbar full parity**
- Currently: sort dropdown only
- Add: filters, view mode toggle, actions slot (Add + EditMode)
- Wire all `ContentToolbar` props matching `ItemDetailClient` usage
- `disabled` prop tied to `sortedItems.length === 0`

**8. isPending loading overlay**
- Add `useTransition` for async operations (remove item, reorder)
- Pass `isPending` to `HeroContentLayout` for opacity overlay during mutations
- Matches `ItemDetailClient` pattern exactly

**9. Confirmation dialog for "Remove from Playlist"**
- `PlaylistItemContextMenu` "Remove from Playlist" currently has no confirmation
- Add `AlertDialog` matching the item delete confirmation pattern
- Message: "Remove {itemName} from this playlist? The item itself will not be deleted."

**10. "More options" hover button on playlist detail items**
- Pass `moreMenuProps` to `GridItem` instances in `PlaylistDetailClient`
- Create `PlaylistItemMoreButton` (or reuse context menu trigger pattern)
- Actions: Go to Item, Open in New Tab, Remove from Playlist
- Matches item detail pattern where `GridItem` shows `ItemMoreButton` on hover

### 2.2 Tier 2 — Card & Grid Parity

These upgrade `PlaylistCard` and `PlaylistSection` to match `GridItem` quality.

**11. PlaylistCard glassmorphism hover overlay**
- Add hover state matching `GridItem` pattern:
  - Default: artwork collage + name + count
  - Hover: semi-transparent backdrop-blur overlay with description (2-line clamp) + item count badge
- Use CSS transition for smooth reveal (`opacity`, `backdrop-filter`)
- Matches the demo-interactive-poster-card.tsx aesthetic

**12. PlaylistCard lazy image loading**
- Replace direct `<Image>` with `useLazyImage` + `useImageLoaded` hooks (same as `GridItem`)
- Adds IntersectionObserver-based lazy loading for below-the-fold cards
- Loading skeleton shown while image loads (same shimmer pattern)

**13. Wire context menus on playlist cards (`PlaylistSection`)**
- Wrap `PlaylistCard` in `PlaylistContextMenu` for owner mode
- Actions: Rename, Toggle Visibility, Delete (with confirmation)
- Optimistic UI updates after each action (update local state, revalidate on error)
- The `PlaylistContextMenu` component already exists — it's just never wired to cards

**14. Visibility badge on playlist cards**
- Owner mode only: small icon badge on card (Eye for public, Lock for private, Link for unlisted)
- Positioned at top-right of the artwork collage
- Matches how items show status indicators on grid items

**15. PlaylistCard description preview**
- Show first line of description below the playlist name (truncated, muted text)
- Only when description exists
- Controlled by available space (hidden on very small cards)

**16. PlaylistCard forwardRef**
- Add `forwardRef` to `PlaylistCard` for parent composition (context menus, sortable containers)
- Matches `GridItem` which uses `forwardRef` for dnd-kit integration

**17. Fix grid columns**
- Owner and viewer modes in `PlaylistDetailClient` should use the same grid: `grid-cols-3 md:grid-cols-4 lg:grid-cols-6`
- Currently owner uses `grid-cols-2`, viewer uses `grid-cols-3`
- `PlaylistSection` grids: standardise to match item grids

**18. Loading skeleton in PlaylistSection**
- Owner mode currently shows nothing while fetching (returns `null`)
- Add skeleton cards (2x2 shimmer grid matching PlaylistCard dimensions)
- Use existing `skeleton-shimmer` utility class

### 2.3 Tier 3 — Surface Parity (Sidebar, Search, Explore, Profile)

These make playlists first-class across all app surfaces.

**19. Sidebar playlist section**
- Add "Playlists" section to `AppSidebar` (below existing nav items)
- Show user's playlists as collapsible list items
- Each entry links to `/u/{username}/playlists/{id}`
- "New Playlist" button at section bottom
- Matches sidebar item navigation pattern

**20. Spotlight search visual parity**
- Currently: items get `ItemThumbnail` with TMDB/artwork fallback chain, `h-[52px]`, `cursor-pointer`, group hover effects
- Playlists get: static `ListMusic` icon, no height class, no cursor-pointer, different search value format
- Fix: Create `PlaylistThumbnail` component (2x2 mini collage or custom artwork), match height/cursor/hover styling
- Match the `CommandItem` structure exactly between items and playlists

**21. Explore page parity**
- Currently: item tab has trending section, recently added section, filter capabilities
- Playlist tab: bare grid only
- Add: "Popular Playlists" featured section, "Recently Updated" section
- Match the section heading + grid pattern from the items tab
- Add pagination/infinite scroll matching items tab

**22. Profile page treatment**
- Currently: items get the main profile treatment with full `ItemsView`
- Playlists get a simpler `PlaylistSection` at the bottom
- Improve: Give playlists equal visual weight on profile pages
- Both owner and viewer modes should treat playlists and items as peer sections

**23. Enhance CreatePlaylistDialog**
- Add optional description textarea (max 1000 chars)
- Add public/private toggle (default private)
- `createPlaylist` server action expanded to accept `description` and `isPublic`

### 2.4 Tier 4 — Mobile Parity

**24. Mobile bottom sheet for playlists**
- Create `MobilePlaylistSheet` matching `MobileItemSheet` (935 lines) pattern
- Sections: Sort options, Filter options, View mode toggle, Playlist settings (name, description, visibility, sharing)
- Lazy-loaded via `next/dynamic` (keeps Framer Motion out of desktop bundle)
- Opens from a settings/options button in playlist detail toolbar on mobile
- Uses Vaul drawer with snap points (matching existing sheet pattern)

**25. Swipeable tabs on mobile**
- Already covered by Tier 1 fix #1 (Contents/About tabs)
- `SwipeableUnderlineTabs` lazy-loaded, `swipeEnabled={!isEditing}`
- Uses `useIsMobile` + `useSyncExternalStore` mount guard

### 2.5 Tier 5 — Polish

**26. URL state full parity**
- Expand `usePlaylistUrlState` to manage 4 params: `sort`, `filter`, `view`, `tab`
- Add localStorage backup (matching `useItemsUrlState` pattern with nuqs)
- `playlist-search-params.ts` updated with all param definitions
- Defaults: sort=custom, filter=none, view=grid, tab=contents

**27. Optimistic UI everywhere**
- Remove from playlist: optimistic removal from list, revert on error
- Reorder: optimistic position update, revert on error
- Context menu actions (rename, toggle visibility, delete): optimistic state updates
- Use `startTransition` + local state patterns from `ItemDetailClient`

**28. Empty state CTA matching**
- Playlist detail empty state: "Add items to get started" with action button (owner)
- Match the item detail empty state visual pattern exactly

---

## 3. Test Coverage Plan

### 3.1 Component RTL Tests (unit)

New test files under `tests/unit/components/playlists/`:

| File | Key Test Cases |
|---|---|
| `playlist-card.test.tsx` | Renders name/count/link; shows custom artwork when hasArtwork; shows 2x2 collage fallback; shows empty icon for 0 items; hover overlay with description; visibility badge for owners; lazy loading hooks; forwardRef |
| `playlist-section.test.tsx` | Owner: fetches and displays cards; shows empty state with CTA; creates playlist; loading skeleton; context menu wiring. Viewer: displays cards; returns null when empty |
| `add-to-playlist-dialog.test.tsx` | Search filtering; toggle membership (optimistic); create inline; empty state |
| `create-playlist-dialog.test.tsx` | Validates empty name; submits with name + description + visibility; calls onCreated callback |
| `edit-playlist-dialog.test.tsx` | Populates form from props; artwork upload preview; artwork removal; share token section (enable/disable/copy/regenerate); saves changes |
| `playlist-context-menu.test.tsx` | Rename action; visibility toggle; delete with confirmation; remove from playlist with confirmation |
| `playlist-detail-client.test.tsx` | Sort options; tabs (Contents/About); edit mode toggle; drag-reorder; "Add Items" button; share button (public vs unlisted); view mode switching; filter chips; tree view mode; toolbar actions; empty state; isPending overlay; mobile sheet trigger |
| `mobile-playlist-sheet.test.tsx` | Opens/closes; sort options; filter options; view mode toggle; settings section |
| `playlist-thumbnail.test.tsx` | Renders 2x2 collage; renders custom artwork; empty state with icon |

### 3.2 Hook Tests (unit)

| File | Key Test Cases |
|---|---|
| `use-playlist-url-state.test.ts` | Reads sort/filter/view/tab from URL; writes all 4 params to URL; defaults when no params; localStorage backup |
| `playlist-search-params.test.ts` | Parses sort param; parses filter param; parses view param; parses tab param; serialises params; handles invalid values |

### 3.3 Integration Tests (new)

| File | Key Test Cases |
|---|---|
| `playlist-explore.test.ts` | `getExplorePlaylists` returns public playlists; respects pagination; filters private playlists/users |
| `playlist-search.test.ts` | `searchPublicPlaylists` matches by name; filters private; respects visibility rules |
| `playlist-auth-extended.test.ts` | Auth boundaries for `removeItemFromPlaylist`, `reorderPlaylists`, `reorderPlaylistItems`, `getPlaylistsForItem` |
| `playlist-artwork.test.ts` | Upload artwork via `updatePlaylist`; remove artwork; serve via API route; public access; owner access |
| `playlist-sharing.test.ts` | Generate share token; access unlisted playlist with valid token; reject invalid token; revoke token; regenerate token; public playlist ignores token |
| `playlist-descendants.test.ts` | `getPlaylistItemDescendants` returns correct tree; handles items without children; handles deep nesting; batched CTE performance |

### 3.4 E2E Tests (new)

| File | Key Test Cases |
|---|---|
| `playlist-edit.spec.ts` | Edit name, description, visibility via EditPlaylistDialog; verify changes persisted |
| `playlist-share.spec.ts` | Share button copies link; unlisted sharing toggle; access via token URL |
| `playlist-public-viewer.spec.ts` | Public playlist detail as unauthenticated viewer; private items hidden |
| `playlist-artwork.spec.ts` | Upload artwork; see it on card and hero; remove artwork; fallback to collage |
| `playlist-reorder.spec.ts` | Enter edit mode; drag-reorder items; verify new order persisted |
| `playlist-context-menu.spec.ts` | Right-click card: rename, toggle visibility, delete; right-click item: remove with confirmation |
| `playlist-add-items.spec.ts` | "Add Items" button in toolbar; search and add items from playlist detail |
| `playlist-tabs.spec.ts` | Switch between Contents/About tabs; verify content changes; mobile swipe |
| `playlist-view-modes.spec.ts` | Switch between grid/list/tree view modes; verify layout changes |
| `playlist-filters.spec.ts` | Apply TMDB type filter; verify items filtered; clear filter |

### 3.5 Existing Tests to Modify

| File | Changes |
|---|---|
| `tests/unit/lib/playlist-actions.test.ts` | Add tests for: artwork upload/removal, share token enable/disable/regenerate, createPlaylist with description/isPublic, updatePlaylist FormData handling, getPlaylistItemDescendants |
| `tests/unit/lib/validations.test.ts` | Add tests for artwork file validation (if new schema added) |
| `tests/integration/playlists/playlist-crud.test.ts` | Add artwork CRUD, share token CRUD, createPlaylist with description/isPublic |
| `tests/integration/playlists/playlist-visibility.test.ts` | Add unlisted sharing scenarios (valid token, invalid token, revoked token, public ignores token) |
| `tests/unit/components/nav-main.test.tsx` | Update for sidebar playlist section |
| `tests/unit/components/search/spotlight-search.test.tsx` | Update for PlaylistThumbnail visual parity |
| Storybook stories | Update all playlist stories for new features (artwork display, share token UI, edit mode, context menu actions, tabs, view modes) |

**Tests to remove:** None — all existing tests remain valid.

---

## 4. Schema Changes Summary

```prisma
model Playlist {
  id            String         @id @default(cuid())
  name          String
  description   String?        @db.VarChar(1000)
  order         Int            @default(0)
  isPublic      Boolean        @default(false)

  // v2 changes:
  // REMOVED: artworkUrl    String?
  artworkImage  Bytes?         // Custom cover image (max 2MB)
  artworkMime   String?        // MIME type for artwork
  shareToken    String?        @unique  // Unlisted sharing token

  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  playlistItems PlaylistItem[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([userId])
  @@index([userId, order])
  @@index([isPublic, updatedAt(sort: Desc)])
  @@index([shareToken])  // NEW
}
```

Migration steps:
1. Add `artworkImage`, `artworkMime`, `shareToken` columns (nullable, no data migration needed)
2. Drop `artworkUrl` column (always null, no data loss)
3. Add unique constraint on `shareToken`
4. Add index on `shareToken`

---

## 5. Dropped from Scope

- **Playlist forking** — viewers can already fork individual items from a public playlist. Full playlist duplication adds complexity for marginal value.
- **Playlist nesting** — playlists within playlists. YAGNI.
- **Collaborative playlists** — multiple users editing the same playlist. YAGNI.
- **Expiring share links** — share tokens don't expire. Owner can revoke manually. YAGNI.
- **Multiple share links per playlist** — one token per playlist is sufficient.
- **Progress tracking for playlists** — playlists are curated lists, not progress-tracked collections. Items track their own progress.
- **Media playback from playlist** — playlists don't play media directly. Users navigate to individual items for playback.
- **Drive sync for playlists** — playlists are app-native, not synced from external sources.
- **Selection checkboxes on playlist items** — no bulk operations beyond reorder needed currently.
