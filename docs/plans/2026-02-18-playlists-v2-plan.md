# Playlists v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade playlists from basic CRUD to full feature parity with items — artwork upload, unlisted sharing, tabs, tree view, edit mode, mobile sheets, and comprehensive test coverage.

**Architecture:** Schema migration first, then data layer (types → actions → API routes → public-auth), then URL state hooks, then UI in dependency order (detail page → cards → surfaces → mobile). Tests accompany each feature. Design doc: `docs/plans/2026-02-18-playlists-v2-design.md`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 7 (Neon PostgreSQL), nuqs (URL state), dnd-kit (drag-drop), Embla Carousel (swipeable tabs), Vitest, Playwright.

---

## Phase 1: Schema & Data Layer

### Task 1: Prisma schema migration

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Update Playlist model**

In `prisma/schema.prisma`, find the Playlist model and make these changes:
1. Remove the `artworkUrl String?` field
2. Add `artworkImage Bytes?` field
3. Add `artworkMime String?` field
4. Add `shareToken String? @unique` field
5. Add `@@index([shareToken])` to the index block

The model should look like:
```prisma
model Playlist {
  id            String         @id @default(cuid())
  name          String
  description   String?        @db.VarChar(1000)
  order         Int            @default(0)
  isPublic      Boolean        @default(false)
  artworkImage  Bytes?
  artworkMime   String?
  shareToken    String?        @unique
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  playlistItems PlaylistItem[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([userId])
  @@index([userId, order])
  @@index([isPublic, updatedAt(sort: Desc)])
  @@index([shareToken])
}
```

**Step 2: Generate and apply migration**

Run: `pnpm prisma migrate dev --name playlist-v2-artwork-sharing`
Expected: Migration created and applied successfully.

**Step 3: Regenerate Prisma client**

Run: `pnpm prisma generate`
Expected: Client generated.

**Step 4: Verify type-check**

Run: `pnpm run type-check`
Expected: Will have errors — `artworkUrl` references in types.ts and playlist-actions.ts need updating. That's expected; we fix them in Task 2.

**Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add playlist artwork and share token schema fields"
```

---

### Task 2: Update types

**Files:**
- Modify: `lib/types.ts`

**Step 1: Update PlaylistWithCount**

Find the `PlaylistWithCount` interface (~line 628). Replace `artworkUrl: string | null` with `hasArtwork: boolean`. Keep all other fields.

**Step 2: Update PlaylistWithItems**

Find `PlaylistWithItems` (search for the interface). Replace `artworkUrl` with `hasArtwork: boolean`. Add `shareToken: string | null`.

**Step 3: Update PublicPlaylistCard**

Find `PublicPlaylistCard` (~line 710). Add `hasArtwork: boolean` field.

**Step 4: Add playlist view types**

Add these after the existing playlist types:

```typescript
/** View mode for playlist detail display. */
export type PlaylistViewMode = "grid" | "tree";

/** Content filter for playlist items (by TMDB type). */
export type PlaylistContentFilter = "movie" | "tv";

/** All valid playlist view modes. */
export const PLAYLIST_VIEW_MODES = ["grid", "tree"] as const;

/** All valid playlist content filters. */
export const PLAYLIST_CONTENT_FILTERS = ["movie", "tv"] as const;
```

**Step 5: Verify type-check**

Run: `pnpm run type-check`
Expected: Errors in playlist-actions.ts where `artworkUrl` is referenced. Fixed in Task 3.

**Step 6: Commit**

```bash
git add lib/types.ts
git commit -m "feat: update playlist types for artwork and sharing"
```

---

### Task 3: Update server actions

**Files:**
- Modify: `lib/playlist-actions.ts`
- Modify: `lib/validations.ts`

**Step 1: Add artwork validation schema**

In `lib/validations.ts`, add after existing schemas:

```typescript
/** Allowed MIME types for playlist artwork. */
const ALLOWED_ARTWORK_MIMES = ["image/jpeg", "image/png", "image/webp"];

/** Max file size for playlist artwork (2MB). */
const MAX_ARTWORK_SIZE = 2 * 1024 * 1024;

