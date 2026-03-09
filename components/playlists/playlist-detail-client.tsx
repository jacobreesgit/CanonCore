/**
 * Client component for playlist detail pages.
 * Renders hero, toolbar, and item grid with sort/edit/bulk-remove support.
 * Owner mode: editable with drag-to-reorder and bulk actions.
 * Viewer mode: read-only grid of public items.
 *
 * Matches ItemDetailClient structure: tabs, useTransition, mobile swipe tabs.
 */

"use client";

import {
  useState,
  useMemo,
  useCallback,
  useTransition,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CinematicHero, type HeroSlide } from "@/components/hero";
import { HeroContentLayout } from "@/components/ui/hero-content-layout";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import { GridItem } from "@/components/sortable-grid/grid-item";
import { EmptyState } from "@/components/items/empty-state";
import { Section } from "@/components/ui/section";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { EditModeToggle } from "@/components/items/edit-mode-toggle";
import { Button } from "@/components/ui/button";
import { PlaylistItemContextMenu } from "@/components/playlists/playlist-context-menu";
import { EditPlaylistDialog } from "@/components/playlists/edit-playlist-dialog";
import { PlaylistDetailSettingsMenu } from "./playlist-detail-settings-menu";
import { usePlaylistUrlState } from "@/hooks/use-playlist-url-state";
import { PLAYLIST_SORT_OPTIONS } from "@/hooks/playlist-search-params";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  deletePlaylist,
  removeItemFromPlaylist,
  reorderPlaylistItems,
} from "@/lib/playlist-actions";
import { getTmdbBackdropUrl } from "@/lib/tmdb-image-utils";
import { emptySubscribe } from "@/lib/empty-subscribe";

const SwipeableUnderlineTabs = dynamic(
  () =>
    import("@/components/ui/swipeable-underline-tabs").then((mod) => ({
      default: mod.SwipeableUnderlineTabs,
    })),
  { ssr: false }
);

const PlaylistSortableGrid = dynamic(
  () =>
    import("@/components/playlists/playlist-sortable-grid").then((mod) => ({
      default: mod.PlaylistSortableGrid,
    })),
  { ssr: false }
);

/** Minimal playlist item shape needed by the detail client. */
interface PlaylistDetailItem {
  playlistItemId: string;
  order: number;
  addedAt: Date;
  item: {
    id: string;
    name: string;
    description: string | null;
    tmdbPosterPath?: string | null;
    tmdbBackdropPath?: string | null;
    artworkId: string | null;
  };
}

/** Minimal playlist shape needed by the detail client. */
interface PlaylistDetailData {
  id: string;
  name: string;
  description: string | null;
  isPublic?: boolean;
  hasArtwork?: boolean;
  shareToken?: string | null;
  items: PlaylistDetailItem[];
}

interface PlaylistDetailClientProps {
  /** Playlist data with items. */
  playlist: PlaylistDetailData;
  /** Profile username for URL construction. */
  username: string;
  /** Whether the current user is the playlist owner. */
  isOwner: boolean;
  /** Resolved dominant colour (playlist artwork > first item > null). Computed server-side. */
  dominantColour?: string | null;
}

/**
 * Client-side playlist detail page with hero, tabs, toolbar, and item grid.
 * Matches ItemDetailClient structure for feature parity.
 */
