# Deployment Summary — v8.0.0

**Branch:** `feat/playlist-management`
**Date:** February 2026
**Commits:** 42

---

## What changed

### Playlist Management System

Full-featured cross-cutting playlist system. Playlists are many-to-many reference lists — items stay in their tree position and can appear in multiple playlists. Two new database models (`Playlist`, `PlaylistItem`) with 14 server actions covering CRUD, artwork upload, share token generation, item management, and drag-to-reorder.

**Database schema:**

- `Playlist` — name, description, order, isPublic, artworkImage/artworkMime (binary), shareToken (unique), userId
- `PlaylistItem` — join table with order field for drag-to-reorder, unique constraint on playlistId + itemId
- Indexed for user lookups, public discovery (isPublic + updatedAt desc), and share token access

**Server actions** (`lib/playlist-actions.ts`):

- `createPlaylist` / `updatePlaylist` / `deletePlaylist` — CRUD with Zod validation
- `getPlaylist` / `getUserPlaylists` / `getPlaylistsForItem` — read operations with count aggregation
- `updatePlaylistArtwork` / `removePlaylistArtwork` — binary artwork upload via API route
- `regenerateShareToken` — nanoid-based share tokens for unlisted sharing
- `addItemToPlaylists` / `removeItemFromPlaylist` / `removeItemsFromPlaylist` — item membership
- `reorderPlaylists` / `reorderPlaylistItems` — drag-to-reorder with batch order updates

**New components** (`components/playlists/`):

- `PlaylistGridItem` — poster collage card showing up to 4 item artworks in a grid mosaic
- `PlaylistDetailClient` — full detail page with Contents/About tabs, edit mode toolbar, drag-to-reorder
- `PlaylistSection` — reusable grid section with responsive columns
- `PlaylistSortableGrid` — dnd-kit-powered drag-to-reorder for playlist items
- `PlaylistContextMenu` — right-click actions (edit, delete, visibility, share link copy)
- `CreatePlaylistDialog` — create with name, description, visibility, artwork
- `EditPlaylistDialog` — edit all fields including artwork upload/removal and share token management
- `AddToPlaylistDialog` — add items to one or multiple playlists with search

**New routes:**

- `app/(public)/u/[username]/playlists/[playlistId]/page.tsx` — public playlist detail with share token support
- `app/(public)/u/[username]/playlists/[playlistId]/opengraph-image.tsx` — dynamic OG images for playlists
- `app/api/playlist/artwork/route.ts` — playlist artwork upload endpoint

### Explore & Profile Page Enhancements

**Explore page** now has two tabs — **Collections** and **Playlists** — with URL-backed tab state. The Playlists tab shows public playlists from all users with the same sort/filter toolbar as Collections. Context menus on your own playlists provide quick actions (edit, delete, share).

**Profile pages** (viewer mode) now display tabs — **Items** and **Playlists** — with URL-backed filters. A **Share** button on the profile hero copies the profile URL to clipboard. Owner heading changed to `h1` for accessibility.

### CinematicHero Enhancements

New `backgroundElement` prop accepts a custom React node rendered behind the gradient overlay. Used for mosaic backdrops on playlist detail pages — a grid of playlist item backdrop artwork tiled behind the hero. New Storybook story demonstrates the mosaic variant.

### CardShell Component

New shared visual base component (`components/ui/card-shell.tsx`) extracts common card styling — glass background, border, hover glow, aspect ratio, rounded corners. Used by `PlaylistGridItem` and available for future card components. Storybook stories included.

### Spotlight Search Enhancement

Spotlight search now includes a **Playlists** section alongside Your Items, Public Collections, and People. Playlist results show artwork thumbnails and item counts.

### URL State Management

Three new hooks for playlist-specific URL state:

- `use-playlist-url-state` — view, sort, filter, and tab state for playlist detail pages
- `use-viewer-url-state` — tab and filter state for profile viewer mode
- `playlist-search-params` — nuqs parser definitions for playlist query params

### Sidebar Navigation Refactor

`nav-main.tsx` refactored from 306 lines to a cleaner structure. Playlists section added to the sidebar showing user's playlists with artwork thumbnails and item counts.

### Testing

**New unit tests** (`tests/unit/`):

- `lib/playlist-actions.test.ts` — 856 lines covering all 14 server actions
- `lib/validations.test.ts` — playlist name, description, and artwork validation schemas
- `hooks/playlist-search-params.test.ts` — URL state parser tests
- `prisma/seed.test.ts` — seed configuration tests

**New integration tests** (`tests/integration/playlists/`):

- `playlist-crud.test.ts` — create, read, update, delete against real DB
- `playlist-items.test.ts` — add, remove, reorder items
- `playlist-visibility.test.ts` — public/private/unlisted sharing with share tokens
- `playlist-auth.test.ts` — authentication and authorisation checks
- `seed/seed.test.ts` — seed integration tests

