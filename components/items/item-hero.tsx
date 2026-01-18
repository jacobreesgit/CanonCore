/**
 * Hero banner component for item detail pages and My Items page.
 * CTA16-style full-bleed artwork with centered content overlay.
 * Supports both item artwork (via artworkId) and direct URLs (via backgroundUrl).
 * Falls back to animated shader when no image available.
 * Long descriptions expand with motion animation via "Read More" button.
 */

"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { motion } from "motion/react";
import {
  Play,
  ChevronDown,
  ChevronUp,
  Maximize2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shader1 } from "@/components/shader1";
import { cn } from "@/lib/utils";
import type { NextItem } from "@/lib/types";

/** Collapsed height for description container in pixels (matches 3.5rem at 16px base). */
const COLLAPSED_HEIGHT_PX = 56;

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
  /** Primary media filename for "now playing" display. */
  primaryMediaName?: string | null;
  /** Progress percentage (0-100) for item and descendants, null if no items with media. */
  progressPercentage?: number | null;
  /** Progress label (e.g., "5/10 watched (of 15 items)") for display. */
  progressLabel?: string | null;
  /** Callback when play button clicked. */
  onPlay?: () => void;
  /** Next incomplete item to navigate to (for "Go to" button). */
  nextItem?: NextItem | null;
  /** Callback when "Go to" button clicked. */
  onGoToNext?: (item: NextItem) => void;
  /** Whether hero is in collapsed state. */
  isCollapsed?: boolean;
  /** Callback to toggle collapsed state. */
  onCollapse?: () => void;
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
  primaryMediaName,
  progressPercentage,
  progressLabel,
  onPlay,
  nextItem,
  onGoToNext,
  isCollapsed = false,
  onCollapse,
  className,
}: ItemHeroProps) {
  const [imageError, setImageError] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  // Detect actual text overflow by comparing scroll height to collapsed height
  useLayoutEffect(() => {
    const checkOverflow = () => {
      if (descriptionRef.current) {
        const hasOverflow =
          descriptionRef.current.scrollHeight > COLLAPSED_HEIGHT_PX;
        setIsOverflowing(hasOverflow);
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [description]);

  // Determine background source: backgroundUrl takes precedence over artworkId
  const backgroundSrc =
    backgroundUrl ?? (artworkId ? `/api/artwork/${artworkId}` : null);
  const shouldShowBackground = backgroundSrc && !imageError;
  const isCollapsedState = isCollapsed && onCollapse;

  // Single animated container - height animates, content fades via AnimatePresence
  return (
    <motion.section
      data-testid="item-hero"
      layout
      initial={false}
      transition={{ type: "spring", stiffness: 400, damping: 35 }}
      className={cn(
        "relative overflow-hidden rounded-xl",
        shouldShowBackground &&
          "bg-black/80 bg-cover bg-center bg-no-repeat before:absolute before:inset-0 before:z-10 before:bg-black/50",
        className
      )}
      style={{
        borderRadius: 12,
        backgroundImage: shouldShowBackground
          ? `url(${backgroundSrc})`
          : undefined,
      }}
    >
      {isCollapsedState ? (
        // Collapsed content - horizontal bar
        <motion.div
          key="collapsed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="relative z-20 flex h-14 items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 backdrop-blur-md"
        >
          <h1 className="truncate text-lg font-semibold text-white/90">
            {name}
          </h1>
          <div className="flex items-center gap-2">
            {hasMedia && onPlay && (
              <Button
                size="sm"
                variant="glass"
                onClick={onPlay}
                className="max-w-[200px] gap-2"
                data-testid="item-hero-play"
              >
                <Play className="size-4 shrink-0" />
                <span className="truncate">
                  {hasProgress ? "Resume" : "Play"}
                  {primaryMediaName && ` ${primaryMediaName}`}
                </span>
              </Button>
            )}
            {nextItem && onGoToNext && (
              <Button
                size="sm"
                variant="glass"
                onClick={() => onGoToNext(nextItem)}
                className="max-w-[200px] gap-2"
                data-testid="item-hero-goto"
              >
                <span className="truncate">Go to {nextItem.name}</span>
                <ArrowRight className="size-4 shrink-0" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={onCollapse}
              aria-label="Expand hero"
              className="size-8 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <Maximize2 className="size-4" />
            </Button>
          </div>
        </motion.div>
      ) : (
        // Expanded content - full cinematic hero
        <motion.div
          key="expanded"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex min-h-[max(240px,30dvh)] items-center justify-center"
        >
          {/* Collapse button - top right */}
          {onCollapse && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onCollapse}
              aria-label="Collapse hero"
              className="absolute top-3 right-3 z-30 size-8 border border-white/20 text-white/60 backdrop-blur-sm hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              <ChevronUp className="size-4" />
            </Button>
          )}

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
            <div
              data-testid="hero-fallback"
              className="absolute inset-0 z-0 overflow-hidden rounded-xl"
            >
              {typeof window !== "undefined" && navigator.webdriver ? (
                <div className="h-full w-full bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900" />
              ) : (
                <Shader1 className="h-full" />
              )}
            </div>
          )}

          {/* Content overlay - centered with consistent width */}
          <div className="relative z-20 flex w-full max-w-4xl flex-col items-center gap-6 p-8 text-center text-white">
            {/* Title */}
            <h1 className="line-clamp-2 text-4xl font-bold tracking-tight drop-shadow-lg md:text-5xl">
              {name}
            </h1>

            {/* Description with expand/collapse for long text */}
            {description && (
              <div className="flex w-full flex-col items-center">
                <motion.div
                  initial={false}
                  animate={{
                    height:
                      descriptionExpanded || !isOverflowing ? "auto" : "3.5rem",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  className="overflow-hidden"
                  data-testid="hero-description"
                >
                  <p
                    ref={descriptionRef}
                    className="text-lg leading-7 text-white/80 drop-shadow-md"
                  >
                    {description}
                  </p>
                </motion.div>

                {isOverflowing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                    className="mt-3 gap-1 border border-white/20 text-white/80 backdrop-blur-sm hover:border-white/40 hover:bg-white/10 hover:text-white"
                    data-testid="hero-read-more"
                  >
                    {descriptionExpanded ? "Show Less" : "Read More"}
                    <motion.span
                      animate={{ rotate: descriptionExpanded ? 180 : 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                    >
                      <ChevronDown className="size-4" />
                    </motion.span>
                  </Button>
                )}
              </div>
            )}

            {/* Progress bar - shown when items have media */}
            {progressPercentage !== null && (
              <div className="flex w-full flex-col items-center gap-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20 backdrop-blur-sm">
                  <motion.div
                    data-testid="hero-progress-bar"
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{
                      type: "spring",
                      stiffness: 100,
                      damping: 20,
                      delay: 0.2,
                    }}
                  />
                </div>
                {progressLabel && (
                  <span
                    data-testid="hero-progress-label"
                    className="text-xs tracking-wide text-white/60"
                  >
                    {progressLabel}
                  </span>
                )}
              </div>
            )}

            {/* CTA buttons - Play and/or Go to */}
            <div className="flex flex-wrap items-center justify-center gap-3">
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
              {nextItem && onGoToNext && (
                <Button
                  size="lg"
                  variant="glass"
                  onClick={() => onGoToNext(nextItem)}
                  className="max-w-xs gap-2"
                  data-testid="item-hero-goto"
                >
                  <span className="truncate">Go to {nextItem.name}</span>
                  <ArrowRight className="size-5 shrink-0" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
