/**
 * Client component for playlist detail pages.
 * Renders hero, toolbar, and item grid with sort/edit/bulk-remove support.
 * Owner mode: editable with drag-to-reorder and bulk actions.
 * Viewer mode: read-only grid of public items.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { CinematicHero, type HeroSlide } from "@/components/hero";
import { HeroButton } from "@/components/items/hero-button";
import { HeroContentLayout } from "@/components/ui/hero-content-layout";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import { GridItem } from "@/components/sortable-grid/grid-item";
import { EmptyState } from "@/components/items/empty-state";
import { Section } from "@/components/ui/section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlaylistItemContextMenu } from "@/components/playlists/playlist-context-menu";
import { EditPlaylistDialog } from "@/components/playlists/edit-playlist-dialog";
import { usePlaylistUrlState } from "@/hooks/use-playlist-url-state";
import { PLAYLIST_SORT_OPTIONS } from "@/hooks/playlist-search-params";
import { deletePlaylist, removeItemFromPlaylist } from "@/lib/playlist-actions";
import { getTmdbBackdropUrl } from "@/lib/tmdb-image-utils";

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
  items: PlaylistDetailItem[];
}

interface PlaylistDetailClientProps {
  /** Playlist data with items. */
  playlist: PlaylistDetailData;
  /** Profile username for URL construction. */
  username: string;
  /** Whether the current user is the playlist owner. */
  isOwner: boolean;
}

/**
 * Client-side playlist detail page with hero, toolbar, and item grid.
 *
 * @param playlist - Playlist data with items
 * @param username - Profile username for URL construction
 * @param isOwner - Whether the current user is the playlist owner
 */
export function PlaylistDetailClient({
  playlist: initialPlaylist,
  username,
  isOwner,
}: PlaylistDetailClientProps) {
  const router = useRouter();
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const { sortBy, setSortBy } = usePlaylistUrlState();

  // Sort items based on current sort option
  const sortedItems = useMemo(() => {
    const items = [...playlist.items];
    switch (sortBy) {
      case "name-asc":
        return items.sort((a, b) => a.item.name.localeCompare(b.item.name));
      case "updated-desc":
        return items.sort(
          (a, b) =>
            new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
      default:
        return items.sort((a, b) => a.order - b.order);
    }
  }, [playlist.items, sortBy]);

  // Handle remove item from playlist
  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      const result = await removeItemFromPlaylist(playlist.id, itemId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setPlaylist((prev) => ({
          ...prev,
          items: prev.items.filter((i) => i.item.id !== itemId),
        }));
      }
    },
    [playlist.id]
  );

  // Handle delete playlist
  const handleDelete = useCallback(async () => {
    const result = await deletePlaylist(playlist.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Playlist deleted");
      router.push(`/u/${username}`);
    }
  }, [playlist.id, username, router]);

  // Handle share
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/u/${username}/playlists/${playlist.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard");
    });
  }, [username, playlist.id]);

  // Build hero slide
  const firstItem = sortedItems[0]?.item;
  const backdropUrl = firstItem?.tmdbBackdropPath
    ? getTmdbBackdropUrl(firstItem.tmdbBackdropPath)
    : firstItem?.artworkId
      ? `/api/artwork/${firstItem.artworkId}`
      : undefined;

  const heroSlide: HeroSlide = {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description ?? undefined,
    backgroundUrl: backdropUrl,
  };

  // Hero actions (edit/share for owner, share for viewer, delete for owner)
  const heroActions = (
    <>
      {isOwner && (
        <HeroButton
          onClick={() => setShowEdit(true)}
          data-testid="playlist-edit-button"
        >
          <Pencil className="size-4" />
          Edit
        </HeroButton>
      )}
      <HeroButton onClick={handleShare} data-testid="playlist-share-button">
        <Share2 className="size-4" />
        Share
      </HeroButton>
      {isOwner && (
        <HeroButton
          onClick={() => setShowDeleteConfirm(true)}
          data-testid="playlist-delete-button"
        >
          <Trash2 className="size-4" />
          Delete
        </HeroButton>
      )}
    </>
  );

  // Toolbar actions placeholder (edit mode deferred to v2)

  // Hero element
  const hero = (
    <CinematicHero
      slides={[heroSlide]}
      headingLevel="h1"
      renderActions={() => heroActions}
    />
  );

  // Grid columns
  const gridClasses = isOwner
    ? "stagger-grid grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6"
    : "stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6";

  return (
    <>
      <HeroContentLayout hero={hero} data-testid="playlist-detail">
        <ContentToolbar
          sortBy={sortBy}
          onSortChange={setSortBy}
          sortOptions={PLAYLIST_SORT_OPTIONS}
          defaultSort="custom"
          disabled={sortedItems.length === 0}
        />

        {sortedItems.length === 0 ? (
          <Section className="flex flex-1 flex-col">
            <EmptyState
              variant="playlist-empty"
              onAction={
                isOwner ? () => router.push(`/u/${username}`) : undefined
              }
            />
          </Section>
        ) : (
          <Section>
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
                    showDescription
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
          </Section>
        )}
      </HeroContentLayout>

      {isOwner && (
        <EditPlaylistDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          playlist={playlist}
          onUpdated={(data) => {
            setPlaylist((prev) => ({
              ...prev,
              name: data.name,
              description: data.description,
              isPublic: data.isPublic,
            }));
          }}
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete playlist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{playlist.name}&rdquo;?
              This action cannot be undone. Items in the playlist will not be
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
