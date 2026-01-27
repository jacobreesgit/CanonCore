/**
 * Hero carousel component based on Hero226.
 * Supports multi-slide (Explore page) and single-slide (item detail) modes.
 * Single-slide mode disables autoplay and hides navigation dots.
 *
 * Accessibility: Supports reduced motion, aria-current on active dots.
 * Performance: Uses Next.js Image for LCP optimization, conditional Autoplay loading.
 */

"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Copy } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import useEmblaCarousel from "embla-carousel-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Shader1 } from "@/components/shader1";

/**
 * Generates a gradient background based on a string (username/id).
 * Creates consistent colors for the same user.
 */
function getInitialsGradient(seed: string): string {
  // Simple hash to get consistent hue
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  // Rich, saturated gradient
  return `linear-gradient(135deg, hsl(${hue}, 70%, 45%) 0%, hsl(${(hue + 40) % 360}, 80%, 35%) 100%)`;
}

/**
 * Gets the initials from a name or username.
 */
function getInitials(name: string | null, username: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  }
  return username[0].toUpperCase();
}

export interface HeroSlide {
  /** Unique identifier */
  id: string;
  /** Title displayed on the slide */
  name: string;
  /** Optional description text */
  description?: string | null;
  /** Artwork file ID for background image (used via /api/artwork/{id}) */
  artworkId?: string | null;
  /** Direct URL for background image (e.g., /api/user/hero). Takes precedence over artworkId. */
  backgroundUrl?: string | null;
  /** Link destination when CTA clicked */
  link: string;
  /** Owner username for attribution */
  ownerUsername?: string;
  /** Owner display name for attribution */
  ownerName?: string | null;
  /** Whether slide has playable media files (shows Play button when isOwner=true) */
  hasMedia?: boolean;
  /** Whether media has watch progress (shows Resume vs Play) */
  hasProgress?: boolean;
  /** Primary media filename for "now playing" display */
  primaryMediaName?: string | null;
  /** Progress percentage (0-100) for item and descendants */
  progressPercentage?: number | null;
  /** Progress label (e.g., "5/10 watched") for display */
  progressLabel?: string | null;
  /** Next incomplete item for "Go to" button */
  nextItem?: { id: string; name: string } | null;
  /** Profile ID for avatar display (single-slide mode) */
  profileId?: string;
  /** Profile username for avatar (single-slide mode) */
  profileUsername?: string;
  /** Profile name for avatar (single-slide mode) */
  profileName?: string | null;
  /** Whether profile has an uploaded image (single-slide mode) */
  profileHasImage?: boolean;
  /** Owner user ID (used to check if current user owns this slide) */
  ownerUserId?: string;
}

interface HeroCarouselProps {
  /** Array of slides to display */
  slides: HeroSlide[];
  /** Custom CTA button text (default: "View Item") */
  ctaText?: string;
  /** Whether to show CTA button (default: true) */
  showCta?: boolean;
  /** Autoplay delay in ms (default: 4000) */
  autoplayDelay?: number;
  /** Text alignment for content (default: "left" for media app readability) */
  textAlign?: "left" | "right" | "center";
  /** Additional CSS classes */
  className?: string;
  /** Whether current user owns this content - controls Play/Go-to buttons and progress display */
  isOwner?: boolean;
  /** Current user ID (used to check ownership per-slide for fork button) */
  currentUserId?: string | null;
  /** Callback when play button clicked (only shown when isOwner=true and slide.hasMedia=true) */
  onPlay?: (slideId: string) => void;
  /** Callback when "Go to" button clicked (only shown when isOwner=true and slide.nextItem exists) */
  onGoToNext?: (itemId: string) => void;
  /** Callback when fork button clicked (only shown when user doesn't own the slide) */
  onFork?: (slideId: string) => void;
  /** Add responsive padding to carousel container (for profile pages) */
  addContainerPadding?: boolean;
}

/**
 * Carousel hero component for featured content display.
 * Based on Hero226 design with support for single and multi-slide modes.
 *
 * @param props - Carousel configuration
 */
