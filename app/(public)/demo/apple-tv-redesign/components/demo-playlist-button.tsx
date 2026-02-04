/**
 * Playlist button placeholder showing "Coming Soon" on click.
 */

"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DemoPlaylistButtonProps {
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Add to Playlist button that shows coming soon toast.
 */
export function DemoPlaylistButton({ className }: DemoPlaylistButtonProps) {
  const handleClick = () => {
    toast.info("Playlists coming soon", {
      description:
        "Create custom playlists that pull items from anywhere in your library.",
    });
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2",
        "h-12 rounded-full px-6",
        "bg-white/10 backdrop-blur-sm",
        "border border-white/20",
        "text-sm font-medium text-white",
        "transition-colors duration-150",
        "hover:bg-white/20",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none",
        className
      )}
    >
      <Plus className="size-4" aria-hidden="true" />
      <span>Add to Playlist</span>
    </button>
  );
}
