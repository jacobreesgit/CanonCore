/**
 * Apple TV+ Redesign Demo - Profile Page.
 * User profile with avatar, pinned items, and library grid.
 */

import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { DemoProgressBar } from "../components";
import { getDemoMovieGrid, getDemoTvShowGrid } from "../lib/tmdb-demo";
import { cn } from "@/lib/utils";
import { ProfileContent } from "./profile-content";

/** Mock user data for the profile. */
const MOCK_PROFILE = {
  name: "Film Fan",
  username: "filmfan",
  avatarUrl: null, // Will use initials
  heroBackdropId: 693134, // Dune: Part Two
};

/**
 * Profile page showing user info, pinned items, and library.
 */
export default async function ProfileDemoPage() {
  // Fetch library items
  const [movieItems, tvItems] = await Promise.all([
    getDemoMovieGrid(),
    getDemoTvShowGrid(),
  ]);

  // Add deterministic mock progress data based on index
  const allItems = [...movieItems, ...tvItems].map((item, index) => ({
    ...item,
    // Deterministic progress based on index for consistent renders
    progress: (index * 23 + 17) % 100,
    // Mark first 3 as pinned for demo
    isPinned: index < 3,
  }));

  // Calculate overall library progress
  const totalProgress = allItems.reduce(
    (sum, item) => sum + (item.progress || 0),
    0
  );
  const averageProgress = Math.round(totalProgress / allItems.length);

  // First 3 items are pinned
  const pinnedItems = allItems.slice(0, 3);
  const libraryItems = allItems.slice(3);

  // Get hero backdrop from first movie
  const heroBackdropUrl = movieItems[0]?.backdropUrl;

  return (
    <>
      <SiteHeader
        title="Apple TV+ Demo"
        titleHref="/demo/apple-tv-redesign"
        breadcrumbs={[
          {
            id: "profile",
            name: `@${MOCK_PROFILE.username}`,
            href: "/demo/apple-tv-redesign/profile",
          },
        ]}
      />
      <div className="apple-tv-demo flex flex-1 flex-col bg-[var(--atv-bg)] text-[var(--atv-text-primary)]">
        {/* Hero Section with Avatar */}
        <section className="relative h-[40vh] w-full overflow-hidden md:h-[50vh]">
          {/* Backdrop */}
          {heroBackdropUrl && (
            <Image
              src={heroBackdropUrl}
              alt=""
              fill
              priority
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

          {/* Content */}
          <div className="absolute inset-x-0 bottom-0 z-10">
            <div
              className={cn(
                "flex items-end gap-6",
                "px-[var(--atv-px-mobile)] pb-8",
                "sm:px-[var(--atv-px-sm)]",
                "md:px-[var(--atv-px-md)] md:pb-12",
                "lg:px-[var(--atv-px-lg)]",
                "xl:px-[var(--atv-px-xl)]",
                "2xl:px-[var(--atv-px-2xl)]"
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "relative size-24 flex-shrink-0 md:size-32",
                  "overflow-hidden rounded-full",
                  "bg-gradient-to-br from-white/20 to-white/5",
                  "ring-4 ring-[var(--atv-bg)]"
                )}
              >
                {/* Initials fallback */}
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-3xl font-bold text-white md:text-4xl">
                    {MOCK_PROFILE.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
              </div>

              {/* User info */}
              <div className="flex-1 pb-1">
                <h1
                  className={cn(
                    "text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl",
                    "text-white"
                  )}
                  style={{ fontFamily: "var(--atv-font-display)" }}
                >
                  {MOCK_PROFILE.name}
                </h1>
                <p className="mt-1 text-sm text-white/60">
                  @{MOCK_PROFILE.username}
                </p>

                {/* Library progress */}
                <div className="mt-3 max-w-xs">
                  <DemoProgressBar
                    progress={averageProgress}
                    label={`${averageProgress}% watched`}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Content */}
        <ProfileContent pinnedItems={pinnedItems} libraryItems={libraryItems} />

        {/* Footer spacing */}
        <div className="h-16" />
      </div>
    </>
  );
}