/** Validation schema for playlist artwork file. */
export const playlistArtworkSchema = z.object({
  size: z.number().max(MAX_ARTWORK_SIZE, "Image must be under 2MB"),
  type: z.string().refine((t) => ALLOWED_ARTWORK_MIMES.includes(t), {
    message: "Only JPEG, PNG, and WebP images are allowed",
  }),
});
```

**Step 2: Update createPlaylist action**

In `lib/playlist-actions.ts`, update `createPlaylist` signature to accept optional `description` and `isPublic`:

```typescript
export async function createPlaylist(
  name: string,
  options?: { description?: string; isPublic?: boolean }
): Promise<ItemResult<{ id: string; name: string }>> {
```

In the prisma.playlist.create call, add:
```typescript
data: {
  name: validated,
  userId: session.user.id,
  description: options?.description ?? null,
  isPublic: options?.isPublic ?? false,
  order: (maxOrder?.order ?? -1) + 1,
},
```

**Step 3: Update updatePlaylist action for FormData**

Replace the current `updatePlaylist` function. It currently accepts `(playlistId: string, data: { name?: string; description?: string; isPublic?: boolean })`.

Add artwork and share token support:

```typescript
export async function updatePlaylist(
  playlistId: string,
  data: {
    name?: string;
    description?: string;
    isPublic?: boolean;
    enableSharing?: boolean;
  }
): Promise<ItemResult> {
```

In the update call, add share token logic:
```typescript
const updateData: Record<string, unknown> = {};
if (data.name !== undefined) updateData.name = data.name;
if (data.description !== undefined) updateData.description = data.description;
if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
if (data.enableSharing === true) {
  const { nanoid } = await import("nanoid");
  updateData.shareToken = nanoid(21);
} else if (data.enableSharing === false) {
  updateData.shareToken = null;
}
```

**Step 4: Add artwork upload action**

Add new function:

```typescript
export async function updatePlaylistArtwork(
  playlistId: string,
  formData: FormData
): Promise<ItemResult> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("mutation"),
    ]);
    if (!session?.user?.id) return { error: "Not authenticated" };
    if (rateLimitResult) return { error: "Rate limit exceeded" };

    const file = formData.get("artwork") as File | null;
    if (!file) return { error: "No file provided" };

    const validation = playlistArtworkSchema.safeParse({
      size: file.size,
      type: file.type,
    });
    if (!validation.success) {
      return { error: validation.error.errors[0].message };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Strip EXIF using the same utility as user hero upload
    const { stripExif } = await import("@/lib/image-utils");
    const processed = await stripExif(bytes);

    await prisma.playlist.update({
      where: { id: playlistId, userId: session.user.id },
      data: {
        artworkImage: Buffer.from(processed),
        artworkMime: file.type,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Failed to upload artwork" };
  }
}
```

**Step 5: Add remove artwork action**

```typescript
export async function removePlaylistArtwork(
  playlistId: string
): Promise<ItemResult> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("mutation"),
    ]);
    if (!session?.user?.id) return { error: "Not authenticated" };
    if (rateLimitResult) return { error: "Rate limit exceeded" };

    await prisma.playlist.update({
      where: { id: playlistId, userId: session.user.id },
      data: { artworkImage: null, artworkMime: null },
    });

    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Failed to remove artwork" };
  }
}
```

**Step 6: Add regenerateShareToken action**

```typescript
export async function regenerateShareToken(
  playlistId: string
): Promise<ItemResult<{ shareToken: string }>> {
  try {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("mutation"),
    ]);
    if (!session?.user?.id) return { error: "Not authenticated" };
    if (rateLimitResult) return { error: "Rate limit exceeded" };

    const { nanoid } = await import("nanoid");
    const token = nanoid(21);

    await prisma.playlist.update({
      where: { id: playlistId, userId: session.user.id },
      data: { shareToken: token },
    });

    revalidatePath("/");
    return { success: true, data: { shareToken: token } };
  } catch {
    return { error: "Failed to regenerate token" };
  }
}
```

**Step 7: Update getUserPlaylists and getPlaylist**

In `getUserPlaylists`, update the Prisma select to replace `artworkUrl` with `artworkImage` presence check. The return should map to `hasArtwork: !!playlist.artworkImage`.

In `getPlaylist`, add `shareToken` to the select and include `hasArtwork` in the return.

**Step 8: Verify type-check passes**

Run: `pnpm run type-check`
Expected: PASS (or very few remaining errors from downstream consumers — fix any that appear).

**Step 9: Run existing tests**

Run: `pnpm run test -- --run tests/unit/lib/playlist-actions.test.ts`
Expected: Existing tests should still pass (createPlaylist signature is backwards-compatible).

**Step 10: Commit**

```bash
git add lib/playlist-actions.ts lib/validations.ts
git commit -m "feat: add playlist artwork upload, share token, and enhanced create"
```

---

### Task 4: Playlist artwork API route

**Files:**
- Create: `app/api/playlist/artwork/route.ts`

**Step 1: Create the route**

Mirror the pattern from `app/api/user/hero/route.ts`:

```typescript
/**
 * API route for serving playlist artwork images.
 * Supports public playlists, unlisted (share token), and owner access.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const playlistId = searchParams.get("playlistId");
  const token = searchParams.get("token");

  if (!playlistId) {
    return new Response("Missing playlistId", { status: 400 });
  }

  const rateLimitResult = await checkRateLimit("apiRoute");
  if (rateLimitResult) {
    return new Response("Too many requests", { status: 429 });
  }

  const session = await auth();

  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    select: {
      artworkImage: true,
      artworkMime: true,
      isPublic: true,
      shareToken: true,
      userId: true,
    },
  });

  if (!playlist?.artworkImage || !playlist.artworkMime) {
    return new Response(null, { status: 404 });
  }

  // Access control: public, owner, or valid share token
  const isOwner = session?.user?.id === playlist.userId;
  const isPublic = playlist.isPublic;
  const hasValidToken = token && playlist.shareToken === token;

  if (!isPublic && !isOwner && !hasValidToken) {
    return new Response(null, { status: 404 });
  }

  const imageBytes = new Uint8Array(playlist.artworkImage);
  const etag = createHash("md5").update(imageBytes).digest("hex");

  return new Response(imageBytes, {
    status: 200,
    headers: {
      "Content-Type": playlist.artworkMime,
      "Cache-Control": isPublic ? "public, max-age=3600" : "private, max-age=3600",
      ETag: `"${etag}"`,
    },
  });
}
```

**Step 2: Verify type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/playlist/artwork/
git commit -m "feat: add playlist artwork API route"
```

---

### Task 5: Update public-auth for share tokens

**Files:**
- Modify: `lib/public-auth.ts`

**Step 1: Update getPublicPlaylist**

Find `getPublicPlaylist` function. Currently it only returns public playlists. Add optional `token` parameter:

```typescript
export async function getPublicPlaylist(
  playlistId: string,
  token?: string | null
)
```

In the Prisma query, change the where clause:
- If `token` is provided, query by `id: playlistId` and then check: if `isPublic` OR `shareToken === token`, allow access
- If no token, keep existing `isPublic: true` requirement
- Always check that user `isPublic: true` (owner profile must be public) — BUT for unlisted playlists, the owner profile check should still apply

The logic:
```typescript
const playlist = await prisma.playlist.findUnique({
  where: { id: playlistId },
  include: {
    user: { select: { isPublic: true, username: true, name: true, id: true } },
    playlistItems: {
      include: { item: { select: { /* existing fields */ } } },
      orderBy: { order: "asc" },
    },
  },
});

