/**
 * Playlist button placeholder showing "Coming Soon" on click.
 */

"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { HeroButton } from "./hero-button";

interface PlaylistButtonProps {
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Add to Playlist button that shows coming soon toast.
 */
export function PlaylistButton({ className }: PlaylistButtonProps) {
  const handleClick = () => {
    toast.info("Playlists coming soon", {
      description:
        "Create custom playlists that pull items from anywhere in your library.",
    });
  };

  return (
    <HeroButton onClick={handleClick} className={className}>
      <Plus className="size-4" aria-hidden="true" />
      <span>Add to Playlist</span>
    </HeroButton>
  );
}
