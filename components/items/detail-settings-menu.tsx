/**
 * Settings gear menu for item detail pages.
 * Desktop: DropdownMenu anchored to hero button.
 * Mobile: MobileBottomSheet with touch-friendly action list.
 * Reuses renderMenuItems from item-context-menu for action consistency.
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faSpinner } from "@fortawesome/free-solid-svg-icons";
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
import { HeroButton } from "./hero-button";
import { renderMenuItems, type ItemMenuActions } from "./item-context-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { addItemToPlaylists } from "@/lib/playlist-actions";

const AddToPlaylistDialog = dynamic(
  () =>
    import("@/components/playlists/add-to-playlist-dialog").then((mod) => ({
      default: mod.AddToPlaylistDialog,
    })),
  { ssr: false }
);

const MobileAddToPlaylistSheet = dynamic(
  () =>
    import("@/components/playlists/mobile-add-to-playlist-sheet").then(
      (mod) => ({
        default: mod.MobileAddToPlaylistSheet,
      })
    ),
  { ssr: false }
);

const MobileCreatePlaylistSheet = dynamic(
  () =>
    import("@/components/playlists/mobile-create-playlist-sheet").then(
      (mod) => ({
        default: mod.MobileCreatePlaylistSheet,
      })
    ),
  { ssr: false }
);

const AddItemDialog = dynamic(
  () =>
    import("./add-item-dialog").then((mod) => ({
      default: mod.AddItemDialog,
    })),
  { ssr: false }
);

const MobileBottomSheet = dynamic(
  () =>
    import("@/components/mobile/mobile-bottom-sheet").then((mod) => ({
      default: mod.MobileBottomSheet,
    })),
  { ssr: false }
);

interface DetailSettingsMenuProps extends ItemMenuActions {
  className?: string;
}

/**
 * Settings gear button for item detail hero.
 * Opens DropdownMenu on desktop, MobileBottomSheet on mobile.
 * Contains the full item action menu; "Edit Item" opens the settings dialog.
 */
export function DetailSettingsMenu({
  className,
  ...actions
}: DetailSettingsMenuProps) {
  const {
    itemName,
    itemId,
    showAddToPlaylist = false,
    onDelete,
    onAddChild,
    onAddChildComplete,
    hasDriveConnection = false,
  } = actions;
  const isMobile = useIsMobile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [playlistVersion, setPlaylistVersion] = useState(0);

  async function handleDelete() {
    if (!onDelete) return;
    setIsLoading(true);
    try {
      await onDelete();
      setDeleteOpen(false);
    } finally {
      setIsLoading(false);
    }
  }

  // Shared delete confirmation dialog — rendered once, used by both branches
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
          <AlertDialogTitle>Delete Item</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Are you sure you want to delete &ldquo;{itemName}&rdquo;? This will
            also delete all child items. This action cannot be undone.
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
                  className="mr-2 size-4"
                  spin
                />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Mobile: bottom sheet with action buttons
  if (isMobile) {
    return (
      <>
        <HeroButton
          onClick={() => setSheetOpen(true)}
          aria-label="Settings"
          data-testid="detail-settings-button"
          className={className}
        >
          <FontAwesomeIcon icon={faGear} className="size-4" />
          Settings
        </HeroButton>

        {sheetOpen && (
          <MobileBottomSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title={`${itemName} actions`}
            data-testid="detail-settings-sheet"
          >
            <div className="flex flex-col gap-1 px-2 py-4">
              {renderMenuItems({
                actions,
                MenuItem: ({
                  onClick,
                  className: cls,
                  children,
                  "data-testid": testId,
                }) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSheetOpen(false);
                      onClick?.();
                    }}
                    className={cn(cls, "flex w-full items-center text-left")}
                    data-testid={testId}
                  >
                    {children}
                  </button>
                ),
                MenuSeparator: ({ className: cls }) => (
                  <div className={cn("my-1 h-px", cls)} />
                ),
                onDeleteClick: () => {
                  setSheetOpen(false);
                  setDeleteOpen(true);
                },
                onAddChildClick: () => {
                  setSheetOpen(false);
                  setAddChildOpen(true);
                },
                onPlaylistClick: showAddToPlaylist
                  ? () => {
                      setSheetOpen(false);
                      setPlaylistOpen(true);
                    }
                  : undefined,
              })}
            </div>
          </MobileBottomSheet>
        )}

        {deleteConfirmDialog}

        <AddItemDialog
          open={addChildOpen}
          onOpenChange={setAddChildOpen}
          onAdd={async (
            name,
            description,
            _tmdbSelection,
            visibilityOptions
          ) => {
            if (!onAddChild) return { error: "No handler" };
            return onAddChild(name, description, visibilityOptions);
          }}
          onComplete={onAddChildComplete}
          parentName={itemName}
          hasDriveConnection={hasDriveConnection}
        />

        {playlistOpen && itemId && (
          <MobileAddToPlaylistSheet
            open={playlistOpen}
            onOpenChange={setPlaylistOpen}
            itemId={itemId}
            onCreatePlaylist={() => setCreatePlaylistOpen(true)}
            playlistVersion={playlistVersion}
          />
        )}

        {createPlaylistOpen && (
          <MobileCreatePlaylistSheet
            open={createPlaylistOpen}
            onOpenChange={setCreatePlaylistOpen}
            onCreated={(playlist) => {
              setCreatePlaylistOpen(false);
              setPlaylistVersion((v) => v + 1);
              // Auto-add the current item to the newly created playlist
              // (matches desktop AddToPlaylistDialog.handleCreated behaviour)
              if (itemId) {
                addItemToPlaylists(itemId, [playlist.id]);
              }
            }}
          />
        )}
      </>
    );
  }

  // Desktop: dropdown menu
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <HeroButton
            aria-label="Settings"
            data-testid="detail-settings-button"
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
            "glass-menu",
            "border border-white/[0.08]",
            "rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          {renderMenuItems({
            actions,
            MenuItem: DropdownMenuItem,
            MenuSeparator: DropdownMenuSeparator,
            onDeleteClick: () => setDeleteOpen(true),
            onAddChildClick: () => setAddChildOpen(true),
            onPlaylistClick: showAddToPlaylist
              ? () => setPlaylistOpen(true)
              : undefined,
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {deleteConfirmDialog}

      <AddItemDialog
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onAdd={async (name, description, _tmdbSelection, visibilityOptions) => {
          if (!onAddChild) return { error: "No handler" };
          return onAddChild(name, description, visibilityOptions);
        }}
        onComplete={onAddChildComplete}
        parentName={itemName}
        hasDriveConnection={hasDriveConnection}
      />

      {playlistOpen && itemId && (
        <AddToPlaylistDialog
          open={playlistOpen}
          onOpenChange={setPlaylistOpen}
          itemId={itemId}
        />
      )}
    </>
  );
}
