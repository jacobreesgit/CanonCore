# Playlists v2 Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Upgrade playlists from basic CRUD to feature-complete with artwork upload, unlisted sharing, improved metadata, and full parity with item UX patterns.

**Architecture:** Three new features (artwork bytes-in-DB, share token for unlisted access, enhanced JSON-LD/OG), plus comprehensive parity fixes across all playlist components, plus complete test coverage backfill.

---

## Table of Contents

1. [New Features](#1-new-features)
   - [1.1 Artwork Upload](#11-artwork-upload)
   - [1.2 Unlisted Sharing](#12-unlisted-sharing)
   - [1.3 JSON-LD / OpenGraph Improvements](#13-json-ld--opengraph-improvements)
2. [Parity Fixes](#2-parity-fixes)
   - [2.1 Tier 1 — High Impact](#21-tier-1--high-impact)
   - [2.2 Tier 2 — Polish](#22-tier-2--polish)
   - [2.3 Tier 3 — Nice to Have](#23-tier-3--nice-to-have)
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

Inconsistencies between playlist and item UX patterns, organised by impact.

### 2.1 Tier 1 — High Impact

**1. Wire context menus on playlist cards (`PlaylistSection`)**
- Wrap `PlaylistCard` in `PlaylistContextMenu` for owner mode
- Actions: Rename, Toggle Visibility, Delete (with confirmation)
- Optimistic UI updates after each action (update local state, revalidate on error)
- The `PlaylistContextMenu` component already exists — it's just never wired to cards

**2. Add "more options" hover button on playlist detail items**
- Pass `moreMenuProps` to `GridItem` instances in `PlaylistDetailClient`
- Use `PlaylistItemContextMenu` actions (Go to Item, Open in New Tab, Remove)
- Matches item detail pattern where GridItem shows a "..." button on hover

**3. Edit mode / drag-to-reorder for playlist items**
- Add `EditModeToggle` to playlist detail toolbar (owner only)
- When active: `SortableGrid` wraps the items grid with drag handles
- On drop: call `reorderPlaylistItems` server action (already exists)
- Only available when sort is "Custom Order"
- Matches the item detail edit mode pattern exactly

**4. "Add Items" button in playlist detail toolbar**
- New button in toolbar actions slot (owner only): "Add" with Plus icon
- Opens a search/browse dialog that lets owners search their library items
- Items already in the playlist shown as checked/disabled
- On select: call `addItemToPlaylists` to add the item
- This is the reverse of `AddToPlaylistDialog` — instead of "which playlists for this item", it's "which items for this playlist"

**5. Confirmation dialog for "Remove from Playlist"**
- `PlaylistItemContextMenu` "Remove from Playlist" currently has no confirmation
- Add `AlertDialog` matching the item delete pattern
- Message: "Remove {itemName} from this playlist? The item itself will not be deleted."

### 2.2 Tier 2 — Polish

**6. Fix grid columns**
- Owner and viewer modes in `PlaylistDetailClient` should use the same grid: `grid-cols-3 md:grid-cols-4 lg:grid-cols-6`
- Currently owner uses `grid-cols-2`, viewer uses `grid-cols-3`

**7. Enhance CreatePlaylistDialog**
- Add optional description textarea (max 1000 chars)
- Add public/private toggle (default private)
- `createPlaylist` server action expanded to accept `description` and `isPublic`

**8. Loading skeleton in PlaylistSection**
- Owner mode currently shows nothing while fetching (returns `null`)
- Add skeleton cards (2x2 shimmer grid matching PlaylistCard dimensions)

**9. PlaylistCard hover overlay**
- Add hover state matching GridItem pattern:
  - Default: artwork collage + name + count
  - Hover: semi-transparent overlay with description (2-line clamp) + item count badge
- Use CSS transition for smooth reveal

**10. Visibility badge on playlist cards**
- Owner mode only: small icon badge on card (eye for public, lock for private)
- Positioned at top-right of the artwork collage
- Matches how items show status indicators

### 2.3 Tier 3 — Nice to Have

**11. Filter chips in playlist detail toolbar**
- Filter by media type of items (if items have TMDB types: Movie, TV, etc.)
- Uses existing `FilterDropdown` component pattern from item detail
- Only show when playlist has items with TMDB metadata

**12. PlaylistCard description preview**
- Show first line of description below the playlist name (truncated, muted text)
- Only when description exists
- Controlled by available space (hidden on very small cards)

---

## 3. Test Coverage Plan

### 3.1 Component RTL Tests (unit)

New test files under `tests/unit/components/playlists/`:

| File | Key Test Cases |
|---|---|
| `playlist-card.test.tsx` | Renders name/count/link; shows custom artwork when hasArtwork; shows 2x2 collage fallback; shows empty icon for 0 items; visibility badge for owners |
| `playlist-section.test.tsx` | Owner: fetches and displays cards; shows empty state with CTA; creates playlist; loading skeleton. Viewer: displays cards; returns null when empty |
| `add-to-playlist-dialog.test.tsx` | Search filtering; toggle membership (optimistic); create inline; empty state |
| `create-playlist-dialog.test.tsx` | Validates empty name; submits with name + description + visibility; calls onCreated callback |
| `edit-playlist-dialog.test.tsx` | Populates form from props; artwork upload preview; artwork removal; share token section (enable/disable/copy/regenerate); saves changes |
| `playlist-context-menu.test.tsx` | Rename action; visibility toggle; delete with confirmation; remove from playlist with confirmation |
| `playlist-detail-client.test.tsx` | Sort options; edit mode toggle; drag-reorder; "Add Items" button; share button (public vs unlisted); toolbar actions; empty state |

### 3.2 Hook Tests (unit)

| File | Key Test Cases |
|---|---|
| `use-playlist-url-state.test.ts` | Reads sort/tab from URL; writes sort/tab to URL; defaults when no params |
| `playlist-search-params.test.ts` | Parses sort param; parses tab param; serialises params; handles invalid values |

### 3.3 Integration Tests (new)

| File | Key Test Cases |
|---|---|
| `playlist-explore.test.ts` | `getExplorePlaylists` returns public playlists; respects pagination; filters private playlists/users |
| `playlist-search.test.ts` | `searchPublicPlaylists` matches by name; filters private; respects visibility rules |
| `playlist-auth-extended.test.ts` | Auth boundaries for `removeItemFromPlaylist`, `reorderPlaylists`, `reorderPlaylistItems`, `getPlaylistsForItem` |
| `playlist-artwork.test.ts` | Upload artwork via `updatePlaylist`; remove artwork; serve via API route; public access; owner access |
| `playlist-sharing.test.ts` | Generate share token; access unlisted playlist with valid token; reject invalid token; revoke token; regenerate token; public playlist ignores token |

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

### 3.5 Existing Tests to Modify

| File | Changes |
|---|---|
| `tests/unit/lib/playlist-actions.test.ts` | Add tests for: artwork upload/removal, share token enable/disable/regenerate, createPlaylist with description/isPublic, updatePlaylist FormData handling |
| `tests/unit/lib/validations.test.ts` | Add tests for artwork file validation (if new schema added) |
| `tests/integration/playlists/playlist-crud.test.ts` | Add artwork CRUD, share token CRUD, createPlaylist with description/isPublic |
| `tests/integration/playlists/playlist-visibility.test.ts` | Add unlisted sharing scenarios (valid token, invalid token, revoked token, public ignores token) |
| Storybook stories | Update all 6 playlist stories for new features (artwork display, share token UI, edit mode, context menu actions) |

**Tests to remove:** None — all existing tests remain valid.

**Knip note:** The `playlist-button.tsx` "unused file" warning should resolve naturally as it becomes more actively imported.

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
