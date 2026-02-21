/**
 * Add to Playlist button that opens the playlist management dialog.
 * Preloads dialog on hover/focus for reduced perceived latency.
 */

"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { HeroButton } from "./hero-button";

const AddToPlaylistDialog = dynamic(
  () =>
    import("@/components/playlists/add-to-playlist-dialog").then((mod) => ({
      default: mod.AddToPlaylistDialog,
    })),
  { ssr: false }
);

interface PlaylistButtonProps {
  /** The item ID to manage playlist membership for. */
  itemId: string;
  /** Additional CSS classes. */
  className?: string;
}

/** Preload the dialog module on intent. */
function preloadDialog() {
  void import("@/components/playlists/add-to-playlist-dialog");
}

/**
 * Pill-shaped hero button that opens the Add to Playlist dialog.
 * Lazy-loads the dialog and preloads on hover/focus for snappy UX.
 *
 * @param itemId - The item to manage playlist membership for
 * @param className - Additional CSS classes
 */
export function PlaylistButton({ itemId, className }: PlaylistButtonProps) {
  const [open, setOpen] = useState(false);

  const handleClick = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <>
      <span onMouseEnter={preloadDialog} onFocus={preloadDialog}>
        <HeroButton
          onClick={handleClick}
          className={className}
          data-testid="playlist-button"
        >
          <FontAwesomeIcon
            icon={faPlus}
            className="size-4"
            aria-hidden="true"
          />
          <span>Add to Playlist</span>
        </HeroButton>
      </span>

      {open && (
        <AddToPlaylistDialog
          open={open}
          onOpenChange={setOpen}
          itemId={itemId}
        />
      )}
    </>
  );
}
