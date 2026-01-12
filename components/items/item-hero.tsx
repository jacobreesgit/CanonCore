/**
 * Hero banner component for item detail pages and My Items page.
 * CTA16-style full-bleed artwork with centered content overlay.
 * Supports both item artwork (via artworkId) and direct URLs (via backgroundUrl).
 * Falls back to animated shader when no image available.
 * Long descriptions expand with motion animation via "Read More" button.
 */

"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Play,
  Film,
  ImageIcon,
  FileText,
  Folder,
  Music,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shader1 } from "@/components/shader1";
import { cn } from "@/lib/utils";

/** Truncate length for description before showing "Read More". */
const DESCRIPTION_TRUNCATE_LENGTH = 150;

interface ItemHeroProps {
  /** Item name displayed as heading. */
  name: string;
  /** Optional description (max 1000 chars). Long descriptions show "Read More" button. */
  description?: string | null;
  /** Artwork file ID for background image (via /api/artwork/{id}). */
  artworkId?: string | null;
  /** Direct URL for background image (e.g., /api/user/hero). Takes precedence over artworkId. */
  backgroundUrl?: string | null;
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
  /** Primary media filename for "now playing" display. */
  primaryMediaName?: string | null;
  /** Primary media MIME type (e.g., "audio/mpeg", "video/mp4") for icon display. */
  primaryMediaMimeType?: string | null;
  /** Callback when play button clicked. */
  onPlay?: () => void;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * CTA-style hero banner with full-bleed artwork background.
 * Always renders regardless of files/children state.
 * Display priority: backgroundUrl -> artworkId -> Shader1 fallback.
 *
 * @param props - Hero configuration
 */
export function ItemHero({
  name,
  description,
  artworkId,
  backgroundUrl,
  hasMedia = false,
  hasProgress = false,
  mediaCount = 0,
  artworkCount = 0,
  subtitleCount = 0,
  childCount = 0,
  primaryMediaName,
  primaryMediaMimeType,
  onPlay,
  className,
}: ItemHeroProps) {
  const [imageError, setImageError] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Determine if description needs truncation
  const shouldTruncate =
    description && description.length > DESCRIPTION_TRUNCATE_LENGTH;

  // Determine if primary media is audio (show Music icon) or video (show Film icon)
  const isAudio = primaryMediaMimeType?.startsWith("audio/") ?? false;
  const MediaIcon = isAudio ? Music : Film;

  // Determine background source: backgroundUrl takes precedence over artworkId
  const backgroundSrc =
    backgroundUrl ?? (artworkId ? `/api/artwork/${artworkId}` : null);
  const shouldShowBackground = backgroundSrc && !imageError;

  return (
    <section
      data-testid="item-hero"
      className={cn(
        // CTA16-inspired height and centering - hybrid approach: never smaller than 240px, scales to 30% of dynamic viewport
        "relative flex min-h-[max(240px,30dvh)] items-center justify-center overflow-hidden rounded-xl",
        // Background image styles (only when showing image, not shader)
        shouldShowBackground &&
          "bg-black/80 bg-cover bg-center bg-no-repeat before:absolute before:inset-0 before:z-10 before:bg-black/50",
        className
      )}
      style={{
        backgroundImage: shouldShowBackground
          ? `url(${backgroundSrc})`
          : undefined,
      }}
    >
      {/* Hidden img for error detection */}
      {backgroundSrc && !imageError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundSrc}
          alt=""
          className="hidden"
          onError={() => setImageError(true)}
        />
      )}

      {/* Shader fallback when no background image */}
      {/* navigator.webdriver is true when running in Playwright/Selenium automated tests.
          We use a simple CSS gradient instead of the WebGL Shader1 component to avoid
          GPU load and rendering inconsistencies in headless browser environments. */}
      {!shouldShowBackground && (
        <div data-testid="hero-fallback" className="absolute inset-0 z-0">
          {typeof window !== "undefined" && navigator.webdriver ? (
            <div className="h-full w-full bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900" />
          ) : (
            <Shader1 className="h-full" />
          )}
        </div>
      )}

      {/* Content overlay - centered */}
      <div className="relative z-20 flex flex-col items-center gap-6 p-8 text-center text-white">
        {/* Title */}
        <h1 className="line-clamp-2 max-w-2xl text-4xl font-bold tracking-tight drop-shadow-lg md:text-5xl">
          {name}
        </h1>

        {/* Description with expand/collapse for long text */}
        {description && (
          <div className="flex max-w-xl flex-col items-center">
            <motion.div
              initial={false}
              animate={{
                height:
                  descriptionExpanded || !shouldTruncate ? "auto" : "4.5rem",
              }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden"
              data-testid="hero-description"
            >
              <p className="text-lg text-white/80 drop-shadow-md">
                {descriptionExpanded || !shouldTruncate
                  ? description
                  : `${description.slice(0, DESCRIPTION_TRUNCATE_LENGTH)}...`}
              </p>
            </motion.div>

            {shouldTruncate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                className="group mt-2 text-white/70 hover:bg-white/10 hover:text-white"
                data-testid="hero-read-more"
              >
                {descriptionExpanded ? "Show Less" : "Read More"}
                <motion.span
                  animate={{ rotate: descriptionExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="ml-1"
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
              </Button>
            )}
          </div>
        )}

        {/* Stats row */}
        <div
          data-testid="item-hero-stats"
          className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/70"
        >
          {mediaCount > 0 && (
            <span className="flex items-center gap-1.5">
              <MediaIcon className="size-4" />
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

        {/* Play button with primary media name in label */}
        {hasMedia && onPlay && (
          <Button
            size="lg"
            variant="glass"
            onClick={onPlay}
            className="max-w-xs gap-2"
            data-testid="item-hero-play"
          >
            <Play className="size-5 shrink-0" />
            <span className="truncate">
              {hasProgress ? "Resume" : "Play"}
              {primaryMediaName && ` ${primaryMediaName}`}
            </span>
          </Button>
        )}
      </div>
    </section>
  );
}
