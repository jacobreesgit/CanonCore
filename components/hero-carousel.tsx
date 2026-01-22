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
import { ArrowRight } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Shader1 } from "@/components/shader1";

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
  /** Callback when play button clicked (only shown when isOwner=true and slide.hasMedia=true) */
  onPlay?: (slideId: string) => void;
  /** Callback when "Go to" button clicked (only shown when isOwner=true and slide.nextItem exists) */
  onGoToNext?: (itemId: string) => void;
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
  onPlay,
  onGoToNext,
}: HeroCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const hasAnimated = useRef(false);

  // Respect user's reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  const isSingleSlide = slides.length === 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [autoplayPlugin, setAutoplayPlugin] = useState<any[] | null>(null);

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
    <section data-testid="hero-carousel" className={cn("relative", className)}>
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
          <CarouselContent className="flex w-full gap-4">
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
                    "w-full",
                    isSingleSlide ? "basis-full" : "basis-[91%]"
                  )}
                >
                  <div className="p-1">
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

                      {/* Content - Configurable text alignment */}
                      <div
                        className={cn(
                          "z-10 mt-auto flex w-full flex-col gap-4 text-white",
                          textAlignClass
                        )}
                      >
                        <h1 className="w-full truncate text-4xl font-bold tracking-tight md:text-5xl">
                          {slide.name}
                        </h1>
                        {slide.description && (
                          <p className="line-clamp-2 w-full text-lg text-white/80">
                            {slide.description}
                          </p>
                        )}
                      </div>

                      {/* Progress bar */}
                      {isOwner && slide.progressPercentage != null && (
                        <div
                          className={cn(
                            "z-10 flex w-full flex-col items-start gap-2",
                            !slide.description && "mt-4"
                          )}
                        >
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

                      {/* Action buttons row - always rendered for consistent layout */}
                      <div
                        className={cn(
                          "z-10 flex min-h-[2.75rem] w-full flex-wrap items-center gap-3",
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
