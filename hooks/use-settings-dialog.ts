/**
 * Hook for managing the item settings dialog lifecycle.
 * Encapsulates opening, closing, and refreshing settings state
 * including file fetching for the dialog.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getItemFiles } from "@/lib/item-file-actions";
import type { ItemWithArtwork, SerializedItemFile } from "@/lib/types";

/** State for the item settings dialog. */
export interface SettingsDialogState {
  item: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    inheritVisibility: boolean;
    hasParent: boolean;
    hasChildren: boolean;
    tmdbId: number | null;
    tmdbShowTagline: boolean;
    tmdbShowMetadata: boolean;
    tmdbShowGenres: boolean;
    tmdbShowCast: boolean;
    tmdbShowProviders: boolean;
    tmdbShowVideos: boolean;
    tmdbShowRecommendations: boolean;
  };
  files: {
    media: SerializedItemFile[];
    artwork: SerializedItemFile[];
    subtitles: SerializedItemFile[];
  };
}

interface UseSettingsDialogOptions {
  /** Ref to current items array (avoids stale closures). */
  itemsRef: React.RefObject<ItemWithArtwork[]>;
  /** Refetch items from server after settings change. */
  refetchItems: () => Promise<void>;
}

/**
 * Manages the item settings dialog state, including opening with file fetch,
 * closing, and refreshing after changes.
 *
 * @param options.itemsRef - Ref to current items for fresh data on open/refresh
 * @param options.refetchItems - Server refetch after settings change
 * @returns Dialog state and control functions
 */
export function useSettingsDialog({
  itemsRef,
  refetchItems,
}: UseSettingsDialogOptions) {
  const [settingsDialog, setSettingsDialog] =
    useState<SettingsDialogState | null>(null);

  // Ref to avoid stale closure in refreshSettings (updated via effect, not during render)
  const dialogRef = useRef(settingsDialog);
  useEffect(() => {
    dialogRef.current = settingsDialog;
  }, [settingsDialog]);

  /**
   * Opens the settings dialog for an item.
   * Fetches the item's files before displaying.
   */
  const openSettings = useCallback(
    async (id: string) => {
      const item = itemsRef.current?.find((i) => i.id === id);
      if (!item) return;

      const filesResult = await getItemFiles(id);
      const files =
        filesResult.success && filesResult.data
          ? filesResult.data
          : { media: [], artwork: [], subtitles: [] };

      setSettingsDialog({
        item: {
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
        },
        files,
      });
    },
    [itemsRef]
  );

  /** Closes the settings dialog. */
  const closeSettings = useCallback(() => {
    // Update ref synchronously so in-flight refreshSettings sees null after await
    dialogRef.current = null;
    setSettingsDialog(null);
  }, []);

  /**
   * Refreshes items from server, and updates dialog state if still open.
   * Always refetches items so the tree/grid reflects saved changes.
   */
  const refreshSettings = useCallback(async () => {
    const current = dialogRef.current;

    await refetchItems();

    // Only update dialog state if it's still open after the async refetch
    if (!current || !dialogRef.current) return;

    const filesResult = await getItemFiles(current.item.id);
    const updatedFiles =
      filesResult.success && filesResult.data
        ? filesResult.data
        : current.files;

    // Re-check dialog is still open after second async call
    if (!dialogRef.current) return;

    const updatedItem = itemsRef.current?.find((i) => i.id === current.item.id);
    if (updatedItem) {
      setSettingsDialog({
        item: {
          id: updatedItem.id,
          name: updatedItem.name,
          description: updatedItem.description,
          isPublic: updatedItem.isPublic,
          inheritVisibility: updatedItem.inheritVisibility,
          hasParent: updatedItem.parentId !== null,
          hasChildren: updatedItem.childCount > 0,
          tmdbId: updatedItem.tmdbId,
          tmdbShowTagline: updatedItem.tmdbShowTagline,
          tmdbShowMetadata: updatedItem.tmdbShowMetadata,
          tmdbShowGenres: updatedItem.tmdbShowGenres,
          tmdbShowCast: updatedItem.tmdbShowCast,
          tmdbShowProviders: updatedItem.tmdbShowProviders,
          tmdbShowVideos: updatedItem.tmdbShowVideos,
          tmdbShowRecommendations: updatedItem.tmdbShowRecommendations,
        },
        files: updatedFiles,
      });
    }
  }, [refetchItems, itemsRef]);

  return { settingsDialog, openSettings, closeSettings, refreshSettings };
}