if (!playlist) return null;

// Access check: public OR valid share token
const isAccessible = playlist.isPublic || (token && playlist.shareToken === token);
if (!isAccessible) return null;

// Owner profile must be public (even for unlisted sharing)
if (!playlist.user.isPublic) return null;

// Filter to only public items
const publicItems = playlist.playlistItems.filter(pi => pi.item.isPublic);
if (publicItems.length === 0 && playlist.isPublic) return null; // hide empty public playlists
// For unlisted playlists, allow even if empty (owner shared it intentionally)
```

**Step 2: Run integration tests**

Run: `pnpm run test:integration -- --run tests/integration/playlists/`
Expected: Existing tests pass (new param is optional, doesn't change default behaviour).

**Step 3: Commit**

```bash
git add lib/public-auth.ts
git commit -m "feat: add share token support to getPublicPlaylist"
```

---

### Task 6: Update playlist detail page for share tokens

**Files:**
- Modify: `app/(public)/u/[username]/playlists/[playlistId]/page.tsx`
- Modify: `app/(public)/u/[username]/playlists/[playlistId]/opengraph-image.tsx`

**Step 1: Update page.tsx**

Add `searchParams` to the PageProps:

```typescript
interface PageProps {
  params: Promise<{ username: string; playlistId: string }>;
  searchParams: Promise<{ token?: string }>;
}
```

In both `generateMetadata` and `PlaylistPage`, destructure `token` from `searchParams` and pass it to `getPublicPlaylist(playlistId, token)`.

**Step 2: Update opengraph-image.tsx**

Add `searchParams` handling to read `token` and pass to `getPublicPlaylist`.

**Step 3: Enhance JSON-LD**

In the viewer section of `PlaylistPage`, update the JSON-LD to include `author`, `dateCreated`, `dateModified`, `image` (per design doc section 1.3):

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: publicData.playlist.name,
  description: publicData.playlist.description ?? undefined,
  author: {
    "@type": "Person",
    name: profile.name ?? profile.username,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/u/${username}`,
  },
  numberOfItems: publicData.items.length,
  dateCreated: publicData.playlist.createdAt,
  dateModified: publicData.playlist.updatedAt,
  image: publicData.playlist.hasArtwork
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/playlist/artwork?playlistId=${playlistId}`
    : undefined,
  itemListElement: publicData.items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/u/${username}/${item.id}`,
  })),
};
```

**Step 4: Enhance OpenGraph metadata**

Update `generateMetadata` to use `"article"` type and add author/modified_time:

```typescript
openGraph: {
  title: `${data.name} | CanonCore`,
  description: data.description
    ? `"${data.description}" — ${itemCount} items curated by @${username}`
    : `Playlist by @${username} on CanonCore.`,
  type: "article",
},
```

**Step 5: Verify build**

Run: `pnpm run type-check`
Expected: PASS

**Step 6: Commit**

```bash
git add app/(public)/u/[username]/playlists/
git commit -m "feat: add share token support, enhanced JSON-LD and OpenGraph"
```

---

## Phase 2: URL State & Hooks

### Task 7: Expand playlist URL state

**Files:**
- Modify: `hooks/playlist-search-params.ts`
- Modify: `hooks/use-playlist-url-state.ts`

**Step 1: Add parsers to playlist-search-params.ts**

```typescript
import { parseAsStringLiteral, parseAsArrayOf } from "nuqs/server";
import type { SortOptionConfig } from "@/lib/item-utils";
import { PLAYLIST_VIEW_MODES, PLAYLIST_CONTENT_FILTERS } from "@/lib/types";

