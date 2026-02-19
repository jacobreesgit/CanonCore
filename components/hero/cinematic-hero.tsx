/**
 * Unified cinematic hero component combining carousel, item detail, and profile modes.
 * Full-bleed layout with gradient overlays, Embla carousel, and glassmorphism styling.
 *
 * Modes:
 * - Multi-slide: Embla carousel with auto-advance, dot navigation, renderActions per-slide
 * - Single-slide item: Static hero with TMDB metadata, progress, actions slot
 * - Single-slide profile: Avatar + name + username + inline progress
 *
 * Accessibility: Supports reduced motion, aria-current on active dots.
 * Performance: Uses Next.js Image for LCP optimization.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import useEmblaCarousel from "embla-carousel-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { MetadataLine } from "@/components/items/metadata-line";

const Shader1 = dynamic(
  () =>
    import("@/components/shader-background").then((mod) => ({
      default: mod.Shader1,
    })),
  { ssr: false }
);
import { ProgressBar } from "@/components/ui/progress-bar";
import { HeroAvatar } from "./hero-avatar";
import type { CinematicHeroProps } from "./types";

/**
 * Unified cinematic hero with carousel, item detail, and profile avatar modes.
 */
export function CinematicHero({
  slides,
  renderActions,
  actions,
  headingLevel = "h2",
  autoAdvanceInterval = 5000,
  enableKenBurns = true,
  disableShader = false,
  backgroundElement,
  className,
}: CinematicHeroProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});

  const isSingleSlide = slides.length === 1;

  // Sync active index with Embla
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setActiveIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("init", onSelect);
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("init", onSelect);
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Auto-advance (respects reduced motion)
  useEffect(() => {
    if (autoAdvanceInterval === 0 || isPaused || !emblaApi || isSingleSlide)
      return;

    const timer = setInterval(() => {
      emblaApi.scrollNext();
    }, autoAdvanceInterval);
    return () => clearInterval(timer);
  }, [autoAdvanceInterval, isPaused, emblaApi, isSingleSlide]);

  // Pause auto-advance when user prefers reduced motion (bidirectional)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsPaused(e.matches);
    };
    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const goToSlide = useCallback(
    (index: number) => {
      emblaApi?.scrollTo(index);
    },
    [emblaApi]
  );

  // Track image loading state
  const handleImageLoad = useCallback((slideId: string) => {
    setImageLoaded((prev) => ({ ...prev, [slideId]: true }));
  }, []);

  // Don't render anything if no slides
  if (slides.length === 0) {
    return null;
  }

  const activeSlide = slides[activeIndex];
  if (!activeSlide) return null;

  const Heading = headingLevel;

  // Resolve actions: renderActions takes precedence, then actions prop
  const resolvedActions = renderActions ? renderActions(activeSlide) : actions;

  return (
    <section
      className={cn(
        "relative h-[55vh] w-full overflow-hidden md:h-[65vh]",
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Featured content carousel"
      data-testid="hero-carousel"
    >
      {/* Screen reader announcement for slide changes */}
      {!isSingleSlide && (
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {`Slide ${activeIndex + 1} of ${slides.length}: ${activeSlide.name}`}
        </div>
      )}

      {/* Embla Carousel Container — skip ref for single slide to avoid unnecessary init */}
      <div
        ref={isSingleSlide ? undefined : emblaRef}
        className="h-full overflow-hidden"
      >
        <div className="flex h-full">
          {slides.map((slide, index) => {
            const backgroundSrc =
              slide.backgroundUrl ??
              (slide.artworkId ? `/api/artwork/${slide.artworkId}` : null);
            const hasBackground = !!backgroundSrc;

            return (
              <div
                key={slide.id}
                className="relative h-full w-full flex-[0_0_100%] overflow-hidden"
              >
                {/* Loading skeleton */}
                {!backgroundElement &&
                  hasBackground &&
                  !imageLoaded[slide.id] && (
                    <Skeleton className="absolute inset-0" />
                  )}

                {/* Backdrop: custom element > image > shader > gradient */}
                {backgroundElement ? (
                  <div className="absolute inset-0 overflow-hidden">
                    {backgroundElement}
                  </div>
                ) : hasBackground ? (
                  <Image
                    src={backgroundSrc}
                    alt={isSingleSlide ? slide.name : ""}
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    className={cn(
                      "object-cover object-center transition-opacity duration-300",
                      imageLoaded[slide.id] ? "opacity-100" : "opacity-0",
                      enableKenBurns && "ken-burns"
                    )}
                    onLoad={() => handleImageLoad(slide.id)}
                    onError={() => handleImageLoad(slide.id)}
                    unoptimized={backgroundSrc.startsWith("/api/")}
                  />
                ) : disableShader ? (
                  <div className="h-full w-full bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900" />
                ) : (
                  <Shader1 className="h-full w-full" />
                )}

                {/* Cinematic diagonal overlay — strongest at bottom-left content area */}
                <div
                  className="absolute inset-0"
                  style={{ background: "var(--gradient-hero-overlay)" }}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Content (positioned over carousel) */}
      <div className="animate-slide-up pointer-events-none absolute inset-x-0 bottom-0 z-10">
        <div
          className={cn(
            "px-[var(--section-px-mobile)]",
            isSingleSlide ? "pb-8" : "pb-16",
            "sm:px-[var(--section-px-sm)]",
            "md:px-[var(--section-px-md)]",
            isSingleSlide ? "md:pb-12" : "md:pb-20",
            "lg:px-[var(--section-px-lg)]",
            "xl:px-[var(--section-px-xl)]",
            "2xl:px-[var(--section-px-2xl)]"
          )}
        >
          {/* Profile avatar mode */}
          {activeSlide.profile ? (
            <div className="flex items-end gap-5 md:gap-8">
              <HeroAvatar
                userId={activeSlide.profile.id}
                name={activeSlide.profile.name}
                username={activeSlide.profile.username}
                hasImage={activeSlide.profile.hasImage}
              />

              {/* Name and username */}
              <div className="min-w-0 flex-1 pb-1">
                <Heading
                  className={cn(
                    "text-3xl font-bold tracking-tight text-balance",
                    "sm:text-4xl md:text-5xl lg:text-6xl",
                    "text-white drop-shadow-lg"
                  )}
                >
                  {activeSlide.name}
                </Heading>
                <p className="mt-2 truncate text-sm text-white/60 md:text-base">
                  @{activeSlide.profile.username}
                </p>
                {typeof activeSlide.progress === "number" &&
                  activeSlide.progress > 0 && (
                    <div className="mt-5 flex max-w-xs flex-col gap-2">
                      <div className="relative h-1 w-full max-w-[400px] overflow-hidden rounded-full bg-white/10 backdrop-blur-sm">
                        <div
                          className="bg-primary absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out"
                          style={{
                            width:
                              activeSlide.progress === 0
                                ? "0%"
                                : `max(8px, ${activeSlide.progress}%)`,
                          }}
                        />
                      </div>
                      {activeSlide.progressLabel && (
                        <span className="text-sm tracking-wide text-white/50 tabular-nums">
                          {activeSlide.progressLabel}
                        </span>
                      )}
                    </div>
                  )}
              </div>
            </div>
          ) : (
            /* Standard item/explore layout */
            <>
              {/* Attribution */}
              {activeSlide.attribution && (
                <p className="mb-2 text-sm text-white/50">
                  {activeSlide.attributionHref ? (
                    <Link
                      href={activeSlide.attributionHref}
                      className="pointer-events-auto underline decoration-white/0 underline-offset-2 transition-[text-decoration-color] hover:decoration-white/50"
                    >
                      {activeSlide.attribution}
                    </Link>
                  ) : (
                    activeSlide.attribution
                  )}
                </p>
              )}

              {/* Title */}
              <Heading
                className={cn(
                  "font-bold tracking-tight text-balance",
                  "text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl",
                  "text-white drop-shadow-lg"
                )}
              >
                {activeSlide.name}
              </Heading>

              {/* Tagline */}
              {activeSlide.tagline && (
                <p className="mt-2 text-lg text-white/70 italic md:text-xl">
                  &ldquo;{activeSlide.tagline}&rdquo;
                </p>
              )}

              {/* Metadata line (includes genres inline) */}
              {(activeSlide.metadata ||
                (activeSlide.genres && activeSlide.genres.length > 0)) && (
                <div className="mt-4">
                  <MetadataLine
                    year={activeSlide.metadata?.year}
                    runtime={activeSlide.metadata?.runtime}
                    contentRating={activeSlide.metadata?.contentRating}
                    voteAverage={activeSlide.metadata?.voteAverage}
                    genres={activeSlide.genres}
                  />
                </div>
              )}

              {/* Description */}
              {activeSlide.description && (
                <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
                  {activeSlide.description}
                </p>
              )}

              {/* Progress bar */}
              {typeof activeSlide.progress === "number" && (
                <div className="mt-5">
                  <ProgressBar
                    progress={activeSlide.progress}
                    label={activeSlide.progressLabel}
                  />
                </div>
              )}
            </>
          )}

          {/* Actions */}
          {resolvedActions && (
            <div className="pointer-events-auto mt-5 flex flex-wrap gap-3">
              {resolvedActions}
            </div>
          )}
        </div>
      </div>

      {/* Dot Navigation - only for multiple slides */}
      {!isSingleSlide && (
        <div
          className={cn(
            "absolute bottom-6 left-1/2 z-20 -translate-x-1/2",
            "flex items-center gap-2"
          )}
          role="tablist"
          aria-label="Carousel slides"
        >
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Go to slide ${index + 1}: ${slide.name}`}
              data-testid={`hero-dot-${index + 1}`}
              onClick={() => goToSlide(index)}
              className={cn(
                "h-2 cursor-pointer rounded-full transition-all duration-200",
                "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
                index === activeIndex
                  ? "w-6 bg-white"
                  : "w-2 bg-white/40 hover:bg-white/60"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default CinematicHero;
