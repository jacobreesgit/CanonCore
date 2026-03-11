/**
 * Settings gear menu for viewer item detail pages.
 * Desktop: DropdownMenu. Mobile: MobileBottomSheet.
 * Shows fork, add-to-playlist, and sign-in actions.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear,
  faCopy,
  faPlus,
  faCheck,
  faArrowRightToBracket,
} from "@fortawesome/free-solid-svg-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HeroButton } from "./hero-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { MENU_ITEM_CLASSES } from "./menu-styles";

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

const MobileBottomSheet = dynamic(
  () =>
    import("@/components/mobile/mobile-bottom-sheet").then((mod) => ({
      default: mod.MobileBottomSheet,
    })),
  { ssr: false }
);

/** Viewer action props — mirrors ViewerItemMoreButton interface. */
export interface ViewerMenuActions {
  itemId: string;
  itemName: string;
  onFork?: () => void;
  showAddToPlaylist?: boolean;
  isForked?: boolean;
  isGuest?: boolean;
}

interface ViewerDetailSettingsMenuProps extends ViewerMenuActions {
  className?: string;
}

/**
 * Settings gear button for viewer item detail hero.
 * Opens DropdownMenu on desktop, MobileBottomSheet on mobile.
 */
export function ViewerDetailSettingsMenu({
  className,
  itemId,
  itemName,
  onFork,
  showAddToPlaylist = false,
  isForked = false,
  isGuest = false,
}: ViewerDetailSettingsMenuProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  /** Shared action definitions used by both desktop and mobile renders. */
  const actions = {
    addToPlaylist: showAddToPlaylist
      ? {
          icon: faPlus,
          label: "Add to Playlist",
          testId: "menu-add-to-playlist",
          onClick: () => setPlaylistOpen(true),
        }
      : null,
    fork:
      !isGuest && !isForked && onFork
        ? {
            icon: faCopy,
            label: "Fork to Library",
            testId: "menu-fork",
            onClick: onFork,
          }
        : null,
    inLibrary:
      !isGuest && isForked
        ? { icon: faCheck, label: "In Your Library", testId: "menu-in-library" }
        : null,
    signIn: isGuest
      ? {
          icon: faArrowRightToBracket,
          label: "Sign in to Fork",
          testId: "menu-sign-in",
          onClick: () => router.push("/sign-in"),
        }
      : null,
  };

  if (isMobile) {
    const mobileBtn = (
      item: {
        icon: typeof faGear;
        label: string;
        testId: string;
        onClick?: () => void;
      },
      disabled?: boolean
    ) => (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setSheetOpen(false);
          item.onClick?.();
        }}
        className={cn(
          MENU_ITEM_CLASSES,
          "flex w-full items-center text-left",
          disabled && "text-muted-foreground"
        )}
        data-testid={item.testId}
      >
        <FontAwesomeIcon
          icon={item.icon}
          aria-hidden="true"
          className="size-4"
        />
        <span>{item.label}</span>
      </button>
    );

    return (
      <>
        <HeroButton
          onClick={() => setSheetOpen(true)}
          aria-label="Settings"
          data-testid="viewer-detail-settings-button"
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
            data-testid="viewer-detail-settings-sheet"
          >
            <div className="flex flex-col gap-1 px-2 py-4">
              {actions.addToPlaylist && mobileBtn(actions.addToPlaylist)}
              {actions.fork && mobileBtn(actions.fork)}
              {actions.inLibrary && mobileBtn(actions.inLibrary, true)}
              {actions.signIn && mobileBtn(actions.signIn)}
            </div>
          </MobileBottomSheet>
        )}

        {playlistOpen && (
          <MobileAddToPlaylistSheet
            open={playlistOpen}
            onOpenChange={setPlaylistOpen}
            itemId={itemId}
          />
        )}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <HeroButton
            aria-label="Settings"
            data-testid="viewer-detail-settings-button"
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
          {actions.addToPlaylist && (
            <DropdownMenuItem
              onClick={actions.addToPlaylist.onClick}
              className={MENU_ITEM_CLASSES}
              data-testid="menu-add-to-playlist"
            >
              <FontAwesomeIcon
                icon={faPlus}
                aria-hidden="true"
                className="size-4"
              />
              <span>Add to Playlist</span>
            </DropdownMenuItem>
          )}
          {actions.fork && (
            <DropdownMenuItem
              onClick={actions.fork.onClick}
              className={MENU_ITEM_CLASSES}
              data-testid="menu-fork"
            >
              <FontAwesomeIcon
                icon={faCopy}
                aria-hidden="true"
                className="size-4"
              />
              <span>Fork to Library</span>
            </DropdownMenuItem>
          )}
          {actions.inLibrary && (
            <DropdownMenuItem
              disabled
              className={cn(MENU_ITEM_CLASSES, "text-muted-foreground")}
              data-testid="menu-in-library"
            >
              <FontAwesomeIcon
                icon={faCheck}
                aria-hidden="true"
                className="size-4"
              />
              <span>In Your Library</span>
            </DropdownMenuItem>
          )}
          {actions.signIn && (
            <DropdownMenuItem
              onClick={actions.signIn.onClick}
              className={MENU_ITEM_CLASSES}
              data-testid="menu-sign-in"
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
