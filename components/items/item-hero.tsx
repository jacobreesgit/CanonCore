/**
 * Hero banner component for item detail pages.
 * CTA16-style full-bleed artwork with centered content overlay.
 * Uses GridItem's background image pattern for consistency.
 */

"use client";

import { useState } from "react";
import { Play, Film, ImageIcon, FileText, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ItemHeroProps {
  /** Item name displayed as heading. */
  name: string;
  /** Optional description (max 200 chars). */
  description?: string | null;
  /** Artwork file ID for background image. */
  artworkId?: string | null;
  /** Whether item has playable media files. */
  hasMedia?: boolean;
  /** Whether media has watch progress (shows Resume vs Play). */
  hasProgress?: boolean;
  /** Number of media files. */
  mediaCount?: number;
  /** Number of artwork files. */
  artworkCount?: number;
  /** Number of subtitle files. */
  subtitleCount?: number;
  /** Number of child items. */
  childCount?: number;
  /** Callback when play button clicked. */
  onPlay?: () => void;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * CTA-style hero banner with full-bleed artwork background.
 * Always renders regardless of files/children state.
 *
 * @param props - Hero configuration
 */
export function ItemHero({
  name,
  description,
  artworkId,
  hasMedia = false,
  hasProgress = false,
  mediaCount = 0,
  artworkCount = 0,
  subtitleCount = 0,
  childCount = 0,
  onPlay,
  className,
}: ItemHeroProps) {
  const [imageError, setImageError] = useState(false);
  const shouldShowArtwork = artworkId && !imageError;

  return (
    <section
      data-testid="item-hero"
      className={cn(
        // CTA16-inspired height and centering
        "relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl",
        // Background image styles (GridItem pattern)
        "bg-black/80 bg-cover bg-center bg-no-repeat",
        // Dark overlay for text legibility
        "before:absolute before:inset-0 before:z-10 before:bg-black/50",
        className
      )}
      style={{
        backgroundImage: shouldShowArtwork
          ? `url(/api/artwork/${artworkId})`
          : undefined,
      }}
    >
      {/* Hidden img for error detection */}
      {artworkId && !imageError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/artwork/${artworkId}`}
          alt=""
          className="hidden"
          onError={() => setImageError(true)}
        />
      )}

      {/* Fallback gradient when no artwork */}
      {!shouldShowArtwork && (
        <div
          data-testid="hero-fallback"
          className={cn(
            "absolute inset-0 z-0",
            "flex items-center justify-center",
            "from-muted/80 to-muted bg-gradient-to-br"
          )}
        >
          <Film className="text-muted-foreground/30 size-24" strokeWidth={1} />
        </div>
      )}

      {/* Content overlay - centered */}
      <div className="relative z-20 flex flex-col items-center gap-6 p-8 text-center text-white">
        {/* Title */}
        <h1 className="line-clamp-2 max-w-2xl text-4xl font-bold tracking-tight drop-shadow-lg md:text-5xl">
          {name}
        </h1>

        {/* Description */}
        {description && (
          <p className="line-clamp-3 max-w-xl text-lg text-white/80 drop-shadow-md">
            {description}
          </p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
          {mediaCount > 0 && (
            <span className="flex items-center gap-1.5">
              <Film className="size-4" />
              {mediaCount} media file{mediaCount !== 1 ? "s" : ""}
            </span>
          )}
          {artworkCount > 0 && (
            <span className="flex items-center gap-1.5">
              <ImageIcon className="size-4" />
              {artworkCount} artwork
            </span>
          )}
          {subtitleCount > 0 && (
            <span className="flex items-center gap-1.5">
              <FileText className="size-4" />
              {subtitleCount} subtitle{subtitleCount !== 1 ? "s" : ""}
            </span>
          )}
          {childCount > 0 && (
            <span className="flex items-center gap-1.5">
              <Folder className="size-4" />
              {childCount} item{childCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Play button */}
        {hasMedia && onPlay && (
          <Button
            size="lg"
            variant="glass"
            onClick={onPlay}
            className="gap-2"
            data-testid="item-hero-play"
          >
            <Play className="size-5" />
            {hasProgress ? "Resume" : "Play"}
          </Button>
        )}
      </div>
    </section>
  );
}
