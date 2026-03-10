/**
 * Settings gear menu for playlist detail pages.
 * Desktop: DropdownMenu. Mobile: MobileBottomSheet.
 * Shows Edit Playlist and Delete actions.
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear,
  faPencil,
  faTrashCan,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { HeroButton } from "@/components/items/hero-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { MENU_ITEM_CLASSES } from "@/components/items/menu-styles";

const MobileBottomSheet = dynamic(
  () =>
    import("@/components/mobile/mobile-bottom-sheet").then((mod) => ({
      default: mod.MobileBottomSheet,
    })),
  { ssr: false }
);

const DELETE_ITEM_CLASSES = cn(
  "gap-2 rounded-lg px-3 py-2",
  "text-sm",
  "text-red-400",
  "hover:bg-red-500/10 hover:text-red-300",
  "focus:bg-red-500/10 focus:text-red-300",
  "cursor-pointer"
);

interface PlaylistDetailSettingsMenuProps {
  playlistName: string;
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
  className?: string;
}

/**
 * Settings gear button for playlist detail hero.
 * Opens DropdownMenu on desktop, MobileBottomSheet on mobile.
 */
export function PlaylistDetailSettingsMenu({
  playlistName,
  onEdit,
  onDelete,
  className,
}: PlaylistDetailSettingsMenuProps) {
  const isMobile = useIsMobile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  async function handleDelete() {
    setIsLoading(true);
    try {
      await onDelete();
      setDeleteOpen(false);
    } finally {
      setIsLoading(false);
    }
  }

  const deleteConfirmDialog = (
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogContent
        className={cn(
          "glass-dialog",
          "border border-white/[0.08]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          "text-foreground"
        )}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Playlist</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Are you sure you want to delete &ldquo;{playlistName}&rdquo;? Items
            in this playlist will not be deleted. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isLoading}
            className={cn(
              "text-foreground border-white/20 bg-white/10",
              "hover:bg-white/20"
            )}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            {isLoading ? (
              <>
                <FontAwesomeIcon
                  icon={faSpinner}
                  spin
                  className="mr-2 size-4"
                />
                Deleting\u2026
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        <HeroButton
          onClick={() => setSheetOpen(true)}
          aria-label="Settings"
          data-testid="playlist-settings-button"
          className={className}
        >
          <FontAwesomeIcon icon={faGear} className="size-4" />
          Settings
        </HeroButton>

        {sheetOpen && (
          <MobileBottomSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title={`${playlistName} actions`}
            data-testid="playlist-settings-sheet"
          >
            <div className="flex flex-col gap-1 px-2 py-4">
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  onEdit();
                }}
                className={cn(
                  MENU_ITEM_CLASSES,
                  "flex w-full items-center text-left"
                )}
                data-testid="menu-edit-playlist"
              >
                <FontAwesomeIcon
                  icon={faPencil}
                  aria-hidden="true"
                  className="size-4"
                />
                <span>Edit Playlist</span>
              </button>
              <div className="my-1 h-px bg-white/[0.08]" />
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  setDeleteOpen(true);
                }}
                className={cn(
                  DELETE_ITEM_CLASSES,
                  "flex w-full items-center text-left"
                )}
                data-testid="menu-delete-playlist"
              >
                <FontAwesomeIcon
                  icon={faTrashCan}
                  aria-hidden="true"
                  className="size-4"
                />
                <span>Delete</span>
              </button>
            </div>
          </MobileBottomSheet>
        )}

        {deleteConfirmDialog}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <HeroButton
            aria-label="Settings"
            data-testid="playlist-settings-button"
            className={className}
          >
            <FontAwesomeIcon icon={faGear} className="size-4" />
            Settings
          </HeroButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={cn(
            "w-52",
            "bg-[#1a1a1a]/90 backdrop-blur-xl",
            "border border-white/[0.08]",
            "rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          <DropdownMenuItem
            onClick={onEdit}
            className={MENU_ITEM_CLASSES}
            data-testid="menu-edit-playlist"
          >
            <FontAwesomeIcon
              icon={faPencil}
              aria-hidden="true"
              className="size-4"
            />
            <span>Edit Playlist</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/[0.08]" />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className={DELETE_ITEM_CLASSES}
            data-testid="menu-delete-playlist"
          >
            <FontAwesomeIcon
              icon={faTrashCan}
              aria-hidden="true"
              className="size-4"
            />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {deleteConfirmDialog}
    </>
  );
}
