/**
 * Dialog for adding an item to playlists.
 * Shows a searchable list of playlists with checkboxes indicating membership.
 * Supports optimistic updates and inline playlist creation.
 */

"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import { ListMusic, Plus, Search, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { AnimatedDialogContent } from "@/components/ui/animated-dialog-content";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getPlaylistsForItem,
  addItemToPlaylists,
  removeItemFromPlaylist,
} from "@/lib/playlist-actions";
import { CreatePlaylistDialog } from "./create-playlist-dialog";
import { toast } from "sonner";
import type { PlaylistMembership } from "@/lib/types";

interface AddToPlaylistDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when dialog open state changes. */
  onOpenChange: (open: boolean) => void;
  /** The item ID to manage playlist membership for. */
  itemId: string;
}

/**
 * Modal dialog for managing an item's playlist memberships.
 * Shows checkboxes for each playlist with optimistic toggle updates.
 * Includes search filtering and inline playlist creation.
 *
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback when dialog open state changes
 * @param itemId - The item to manage playlist membership for
 */
export function AddToPlaylistDialog({
  open,
  onOpenChange,
  itemId,
}: AddToPlaylistDialogProps) {
  const [playlists, setPlaylists] = useState<PlaylistMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
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
  }, [open, loadPlaylists]);

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
          // Revert optimistic update
          setPlaylists((prev) =>
            prev.map((p) =>
              p.id === playlistId ? { ...p, isMember: currentlyMember } : p
            )
          );
          toast.error(result.error);
        }
      } catch {
        // Revert on network error
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

  const handleCreated = useCallback(
    (playlist: { id: string; name: string }) => {
      setShowCreate(false);
      // Add new playlist as a member and re-add to list
      setPlaylists((prev) => [
        ...prev,
        { id: playlist.id, name: playlist.name, isMember: true },
      ]);
      // Also add the item to the newly created playlist
      addItemToPlaylists(itemId, [playlist.id]).catch(() => {
        toast.error("Failed to add item to new playlist");
      });
    },
    [itemId]
  );

  const header = (
    <DialogHeader>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            "bg-primary/10 ring-primary/20 ring-1"
          )}
        >
          <ListMusic aria-hidden="true" className="text-primary size-5" />
        </div>
        <div className="min-w-0">
          <DialogTitle className="text-lg">Add to Playlist</DialogTitle>
          <DialogDescription className="text-sm">
            Choose which playlists to include this item in.
          </DialogDescription>
        </div>
      </div>
    </DialogHeader>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <AnimatedDialogContent
          data-testid="dialog-add-to-playlist"
          stepKey="playlist-list"
          className="sm:max-w-md"
          header={header}
        >
          <div className="space-y-3 py-2">
            {/* Search input */}
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                aria-label="Search playlists"
                data-testid="playlist-search-input"
                placeholder="Search playlists..."
                value={search}
                onChange={(e) =>
                  startTransition(() => setSearch(e.target.value))
                }
                className="pl-9"
              />
            </div>

            {/* Playlist list */}
            <div
              className="max-h-[300px] min-h-[120px] overflow-y-auto"
              data-testid="playlist-list"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                </div>
              ) : playlists.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <ListMusic className="text-muted-foreground/50 size-8" />
                  <p className="text-muted-foreground text-sm">
                    No playlists yet
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreate(true)}
                    data-testid="create-first-playlist"
                  >
                    <Plus className="mr-1.5 size-4" />
                    Create your first playlist
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
                  <p className="text-muted-foreground text-sm">
                    No playlists match &ldquo;{search}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((playlist) => (
                    <label
                      key={playlist.id}
                      data-testid={`playlist-item-${playlist.id}`}
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
                        data-testid={`playlist-checkbox-${playlist.id}`}
                      />
                      <span className="text-sm font-medium">
                        {playlist.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Create new playlist button */}
            {playlists.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setShowCreate(true)}
                data-testid="create-new-playlist"
              >
                <Plus className="size-4" />
                Create new playlist
              </Button>
            )}
          </div>
        </AnimatedDialogContent>
      </Dialog>

      <CreatePlaylistDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
      />
    </>
  );
}