**New E2E tests** (`e2e/journeys/playlists/`):

- `playlist-crud.spec.ts` — create, edit, delete playlists
- `playlist-items.spec.ts` — add and remove items from playlists
- `playlist-visibility.spec.ts` — visibility toggling and share token access

**New E2E Page Object:** `e2e/pages/playlist.page.ts` — 216-line POM for playlist interactions.

### Minor Changes

- Rate limiting added to item detail viewer path
- Error boundary added to docs layout for consistency
- Playlist OG type unified to `article` for both owner and viewer
- `hasArtwork` added to `ExplorePlaylist` interface
- Avatar and playlist artwork size increased to 800x800 with co-located size constants
- Seed data updated with playlist artwork from Picsum and share tokens for demo playlists
- Storybook mock for playlist actions added (`.storybook/mocks/playlist-actions.mock.ts`)
- Storybook stories updated for PlaylistGridItem, PlaylistSection, ProfilePage, AppSidebar
- `UnderlineTabs` and `SwipeableUnderlineTabs` updated with minor fixes
- Deleted `nav-main.test.tsx` (replaced by refactored component)

---

## New dependencies

| Package  | Type | Purpose                                       |
| -------- | ---- | --------------------------------------------- |
| `nanoid` | prod | Share token generation for unlisted playlists |

---

## New files

**Routes & API:**

- `app/(public)/u/[username]/playlists/[playlistId]/page.tsx`
- `app/(public)/u/[username]/playlists/[playlistId]/opengraph-image.tsx`
- `app/api/playlist/artwork/route.ts`

**Components:**

- `components/playlists/playlist-grid-item.tsx`
- `components/playlists/playlist-detail-client.tsx`
- `components/playlists/playlist-section.tsx`
- `components/playlists/playlist-sortable-grid.tsx`
- `components/playlists/playlist-context-menu.tsx`
- `components/playlists/create-playlist-dialog.tsx`
- `components/playlists/edit-playlist-dialog.tsx`
- `components/playlists/add-to-playlist-dialog.tsx`
- `components/ui/card-shell.tsx`

**Storybook stories:**

- `components/playlists/playlist-grid-item.stories.tsx`
- `components/playlists/playlist-section.stories.tsx`
- `components/playlists/playlist-context-menu.stories.tsx`
- `components/playlists/create-playlist-dialog.stories.tsx`
- `components/playlists/edit-playlist-dialog.stories.tsx`
- `components/playlists/add-to-playlist-dialog.stories.tsx`
- `components/profile/profile-page.stories.tsx`
- `components/ui/card-shell.stories.tsx`

**Hooks:**

- `hooks/use-playlist-url-state.ts`
- `hooks/use-viewer-url-state.ts`
- `hooks/playlist-search-params.ts`

**Server logic:**

- `lib/playlist-actions.ts`

**Storybook mocks:**

- `.storybook/mocks/playlist-actions.mock.ts`

**Tests:**

- `tests/unit/lib/playlist-actions.test.ts`
- `tests/unit/lib/validations.test.ts`
- `tests/unit/hooks/playlist-search-params.test.ts`
- `tests/unit/prisma/seed.test.ts`
- `tests/integration/playlists/playlist-crud.test.ts`
- `tests/integration/playlists/playlist-items.test.ts`
- `tests/integration/playlists/playlist-visibility.test.ts`
- `tests/integration/playlists/playlist-auth.test.ts`
- `tests/integration/seed/seed.test.ts`
- `e2e/journeys/playlists/playlist-crud.spec.ts`
- `e2e/journeys/playlists/playlist-items.spec.ts`
- `e2e/journeys/playlists/playlist-visibility.spec.ts`
- `e2e/pages/playlist.page.ts`

**Documentation:**

- `docs/plans/2026-02-18-playlists-v2-design.md`
- `docs/plans/2026-02-18-playlists-v2-plan.md`

---

## Verification

- [ ] All quality checks pass (`pnpm run check`)
- [ ] Unit tests pass (`pnpm run test`)
- [ ] Integration tests pass (`pnpm run test:integration`)
- [ ] Build succeeds (`pnpm run build`)
- [ ] Playlist CRUD works (create, edit, delete)
- [ ] Playlist artwork upload and removal works
- [ ] Drag-to-reorder within playlists works
- [ ] Share token generates and unlisted access works
- [ ] Explore page shows Collections and Playlists tabs
- [ ] Profile viewer shows Items and Playlists tabs
- [ ] Spotlight search shows playlist results
- [ ] Playlist OG images generate at `/u/[username]/playlists/[playlistId]`
- [ ] Playlist detail page renders for public/unlisted/private playlists appropriately
