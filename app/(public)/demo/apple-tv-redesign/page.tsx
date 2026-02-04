/**
 * Apple TV+ Redesign Demo - Index Page.
 * Navigation hub for all demo views.
 */

import Link from "next/link";
import { Film, Tv, Compass, User } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

/** Demo page links. */
const DEMO_PAGES = [
  {
    href: "/demo/apple-tv-redesign/item",
    title: "Item Page",
    description: "Single movie view with cast, trailers, recommendations",
    icon: Film,
    example: "Dune: Part Two",
  },
  {
    href: "/demo/apple-tv-redesign/container",
    title: "Container Page",
    description: "TV show with Contents/About tabs and seasons grid",
    icon: Tv,
    example: "Severance",
  },
  {
    href: "/demo/apple-tv-redesign/explore",
    title: "Explore Page",
    description: "Public discovery with hero carousel and grid",
    icon: Compass,
    example: "Featured content",
  },
  {
    href: "/demo/apple-tv-redesign/profile",
    title: "Profile Page",
    description: "User profile with avatar, pinned items, library",
    icon: User,
    example: "@filmfan",
  },
];

/**
 * Demo index page with navigation to all views.
 */
export default function AppleTVDemoIndexPage() {
  return (
    <>
      <SiteHeader title="Apple TV+ Demo" titleHref="/demo/apple-tv-redesign" />
      <div className="apple-tv-demo flex flex-1 flex-col bg-[var(--atv-bg)] text-[var(--atv-text-primary)]">
        {/* Hero header */}
        <header
          className={cn(
            "relative flex flex-col items-center justify-center",
            "px-6 py-24 text-center",
            "bg-gradient-to-b from-[var(--atv-surface)] to-[var(--atv-bg)]"
          )}
        >
          <h1
            className={cn(
              "text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl",
              "bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent"
            )}
            style={{ fontFamily: "var(--atv-font-display)" }}
          >
            Apple TV+ Redesign
          </h1>
          <p
            className={cn(
              "mt-4 max-w-2xl text-lg",
              "text-[var(--atv-text-secondary)]"
            )}
          >
            Preview the cinematic redesign for CanonCore. Full-bleed heroes,
            refined typography, and content-forward interfaces inspired by Apple
            TV+.
          </p>
        </header>

        {/* Demo links grid */}
        <main className={cn("mx-auto max-w-5xl", "px-6 pb-24", "-mt-8")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {DEMO_PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className={cn(
                  "group relative overflow-hidden rounded-2xl",
                  "bg-[var(--atv-surface)]",
                  "border border-[var(--atv-border)]",
                  "p-6",
                  "transition-all duration-300",
                  "hover:border-white/20 hover:shadow-lg hover:shadow-white/5",
                  "hover:scale-[1.02]",
                  "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "mb-4 inline-flex size-12 items-center justify-center rounded-xl",
                    "bg-white/5",
                    "group-hover:bg-white/10",
                    "transition-colors duration-300"
                  )}
                >
                  <page.icon
                    className="size-6 text-white/60 transition-colors group-hover:text-white/80"
                    aria-hidden="true"
                  />
                </div>

                {/* Title */}
                <h2
                  className={cn(
                    "text-xl font-semibold tracking-tight",
                    "text-[var(--atv-text-primary)]"
                  )}
                >
                  {page.title}
                </h2>

                {/* Description */}
                <p
                  className={cn(
                    "mt-2 text-sm",
                    "text-[var(--atv-text-secondary)]"
                  )}
                >
                  {page.description}
                </p>

                {/* Example badge */}
                <div className="mt-4">
                  <span
                    className={cn(
                      "inline-flex items-center",
                      "rounded-full px-3 py-1",
                      "text-xs font-medium",
                      "bg-white/5 text-[var(--atv-text-tertiary)]"
                    )}
                  >
                    Example: {page.example}
                  </span>
                </div>

                {/* Arrow indicator */}
                <div
                  className={cn(
                    "absolute top-1/2 right-6 -translate-y-1/2",
                    "text-[var(--atv-text-tertiary)]",
                    "translate-x-2 transform opacity-0",
                    "group-hover:translate-x-0 group-hover:opacity-100",
                    "transition-all duration-300"
                  )}
                >
                  →
                </div>
              </Link>
            ))}
          </div>

          {/* Design principles */}
          <section className="mt-16">
            <h2
              className={cn(
                "mb-6 text-xs font-medium tracking-[0.2em] uppercase",
                "text-[var(--atv-text-tertiary)]"
              )}
            >
              Design Principles
            </h2>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Content is the interface",
                  description: "Artwork dominates, UI chrome minimal",
                },
                {
                  title: "Breathing room",
                  description: "Generous spacing, items don't feel cramped",
                },
                {
                  title: "Subtle sophistication",
                  description: "Refined transitions, no jarring movements",
                },
                {
                  title: "Unified experience",
                  description: "All page types share the same design system",
                },
              ].map((principle) => (
                <div key={principle.title} className="space-y-2">
                  <h3
                    className={cn(
                      "text-sm font-medium",
                      "text-[var(--atv-text-primary)]"
                    )}
                  >
                    {principle.title}
                  </h3>
                  <p className="text-xs text-[var(--atv-text-tertiary)]">
                    {principle.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
