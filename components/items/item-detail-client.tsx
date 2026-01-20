/**
 * Client-side wrapper for item detail pages.
 * Manages shared state between ItemsToolbar and ItemsView.
 * Always shows hero banner followed by children grid/tree.
 */

"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ItemsToolbar } from "./items-toolbar";
import { ItemsView } from "./items-view";
import { ItemHero } from "./item-hero";
import { MediaOverlay } from "@/components/media/media-overlay";
import { updatePlaybackPosition } from "@/lib/item-file-actions";
import type {
  ItemWithArtwork,
  SerializedItemFile,
  ItemProgress,
} from "@/lib/types";
import { getItems } from "@/lib/item-actions";
import { useHeroCollapse } from "@/hooks/use-hero-collapse";
import { useGoToItem } from "@/hooks/use-go-to-item";
import { formatProgressLabel } from "@/lib/progress-utils";

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
}

/**
 * Client wrapper for item detail page with hero banner and unified toolbar.
 * Manages edit mode and add item dialog state shared between toolbar and view.
 * Displays: Toolbar -> Hero -> Children grid/tree.
 */
export function ItemDetailClient({
  item,
  childItems: initialChildItems,
  files,
  artworkId,
  itemProgress,
  hasDriveConnection = false,
}: ItemDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [childItems, setChildItems] = useState(initialChildItems);
  const [isEditing, setIsEditing] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [playingFile, setPlayingFile] = useState<SerializedItemFile | null>(
    null
  );

  // Hero collapse state with localStorage persistence
  const { isCollapsed, toggleCollapse } = useHeroCollapse();

  // First incomplete item for "Go to" button
  const { nextItem, goToNext } = useGoToItem({ parentId: item.id });

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

  // Check if any media has progress
  const hasProgress =
    hasMedia &&
    files.media.some((f) => f.playbackPosition && f.playbackPosition > 0);

  // Get primary media file for play button
  const primaryMedia = hasMedia
    ? files.media.find((f) => f.isPrimary) || files.media[0]
    : null;

  /**
   * Refetches child items from server.
   */
  const refetchItems = useCallback(async () => {
    startTransition(async () => {
      const result = await getItems(item.id);

      if (result.success && result.data) {
        setChildItems(result.data);
      }
    });
  }, [item.id]);

  /**
   * Handles sync completion - refresh items and page.
   */
  const handleSyncComplete = useCallback(async () => {
    await refetchItems();
    router.refresh();
  }, [refetchItems, router]);

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

  // Shared toolbar props
  const toolbarProps = {
    hasItems: hasChildren,
    isEditing,
    onEditToggle: () => setIsEditing((prev) => !prev),
    onAddItem: () => setAddItemOpen(true),
    onSyncComplete: handleSyncComplete,
    item: {
      id: item.id,
      name: item.name,
      description: item.description,
      isPublic: item.isPublic,
      inheritVisibility: item.inheritVisibility,
      hasParent: item.parentId !== null,
      hasChildren: item.childCount > 0,
    },
    childCount: childItems.length,
    hasDriveConnection,
  };

  return (
    <div
      className={`flex flex-col gap-6 ${!hasChildren ? "flex-1" : ""} ${isPending ? "opacity-70" : ""}`}
    >
      {/* Hero banner */}
      <ItemHero
        name={item.name}
        description={item.description}
        artworkId={heroArtworkId}
        hasMedia={hasMedia}
        hasProgress={hasProgress}
        primaryMediaName={primaryMedia?.filename ?? null}
        progressPercentage={itemProgress?.percentage ?? null}
        progressLabel={itemProgress ? formatProgressLabel(itemProgress) : null}
        onPlay={handlePlay}
        nextItem={nextItem ?? null}
        onGoToNext={goToNext}
        isCollapsed={isCollapsed}
        onCollapse={toggleCollapse}
      />

      {/* Toolbar - below hero */}
      <ItemsToolbar {...toolbarProps} />

      {/* Children section - always shown (may be empty state) */}
      <ItemsView
        items={childItems}
        parentId={item.id}
        hideToolbar
        isEditing={isEditing}
        onEditingChange={setIsEditing}
        addItemOpen={addItemOpen}
        onAddItemOpenChange={setAddItemOpen}
        hasDriveConnection={hasDriveConnection}
      />

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
    </div>
  );
}
