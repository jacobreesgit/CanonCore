"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faPlus,
  faCheck,
  faArrowRightToBracket,
} from "@fortawesome/free-solid-svg-icons";
import { MENU_ITEM_CLASSES } from "./menu-styles";
import { cn } from "@/lib/utils";

const AddToPlaylistDialog = dynamic(
  () =>
    import("@/components/playlists/add-to-playlist-dialog").then((mod) => ({
      default: mod.AddToPlaylistDialog,
    })),
  { ssr: false }
);

interface ViewerItemContextMenuProps {
  children: ReactNode;
  itemId: string;
  itemName: string;
  /** Called when user clicks "Fork to Library". */
  onFork?: () => void;
  /** Whether to show the "Add to Playlist" option (authenticated users only). */
  showAddToPlaylist?: boolean;
  /** Whether this item has already been forked by the current user. */
  isForked?: boolean;
  /** Whether the viewer is a guest (not logged in). */
  isGuest?: boolean;
}

export function ViewerItemContextMenu({
  children,
  itemId,
  itemName,
  onFork,
  showAddToPlaylist = false,
  isForked = false,
  isGuest = false,
}: ViewerItemContextMenuProps) {
  const router = useRouter();
  const [playlistOpen, setPlaylistOpen] = useState(false);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent
          aria-label={`Actions for ${itemName}`}
          className={cn(
            "w-52",
            "bg-[var(--glass-bg)] backdrop-blur-xl",
            "border border-[var(--glass-border)]",
            "rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          {showAddToPlaylist && (
            <ContextMenuItem
              onClick={() => setPlaylistOpen(true)}
              className={MENU_ITEM_CLASSES}
            >
              <FontAwesomeIcon
                icon={faPlus}
                aria-hidden="true"
                className="size-4"
              />
              <span>Add to Playlist</span>
            </ContextMenuItem>
          )}

          {!isGuest && !isForked && onFork && (
            <ContextMenuItem onClick={onFork} className={MENU_ITEM_CLASSES}>
              <FontAwesomeIcon
                icon={faCopy}
                aria-hidden="true"
                className="size-4"
              />
              <span>Fork to Library</span>
            </ContextMenuItem>
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
            <ContextMenuItem
              onClick={() => router.push("/sign-in")}
              className={MENU_ITEM_CLASSES}
            >
              <FontAwesomeIcon
                icon={faArrowRightToBracket}
                aria-hidden="true"
                className="size-4"
              />
              <span>Sign in to Fork</span>
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

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
