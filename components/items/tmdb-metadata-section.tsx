/**
 * Inline TMDB metadata section for the item settings TMDB tab.
 * Shows per-field artwork editing and display options.
 * Detach flow is now handled by TmdbSourceField on the Details tab.
 */

"use client";

import { useCallback, useState } from "react";
import {
  faImage,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { Badge } from "@/components/ui/badge";
import { TmdbArtworkField } from "@/components/items/tmdb-artwork-field";
import { TmdbArtworkChangeDialog } from "@/components/items/tmdb-artwork-change-dialog";
import { TmdbDisplayOptionsEditor } from "@/components/items/tmdb-display-options";
import { clearTmdbFieldAction } from "@/lib/tmdb-actions";
import { getPosterUrl, getBackdropUrl, getStillUrl } from "@/lib/tmdb-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TmdbDisplayOptions } from "@/lib/types";

type ContentType = "movie" | "show" | "season" | "episode";

interface TmdbMetadataSectionProps {
  item: {
    id: string;
    tmdbId: number | null;
    tmdbType: string | null;
    tmdbPosterPath: string | null;
    tmdbBackdropPath: string | null;
    name: string;
    description: string | null;
  };
  /** Override content type for season/episode items */
  contentType?: ContentType;
  /** Season number (for season poster or episode still artwork changes) */
  seasonNumber?: number;
  /** Episode number (for episode still artwork changes) */
  episodeNumber?: number;
  displayOptions: TmdbDisplayOptions;
  onDisplayOptionsChange: (options: TmdbDisplayOptions) => void;
  onSettingsChange: () => Promise<void>;
  /** Whether the item has an uploaded artwork file (overrides TMDB poster) */
  hasUploadedPoster?: boolean;
  /** Whether the item has an uploaded hero file (overrides TMDB backdrop) */
  hasUploadedHero?: boolean;
}

export function TmdbMetadataSection({
  item,
  contentType: contentTypeProp,
  seasonNumber,
  episodeNumber,
  displayOptions,
  onDisplayOptionsChange,
  onSettingsChange,
  hasUploadedPoster,
  hasUploadedHero,
}: TmdbMetadataSectionProps) {
  const [openArtworkDialog, setOpenArtworkDialog] = useState<
    "poster" | "backdrop" | "still" | null
  >(null);
  const [isClearing, setIsClearing] = useState(false);

  const contentType: ContentType =
    contentTypeProp ?? (item.tmdbType === "tv" ? "show" : "movie");
  const tmdbType = item.tmdbType === "tv" ? "tv" : "movie";

  const showPoster =
    contentType === "movie" ||
    contentType === "show" ||
    contentType === "season";
  const showBackdrop = contentType === "movie" || contentType === "show";
  const showStill = contentType === "episode";

  const handleClear = useCallback(
    async (field: "poster" | "backdrop") => {
      setIsClearing(true);
      const result = await clearTmdbFieldAction(item.id, field);
      if (result.success) {
        toast.success(`${field === "poster" ? "Poster" : "Backdrop"} cleared`);
        await onSettingsChange();
      } else {
        toast.error(result.error);
      }
      setIsClearing(false);
    },
    [item.id, onSettingsChange]
  );

  const handleArtworkComplete = useCallback(async () => {
    await onSettingsChange();
    setOpenArtworkDialog(null);
  }, [onSettingsChange]);

  return (
    <div className="space-y-6">
      {/* Artwork fields */}
      <div
        className={cn(
          "space-y-4 transition-opacity",
          isClearing && "opacity-50"
        )}
      >
        {showPoster && (
          <TmdbArtworkField
            label="Poster"
            icon={faImage}
            description="The poster image from TMDB used as the thumbnail."
            imagePath={item.tmdbPosterPath}
            imageUrl={getPosterUrl(item.tmdbPosterPath, "w500")}
            onChange={() => setOpenArtworkDialog("poster")}
            onClear={() => handleClear("poster")}
            isLoading={isClearing}
            note={
              hasUploadedPoster ? (
                <Badge variant="destructive">
                  Overridden by uploaded artwork
                </Badge>
              ) : undefined
            }
          />
        )}

        {showBackdrop && (
          <TmdbArtworkField
            label="Backdrop"
            icon={faWandMagicSparkles}
            description="The backdrop image from TMDB used as the banner background."
            imagePath={item.tmdbBackdropPath}
            imageUrl={getBackdropUrl(item.tmdbBackdropPath, "w780")}
            onChange={() => setOpenArtworkDialog("backdrop")}
            onClear={() => handleClear("backdrop")}
            isLoading={isClearing}
            note={
              hasUploadedHero ? (
                <Badge variant="destructive">
                  Overridden by uploaded artwork
                </Badge>
              ) : undefined
            }
          />
        )}

        {showStill && (
          <TmdbArtworkField
            label="Still"
            icon={faImage}
            description="The episode still image from TMDB."
            imagePath={item.tmdbBackdropPath}
            imageUrl={getStillUrl(item.tmdbBackdropPath, "w300")}
            onChange={() => setOpenArtworkDialog("still")}
            onClear={() => handleClear("backdrop")}
            isLoading={isClearing}
          />
        )}
      </div>

      {/* Display options */}
      <TmdbDisplayOptionsEditor
        displayOptions={displayOptions}
        onChange={onDisplayOptionsChange}
      />

      {/* Single artwork change dialog — artworkType driven by openArtworkDialog state */}
      {item.tmdbId !== null && openArtworkDialog !== null && (
        <TmdbArtworkChangeDialog
          open
          onOpenChange={(open) => !open && setOpenArtworkDialog(null)}
          itemId={item.id}
          tmdbId={item.tmdbId}
          tmdbType={tmdbType as "movie" | "tv"}
          artworkType={openArtworkDialog}
          seasonNumber={seasonNumber}
          episodeNumber={
            openArtworkDialog === "still" ? episodeNumber : undefined
          }
          onComplete={handleArtworkComplete}
        />
      )}
    </div>
  );
}
