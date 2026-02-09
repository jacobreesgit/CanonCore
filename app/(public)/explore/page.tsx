/**
 * Public explore page showcasing featured and recent public items.
 * Features a Hero226 carousel with 5 featured items at the top.
 */

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getExploreItems, getFeaturedItems } from "@/lib/public-auth";
import { getProfile } from "@/lib/user-actions";
import { getItemTmdbMetadata } from "@/lib/tmdb-client";
import { SiteHeader } from "@/components/site-header";
import { ExploreClient } from "./explore-client";

export const metadata: Metadata = {
  title: "Explore | CanonCore",
  description:
    "Discover public items from the CanonCore community. Browse and fork curated media libraries.",
  openGraph: {
    title: "Explore | CanonCore",
    description:
      "Discover public items from the CanonCore community. Browse and fork curated media libraries.",
    type: "website",
  },
};

/**
 * Explore page server component.
 * Fetches featured items for carousel and all public items for grid.
 */
export default async function ExplorePage() {
  // Get session, profile, featured items, and explore items in parallel
  const [session, profileResult, featuredItems, items] = await Promise.all([
    auth(),
    getProfile(),
    getFeaturedItems(5),
    getExploreItems(50, 0, null),
  ]);

  const currentUserId = session?.user?.id ?? null;
  const profile = profileResult.success ? profileResult.data : null;
  const currentUser = profile
    ? {
        id: profile.id,
        username: profile.username,
        name: profile.name,
      }
    : null;

  // Re-fetch items with user ID for progress calculation if logged in
  const itemsWithProgress = currentUserId
    ? await getExploreItems(50, 0, currentUserId)
    : items;

  // Batch-fetch TMDB metadata for featured items (parallel, graceful failures)
  const tmdbResults = await Promise.all(
    featuredItems.map((item) =>
      item.tmdbId && item.tmdbType
        ? getItemTmdbMetadata(item.tmdbId, item.tmdbType)
        : Promise.resolve(null)
    )
  );
  const enrichedFeaturedItems = featuredItems.map((item, i) => ({
    ...item,
    tmdbMetadata: tmdbResults[i] ?? null,
  }));

  return (
    <>
      <SiteHeader title="Explore" titleHref="/explore" />
      <div className="bg-background text-foreground flex flex-1 flex-col">
        <ExploreClient
          items={itemsWithProgress}
          featuredItems={enrichedFeaturedItems}
          currentUser={currentUser}
        />
      </div>
    </>
  );
}
