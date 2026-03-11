/**
 * Dialog that wraps the ImageSelectionGrid for changing a single artwork field.
 * Opens the poster/backdrop/still gallery in isolation, applies selection on confirm.
 *
 * Uses AnimatedDialogContent slot API: header/footer are fixed slots,
 * body (children) animates between states. stepKey is required.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AnimatedDialogContent } from "@/components/ui/animated-dialog-content";
import { Button } from "@/components/ui/button";
import { ImageSelectionGrid } from "@/components/items/wizards/tmdb-wizard/image-selection-grid";
import { LogoSelectionGrid } from "@/components/items/logo-selection-grid";
import {
  getImagesAction,
  getSeasonImagesAction,
  getEpisodeImagesAction,
  applyMetadataAction,
} from "@/lib/tmdb-actions";
import type { TMDBImage } from "@/lib/tmdb-client";

type ArtworkType = "poster" | "backdrop" | "still" | "logo";

interface TmdbArtworkChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  tmdbId: number;
  tmdbType: "movie" | "tv";
  artworkType: ArtworkType;
  /** Season number for season poster or episode still artwork */
  seasonNumber?: number;
  /** Episode number for episode still artwork */
  episodeNumber?: number;
  onComplete: () => void;
}

export function TmdbArtworkChangeDialog({
  open,
  onOpenChange,
  itemId,
  tmdbId,
  tmdbType,
  artworkType,
  seasonNumber,
  episodeNumber,
  onComplete,
}: TmdbArtworkChangeDialogProps) {
  const [tmdbImages, setTmdbImages] = useState<TMDBImage[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch images when dialog opens
  useEffect(() => {
    if (!open) return;

    async function fetchImages() {
      // Reset state for fresh open (inside async fn to avoid synchronous setState in effect)
      setSelectedPath(null);
      setError(null);
      setIsFetching(true);

      // Each branch returns a different ActionResult<T>, so handle them separately
      // to let TypeScript narrow the data type correctly.
      if (
        artworkType === "still" &&
        seasonNumber != null &&
        episodeNumber != null
      ) {
        const result = await getEpisodeImagesAction(
          tmdbId,
          seasonNumber,
          episodeNumber
        );
        if (result.success && result.data) {
          setTmdbImages(result.data.stills);
        } else {
          setError(
            "Failed to load images. Try closing and reopening the dialog."
          );
        }
      } else if (artworkType === "poster" && seasonNumber != null) {
        const result = await getSeasonImagesAction(tmdbId, seasonNumber);
        if (result.success && result.data) {
          setTmdbImages(result.data.posters);
        } else {
          setError(
            "Failed to load images. Try closing and reopening the dialog."
          );
        }
      } else {
        const result = await getImagesAction(tmdbId, tmdbType);
        if (result.success && result.data) {
          if (artworkType === "poster") {
            setTmdbImages(result.data.posters);
          } else if (artworkType === "logo") {
            setTmdbImages(result.data.logos ?? []);
          } else {
            setTmdbImages(result.data.backdrops);
          }
        } else {
          setError(
            "Failed to load images. Try closing and reopening the dialog."
          );
        }
      }

      setIsFetching(false);
    }

    fetchImages();
  }, [open, tmdbId, tmdbType, artworkType, seasonNumber, episodeNumber]);

  const handleApply = useCallback(async () => {
    if (!selectedPath) return;

    setIsLoading(true);
    const options =
      artworkType === "poster"
        ? {
            updatePoster: true,
            posterPath: selectedPath,
            updateName: false,
            updateDescription: false,
            updateBackdrop: false,
            updateLogo: false,
          }
        : artworkType === "logo"
          ? {
              updateLogo: true,
              logoPath: selectedPath,
              updateName: false,
              updateDescription: false,
              updatePoster: false,
              updateBackdrop: false,
            }
          : {
              updateBackdrop: true,
              backdropPath: selectedPath,
              updateName: false,
              updateDescription: false,
              updatePoster: false,
              updateLogo: false,
            };

    const result = await applyMetadataAction(itemId, tmdbId, tmdbType, options);
    setIsLoading(false);

    if (result.success) {
      onComplete();
      onOpenChange(false);
    } else {
      setError(result.error);
    }
  }, [
    selectedPath,
    artworkType,
    itemId,
    tmdbId,
    tmdbType,
    onComplete,
    onOpenChange,
  ]);

  const title =
    artworkType === "poster"
      ? "Change Poster"
      : artworkType === "backdrop"
        ? "Change Backdrop"
        : artworkType === "logo"
          ? "Change Logo"
          : "Change Still";

  // ImageSelectionGrid type: poster uses "poster" (2:3), backdrop/still uses "backdrop" (16:9)
  const gridType = artworkType === "poster" ? "poster" : "backdrop";
  const isLogo = artworkType === "logo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* AnimatedDialogContent uses slot API: header/footer are fixed, children animate.
          stepKey is REQUIRED. Override max-width for wider image grid. */}
      <AnimatedDialogContent
        stepKey={isFetching ? "loading" : "gallery"}
        className="glass-dialog sm:max-w-2xl"
        header={
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Select a new {artworkType} image from TMDB.
            </DialogDescription>
          </DialogHeader>
        }
        footer={
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              aria-label="Cancel artwork change"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={!selectedPath || isLoading}
              aria-label={`Apply selected ${artworkType}`}
            >
              {isLoading && (
                <FontAwesomeIcon
                  icon={faSpinner}
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              Apply
            </Button>
          </DialogFooter>
        }
      >
        {/* Body content (animates via AnimatedDialogContent) */}
        {isFetching ? (
          <div className="flex items-center justify-center py-12">
            <FontAwesomeIcon
              icon={faSpinner}
              className="h-6 w-6 animate-spin"
              aria-hidden="true"
            />
            <span className="sr-only">Loading images…</span>
          </div>
        ) : error ? (
          <p className="text-destructive py-8 text-center text-sm" role="alert">
            {error}
          </p>
        ) : isLogo ? (
          <LogoSelectionGrid
            logos={tmdbImages}
            selectedValue={selectedPath}
            onSelect={(value) => setSelectedPath(value)}
          />
        ) : (
          <ImageSelectionGrid
            type={gridType}
            tmdbImages={tmdbImages}
            selectedValue={selectedPath}
            onSelect={(value) => setSelectedPath(value)}
            showTabs={false}
          />
        )}
      </AnimatedDialogContent>
    </Dialog>
  );
}
