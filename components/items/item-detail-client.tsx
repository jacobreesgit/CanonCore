/**
 * Client-side wrapper for item detail pages (owner mode).
 * Uses CinematicHero for cinematic header and Contents/About tabs.
 * Manages shared state between ContentToolbar and ItemsView.
 */

"use client";

import {
  useState,
  useCallback,
  useTransition,
  useMemo,
  useEffect,
} from "react";
import dynamic from "next/dynamic";
import { Play, Plus, Settings2 } from "lucide-react";
import { ItemsView } from "./items-view";
import { EditModeToggle } from "./edit-mode-toggle";
import { ViewToggle } from "./view-toggle";
import { AboutTabContent } from "./about-tab-content";
import { CinematicHero } from "@/components/hero";
import { HeroButton } from "@/components/items/hero-button";
import { PlaylistButton } from "@/components/items/playlist-button";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { HeroContentLayout } from "@/components/ui/hero-content-layout";
import {
  ContentToolbar,
  ToolbarDivider,
} from "@/components/ui/content-toolbar";
import { Button } from "@/components/ui/button";
import { MediaOverlay } from "@/components/media/media-overlay";
import { updatePlaybackPosition } from "@/lib/item-file-actions";
import { getItemFiles } from "@/lib/item-file-actions";
import { useSyncHandler } from "@/hooks/use-sync-handler";
import type {
  ItemWithArtwork,
  SerializedItemFile,
  ItemProgress,
} from "@/lib/types";
import type { TmdbItemMetadata, TmdbItemDetails } from "@/lib/tmdb-client";
import type { TmdbDisplayOptions } from "@/lib/types";
import { useItemsSortFilter } from "@/hooks/use-items-sort-filter";
import { getItems } from "@/lib/item-actions";
import { useGoToItem } from "@/hooks/use-go-to-item";
import { formatProgressLabel } from "@/lib/progress-utils";

// Lazy-load settings dialog
const ItemSettingsDialog = dynamic(
  () =>
    import("./item-settings-dialog").then((mod) => ({
      default: mod.ItemSettingsDialog,
    })),
  { ssr: false }
);

/** Empty files state for initial dialog load */
const emptyFiles = {
  media: [] as SerializedItemFile[],
  artwork: [] as SerializedItemFile[],
  subtitles: [] as SerializedItemFile[],
};

interface CurrentUser {
  id: string;
  username: string | null;
  name: string | null;
}

interface ItemDetailClientProps {
  /** Current item being viewed. */
  item: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    inheritVisibility: boolean;
    parentId: string | null;
    childCount: number;
    tmdbId: number | null;
    tmdbType: string | null;
    tmdbShowTagline: boolean;
    tmdbShowMetadata: boolean;
    tmdbShowGenres: boolean;
    tmdbShowCast: boolean;
    tmdbShowProviders: boolean;
    tmdbShowVideos: boolean;
    tmdbShowRecommendations: boolean;
  };
  /** Child items to display. */
  childItems: ItemWithArtwork[];
  /** Optional files for display. */
  files?: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
  /** Primary artwork ID for hero background. */
  artworkId?: string | null;
  /** Progress data for this item (from server). */
  itemProgress?: ItemProgress | null;
  /** Whether user has Google Drive connected (shows Upload button). */
  hasDriveConnection?: boolean;
  /** Current user info for owner display in grid items. */
  currentUser?: CurrentUser | null;
  /** Open settings dialog on mount (from URL query param). */
  defaultSettingsOpen?: boolean;
  /** TMDB metadata for hero display. */
  tmdbMetadata?: TmdbItemMetadata | null;
  /** TMDB details for About tab (cast, providers, videos, recommendations). */
  tmdbDetails?: TmdbItemDetails | null;
  /** Per-item TMDB display preferences. */
  tmdbDisplayOptions?: TmdbDisplayOptions | null;
}

/**
 * Client wrapper for item detail page with CinematicHero and Contents/About tabs.
 * Manages edit mode, add item dialog, settings dialog, and sync state.
 */
