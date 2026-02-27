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
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPlus,
  faGears,
  faForwardStep,
  faCircleCheck,
  faCircle,
} from "@fortawesome/free-solid-svg-icons";
import { ItemsView } from "./items-view";
import { EditModeToggle } from "./edit-mode-toggle";
import { useItemsUrlState } from "@/hooks/use-items-url-state";
import { AboutTabContent } from "./about-tab-content";
import { CinematicHero } from "@/components/hero";
import { HeroButton } from "@/components/items/hero-button";
import { PlaylistButton } from "@/components/items/playlist-button";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { HeroContentLayout } from "@/components/ui/hero-content-layout";

// Lazy-load swipeable tabs (mobile-only, keeps Embla out of desktop bundle)
const SwipeableUnderlineTabs = dynamic(
  () =>
    import("@/components/ui/swipeable-underline-tabs").then((mod) => ({
      default: mod.SwipeableUnderlineTabs,
    })),
  { ssr: false }
);
import { ContentToolbar } from "@/components/ui/content-toolbar";
import { Button } from "@/components/ui/button";
import { MediaOverlay } from "@/components/media/media-overlay";
import { updatePlaybackPosition } from "@/lib/item-file-actions";
import { getItemFiles } from "@/lib/item-file-actions";
import { markAsWatched, markAsUnwatched } from "@/lib/watch-actions";
import { useSyncHandler } from "@/hooks/use-sync-handler";
import type {
  ItemWithArtwork,
  SerializedItemFile,
  ItemProgress,
} from "@/lib/types";
import type { TmdbItemMetadata, TmdbItemDetails } from "@/lib/tmdb-client";
import type { TmdbDisplayOptions, SyncStatus } from "@/lib/types";
import { getItems } from "@/lib/item-actions";
import { useGoToItem } from "@/hooks/use-go-to-item";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatProgressLabel } from "@/lib/progress-utils";
import {
  getTmdbBackdropUrl,
  getTmdbPosterUrl,
  getTmdbLogoUrl,
} from "@/lib/tmdb-image-utils";
// Lazy-load MobileItemSheet (mobile-only, heavy with Framer Motion)
const MobileItemSheet = dynamic(
  () =>
    import("@/components/items/mobile-item-sheet").then((mod) => ({
      default: mod.MobileItemSheet,
    })),
  { ssr: false }
);

// Lazy-load settings dialog
const ItemSettingsDialog = dynamic(
  () =>
    import("./item-settings-dialog").then((mod) => ({
      default: mod.ItemSettingsDialog,
    })),
  { ssr: false }
);

