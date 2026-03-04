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

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Fade from "embla-carousel-fade";

import { cn } from "@/lib/utils";
import { createColourShades } from "@/lib/colour-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { MetadataLine } from "@/components/items/metadata-line";

import { MeshGradient } from "@mesh-gradient/react";

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
  backgroundElement,
  onColourChange,
  className,
}: CinematicHeroProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, watchDrag: false },
    [Fade()]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [logoErrorIds, setLogoErrorIds] = useState<Set<string>>(new Set());

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

  // Track image settled state (fires on both load and error)
  const handleImageSettled = useCallback((slideId: string) => {
    setImageLoaded((prev) => ({ ...prev, [slideId]: true }));
  }, []);

  const activeSlide = slides[activeIndex];
  const activeDominantColour = activeSlide?.dominantColour ?? null;
  const colourStyles = useMemo(
    () =>
      activeDominantColour
        ? createColourShades(activeDominantColour)
        : undefined,
    [activeDominantColour]
  );

  // Notify parent of colour changes (for page-level theming)
  useEffect(() => {
    onColourChange?.(activeDominantColour);
  }, [activeDominantColour, onColourChange]);

  // Logo error is tracked per slide — only suppress logo for the slide that failed
  const logoError = logoErrorIds.has(activeSlide?.id ?? "");

  // Don't render anything if no slides
  if (slides.length === 0 || !activeSlide) {
    return null;
  }

  const Heading = headingLevel;

  // Resolve actions: renderActions takes precedence, then actions prop
  const resolvedActions = renderActions ? renderActions(activeSlide) : actions;

  return (
    <section
      className={cn(
        "relative flex min-h-[calc(55vh+var(--header-height))] w-full flex-col bg-[var(--dark-900)] md:min-h-[calc(65vh+var(--header-height))] lg:block lg:h-[calc(65vh+var(--header-height))] lg:min-h-0 lg:overflow-hidden",
        activeDominantColour && "transition-colours-pipeline",
        className
      )}
      style={colourStyles}
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
        className="absolute inset-0 overflow-hidden"
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
                    onLoad={() => handleImageSettled(slide.id)}
                    onError={() => handleImageSettled(slide.id)}
                    unoptimized={backgroundSrc.startsWith("/api/")}
                  />
                ) : (
                  <MeshGradient
                    className="absolute inset-0 h-full w-full"
                    options={{
                      colors: ["#0a0a0a", "#1a1a2e", "#16213e", "#0f3460"],
                      animationSpeed: 0.2,
                      seed: 7,
                    }}
                  />
                )}

                {/* Cinematic diagonal overlay — strongest at bottom-left content area.
                   Built inline so it resolves --dark-900 from the hero's own
                   colour scope (inline styles) rather than the :root initial value. */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: [
                      "linear-gradient(to top right, color-mix(in srgb, var(--dark-900) 95%, transparent) 0%, color-mix(in srgb, var(--dark-900) 70%, transparent) 25%, color-mix(in srgb, var(--dark-900) 30%, transparent) 50%, transparent 70%)",
                      "linear-gradient(to top, var(--dark-900) 0%, color-mix(in srgb, var(--dark-900) 70%, transparent) 20%, color-mix(in srgb, var(--dark-900) 30%, transparent) 40%, transparent 55%)",
                      "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 25%)",
                    ].join(", "),
                  }}
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Content — mobile: relative flow (grows hero). Desktop: absolute bottom. */}
      <div className="animate-slide-up pointer-events-none relative z-10 mt-auto pt-[30vh] md:pt-[40vh] lg:absolute lg:inset-x-0 lg:bottom-0 lg:mt-0 lg:pt-0">
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
                {activeSlide.profile?.bio && (
                  <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
                    {activeSlide.profile.bio}
                  </p>
                )}
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
              {/* Title — logo image with text fallback on error */}
              {activeSlide.logoImage && !logoError ? (
                <div className="relative">
                  <Image
                    src={activeSlide.logoImage}
                    alt={activeSlide.name}
                    width={400}
                    height={180}
                    sizes="(max-width: 640px) 220px, (max-width: 768px) 280px, (max-width: 1024px) 350px, 400px"
                    className="h-auto max-h-[100px] w-auto max-w-[220px] object-contain object-left drop-shadow-lg sm:max-h-[120px] sm:max-w-[280px] md:max-h-[150px] md:max-w-[350px] lg:max-h-[180px] lg:max-w-[400px]"
                    unoptimized={activeSlide.logoImage.startsWith("/api/")}
                    onError={() =>
                      setLogoErrorIds((prev) =>
                        new Set(prev).add(activeSlide.id)
                      )
                    }
                  />
                  {/* sr-only title for accessibility */}
                  <Heading className="sr-only">{activeSlide.name}</Heading>
                </div>
              ) : (
                <Heading
                  className={cn(
                    "font-bold tracking-tight text-balance",
                    "text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl",
                    "text-white drop-shadow-lg"
                  )}
                >
                  {activeSlide.name}
                </Heading>
              )}

              {/* Tagline */}
              {activeSlide.tagline && (
                <p className="mt-5 text-lg text-white/70 italic md:text-xl">
                  &ldquo;{activeSlide.tagline}&rdquo;
                </p>
              )}

              {/* Metadata line (includes genres, sync status, and attribution inline) */}
              {(activeSlide.metadata ||
                (activeSlide.genres && activeSlide.genres.length > 0) ||
                activeSlide.syncStatus ||
                activeSlide.driveFileId ||
                activeSlide.attribution) && (
                <div className="mt-4">
                  <MetadataLine
                    year={activeSlide.metadata?.year}
                    runtime={activeSlide.metadata?.runtime}
                    contentRating={activeSlide.metadata?.contentRating}
                    voteAverage={activeSlide.metadata?.voteAverage}
                    genres={activeSlide.genres}
                    syncStatus={activeSlide.syncStatus}
                    driveFileId={activeSlide.driveFileId}
                    attribution={activeSlide.attribution}
                    attributionHref={activeSlide.attributionHref}
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
                <div className="mt-6">
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
            <div className="pointer-events-auto mt-6 flex flex-wrap gap-3">
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
