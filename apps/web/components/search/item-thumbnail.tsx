/**
 * Shared search result thumbnail for items.
 * Resolves TMDB poster path → Drive artwork → fallback icon.
 * Used by SpotlightSearch and MobileSearchSheet.
 */

"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { cn } from "@/lib/utils";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { getTmdbPosterUrl } from "@/lib/tmdb-image-utils";

interface ItemThumbnailProps {
  /** TMDB poster path (takes precedence over artworkId). */
  tmdbPosterPath?: string | null;
  /** Drive artwork file ID (fallback). */
  artworkId?: string | null;
  /** Thumbnail size class (e.g., "size-8" or "size-10"). */
  size?: string;
  /** Border radius class (e.g., "rounded-md" or "rounded-lg"). */
  rounded?: string;
  /** Icon size class for the fallback icon. */
  iconSize?: string;
  /** Fallback icon definition (defaults to faFolder). */
  fallbackIcon?: IconDefinition;
  /** Additional classes on the fallback icon container. */
  fallbackClassName?: string;
}

/**
 * Resolves the thumbnail image source from TMDB poster path or artwork ID.
 */
function resolveSrc(
  tmdbPosterPath?: string | null,
  artworkId?: string | null
): string | null {
  if (tmdbPosterPath) return getTmdbPosterUrl(tmdbPosterPath, "w92");
  if (artworkId) return `/api/artwork/${artworkId}`;
  return null;
}

/**
 * Item thumbnail with load-state tracking.
 * Shows fallback icon until image loads, then fades in.
 */
export function ItemThumbnail({
  tmdbPosterPath,
  artworkId,
  size = "size-8",
  rounded = "rounded-lg",
  iconSize = "size-4",
  fallbackIcon = faFolder,
  fallbackClassName,
}: ItemThumbnailProps) {
  const src = resolveSrc(tmdbPosterPath, artworkId);
  const { ref, loaded, onLoad, onError } = useImageLoaded(src ?? undefined);

  if (!src) {
    return (
      <div
        className={cn(
          "bg-muted/50 text-muted-foreground flex shrink-0 items-center justify-center",
          size,
          rounded,
          fallbackClassName
        )}
      >
        <FontAwesomeIcon
          icon={fallbackIcon}
          className={iconSize}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-muted relative shrink-0 overflow-hidden",
        size,
        rounded
      )}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <FontAwesomeIcon
            icon={fallbackIcon}
            className={cn("text-muted-foreground/50", iconSize)}
            aria-hidden="true"
          />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt=""
        loading="lazy"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-150",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}