export function PlaylistDetailClient({
  playlist: initialPlaylist,
  username,
  isOwner,
  dominantColour,
}: PlaylistDetailClientProps) {
  const router = useRouter();
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [showEdit, setShowEdit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isMobile = useIsMobile();
  const tabsMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const { sortBy, setSortBy, tab, setTab, isCustomSort } =
    usePlaylistUrlState();

  // Sort items based on current sort option (toSorted for immutability)
  const sortedItems = useMemo(() => {
    switch (sortBy) {
      case "name-asc":
        return playlist.items.toSorted((a, b) =>
          a.item.name.localeCompare(b.item.name)
        );
      case "updated-desc":
        return playlist.items.toSorted(
          (a, b) =>
            new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
      default:
        return playlist.items.toSorted((a, b) => a.order - b.order);
    }
  }, [playlist.items, sortBy]);

  // Handle remove item from playlist
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

  // Handle reorder items (optimistic + server call with rollback)
  const handleReorder = useCallback(
    (reorderedItems: PlaylistDetailItem[]) => {
      startTransition(async () => {
        // Save previous state for rollback
        const prevItems = playlist.items;
        // Optimistic update
        setPlaylist((prev) => ({ ...prev, items: reorderedItems }));

        const updates = reorderedItems.map((i) => ({
          id: i.playlistItemId,
          order: i.order,
        }));
        const result = await reorderPlaylistItems(playlist.id, updates);
        if (result.error) {
          // Rollback optimistic update
          setPlaylist((prev) => ({ ...prev, items: prevItems }));
          toast.error(result.error);
        }
      });
    },
    [playlist.id, playlist.items]
  );

  // Handle delete playlist
  const handleDelete = useCallback(() => {
    startTransition(async () => {
      const result = await deletePlaylist(playlist.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Playlist deleted");
        router.push(`/u/${username}`);
      }
    });
  }, [playlist.id, username, router]);

  // Build hero background element — layout adapts to backdrop count
  const heroBackground = useMemo(() => {
    // Custom uploaded artwork — single full-bleed image
    if (playlist.hasArtwork) {
      return (
        <Image
          src={`/api/playlist/artwork?playlistId=${playlist.id}`}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          unoptimized
        />
      );
    }

    // Collect backdrop URLs from items (up to 6)
    const backdropUrls = sortedItems
      .map((si) =>
        si.item.tmdbBackdropPath
          ? getTmdbBackdropUrl(si.item.tmdbBackdropPath, "w780")
          : null
      )
      .filter(Boolean) as string[];

    const count = backdropUrls.length;
    if (count === 0) return undefined;

    // Helper to render a single mosaic tile
    const tile = (
      url: string,
      i: number,
      sizes: string,
      className?: string
    ) => (
      <div key={i} className={cn("relative overflow-hidden", className)}>
        <Image
          src={url}
          alt=""
          fill
          sizes={sizes}
          className="object-cover"
          loading={i === 0 ? undefined : "lazy"}
        />
      </div>
    );

    // 1 backdrop: single full-bleed
    if (count === 1) {
      return (
        <Image
          src={backdropUrls[0]}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
      );
    }

    // 2 backdrops: side by side
    if (count === 2) {
      return (
        <div className="absolute inset-0 grid grid-cols-2">
          {backdropUrls.map((url, i) => tile(url, i, "50vw"))}
        </div>
      );
    }

    // 3 backdrops: three columns
    if (count === 3) {
      return (
        <div className="absolute inset-0 grid grid-cols-3">
          {backdropUrls.map((url, i) => tile(url, i, "33vw"))}
        </div>
      );
    }

    // 4 backdrops: 2×2 grid
    if (count === 4) {
      return (
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {backdropUrls.map((url, i) => tile(url, i, "50vw"))}
        </div>
      );
    }

    // 5 backdrops: 3 top + 2 wider bottom (6-col grid)
    if (count === 5) {
      return (
        <div className="absolute inset-0 grid grid-cols-6 grid-rows-2">
          {backdropUrls
            .slice(0, 3)
            .map((url, i) => tile(url, i, "33vw", "col-span-2"))}
          {backdropUrls
            .slice(3, 5)
            .map((url, i) => tile(url, i + 3, "50vw", "col-span-3"))}
        </div>
      );
    }

    // 6+ backdrops: 3×2 grid
    return (
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
        {backdropUrls.slice(0, 6).map((url, i) => tile(url, i, "33vw"))}
      </div>
    );
  }, [playlist.hasArtwork, playlist.id, sortedItems]);

  const heroSlide: HeroSlide = {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description ?? undefined,
  };

  // Hero actions
  const heroActions = isOwner ? (
    <PlaylistDetailSettingsMenu
      playlistName={playlist.name}
      onEdit={() => setShowEdit(true)}
      onDelete={handleDelete}
    />
  ) : null;

  const hero = (
    <CinematicHero
      slides={[heroSlide]}
      headingLevel="h1"
      renderActions={() => heroActions}
      backgroundElement={heroBackground}
    />
  );

  // Grid columns — unified with items
  const gridClasses =
    "stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6";

  // Toolbar actions (right side) — Add + Edit mode toggle for owner
  const contentsActions = isOwner ? (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(`/u/${username}`)}
        className="gap-1.5"
        aria-label="Add items"
      >
        <FontAwesomeIcon icon={faPlus} className="size-4" />
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

  // Contents tab content
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

      {sortedItems.length === 0 ? (
        <Section className="flex flex-1 flex-col">
          <EmptyState
            variant="playlist-empty"
            onAction={isOwner ? () => router.push(`/u/${username}`) : undefined}
          />
        </Section>
      ) : (
        <Section>
          {isEditing && isCustomSort ? (
            <PlaylistSortableGrid
              items={sortedItems}
              username={username}
              onReorder={handleReorder}
              onRemoveItem={handleRemoveItem}
              gridClassName={gridClasses}
            />
          ) : (
            <div className={gridClasses} data-testid="playlist-item-grid">
              {sortedItems.map((entry, index) => {
                const itemHref = `/u/${username}/${entry.item.id}`;

                const gridItem = (
                  <GridItem
                    key={entry.playlistItemId}
                    id={entry.item.id}
                    name={entry.item.name}
                    description={entry.item.description}
                    tmdbPosterPath={entry.item.tmdbPosterPath}
                    artworkId={entry.item.artworkId}
                    onClick={() => router.push(itemHref)}
                    onMouseEnter={() => router.prefetch(itemHref)}
                    showArtwork
                    priority={index < 6}
                  />
                );

                if (isOwner) {
                  return (
                    <PlaylistItemContextMenu
                      key={entry.playlistItemId}
                      itemName={entry.item.name}
                      itemHref={itemHref}
                      onRemove={() => handleRemoveItem(entry.item.id)}
                    >
                      {gridItem}
                    </PlaylistItemContextMenu>
                  );
                }

                return gridItem;
              })}
            </div>
          )}
        </Section>
      )}
    </>
  );

  // About tab content
  const aboutContent = (
    <Section className="py-8">
      {playlist.description && (
        <div className="mb-6">
          <h3 className="mb-2 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
            About
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {playlist.description}
          </p>
        </div>
      )}
      <div className="text-muted-foreground space-y-1 text-sm">
        <p>
          {playlist.items.length}{" "}
          {playlist.items.length === 1 ? "item" : "items"}
        </p>
      </div>
    </Section>
  );

  const activeTab = tab ?? "contents";

  const tabs = [
    { id: "contents", label: "Contents", content: contentsContent },
    { id: "about", label: "About", content: aboutContent },
  ];

  return (
    <>
      <HeroContentLayout
        hero={hero}
        isPending={isPending}
        dominantColour={dominantColour}
        data-testid="playlist-detail"
      >
        {tabsMounted ? (
          isMobile ? (
            <SwipeableUnderlineTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(id) => setTab(id as "contents" | "about")}
              swipeEnabled={!isEditing}
            />
          ) : (
            <UnderlineTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(id) => setTab(id as "contents" | "about")}
            />
          )
        ) : (
          contentsContent
        )}
      </HeroContentLayout>

      {isOwner && (
        <EditPlaylistDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          playlist={playlist}
          username={username}
          onUpdated={(data) => {
            setPlaylist((prev) => ({
              ...prev,
              name: data.name,
              description: data.description,
              isPublic: data.isPublic,
              hasArtwork: data.hasArtwork,
              shareToken: data.shareToken,
            }));
          }}
        />
      )}
    </>
  );
}
