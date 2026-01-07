/**
 * Client-side wrapper for item detail pages.
 * Manages shared state between ItemsToolbar and ItemsView.
 * Always shows hero banner followed by children grid/tree.
 */

"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ItemsToolbar } from "./items-toolbar";
import { ItemsView } from "./items-view";
import { ItemHero } from "./item-hero";
import { MediaOverlay } from "@/components/media/media-overlay";
import { Spinner } from "@/components/ui/spinner";
import { updatePlaybackPosition } from "@/lib/item-file-actions";
import type { ItemWithArtwork, SerializedItemFile } from "@/lib/types";
import { getItems } from "@/lib/item-actions";
import { getItemsByConnection } from "@/lib/sftp-actions";

interface ItemDetailClientProps {
  /** Current item being viewed. */
  item: {
    id: string;
    name: string;
    description: string | null;
    connectionId: string | null;
    sftpPath: string | null;
  };
  /** Child items to display. */
  childItems: ItemWithArtwork[];
  /** Parent connection info for context. */
  connection?: { id: string; name: string } | null;
  /** Optional files for display. */
  files?: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
  /** Primary artwork ID for hero background. */
  artworkId?: string | null;
}

/**
 * Client wrapper for item detail page with hero banner and unified toolbar.
 * Manages edit mode and add item dialog state shared between toolbar and view.
 * Displays: Toolbar -> Hero -> Children grid/tree.
 */
export function ItemDetailClient({
  item,
  childItems: initialChildItems,
  connection,
  files,
  artworkId,
}: ItemDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [childItems, setChildItems] = useState(initialChildItems);
  const [isEditing, setIsEditing] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [playingFile, setPlayingFile] = useState<SerializedItemFile | null>(
    null
  );

  // Hydration detection
  const [isHydrated, setIsHydrated] = useState(false);
  const [minDurationMet, setMinDurationMet] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: one-time hydration marker
  useEffect(() => setIsHydrated(true), []);

  // Minimum spinner duration (300ms) - prevents flicker for fast loads
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinDurationMet(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const isLoading = !isHydrated || !minDurationMet;

  const isSftpConnected = Boolean(item.connectionId && item.sftpPath);
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

  // Resolve hero artwork using fallback chain: isHero -> isPrimary -> first
  // Single pass through artwork array for efficiency
  const heroArtworkId = (() => {
    if (!files) return artworkId ?? null;
    const artwork = files.artwork;
    if (artwork.length === 0) return null;
    let heroFile: (typeof artwork)[0] | undefined;
    let primaryFile: (typeof artwork)[0] | undefined;
    for (const f of artwork) {
      if (f.isHero) {
        heroFile = f;
        break; // isHero takes priority, stop searching
      }
      if (f.isPrimary && !primaryFile) primaryFile = f;
    }
    return heroFile?.id ?? primaryFile?.id ?? artwork[0]?.id ?? null;
  })();

  /**
   * Refetches child items from server.
   */
  const refetchItems = useCallback(async () => {
    startTransition(async () => {
      const result = item.connectionId
        ? await getItemsByConnection(item.connectionId, item.id)
        : await getItems(item.id);

      if (result.success && result.data) {
        setChildItems(result.data);
      }
    });
  }, [item.id, item.connectionId]);

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
    },
    childCount: childItems.length,
    isSftpConnected,
  };

  // Show full-page spinner until hydrated
  if (isLoading) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        data-testid="items-loading"
      >
        <Spinner className="text-muted-foreground size-8" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${isPending ? "opacity-70" : ""}`}>
      {/* Toolbar - above hero */}
      <ItemsToolbar {...toolbarProps} />

      {/* Hero banner */}
      <ItemHero
        name={item.name}
        description={item.description}
        artworkId={heroArtworkId}
        hasMedia={hasMedia}
        hasProgress={hasProgress}
        mediaCount={files?.media.length ?? 0}
        artworkCount={files?.artwork.length ?? 0}
        subtitleCount={files?.subtitles.length ?? 0}
        childCount={childItems.length}
        onPlay={handlePlay}
      />

      {/* Children section - always shown (may be empty state) */}
      <ItemsView
        items={childItems}
        parentId={item.id}
        connectionId={item.connectionId}
        hideToolbar
        isEditing={isEditing}
        onEditingChange={setIsEditing}
        addItemOpen={addItemOpen}
        onAddItemOpenChange={setAddItemOpen}
        currentConnection={connection}
        onSyncComplete={refetchItems}
      />

      {/* Media player overlay */}
      {playingFile && files && (
        <MediaOverlay
          file={playingFile}
          subtitles={files.subtitles}
          onClose={() => setPlayingFile(null)}
          onPositionUpdate={handlePositionUpdate}
        />
      )}
    </div>
  );
}