/** No-op subscribe for useSyncExternalStore (value never changes) */
const emptySubscribe = () => () => {};

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
    tmdbPosterPath: string | null;
    tmdbBackdropPath: string | null;
    tmdbLogoPath: string | null;
    tmdbShowTagline: boolean;
    tmdbShowMetadata: boolean;
    tmdbShowGenres: boolean;
    tmdbShowCast: boolean;
    tmdbShowProviders: boolean;
    tmdbShowVideos: boolean;
    tmdbShowRecommendations: boolean;
    dominantColour?: string | null;
    syncStatus?: SyncStatus;
    driveFileId?: string | null;
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
  /** Initial watch status from server (avoids client waterfall). */
  initialWatchStatus?: {
    isWatched: boolean;
    playCount: number;
  };
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
  initialWatchStatus,
}: ItemDetailClientProps) {
  const [isPending, startTransition] = useTransition();
  const [childItems, setChildItems] = useState(initialChildItems);
  const [watchStatus, setWatchStatus] = useState(
    initialWatchStatus ?? { isWatched: false, playCount: 0 }
  );
  const [isWatchPending, startWatchTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [playingFile, setPlayingFile] = useState<SerializedItemFile | null>(
    null
  );

  // Viewport detection for portal-based components (dialogs render to <body>,
  // bypassing CSS hidden wrappers — must use JS to prevent dual portals)
  const isMobile = useIsMobile();

  // Delay tab component rendering until after mount so isMobile is accurate.
  // Prevents UnderlineTabs → SwipeableUnderlineTabs swap that causes focus loss.
  const tabsMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Settings dialog state — route to correct surface based on viewport at init
  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (!defaultSettingsOpen) return false;
    if (typeof window !== "undefined" && window.innerWidth < 1024) return false;
    return true;
  });
  const [settingsFiles, setSettingsFiles] = useState(emptyFiles);

  // Mobile sheet open state (separate from desktop dialog)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(() => {
    if (!defaultSettingsOpen) return false;
    if (typeof window !== "undefined" && window.innerWidth < 1024) return true;
    return false;
  });

  // Sort/filter/view state (URL + localStorage backup)
  const {
    sortBy,
    setSortBy,
    filters,
    toggleFilter,
    clearFilters,
    viewMode,
    setViewMode,
    tab,
    setTab,
    isCustomSort,
  } = useItemsUrlState();

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

  // Resolve logo image: manual upload > TMDB logo > text title fallback
  const logoImage = useMemo(() => {
    const logoArtwork = files?.artwork.find((f) => f.isLogo);
    if (logoArtwork) return `/api/artwork/${logoArtwork.id}`;
    if (item.tmdbLogoPath) return getTmdbLogoUrl(item.tmdbLogoPath);
    return undefined;
  }, [files, item.tmdbLogoPath]);

  const hasChildren = childItems.length > 0;
  const hasMedia = files && files.media.length > 0;
  const hasTmdb = !!item.tmdbId;

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

  // isCustomSort comes from useItemsUrlState

  /**
   * Opens settings dialog (desktop) or mobile sheet based on viewport.
   */
  const handleOpenSettings = useCallback(async () => {
    if (isMobile) {
      setMobileSheetOpen(true);
    } else {
      setSettingsOpen(true);
    }
    const result = await getItemFiles(item.id);
    if (result.success && result.data) {
      setSettingsFiles(result.data);
    }
  }, [isMobile, item.id]);

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

  const handleWatch = useCallback(() => {
    setWatchStatus((prev) => ({
      isWatched: true,
      playCount: prev.playCount + 1,
    }));
    startWatchTransition(async () => {
      const result = await markAsWatched(item.id);
      if (!result.success) {
        // Revert optimistic update
        setWatchStatus((prev) => ({
          isWatched: prev.playCount > 1,
          playCount: Math.max(0, prev.playCount - 1),
        }));
      }
    });
  }, [item.id, startWatchTransition]);

  const handleUnwatch = useCallback(() => {
    setWatchStatus((prev) => ({
      isWatched: prev.playCount > 1,
      playCount: Math.max(0, prev.playCount - 1),
    }));
    startWatchTransition(async () => {
      const result = await markAsUnwatched(item.id);
      if (!result.success) {
        // Revert optimistic update
        setWatchStatus((prev) => ({
          isWatched: true,
          playCount: prev.playCount + 1,
        }));
      }
    });
  }, [item.id, startWatchTransition]);

  // Owner hero action buttons
  const ownerActions = (
    <>
      {hasMedia && (
        <HeroButton variant="primary" onClick={handlePlay}>
          <FontAwesomeIcon icon={faPlay} className="size-4" />
          {hasProgress ? `Resume ${primaryMedia?.filename ?? ""}` : "Play"}
        </HeroButton>
      )}
      {nextItem && (
        <HeroButton variant="primary" onClick={() => goToNext(nextItem)}>
          <FontAwesomeIcon icon={faForwardStep} className="size-4" />
          Next Up: {nextItem.name}
        </HeroButton>
      )}
      <PlaylistButton itemId={item.id} />
      {watchStatus.isWatched ? (
        <HeroButton
          onClick={handleUnwatch}
          disabled={isWatchPending}
          aria-label="Watched"
          aria-pressed="true"
        >
          <FontAwesomeIcon icon={faCircleCheck} className="size-4" />
          Watched
        </HeroButton>
      ) : (
        <HeroButton
          onClick={handleWatch}
          disabled={isWatchPending}
          aria-label="Mark Watched"
          aria-pressed="false"
        >
          <FontAwesomeIcon icon={faCircle} className="size-4" />
          Mark Watched
        </HeroButton>
      )}
      <HeroButton onClick={handleOpenSettings} aria-label="Settings">
        <FontAwesomeIcon icon={faGears} className="size-4" />
        Settings
      </HeroButton>
    </>
  );

  // Settings item data for dialog (memoized to avoid re-creating on every render)
  const settingsItem = useMemo(
    () => ({
      id: item.id,
      name: item.name,
      description: item.description,
      isPublic: item.isPublic,
      inheritVisibility: item.inheritVisibility,
      hasParent: item.parentId !== null,
      hasChildren: item.childCount > 0,
      tmdbId: item.tmdbId,
      tmdbType: item.tmdbType,
      tmdbPosterPath: item.tmdbPosterPath,
      tmdbBackdropPath: item.tmdbBackdropPath,
      tmdbLogoPath: item.tmdbLogoPath,
      tmdbShowTagline: item.tmdbShowTagline,
      tmdbShowMetadata: item.tmdbShowMetadata,
      tmdbShowGenres: item.tmdbShowGenres,
      tmdbShowCast: item.tmdbShowCast,
      tmdbShowProviders: item.tmdbShowProviders,
      tmdbShowVideos: item.tmdbShowVideos,
      tmdbShowRecommendations: item.tmdbShowRecommendations,
    }),
    [item]
  );

  // viewMode comes from useItemsUrlState

  // Contents tab toolbar right actions
  const contentsActions = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAddItemOpen(true)}
        className="gap-1.5"
        aria-label="Add"
        data-testid="items-add-button"
      >
        <FontAwesomeIcon icon={faPlus} className="size-4" />
        <span className="hidden xl:inline">Add</span>
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
    </>
  );

  // Contents tab content (toolbar + items view)
  const contentsContent = (
    <>
      <ContentToolbar
        sortBy={sortBy}
        onSortChange={setSortBy}
        filters={filters}
        toggleFilter={toggleFilter}
        clearFilters={clearFilters}
        viewMode={viewMode}
        onViewChange={setViewMode}
        showSync
        isSyncing={isSyncing}
        onSync={handleSync}
        hasDriveConnection={hasDriveConnection}
        disabled={!hasChildren}
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
        filters={filters}
        clearFilters={clearFilters}
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
      actions={contentsActions}
    />
  );

  // Show tabs when there are children or TMDB data
  const showTabs = hasChildren || hasTmdb;

  // Active tab - URL-backed via useItemsUrlState, falls back to context-based default.
  const defaultTabId = hasChildren ? "contents" : "about";
  const activeTab = tab ?? defaultTabId;

  // Resolve hero background URL: TMDB backdrop takes precedence over artwork
  const heroBackgroundUrl = item.tmdbBackdropPath
    ? getTmdbBackdropUrl(item.tmdbBackdropPath)
    : undefined;

  // Hero element
  const hero = (
    <CinematicHero
      slides={[
        {
          id: item.id,
          name: item.name,
          backgroundUrl: heroBackgroundUrl,
          artworkId: heroArtworkId,
          logoImage,
          dominantColour: item.dominantColour ?? undefined,
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
          syncStatus: item.syncStatus,
          driveFileId: item.driveFileId,
        },
      ]}
      headingLevel="h1"
      actions={ownerActions}
    />
  );

  return (
    <HeroContentLayout
      hero={hero}
      isPending={isPending}
      dominantColour={item.dominantColour}
      data-testid="item-detail-container"
    >
      {/* Tabbed content or direct toolbar */}
      {showTabs && tabsMounted ? (
        isMobile ? (
          <SwipeableUnderlineTabs
            tabs={[
              {
                id: "contents",
                label: "Contents",
                content: contentsContent,
              },
              { id: "about", label: "About", content: aboutContent },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setTab(id as "contents" | "about")}
            swipeEnabled={!isEditing}
          />
        ) : (
          <UnderlineTabs
            tabs={[
              {
                id: "contents",
                label: "Contents",
                content: contentsContent,
              },
              { id: "about", label: "About", content: aboutContent },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setTab(id as "contents" | "about")}
          />
        )
      ) : (
        contentsContent
      )}

      {/* Item Settings Dialog (desktop) */}
      {settingsOpen && !isMobile && (
        <ItemSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          item={settingsItem}
          files={settingsFiles}
          hasDriveConnection={hasDriveConnection}
          onSettingsChange={handleSettingsChange}
        />
      )}

      {/* Item Settings Sheet (mobile) */}
      {mobileSheetOpen && isMobile && (
        <MobileItemSheet
          open={mobileSheetOpen}
          onOpenChange={setMobileSheetOpen}
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
            item.tmdbPosterPath
              ? (getTmdbPosterUrl(item.tmdbPosterPath) ?? undefined)
              : heroArtworkId
                ? `/api/artwork/${heroArtworkId}`
                : undefined
          }
          onClose={() => setPlayingFile(null)}
          onPositionUpdate={handlePositionUpdate}
        />
      )}
    </HeroContentLayout>
  );
}