export function ItemDetailClient({
  item,
  childItems: initialChildItems,
  files,
  artworkId,
  itemProgress,
  hasDriveConnection = false,
  currentUser,
  defaultSettingsOpen = false,
  tmdbMetadata,
  tmdbDetails,
  tmdbDisplayOptions,
}: ItemDetailClientProps) {
  const [isPending, startTransition] = useTransition();
  const [childItems, setChildItems] = useState(initialChildItems);
  const [isEditing, setIsEditing] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [playingFile, setPlayingFile] = useState<SerializedItemFile | null>(
    null
  );

  // Settings dialog state (absorbed from ItemsToolbar)
  const [settingsOpen, setSettingsOpen] = useState(defaultSettingsOpen);
  const [settingsFiles, setSettingsFiles] = useState(emptyFiles);

  // Sort/filter state (persisted to localStorage)
  const { sortBy, setSortBy, filterBy, setFilterBy } = useItemsSortFilter();

  // Sync with post-sync item refresh
  const handleSyncSuccess = useCallback(() => {
    startTransition(async () => {
      const itemsResult = await getItems(item.id);
      if (itemsResult.success && itemsResult.data) {
        setChildItems(itemsResult.data);
      }
    });
  }, [item.id]);
  const { isSyncing, handleSync } = useSyncHandler({
    onSuccess: handleSyncSuccess,
  });

  // First incomplete item for "Go to" button
  const { nextItem, goToNext } = useGoToItem({
    parentId: item.id,
    username: currentUser?.username,
  });

  // Fetch files on mount when settings dialog should be open by default
  useEffect(() => {
    if (!defaultSettingsOpen) return;
    let stale = false;
    getItemFiles(item.id).then((result) => {
      if (!stale && result.success && result.data) {
        setSettingsFiles(result.data);
      }
    });
    return () => {
      stale = true;
    };
  }, [defaultSettingsOpen, item.id]);

  // Resolve hero artwork using fallback chain: isHero -> isPrimary -> first
  const heroArtworkId = useMemo(() => {
    if (!files) return artworkId ?? null;
    const artwork = files.artwork;
    if (artwork.length === 0) return null;
    let heroFile: (typeof artwork)[0] | undefined;
    let primaryFile: (typeof artwork)[0] | undefined;
    for (const f of artwork) {
      if (f.isHero) {
        heroFile = f;
        break;
      }
      if (f.isPrimary && !primaryFile) primaryFile = f;
    }
    return heroFile?.id ?? primaryFile?.id ?? artwork[0]?.id ?? null;
  }, [files, artworkId]);

  const hasChildren = childItems.length > 0;
  const hasMedia = files && files.media.length > 0;
  const hasTmdb = !!item.tmdbId;
  const isTV = item.tmdbType === "tv";

  // Check if any media has progress
  const hasProgress =
    hasMedia &&
    files.media.some((f) => f.playbackPosition && f.playbackPosition > 0);

  // Get primary media file for play button
  const primaryMedia = hasMedia
    ? files.media.find((f) => f.isPrimary) || files.media[0]
    : null;

  // Progress data for hero
  const progressPercentage = itemProgress?.percentage ?? undefined;
  const progressLabel = itemProgress
    ? (formatProgressLabel(itemProgress) ?? undefined)
    : undefined;

  // Disable edit mode when not using custom sort
  const isCustomSort = sortBy === "custom";

  /**
   * Opens settings dialog and fetches files.
   */
  const handleOpenSettings = useCallback(async () => {
    setSettingsOpen(true);
    const result = await getItemFiles(item.id);
    if (result.success && result.data) {
      setSettingsFiles(result.data);
    }
  }, [item.id]);

  /**
   * Refreshes files and child items after settings change.
   */
  const handleSettingsChange = useCallback(async () => {
    const [filesResult, itemsResult] = await Promise.all([
      getItemFiles(item.id),
      getItems(item.id),
    ]);
    if (filesResult.success && filesResult.data) {
      setSettingsFiles(filesResult.data);
    }
    if (itemsResult.success && itemsResult.data) {
      setChildItems(itemsResult.data);
    }
  }, [item.id]);

  /**
   * Handles play button click from hero.
   */
  const handlePlay = useCallback(() => {
    if (primaryMedia) {
      setPlayingFile(primaryMedia);
    }
  }, [primaryMedia]);

  /**
   * Handles playback position updates from media player.
   */
  const handlePositionUpdate = useCallback(
    async (fileId: string, position: number, duration: number | null) => {
      await updatePlaybackPosition(fileId, position, duration);
    },
    []
  );

  // Owner hero action buttons
  const ownerActions = (
    <>
      {hasMedia && (
        <HeroButton
          variant="primary"
          onClick={handlePlay}
          data-testid="hero-play-button"
        >
          <Play className="size-4" />
          {hasProgress ? `Resume ${primaryMedia?.filename ?? ""}` : "Play"}
        </HeroButton>
      )}
      {nextItem && (
        <HeroButton
          onClick={() => goToNext(nextItem)}
          data-testid="hero-goto-button"
        >
          Next Up: {nextItem.name}
        </HeroButton>
      )}
      {/* Playlist (placeholder feature) */}
      <PlaylistButton />
    </>
  );

  // Settings item data for dialog
  const settingsItem = {
    id: item.id,
    name: item.name,
    description: item.description,
    isPublic: item.isPublic,
    inheritVisibility: item.inheritVisibility,
    hasParent: item.parentId !== null,
    hasChildren: item.childCount > 0,
    tmdbId: item.tmdbId,
    tmdbShowTagline: item.tmdbShowTagline,
    tmdbShowMetadata: item.tmdbShowMetadata,
    tmdbShowGenres: item.tmdbShowGenres,
    tmdbShowCast: item.tmdbShowCast,
    tmdbShowProviders: item.tmdbShowProviders,
    tmdbShowVideos: item.tmdbShowVideos,
    tmdbShowRecommendations: item.tmdbShowRecommendations,
  };

  // Contents tab toolbar left actions (view toggle)
  const contentsLeftActions = <ViewToggle disabled={!hasChildren} />;

  // Settings button (shared between Contents and About toolbars)
  const settingsButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleOpenSettings}
      className="gap-1.5"
      aria-label="Settings"
    >
      <Settings2 className="size-4" />
      <span className="hidden sm:inline">Settings</span>
    </Button>
  );

  // Contents tab toolbar right actions
  const contentsActions = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAddItemOpen(true)}
        className="gap-1.5"
        aria-label="Add"
      >
        <Plus className="size-4" strokeWidth={2} />
        <span className="hidden sm:inline">Add</span>
      </Button>
      <EditModeToggle
        isEditing={isEditing}
        onToggle={() => setIsEditing((prev) => !prev)}
        disabled={!hasChildren || !isCustomSort}
        disabledReason={
          !hasChildren
            ? "No items to edit"
            : !isCustomSort
              ? "Set sort to Custom Order to reorder"
              : undefined
        }
      />
      <ToolbarDivider />
      {settingsButton}
    </>
  );

  // Contents tab content (toolbar + items view)
  const contentsContent = (
    <>
      <ContentToolbar
        sortBy={sortBy}
        onSortChange={setSortBy}
        filterBy={filterBy}
        onFilterChange={setFilterBy}
        showSync
        isSyncing={isSyncing}
        onSync={handleSync}
        hasDriveConnection={hasDriveConnection}
        disabled={!hasChildren}
        leftActions={contentsLeftActions}
        actions={contentsActions}
      />
      <ItemsView
        items={childItems}
        parentId={item.id}
        hideToolbar
        isEditing={isEditing}
        onEditingChange={setIsEditing}
        addItemOpen={addItemOpen}
        onAddItemOpenChange={setAddItemOpen}
        sortBy={sortBy}
        onSortChange={setSortBy}
        filterBy={filterBy}
        onFilterChange={setFilterBy}
        onItemsChange={setChildItems}
        hasDriveConnection={hasDriveConnection}
        currentUser={currentUser}
      />
    </>
  );

  // About tab content (shared component with internal filter state)
  const aboutContent = (
    <AboutTabContent
      description={item.description}
      tmdbDetails={tmdbDetails}
      tmdbDisplayOptions={tmdbDisplayOptions}
      isTV={isTV}
      actions={settingsButton}
    />
  );

  // Show tabs when there are children or TMDB data
  const showTabs = hasChildren || hasTmdb;

  // Hero element
  const hero = (
    <CinematicHero
      slides={[
        {
          id: item.id,
          name: item.name,
          artworkId: heroArtworkId,
          tagline:
            tmdbDisplayOptions?.showTagline !== false
              ? tmdbMetadata?.tagline
              : undefined,
          description: item.description ?? undefined,
          metadata:
            tmdbDisplayOptions?.showMetadata !== false && tmdbMetadata
              ? {
                  year: tmdbMetadata.year,
                  runtime: tmdbMetadata.runtime,
                  contentRating: tmdbMetadata.contentRating,
                  voteAverage: tmdbMetadata.voteAverage,
                }
              : undefined,
          genres:
            tmdbDisplayOptions?.showGenres !== false &&
            tmdbMetadata?.genres?.length
              ? tmdbMetadata.genres
              : undefined,
          progress: progressPercentage,
          progressLabel,
        },
      ]}
      headingLevel="h1"
      actions={ownerActions}
    />
  );

  return (
    <HeroContentLayout hero={hero} isPending={isPending}>
      {/* Tabbed content or direct toolbar */}
      {showTabs ? (
        <UnderlineTabs
          defaultTab={hasChildren ? "contents" : "about"}
          tabs={[
            {
              id: "contents",
              label: "Contents",
              content: contentsContent,
            },
            { id: "about", label: "About", content: aboutContent },
          ]}
        />
      ) : (
        contentsContent
      )}

      {/* Item Settings Dialog */}
      {settingsOpen && (
        <ItemSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          item={settingsItem}
          files={settingsFiles}
          hasDriveConnection={hasDriveConnection}
          onSettingsChange={handleSettingsChange}
        />
      )}

      {/* Media player overlay */}
      {playingFile && files && (
        <MediaOverlay
          file={playingFile}
          subtitles={files.subtitles}
          posterUrl={
            heroArtworkId ? `/api/artwork/${heroArtworkId}` : undefined
          }
          onClose={() => setPlayingFile(null)}
          onPositionUpdate={handlePositionUpdate}
        />
      )}
    </HeroContentLayout>
  );
}
