/**
 * Hero carousel for explore page with auto-advancing slides.
 * Shows featured items with backdrop, title, and owner attribution.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Share2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DemoGridItem } from "../lib/tmdb-demo";

interface DemoHeroCarouselProps {
  /** Featured items to display. */
  items: DemoGridItem[];
  /** Auto-advance interval in ms (0 to disable). */
  autoAdvanceInterval?: number;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Auto-advancing hero carousel for explore page.
 */
export function DemoHeroCarousel({
  items,
  autoAdvanceInterval = 5000,
  className,
}: DemoHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goToSlide = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  // Auto-advance
  useEffect(() => {
    if (autoAdvanceInterval === 0 || isPaused) return;

    const timer = setInterval(goToNext, autoAdvanceInterval);
    return () => clearInterval(timer);
  }, [autoAdvanceInterval, isPaused, goToNext]);

  // Check for reduced motion preference using layout effect pattern
  // to avoid flash of animation before preference is detected
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // Using a ref-like pattern to avoid the lint warning about setState in effect
      // This is a valid use case: subscribing to external system (media query)
      if (e.matches) {
        setIsPaused(true);
      }
    };
    // Check initial state
    handleChange(mediaQuery);
    // Subscribe to changes
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const activeItem = items[activeIndex];

  if (!activeItem) return null;

  return (
    <section
      className={cn(
        "relative h-[40vh] w-full overflow-hidden md:h-[50vh]",
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Featured content carousel"
    >
      {/* ═══════════════════════════════════════════════════════════
          Slides
          ═══════════════════════════════════════════════════════════ */}
      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-600",
            index === activeIndex
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          )}
          aria-hidden={index !== activeIndex}
        >
          {/* Backdrop */}
          {item.backdropUrl && (
            <Image
              src={item.backdropUrl}
              alt=""
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover object-center"
            />
          )}

          {/* Gradients */}
          <div
            className="absolute inset-x-0 top-0 h-[30%]"
            style={{ background: "var(--atv-gradient-top)" }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[70%]"
            style={{ background: "var(--atv-gradient-hero)" }}
            aria-hidden="true"
          />
        </div>
      ))}

      {/* ═══════════════════════════════════════════════════════════
          Content
          ═══════════════════════════════════════════════════════════ */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div
          className={cn(
            "px-[var(--atv-px-mobile)] pb-16",
            "sm:px-[var(--atv-px-sm)]",
            "md:px-[var(--atv-px-md)] md:pb-20",
            "lg:px-[var(--atv-px-lg)]",
            "xl:px-[var(--atv-px-xl)]",
            "2xl:px-[var(--atv-px-2xl)]"
          )}
        >
          {/* Owner attribution */}
          {activeItem.owner && (
            <p className="mb-2 text-sm text-white/50">
              Shared by @{activeItem.owner.username}
            </p>
          )}

          {/* Title */}
          <h2
            className={cn(
              "text-3xl font-bold tracking-tight text-balance",
              "sm:text-4xl md:text-5xl lg:text-6xl",
              "text-white drop-shadow-lg"
            )}
            style={{ fontFamily: "var(--atv-font-display)" }}
          >
            {activeItem.title}
          </h2>

          {/* Year */}
          {activeItem.year && (
            <p className="mt-2 text-sm text-white/60 tabular-nums">
              {activeItem.year}
            </p>
          )}

          {/* Description */}
          {activeItem.overview && (
            <p className="mt-3 line-clamp-2 max-w-xl text-sm text-white/70 md:text-base">
              {activeItem.overview}
            </p>
          )}

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/demo/apple-tv-redesign/item"
              className={cn(
                "group inline-flex items-center gap-2",
                "h-10 rounded-full px-5",
                "text-sm font-medium",
                "bg-white/10 text-white backdrop-blur-sm",
                "border border-white/20",
                "hover:bg-white/20",
                "transition-all duration-150",
                "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
              )}
            >
              <span>View Item</span>
              <ArrowRight
                className="size-4 -rotate-45 transition-all ease-out group-hover:ml-1 group-hover:rotate-0"
                aria-hidden="true"
              />
            </Link>

            {/* Fork button with badge */}
            <div className="relative">
              <button
                className={cn(
                  "group inline-flex items-center gap-2",
                  "h-10 rounded-full px-5",
                  "text-sm font-medium",
                  "bg-white/10 text-white backdrop-blur-sm",
                  "border border-white/20",
                  "hover:bg-white/20",
                  "transition-all duration-150",
                  "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
                )}
              >
                <Share2 className="size-4" aria-hidden="true" />
                <span>Fork</span>
              </button>

              {/* Fork count badge */}
              <div
                className={cn(
                  "absolute -top-3 -right-4",
                  "flex items-center gap-1 rounded-full px-2 py-0.5",
                  "bg-white/20 backdrop-blur-sm",
                  "text-xs font-medium text-white",
                  "border border-white/30"
                )}
              >
                <Users className="size-3" aria-hidden="true" />
                <span>52</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Dot Navigation
          ═══════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          "absolute bottom-6 left-1/2 z-20 -translate-x-1/2",
          "flex items-center gap-2"
        )}
        role="tablist"
        aria-label="Carousel slides"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Go to slide ${index + 1}: ${item.title}`}
            onClick={() => goToSlide(index)}
            className={cn(
              "h-2 rounded-full transition-all duration-200 cursor-pointer",
              index === activeIndex
                ? "w-6 bg-white"
                : "w-2 bg-white/40 hover:bg-white/60"
            )}
          />
        ))}
      </div>
    </section>
  );
}