const PLAYLIST_SORT_VALUES = ["custom", "updated-desc", "name-asc"] as const;
const PLAYLIST_TAB_VALUES = ["contents", "about"] as const;

export const playlistParsers = {
  sort: parseAsStringLiteral(PLAYLIST_SORT_VALUES).withDefault("custom"),
  view: parseAsStringLiteral(PLAYLIST_VIEW_MODES).withDefault("grid"),
  filter: parseAsArrayOf(parseAsStringLiteral(PLAYLIST_CONTENT_FILTERS)).withDefault([]),
  tab: parseAsStringLiteral(PLAYLIST_TAB_VALUES),
};

export const PLAYLIST_SORT_OPTIONS: SortOptionConfig[] = [
  { value: "custom", label: "Custom Order" },
  { value: "updated-desc", label: "Date Added" },
  { value: "name-asc", label: "Name A-Z" },
];
```

**Step 2: Expand usePlaylistUrlState**

```typescript
import { useQueryStates } from "nuqs";
import { useCallback } from "react";
import { playlistParsers } from "./playlist-search-params";
import type { SortOption, PlaylistViewMode, PlaylistContentFilter } from "@/lib/types";

export function usePlaylistUrlState() {
  const [state, setState] = useQueryStates(playlistParsers, {
    history: "replace",
    scroll: false,
  });

  const setSortBy = useCallback(
    (sort: SortOption) => setState({ sort: sort as typeof state.sort }),
    [setState]
  );

  const setViewMode = useCallback(
    (view: PlaylistViewMode) => setState({ view }),
    [setState]
  );

  const toggleFilter = useCallback(
    (filter: PlaylistContentFilter) => {
      const current = state.filter ?? [];
      const next = current.includes(filter)
        ? current.filter((f) => f !== filter)
        : [...current, filter];
      setState({ filter: next });
    },
    [state.filter, setState]
  );

  const clearFilters = useCallback(
    () => setState({ filter: [] }),
    [setState]
  );

  const setTab = useCallback(
    (tab: "contents" | "about") => setState({ tab }),
    [setState]
  );

  return {
    sortBy: state.sort as SortOption,
    setSortBy,
    viewMode: (state.view ?? "grid") as PlaylistViewMode,
    setViewMode,
    filters: (state.filter ?? []) as PlaylistContentFilter[],
    toggleFilter,
    clearFilters,
    hasActiveFilters: (state.filter ?? []).length > 0,
    tab: state.tab as "contents" | "about" | null,
    setTab,
    isCustomSort: state.sort === "custom",
  };
}
```

**Step 3: Run type-check**

Run: `pnpm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add hooks/playlist-search-params.ts hooks/use-playlist-url-state.ts
git commit -m "feat: expand playlist URL state with view, filter, and tab params"
```

---

## Phase 3: Detail Page Structural Parity

### Task 8: Add tabs to PlaylistDetailClient

This is the largest task — restructuring `PlaylistDetailClient` to match `ItemDetailClient` structure.

**Files:**
- Modify: `components/playlists/playlist-detail-client.tsx`

**Step 1: Add imports**

Add these imports to `PlaylistDetailClient`:

```typescript
import { useTransition, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { EditModeToggle } from "@/components/items/edit-mode-toggle";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const SwipeableUnderlineTabs = dynamic(
  () =>
    import("@/components/ui/swipeable-underline-tabs").then((mod) => ({
      default: mod.SwipeableUnderlineTabs,
    })),
  { ssr: false }
);

const emptySubscribe = () => () => {};
```

**Step 2: Add state**

Add to component body:

```typescript
const [isPending, startTransition] = useTransition();
const [isEditing, setIsEditing] = useState(false);
const isMobile = useIsMobile();
const tabsMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

const { sortBy, setSortBy, viewMode, setViewMode, filters, toggleFilter, clearFilters, tab, setTab, isCustomSort } = usePlaylistUrlState();
```

Remove the old `const { sortBy, setSortBy } = usePlaylistUrlState();`.

**Step 3: Wrap mutations in startTransition**

Update `handleRemoveItem` to use `startTransition`:

```typescript
const handleRemoveItem = useCallback(
  async (itemId: string) => {
    startTransition(async () => {
      const result = await removeItemFromPlaylist(playlist.id, itemId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setPlaylist((prev) => ({
          ...prev,
          items: prev.items.filter((i) => i.item.id !== itemId),
        }));
      }
    });
  },
  [playlist.id]
);
```

**Step 4: Build Contents tab and About tab**

Build the `contentsActions` (right side of toolbar) — matching ItemDetailClient:

```typescript
const contentsActions = isOwner ? (
  <>
    <Button
      variant="outline"
      size="sm"
      onClick={() => {/* TODO: add items dialog */}}
      className="gap-1.5"
      aria-label="Add"
    >
      <Plus className="size-4" strokeWidth={2} />
      <span className="hidden xl:inline">Add</span>
    </Button>
    <EditModeToggle
      isEditing={isEditing}
      onToggle={() => setIsEditing((prev) => !prev)}
      disabled={!sortedItems.length || !isCustomSort}
      disabledReason={
        !sortedItems.length
          ? "No items to edit"
          : !isCustomSort
            ? "Set sort to Custom Order to reorder"
            : undefined
      }
    />
  </>
) : null;
```

Build Contents content:

```typescript
const contentsContent = (
  <>
    <ContentToolbar
      sortBy={sortBy}
      onSortChange={setSortBy}
      sortOptions={PLAYLIST_SORT_OPTIONS}
      defaultSort="custom"
      disabled={sortedItems.length === 0}
      actions={contentsActions}
    />
    {/* grid/items render goes here */}
    {sortedItems.length === 0 ? (
      <Section className="flex flex-1 flex-col">
        <EmptyState variant="playlist-empty" onAction={isOwner ? () => router.push(`/u/${username}`) : undefined} />
      </Section>
    ) : (
      <Section>
        <div className={gridClasses} data-testid="playlist-item-grid">
          {/* existing grid rendering */}
        </div>
      </Section>
    )}
  </>
);
```

Build About content:

```typescript
const aboutContent = (
  <Section className="py-8">
    {playlist.description && (
      <div className="mb-6">
        <h3 className="mb-2 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">About</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{playlist.description}</p>
      </div>
    )}
    <div className="text-muted-foreground space-y-1 text-sm">
      <p>{playlist.items.length} {playlist.items.length === 1 ? "item" : "items"}</p>
    </div>
  </Section>
);
```

**Step 5: Render tabs**

Replace the current content render with tabs:

```typescript
const activeTab = tab ?? "contents";

return (
  <>
    <HeroContentLayout hero={hero} isPending={isPending} data-testid="playlist-detail">
      {tabsMounted ? (
        isMobile ? (
          <SwipeableUnderlineTabs
            tabs={[
              { id: "contents", label: "Contents", content: contentsContent },
              { id: "about", label: "About", content: aboutContent },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setTab(id as "contents" | "about")}
            swipeEnabled={!isEditing}
          />
        ) : (
          <UnderlineTabs
            defaultTab="contents"
            tabs={[
              { id: "contents", label: "Contents", content: contentsContent },
              { id: "about", label: "About", content: aboutContent },
            ]}
          />
        )
      ) : (
        contentsContent
      )}
    </HeroContentLayout>
    {/* existing dialogs */}
  </>
);
```

**Step 6: Fix grid columns to match items**

Replace the `gridClasses` with unified columns:

```typescript
const gridClasses = "stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6";
```

**Step 7: Verify type-check and test**

Run: `pnpm run type-check && pnpm run test`
Expected: PASS

**Step 8: Commit**

```bash
git add components/playlists/playlist-detail-client.tsx
git commit -m "feat: add tabs, edit mode, toolbar actions to PlaylistDetailClient"
```

---

### Task 9: Add drag-to-reorder with SortableGrid

**Files:**
- Modify: `components/playlists/playlist-detail-client.tsx`

**Step 1: Add SortableGrid import**

```typescript
import dynamic from "next/dynamic";
const SortableGrid = dynamic(
  () => import("@/components/sortable-grid").then((mod) => ({ default: mod.SortableGrid })),
  { ssr: false }
);
```

**Step 2: Add reorder handler**

```typescript
const handleReorder = useCallback(
  (updates: { id: string; order: number }[]) => {
    startTransition(async () => {
      // Optimistic update
      setPlaylist((prev) => {
        const newItems = [...prev.items];
        for (const update of updates) {
          const item = newItems.find((i) => i.playlistItemId === String(update.id));
          if (item) item.order = update.order;
        }
        return { ...prev, items: newItems };
      });

      const result = await reorderPlaylistItems(
        playlist.id,
        updates.map((u) => ({ id: String(u.id), order: u.order }))
      );
      if (result.error) {
        toast.error(result.error);
      }
    });
  },
  [playlist.id]
);
```

**Step 3: Wrap grid in SortableGrid when editing**

In the grid section of `contentsContent`, conditionally wrap with `SortableGrid`:

```typescript
{isEditing && isCustomSort ? (
  <SortableGrid
    items={sortedItems.map((entry) => ({
      id: entry.playlistItemId,
      ...entry,
    }))}
    onReorder={handleReorder}
    renderItem={(entry) => (
      <GridItem
        id={entry.item.id}
        name={entry.item.name}
        description={entry.item.description}
        tmdbPosterPath={entry.item.tmdbPosterPath}
        artworkId={entry.item.artworkId}
        showArtwork
        priority={false}
      />
    )}
    columns={gridClasses}
  />
) : (
  <div className={gridClasses} data-testid="playlist-item-grid">
    {/* existing grid rendering */}
  </div>
)}
```

Note: The exact `SortableGrid` API may differ — check `components/sortable-grid/sortable-grid.tsx` for the actual interface. Adapt accordingly.

**Step 4: Verify and commit**

Run: `pnpm run type-check`
Expected: PASS

```bash
git add components/playlists/playlist-detail-client.tsx
git commit -m "feat: add drag-to-reorder support for playlist items"
```

---

### Task 10: Add remove confirmation dialog

**Files:**
- Modify: `components/playlists/playlist-context-menu.tsx`

**Step 1: Add confirmation state to PlaylistItemContextMenu**

Currently `PlaylistItemContextMenu` has a `Remove from Playlist` item with no confirmation. Add `AlertDialog` matching the pattern from `ItemContextMenu`:

Add state:
```typescript
const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
```

Replace the direct `onRemove` call with dialog trigger, and add the AlertDialog matching `item-context-menu.tsx` glassmorphism styling.

**Step 2: Commit**

```bash
git add components/playlists/playlist-context-menu.tsx
git commit -m "feat: add confirmation dialog for remove from playlist"
```

---

### Task 11: Upgrade PlaylistCard

**Files:**
- Modify: `components/playlists/playlist-card.tsx`

**Step 1: Add forwardRef**

Wrap the component in `forwardRef`:

```typescript
export const PlaylistCard = forwardRef<HTMLAnchorElement, PlaylistCardProps>(
  function PlaylistCard({ playlist, username, priority = false, isOwner, hasArtwork }, ref) {
```

**Step 2: Add visibility badge**

For owner mode, add a badge at top-right of artwork:

```typescript
{isOwner && (
  <div className="absolute top-1.5 right-1.5 z-10">
    {playlist.isPublic ? (
      <Eye className="size-3.5 text-white/60 drop-shadow" />
    ) : (
      <Lock className="size-3.5 text-white/60 drop-shadow" />
    )}
  </div>
)}
```

**Step 3: Add glassmorphism hover overlay**

Add an overlay div that appears on hover:

```typescript
{/* Hover overlay */}
<div className={cn(
  "absolute inset-0 flex flex-col justify-end p-3",
  "bg-black/60 backdrop-blur-sm",
  "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
)}>
  {playlist.description && (
    <p className="line-clamp-2 text-xs text-white/80">{playlist.description}</p>
  )}
  <p className="mt-1 text-xs font-medium text-white/60">
    {playlist.itemCount} {playlist.itemCount === 1 ? "item" : "items"}
  </p>
</div>
```

**Step 4: Add hasArtwork support**

When `hasArtwork` is true, show custom artwork instead of collage:

```typescript
{hasArtwork ? (
  <Image
    src={`/api/playlist/artwork?playlistId=${playlist.id}`}
    alt=""
    fill
    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
    className="object-cover"
    priority={priority}
  />
) : artworks.length === 0 ? (
  /* existing empty state */
) : /* existing collage */}
```

**Step 5: Update interface**

```typescript
interface PlaylistCardProps {
  playlist: {
    id: string;
    name: string;
    description?: string | null;
    itemCount: number;
    previewArtworkIds: (string | null)[];
    isPublic?: boolean;
    hasArtwork?: boolean;
  };
  username: string;
  priority?: boolean;
  isOwner?: boolean;
}
```

**Step 6: Commit**

```bash
git add components/playlists/playlist-card.tsx
git commit -m "feat: upgrade PlaylistCard with hover overlay, visibility badge, artwork"
```

---

### Task 12: Wire context menus on PlaylistSection

**Files:**
- Modify: `components/playlists/playlist-section.tsx`

**Step 1: Import PlaylistContextMenu**

```typescript
import { PlaylistContextMenu } from "./playlist-context-menu";
```

**Step 2: Wrap cards in context menu for owner mode**

In `OwnerPlaylistSection`, wrap each `PlaylistCard` in `PlaylistContextMenu`:

```typescript
{playlists.map((playlist) => (
  <PlaylistContextMenu
    key={playlist.id}
    playlistName={playlist.name}
    playlistId={playlist.id}
    isPublic={playlist.isPublic}
    onRename={async (name) => { /* call updatePlaylist */ }}
    onToggleVisibility={async () => { /* call updatePlaylist */ }}
    onDelete={async () => { /* call deletePlaylist */ }}
  >
    <PlaylistCard
      playlist={playlist}
      username={username}
      isOwner
    />
  </PlaylistContextMenu>
))}
```

Note: Check `PlaylistContextMenu` for the actual props — it may need `PlaylistCardContextMenu` to be created or the existing component to be extended. Currently `PlaylistContextMenu` has card-level actions (rename, visibility, delete) and `PlaylistItemContextMenu` has item-level actions (go to, remove).

**Step 3: Add loading skeleton**

Replace the `if (!isLoaded) return null;` with a skeleton:

```typescript
if (!isLoaded) {
  return (
    <Section className="py-8" aria-label="Playlists">
      <div className="mb-4 h-4 w-16 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-square rounded-md bg-muted skeleton-shimmer" />
        ))}
      </div>
    </Section>
  );
}
```

**Step 4: Commit**

```bash
git add components/playlists/playlist-section.tsx
git commit -m "feat: wire context menus and loading skeleton on PlaylistSection"
```

---

### Task 13: Enhance CreatePlaylistDialog

**Files:**
- Modify: `components/playlists/create-playlist-dialog.tsx`

**Step 1: Add description textarea and visibility toggle**

Add a description `Textarea` (max 1000 chars) and a public/private `Switch`:

```typescript
const [description, setDescription] = useState("");
const [isPublic, setIsPublic] = useState(false);
```

In the form, add after the name input:
```typescript
<Textarea
  placeholder="Description (optional)"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  maxLength={1000}
  rows={3}
/>
<div className="flex items-center justify-between">
  <Label htmlFor="create-playlist-public">Make public</Label>
  <Switch
    id="create-playlist-public"
    checked={isPublic}
    onCheckedChange={setIsPublic}
  />
</div>
```

**Step 2: Pass new fields to createPlaylist**

```typescript
const result = await createPlaylist(name, { description: description || undefined, isPublic });
```

**Step 3: Commit**

```bash
git add components/playlists/create-playlist-dialog.tsx
git commit -m "feat: enhance CreatePlaylistDialog with description and visibility"
```

---

### Task 14: Edit dialog — artwork and sharing UI

**Files:**
- Modify: `components/playlists/edit-playlist-dialog.tsx`

**Step 1: Add artwork upload section**

Above the name field, add:
- Image preview (current artwork or placeholder)
- File input with drag-drop zone
- Remove button (when artwork exists)

Use the existing artwork patterns from the user hero upload.

**Step 2: Add shareable link section**

Below the visibility toggle, when `isPublic === false`:
- Toggle switch for "Shareable link"
- When enabled: read-only URL input with copy button
- "Regenerate" button with confirmation

**Step 3: Wire to server actions**

- Artwork upload: call `updatePlaylistArtwork(playlistId, formData)`
- Artwork remove: call `removePlaylistArtwork(playlistId)`
- Share toggle on: call `updatePlaylist(playlistId, { enableSharing: true })`
- Share toggle off: call `updatePlaylist(playlistId, { enableSharing: false })`
- Regenerate: call `regenerateShareToken(playlistId)`

**Step 4: Commit**

```bash
git add components/playlists/edit-playlist-dialog.tsx
git commit -m "feat: add artwork upload and share link UI to EditPlaylistDialog"
```

---

## Phase 4: Surface Parity

### Task 15: Spotlight search visual parity

**Files:**
- Modify: `components/search/spotlight-search.tsx`

**Step 1: Match playlist result styling to item results**

Find the playlist `CommandItem` section. Currently it uses a static `ListMusic` icon.

Replace with a mini thumbnail showing the 2x2 collage or custom artwork:
- If `hasArtwork`: show `<img src="/api/playlist/artwork?playlistId={id}" />` in a small square
- Else: keep the `ListMusic` icon but match the `h-[52px]` height and `cursor-pointer` from items

Add `cursor-pointer`, `group` class, and consistent height.

**Step 2: Commit**

```bash
git add components/search/spotlight-search.tsx
git commit -m "feat: improve playlist search result visual parity"
```

---

### Task 16: Sidebar playlists section

**Files:**
- Modify: `components/nav-main.tsx`

**Step 1: Add playlists to sidebar**

After the existing nav items, add a collapsible "Playlists" section when authenticated:
- Fetch user playlists via `getUserPlaylists` (or receive as props)
- Show as collapsible list items
- Each links to `/u/{username}/playlists/{id}`

Note: This may require passing playlists data from `AppSidebar` down to `NavMain`, or using a client-side fetch within `NavMain`. Check the existing pattern — `NavMain` receives `items` as props, so playlists would likely be added as a separate section.

Consider adding a `playlists` prop to `NavMainProps`:
```typescript
interface NavMainProps {
  items: NavItem[];
  username?: string | null;
  playlists?: { id: string; name: string }[];
}
```

**Step 2: Commit**

```bash
git add components/nav-main.tsx components/app-sidebar.tsx
git commit -m "feat: add playlists section to sidebar navigation"
```

---

## Phase 5: Tests

### Task 17: Unit tests for updated server actions

**Files:**
- Modify: `tests/unit/lib/playlist-actions.test.ts`

**Step 1: Add tests**

Add test cases for:
- `createPlaylist` with description and isPublic
- `updatePlaylist` with enableSharing (generates token)
- `updatePlaylist` with enableSharing=false (revokes token)
- `regenerateShareToken` happy path
- `updatePlaylistArtwork` validation (too large, wrong type)
- `removePlaylistArtwork` happy path

Follow the existing mock patterns in the file.

**Step 2: Run tests**

Run: `pnpm run test -- --run tests/unit/lib/playlist-actions.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/unit/lib/playlist-actions.test.ts
git commit -m "test: add unit tests for artwork, sharing, and enhanced create"
```

---

### Task 18: Integration tests for sharing

**Files:**
- Modify: `tests/integration/playlists/playlist-visibility.test.ts`

**Step 1: Add unlisted sharing tests**

Add new test cases:
- `it("allows access to unlisted playlist with valid share token")`
- `it("rejects access to unlisted playlist with invalid token")`
- `it("rejects access to unlisted playlist without token")`
- `it("ignores token for public playlists")`

Follow the existing pattern in the file (create user, create playlist, test via `getPublicPlaylist`).

**Step 2: Run tests**

Run: `pnpm run test:integration -- --run tests/integration/playlists/playlist-visibility.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/integration/playlists/playlist-visibility.test.ts
git commit -m "test: add integration tests for unlisted playlist sharing"
```

---

### Task 19: Unit tests for validations

**Files:**
- Modify: `tests/unit/lib/validations.test.ts`

**Step 1: Add artwork validation tests**

Add tests for `playlistArtworkSchema`:
- Valid JPEG passes
- Valid PNG passes
- Valid WebP passes
- Too large file fails
- Invalid MIME type fails

**Step 2: Run tests**

Run: `pnpm run test -- --run tests/unit/lib/validations.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/unit/lib/validations.test.ts
git commit -m "test: add unit tests for playlist artwork validation"
```

---

### Task 20: Unit tests for URL state hook

**Files:**
- Create: `tests/unit/hooks/use-playlist-url-state.test.ts`
- Modify: `tests/unit/hooks/playlist-search-params.test.ts` (if exists, otherwise create)

**Step 1: Test playlist-search-params**

Test that parsers handle:
- Valid sort values
- Valid view values
- Valid filter arrays
- Valid tab values
- Invalid values fall back to defaults

**Step 2: Run tests**

Run: `pnpm run test -- --run tests/unit/hooks/`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/unit/hooks/
git commit -m "test: add unit tests for playlist URL state and search params"
```

---

### Task 21: Update seed and existing tests

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `tests/unit/prisma/seed.test.ts`
- Modify: `tests/integration/seed/seed.test.ts`

**Step 1: Update seed**

Remove any `artworkUrl` references in seed data. Add sample `shareToken` to one test playlist if desired.

**Step 2: Update seed tests**

Remove assertions on `artworkUrl`. Add assertions for new fields if seed creates them.

**Step 3: Run all tests**

Run: `pnpm run test && pnpm run test:integration`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add prisma/seed.ts tests/
git commit -m "chore: update seed and tests for playlist v2 schema"
```

---

### Task 22: Quality gate

**Step 1: Run full quality gate**

Run: `pnpm run check`
Expected: PASS (format + lint + type-check + knip + build)

**Step 2: Fix any issues found**

If knip reports new unused exports due to the type changes, fix them. If lint has issues, fix them.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix quality gate issues for playlists v2"
```

---

### Task 23: Update Storybook stories

**Files:**
- Modify: All files under `components/playlists/*.stories.tsx`

**Step 1: Update stories**

Update each playlist story to reflect new features:
- `PlaylistCard` stories: add variants for hasArtwork, visibility badge, hover overlay
- `EditPlaylistDialog` stories: add artwork upload section, share link section
- `CreatePlaylistDialog` stories: add description and visibility fields
- `PlaylistSection` stories: add loading skeleton variant, context menu variant
- `PlaylistContextMenu` stories: update for new confirmation dialogs

**Step 2: Verify stories build**

Run: `pnpm run storybook --ci`
Expected: Stories build and render.

**Step 3: Commit**

```bash
git add components/playlists/*.stories.tsx
git commit -m "chore: update playlist Storybook stories for v2 features"
```

---

## Phase 6: Final Verification

### Task 24: Full test run and quality gate

**Step 1: Run all tests**

Run: `pnpm run test`
Expected: All unit tests PASS.

Run: `pnpm run test:integration`
Expected: All integration tests PASS.

**Step 2: Run quality gate**

Run: `pnpm run check`
Expected: PASS

**Step 3: Manual smoke test**

If dev server is available:
- Create a playlist with description and visibility
- Edit playlist: upload artwork, enable sharing
- View playlist detail: verify tabs work, sort works
- Test share link with incognito browser
- Right-click playlist card: verify context menu

**Step 4: Commit any final fixes**

---

## Deferred Items (Future Tasks)

These items from the design doc are intentionally deferred to keep this plan deliverable:

- **Tree view for playlist items** (design doc parity fix #2) — requires `getPlaylistItemDescendants` CTE query, significant data layer work
- **Mobile bottom sheet** (design doc parity fix #24) — 935-line component, large scope
- **Explore page parity** (design doc parity fix #21) — requires backend changes for popular/trending playlists
- **Profile page treatment** (design doc parity fix #22) — UI rework
- **PlaylistCard lazy image loading** (design doc parity fix #12) — performance optimization, not blocking

These can be tackled as follow-up PRs after the core v2 features land.
