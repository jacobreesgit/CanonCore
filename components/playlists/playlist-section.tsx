/**
 * Playlist section for profile pages.
 * Renders a grid of PlaylistCards for both owner and viewer modes.
 * Owner mode: uses server-fetched initial data, falls back to client fetch.
 * Viewer mode: receives playlists as props, hidden when empty.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Section } from "@/components/ui/section";
import { PlaylistCard } from "./playlist-card";
import { PlaylistContextMenu } from "./playlist-context-menu";
import { EmptyState } from "@/components/items/empty-state";
import {
  getUserPlaylists,
  updatePlaylist,
  deletePlaylist,
} from "@/lib/playlist-actions";
import { CreatePlaylistDialog } from "./create-playlist-dialog";
import type { PlaylistWithCount, PublicPlaylistCard } from "@/lib/types";

interface PlaylistSectionOwnerProps {
  /** Owner mode — fetches playlists client-side. */
  mode: "owner";
  /** Profile username for URL construction. */
  username: string;
  /** Server-fetched playlists to avoid client-side flash. */
  initialPlaylists?: PlaylistWithCount[];
}

interface PlaylistSectionViewerProps {
  /** Viewer mode — receives playlists as props. */
  mode: "viewer";
  /** Profile username for URL construction. */
  username: string;
  /** Public playlists to display. */
  playlists: PublicPlaylistCard[];
}

type PlaylistSectionProps =
  | PlaylistSectionOwnerProps
  | PlaylistSectionViewerProps;

/**
 * Renders a grid of playlist cards on the profile page.
 * Owner mode uses server-fetched initial data when available.
 * Viewer mode receives playlists as props and hides when empty.
 *
 * @param mode - "owner" or "viewer"
 * @param username - Profile username for card links
 * @param playlists - Public playlists (viewer mode only)
 * @param initialPlaylists - Server-fetched playlists (owner mode only)
 */
export function PlaylistSection(props: PlaylistSectionProps) {
  if (props.mode === "viewer") {
    return <ViewerPlaylistSection {...props} />;
  }
  return <OwnerPlaylistSection {...props} />;
}

function ViewerPlaylistSection({
  username,
  playlists,
}: PlaylistSectionViewerProps) {
  if (playlists.length === 0) return null;

  return (
    <Section
      className="py-8"
      aria-label="Playlists"
      data-testid="playlist-section"
    >
      <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
        Playlists
      </h2>
      <div className="stagger-grid grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {playlists.map((playlist) => (
          <PlaylistCard
            key={playlist.id}
            playlist={playlist}
            username={username}
          />
        ))}
      </div>
    </Section>
  );
}

function OwnerPlaylistSection({
  username,
  initialPlaylists,
}: PlaylistSectionOwnerProps) {
  const router = useRouter();
  const hasInitialData = initialPlaylists !== undefined;
  const [playlists, setPlaylists] = useState<PlaylistWithCount[]>(
    initialPlaylists ?? []
  );
  const [isLoaded, setIsLoaded] = useState(hasInitialData);
  const [showCreate, setShowCreate] = useState(false);

  // Only fetch client-side if no initial data was provided
  useEffect(() => {
    if (hasInitialData) return;
    let cancelled = false;
    getUserPlaylists().then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setPlaylists(result.data);
      }
      setIsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasInitialData]);

  /** Re-fetch playlists after creating a new one. */
  const refreshPlaylists = useCallback(async () => {
    const result = await getUserPlaylists();
    if (result.success && result.data) {
      setPlaylists(result.data);
    }
  }, []);

  const handleToggleVisibility = useCallback(
    async (playlistId: string, currentIsPublic: boolean) => {
      const result = await updatePlaylist(playlistId, {
        isPublic: !currentIsPublic,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId ? { ...p, isPublic: !currentIsPublic } : p
          )
        );
      }
    },
    []
  );

  const handleDelete = useCallback(async (playlistId: string) => {
    const result = await deletePlaylist(playlistId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      toast.success("Playlist deleted");
    }
  }, []);

  if (!isLoaded) return null;

  return (
    <>
      <Section
        className="py-8"
        aria-label="Playlists"
        data-testid="playlist-section"
      >
        <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
          Playlists
        </h2>
        {playlists.length === 0 ? (
          <EmptyState
            variant="playlist-empty"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          <div className="stagger-grid grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {playlists.map((playlist) => (
              <PlaylistContextMenu
                key={playlist.id}
                playlistName={playlist.name}
                isPublic={playlist.isPublic}
                onRename={() =>
                  router.push(`/u/${username}/playlists/${playlist.id}`)
                }
                onToggleVisibility={() =>
                  handleToggleVisibility(playlist.id, playlist.isPublic)
                }
                onDelete={() => handleDelete(playlist.id)}
              >
                <PlaylistCard playlist={playlist} username={username} isOwner />
              </PlaylistContextMenu>
            ))}
          </div>
        )}
      </Section>

      <CreatePlaylistDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => {
          setShowCreate(false);
          refreshPlaylists();
        }}
      />
    </>
  );
}
