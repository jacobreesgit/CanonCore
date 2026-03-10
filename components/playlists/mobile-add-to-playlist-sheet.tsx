/**
 * Mobile bottom sheet for adding an item to playlists.
 * Shows a searchable list of playlists with checkboxes indicating membership.
 * Follows existing mobile sheet patterns (MobileCreatePlaylistSheet, etc.).
 */

"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMusic,
  faPlus,
  faMagnifyingGlass,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import {
  MobileBottomSheet,
  MobileBottomSheetHeader,
  MobileBottomSheetTitle,
  MobileBottomSheetContent,
} from "@/components/mobile/mobile-bottom-sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getPlaylistsForItem,
  addItemToPlaylists,
  removeItemFromPlaylist,
} from "@/lib/playlist-actions";
import { toast } from "sonner";
import type { PlaylistMembership } from "@/lib/types";

export interface MobileAddToPlaylistSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
  /** The item ID to manage playlist membership for. */
  itemId: string;
  /** Callback to open the create playlist flow. */
  onCreatePlaylist?: () => void;
  /** Increment to trigger an explicit refetch of the playlist list. */
  playlistVersion?: number;
}

/**
 * Mobile bottom sheet for managing an item's playlist memberships.
 * Shows checkboxes for each playlist with optimistic toggle updates.
 * Includes search filtering and a button to create a new playlist.
 */
export function MobileAddToPlaylistSheet({
  open,
  onOpenChange,
  itemId,
  onCreatePlaylist,
  playlistVersion,
}: MobileAddToPlaylistSheetProps) {
  const [playlists, setPlaylists] = useState<PlaylistMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const loadPlaylists = useCallback(async () => {
    setIsLoading(true);
    const result = await getPlaylistsForItem(itemId);
    if (result.success && result.data) {
      setPlaylists(result.data);
    }
    setIsLoading(false);
  }, [itemId]);

  useEffect(() => {
    if (open) {
      setSearch("");
      loadPlaylists();
    }
  }, [open, loadPlaylists, playlistVersion]);

  const filtered = useMemo(() => {
    if (!search.trim()) return playlists;
    const q = search.toLowerCase();
    return playlists.filter((p) => p.name.toLowerCase().includes(q));
  }, [playlists, search]);

  const handleToggle = useCallback(
    async (playlistId: string, currentlyMember: boolean) => {
      // Optimistic update
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId ? { ...p, isMember: !currentlyMember } : p
        )
      );
      setTogglingIds((prev) => new Set(prev).add(playlistId));

      try {
        const result = currentlyMember
          ? await removeItemFromPlaylist(playlistId, itemId)
          : await addItemToPlaylists(itemId, [playlistId]);

        if (result.error) {
          setPlaylists((prev) =>
            prev.map((p) =>
              p.id === playlistId ? { ...p, isMember: currentlyMember } : p
            )
          );
          toast.error(result.error);
        }
      } catch {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlistId ? { ...p, isMember: currentlyMember } : p
          )
        );
        toast.error("Something went wrong");
      } finally {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(playlistId);
          return next;
        });
      }
    },
    [itemId]
  );

  return (
    <MobileBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[0.7]}
      repositionInputs
      title="Add to Playlist"
      description="Choose which playlists to include this item in"
      className={cn(
        "glass-dialog",
        "border-t border-white/[0.08]",
        "text-foreground"
      )}
      data-testid="sheet-add-to-playlist"
    >
      <MobileBottomSheetHeader>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              "bg-primary/10 ring-primary/20 ring-1"
            )}
          >
            <FontAwesomeIcon
              icon={faMusic}
              aria-hidden="true"
              className="text-primary size-5"
            />
          </div>
          <div className="min-w-0">
            <MobileBottomSheetTitle>Add to Playlist</MobileBottomSheetTitle>
            <p className="text-muted-foreground text-sm">
              Choose which playlists to include this item in.
            </p>
          </div>
        </div>
      </MobileBottomSheetHeader>

      <MobileBottomSheetContent>
        <div className="space-y-3">
          {/* Search input */}
          <div className="relative">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              aria-label="Search playlists"
              placeholder="Search playlists&#x2026;"
              value={search}
              onChange={(e) => startTransition(() => setSearch(e.target.value))}
              className="pl-9"
            />
          </div>

          {/* Playlist list */}
          <div className="max-h-[50vh] min-h-[120px] overflow-y-auto overscroll-y-contain">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <FontAwesomeIcon
                  icon={faSpinner}
                  spin
                  className="text-muted-foreground size-5"
                />
              </div>
            ) : playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <FontAwesomeIcon
                  icon={faMusic}
                  className="text-muted-foreground/50 size-8"
                />
                <p className="text-muted-foreground text-sm">
                  No playlists yet
                </p>
                {onCreatePlaylist && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCreatePlaylist}
                    data-testid="create-first-playlist"
                  >
                    <FontAwesomeIcon icon={faPlus} className="mr-1.5 size-4" />
                    Create your first playlist
                  </Button>
                )}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No playlists match &ldquo;{search}&rdquo;
                </p>
              </div>
            ) : (
              <div className="space-y-1" data-testid="playlist-list">
                {filtered.map((playlist) => (
                  <label
                    key={playlist.id}
                    className={cn(
                      "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-3 py-2",
                      "hover:bg-muted/50 transition-colors",
                      togglingIds.has(playlist.id) && "opacity-70"
                    )}
                  >
                    <Checkbox
                      checked={playlist.isMember}
                      onCheckedChange={() =>
                        handleToggle(playlist.id, playlist.isMember)
                      }
                      disabled={togglingIds.has(playlist.id)}
                    />
                    <span className="text-sm font-medium">{playlist.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Create new playlist button */}
          {playlists.length > 0 && onCreatePlaylist && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={onCreatePlaylist}
              data-testid="create-new-playlist"
            >
              <FontAwesomeIcon icon={faPlus} className="size-4" />
              Create new playlist
            </Button>
          )}
        </div>
      </MobileBottomSheetContent>
    </MobileBottomSheet>
  );
}