export function HeroCarousel({
  slides,
  ctaText = "View Item",
  showCta = true,
  autoplayDelay = 4000,
  textAlign = "left",
  className,
  isOwner = false,
  currentUserId,
  onPlay,
  onGoToNext,
  onFork,
  addContainerPadding = false,
}: HeroCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [avatarLoaded, setAvatarLoaded] = useState<Record<string, boolean>>({});
  const [avatarError, setAvatarError] = useState<Record<string, boolean>>({});
  const hasAnimated = useRef(false);

  // Respect user's reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  const isSingleSlide = slides.length === 1;
  // State for autoplay plugin - array of Embla plugins or null while loading
  // Extract type from second parameter of useEmblaCarousel
  const [autoplayPlugin, setAutoplayPlugin] = useState<
    Parameters<typeof useEmblaCarousel>[1] | null
  >(null);

  // Dynamic import for Autoplay plugin - only load when needed (code splitting)
  // Only use autoplay plugin for multiple slides AND if user doesn't prefer reduced motion
  useEffect(() => {
    if (isSingleSlide || prefersReducedMotion) {
      setAutoplayPlugin([]);
      return;
    }

    // Dynamic import - only loads when multi-slide and motion allowed
    import("embla-carousel-autoplay").then((mod) => {
      const Autoplay = mod.default;
      setAutoplayPlugin([
        Autoplay({
          delay: autoplayDelay,
          stopOnInteraction: true,
          stopOnMouseEnter: true,
        }),
      ]);
    });
  }, [isSingleSlide, autoplayDelay, prefersReducedMotion]);

  // Don't render until plugins are loaded (prevents flash)
  const plugins = autoplayPlugin ?? [];

  // Proper useEffect cleanup for Embla API listener
  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    api.on("select", onSelect);

    // Cleanup: Remove listener when component unmounts or api changes
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // Track image loading state
  const handleImageLoad = useCallback((slideId: string) => {
    setImageLoaded((prev) => ({ ...prev, [slideId]: true }));
  }, []);

  // Track avatar loading state
  const handleAvatarLoad = useCallback((slideId: string) => {
    setAvatarLoaded((prev) => ({ ...prev, [slideId]: true }));
  }, []);

  const handleAvatarError = useCallback((slideId: string) => {
    setAvatarError((prev) => ({ ...prev, [slideId]: true }));
    setAvatarLoaded((prev) => ({ ...prev, [slideId]: true }));
  }, []);

  // Don't render anything if no slides
  if (slides.length === 0) {
    return null;
  }

  // Text alignment classes
  const textAlignClass = {
    left: "text-left items-start",
    right: "text-right items-end",
    center: "text-center items-center",
  }[textAlign];

  // Only animate on first mount
  const shouldAnimate = !prefersReducedMotion && !hasAnimated.current;
  if (shouldAnimate) {
    hasAnimated.current = true;
  }

  // Wrapper component based on motion preference
  const Wrapper = prefersReducedMotion ? "div" : motion.div;
  const wrapperProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.5 },
      };

  return (
    <section
      data-testid="hero-carousel"
      className={cn(
        "relative",
        addContainerPadding && "px-4 md:px-6 lg:px-8",
        className
      )}
    >
      <Wrapper {...wrapperProps}>
        {/* touch-action: pan-y allows vertical scroll while enabling horizontal swipe */}
        <Carousel
          setApi={setApi}
          className="w-full touch-pan-y"
          opts={{
            loop: !isSingleSlide,
            slidesToScroll: 1,
            watchDrag: !isSingleSlide,
          }}
          plugins={plugins}
        >
          <CarouselContent className="flex w-full">
            {slides.map((slide, index) => {
              // Determine background source: backgroundUrl takes precedence over artworkId
              const backgroundSrc =
                slide.backgroundUrl ??
                (slide.artworkId ? `/api/artwork/${slide.artworkId}` : null);
              const hasBackground = !!backgroundSrc;

              return (
                <CarouselItem
                  key={slide.id}
                  className={cn(
                    "w-full pl-4",
                    isSingleSlide ? "basis-full" : "basis-[91%]"
                  )}
                >
                  <div>
                    <div
                      className={cn(
                        "bg-muted relative flex h-[max(280px,35dvh)] flex-col justify-between gap-4 overflow-hidden rounded-xl p-8",
                        textAlignClass
                      )}
                    >
                      {/* Loading skeleton (only for image backgrounds) */}
                      {hasBackground && !imageLoaded[slide.id] && (
                        <Skeleton className="absolute inset-0 rounded-xl" />
                      )}

                      {/* Background: URL/artworkId image OR Shader1 fallback */}
                      <div className="pointer-events-none absolute inset-0">
                        {hasBackground ? (
                          <>
                            <Image
                              src={backgroundSrc}
                              alt="" // Decorative image, title provides context
                              fill
                              sizes="(max-width: 768px) 100vw, 91vw"
                              className={cn(
                                "object-cover transition-opacity duration-300",
                                imageLoaded[slide.id]
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                              priority={index === 0} // LCP optimization for first slide
                              onLoad={() => handleImageLoad(slide.id)}
                              onError={() => handleImageLoad(slide.id)} // Still show content on error
                              data-testid="hero-carousel-artwork"
                              // Skip optimization for local API routes (query strings not supported in localPatterns)
                              unoptimized={backgroundSrc.startsWith("/api/")}
                            />
                            {/* Dark overlay for text readability */}
                            <div className="absolute inset-0 bg-black/40" />
                          </>
                        ) : /* Shader fallback when no background image */
                        /* navigator.webdriver check for Playwright test stability */
                        typeof window !== "undefined" && navigator.webdriver ? (
                          <div
                            data-testid="hero-fallback"
                            className="h-full w-full bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900"
                          />
                        ) : (
                          <Shader1
                            data-testid="hero-fallback"
                            className="h-full w-full"
                          />
                        )}
                      </div>

                      {/* Content - horizontal layout with avatar (single-slide) or vertical (multi-slide) */}
                      <div
                        className={cn(
                          "z-10 mt-auto flex w-full gap-5 text-white md:gap-6",
                          isSingleSlide &&
                            slide.profileId &&
                            slide.profileUsername
                            ? "items-end text-left" // Horizontal layout with avatar - content at bottom
                            : cn("flex-col gap-4", textAlignClass) // Vertical layout without avatar
                        )}
                      >
                        {/* Avatar - shown in single-slide mode when profile data is present */}
                        {isSingleSlide &&
                          slide.profileId &&
                          slide.profileUsername && (
                            <div className="group/avatar relative shrink-0">
                              <div
                                className={cn(
                                  "relative h-32 w-32 overflow-hidden rounded-full md:h-44 md:w-44 lg:h-52 lg:w-52",
                                  "ring-background shadow-2xl ring-4"
                                )}
                              >
                                {slide.profileHasImage &&
                                !avatarError[slide.id] ? (
                                  <>
                                    {/* Avatar loading skeleton */}
                                    {!avatarLoaded[slide.id] && (
                                      <Skeleton className="absolute inset-0 rounded-full" />
                                    )}
                                    <Image
                                      src={`/api/user/avatar?userId=${slide.profileId}`}
                                      alt={slide.name}
                                      fill
                                      sizes="(max-width: 768px) 128px, (max-width: 1024px) 176px, 208px"
                                      className={cn(
                                        "object-cover transition-opacity duration-300",
                                        avatarLoaded[slide.id]
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                      onLoad={() => handleAvatarLoad(slide.id)}
                                      onError={() =>
                                        handleAvatarError(slide.id)
                                      }
                                      unoptimized
                                    />
                                  </>
                                ) : (
                                  /* Initials fallback */
                                  <div
                                    className="flex h-full w-full items-center justify-center"
                                    style={{
                                      background: getInitialsGradient(
                                        slide.profileId
                                      ),
                                    }}
                                  >
                                    <span className="text-3xl font-bold text-white md:text-4xl">
                                      {getInitials(
                                        slide.profileName ?? null,
                                        slide.profileUsername
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        {/* Content stack - everything to the right of avatar */}
                        <div className="flex w-full min-w-0 flex-col justify-end pb-1">
                          {/* Title and description */}
                          <div>
                            {/* User Attribution Badge - shown when viewer doesn't own the content */}
                            {!isOwner &&
                              slide.ownerUsername &&
                              slide.profileId && (
                                <Link
                                  href={`/u/${slide.ownerUsername}`}
                                  className="group/badge bg-background/20 hover:bg-background/30 mb-2 inline-flex items-center gap-2 rounded-full border-0 px-2.5 py-1.5 backdrop-blur-sm transition-all"
                                  data-testid="hero-carousel-attribution"
                                >
                                  {/* Avatar */}
                                  <div className="relative size-6 shrink-0 overflow-hidden rounded-full ring-1 ring-white/20">
                                    {slide.profileHasImage &&
                                    !avatarError[slide.id] ? (
                                      <>
                                        {!avatarLoaded[slide.id] && (
                                          <Skeleton className="absolute inset-0 rounded-full" />
                                        )}
                                        <Image
                                          src={`/api/user/avatar?userId=${slide.profileId}`}
                                          alt={
                                            slide.ownerName ||
                                            slide.ownerUsername
                                          }
                                          fill
                                          sizes="24px"
                                          className={cn(
                                            "object-cover transition-opacity duration-300",
                                            avatarLoaded[slide.id]
                                              ? "opacity-100"
                                              : "opacity-0"
                                          )}
                                          onLoad={() =>
                                            handleAvatarLoad(slide.id)
                                          }
                                          onError={() =>
                                            handleAvatarError(slide.id)
                                          }
                                          unoptimized
                                        />
                                      </>
                                    ) : (
                                      <div
                                        className="flex size-full items-center justify-center text-[9px] font-bold text-white"
                                        style={{
                                          background: getInitialsGradient(
                                            slide.profileId
                                          ),
                                        }}
                                      >
                                        {getInitials(
                                          slide.profileName ?? null,
                                          slide.ownerUsername
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Username */}
                                  <span className="text-sm font-medium text-white transition-colors group-hover/badge:text-white/90">
                                    @{slide.ownerUsername}
                                  </span>
                                </Link>
                              )}

                            <h1 className="w-full truncate text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                              {slide.name}
                            </h1>
                            {slide.description && (
                              <p className="mt-1 line-clamp-2 w-full text-base text-white/60 md:text-lg">
                                {slide.description}
                              </p>
                            )}
                          </div>

                          {/* Progress bar */}
                          {isOwner && slide.progressPercentage != null && (
                            <div className="mt-2 flex w-full flex-col items-start gap-2">
                              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/20 backdrop-blur-sm">
                                <motion.div
                                  data-testid="hero-progress-bar"
                                  className="h-full rounded-full bg-white"
                                  initial={
                                    prefersReducedMotion ? false : { width: 0 }
                                  }
                                  animate={{
                                    width: `${slide.progressPercentage ?? 0}%`,
                                  }}
                                  transition={
                                    prefersReducedMotion
                                      ? { duration: 0 }
                                      : {
                                          type: "spring",
                                          stiffness: 100,
                                          damping: 20,
                                          delay: 0.2,
                                        }
                                  }
                                />
                              </div>
                              <span
                                data-testid="hero-progress-label"
                                className={cn(
                                  "truncate text-sm tracking-wide text-white/60 tabular-nums",
                                  !slide.progressLabel && "invisible"
                                )}
                              >
                                {slide.progressLabel || "\u00A0"}
                              </span>
                            </div>
                          )}

                          {/* Action buttons row */}
                          <div
                            className={cn(
                              "mt-2 flex w-full flex-wrap items-center gap-3",
                              // Only reserve space (min-h) when NOT in single-slide profile mode
                              !(
                                isSingleSlide &&
                                slide.profileId &&
                                slide.profileUsername
                              ) && "min-h-[2.75rem]",
                              textAlign === "right"
                                ? "justify-start"
                                : "justify-end"
                            )}
                          >
                            {/* Play button - only shown when isOwner and has media */}
                            {isOwner && slide.hasMedia && onPlay && (
                              <Button
                                size="lg"
                                variant="glass"
                                onClick={() => onPlay(slide.id)}
                                className="group text-md rounded-full"
                                data-testid="hero-play-button"
                              >
                                <span className="truncate">
                                  {slide.hasProgress ? "Resume" : "Play"}
                                  {slide.primaryMediaName &&
                                    ` ${slide.primaryMediaName}`}
                                </span>
                                <ArrowRight className="size-4 -rotate-45 transition-all ease-out group-hover:ml-1 group-hover:rotate-0" />
                              </Button>
                            )}

                            {/* Go to button - only shown when isOwner and has next item */}
                            {isOwner && slide.nextItem && onGoToNext && (
                              <Button
                                size="lg"
                                variant="glass"
                                onClick={() => onGoToNext(slide.nextItem!.id)}
                                className="group text-md rounded-full"
                                data-testid="hero-goto-button"
                              >
                                <span className="truncate">
                                  Next Up: {slide.nextItem.name}
                                </span>
                                <ArrowRight className="size-4 -rotate-45 transition-all ease-out group-hover:ml-1 group-hover:rotate-0" />
                              </Button>
                            )}

                            {/* CTA Button - for non-owners or explore page */}
                            {showCta && (
                              <Link href={slide.link}>
                                <Button
                                  size="lg"
                                  variant="glass"
                                  className="group text-md rounded-full"
                                >
                                  {ctaText}
                                  <ArrowRight className="size-4 -rotate-45 transition-all ease-out group-hover:ml-1 group-hover:rotate-0" />
                                </Button>
                              </Link>
                            )}

                            {/* Fork button - only shown when user doesn't own this slide */}
                            {onFork &&
                              currentUserId &&
                              slide.ownerUserId &&
                              currentUserId !== slide.ownerUserId && (
                                <Button
                                  size="lg"
                                  variant="glass"
                                  onClick={() => onFork(slide.id)}
                                  className="group text-md rounded-full"
                                  data-testid="hero-fork-button"
                                >
                                  <span>Fork</span>
                                  <Copy className="size-4" />
                                </Button>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>

          {/* Navigation Dots - only for multiple slides */}
          {/* Note: keyboard navigation via arrow keys handled by Embla's built-in keyboard support */}
          {!isSingleSlide && (
            <div
              className="mt-4 flex justify-center gap-2"
              role="tablist"
              aria-label="Carousel navigation"
            >
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => api?.scrollTo(index)}
                  className={cn(
                    // Explicit focus ring for design system consistency
                    "focus-visible:ring-primary focus-visible:ring-offset-background h-2.5 w-2.5 cursor-pointer rounded-full transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    current === index
                      ? "bg-primary w-4"
                      : "bg-muted-foreground/50 hover:bg-muted-foreground/70"
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={current === index ? "true" : undefined}
                  role="tab"
                  aria-selected={current === index}
                />
              ))}
            </div>
          )}
        </Carousel>
      </Wrapper>
    </section>
  );
}
