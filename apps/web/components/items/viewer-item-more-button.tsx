"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsis,
  faCopy,
  faPlus,
  faCheck,
  faArrowRightToBracket,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slugify";
import { MENU_ITEM_CLASSES } from "./menu-styles";

const AddToPlaylistDialog = dynamic(
  () =>
    import("@/components/playlists/add-to-playlist-dialog").then((mod) => ({
      default: mod.AddToPlaylistDialog,
    })),
  { ssr: false }
);

export interface ViewerMenuActions {
  itemId: string;
  itemName: string;
  onFork?: () => void;
  showAddToPlaylist?: boolean;
  isForked?: boolean;
  isGuest?: boolean;
}

interface ViewerItemMoreButtonProps extends ViewerMenuActions {
  className?: string;
}

export function ViewerItemMoreButton({
  className,
  itemId,
  itemName,
  onFork,
  showAddToPlaylist = false,
  isForked = false,
  isGuest = false,
}: ViewerItemMoreButtonProps) {
  const router = useRouter();
  const [playlistOpen, setPlaylistOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More options"
            data-testid={`item-more-${slugify(itemName)}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex size-7 items-center justify-center",
              "rounded-md",
              "border border-white/[0.08] bg-white/[0.06]",
              "hover:border-white/[0.12] hover:bg-white/[0.12]",
              "hover:text-foreground text-[var(--tertiary-foreground)]",
              "transition-all duration-150",
              "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
              className
            )}
          >
            <FontAwesomeIcon
              icon={faEllipsis}
              className="size-4"
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          aria-label={`Actions for ${itemName}`}
          className={cn(
            "w-52",
            "bg-[var(--glass-bg)] backdrop-blur-xl",
            "border border-[var(--glass-border)]",
            "rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {showAddToPlaylist && (
            <DropdownMenuItem
              onClick={() => setPlaylistOpen(true)}
              className={MENU_ITEM_CLASSES}
            >
              <FontAwesomeIcon
                icon={faPlus}
                aria-hidden="true"
                className="size-4"
              />
              <span>Add to Playlist</span>
            </DropdownMenuItem>
          )}

          {!isGuest && !isForked && onFork && (
            <DropdownMenuItem onClick={onFork} className={MENU_ITEM_CLASSES}>
              <FontAwesomeIcon
                icon={faCopy}
                aria-hidden="true"
                className="size-4"
              />
              <span>Fork to Library</span>
            </DropdownMenuItem>
          )}

          {!isGuest && isForked && (
            <div
              className={cn(
                MENU_ITEM_CLASSES,
                "text-muted-foreground flex items-center"
              )}
              role="status"
            >
              <FontAwesomeIcon
                icon={faCheck}
                aria-hidden="true"
                className="size-4"
              />
              <span>In Your Library</span>
            </div>
          )}

          {isGuest && (
            <DropdownMenuItem
              onClick={() => router.push("/sign-in")}
              className={MENU_ITEM_CLASSES}
            >
              <FontAwesomeIcon
                icon={faArrowRightToBracket}
                aria-hidden="true"
                className="size-4"
              />
              <span>Sign in to Fork</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {playlistOpen && (
        <AddToPlaylistDialog
          open={playlistOpen}
          onOpenChange={setPlaylistOpen}
          itemId={itemId}
        />
      )}
    </>
  );
}
