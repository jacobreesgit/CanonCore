/**
 * Public explore page showcasing featured and recent public items.
 * Features a cinematic hero carousel with 5 featured items at the top.
 */

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getExploreItems, getFeaturedItems } from "@/lib/public-auth";
import { getProfile } from "@/lib/user-actions";
import { getGoogleDriveConnection } from "@/lib/google-drive-actions";
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
  twitter: {
    card: "summary_large_image",
    title: "Explore | CanonCore",
    description:
      "Discover public items from the CanonCore community. Browse and fork curated media libraries.",
  },
};

/**
 * Explore page server component.
 * Fetches featured items for carousel and all public items for grid.
 */
export default async function ExplorePage() {
  // Start auth, profile, and featured items immediately
  const sessionPromise = auth();
  const profilePromise = getProfile();

  // Chain TMDB enrichment on featured items so metadata fetching starts
  // as soon as featured items resolve, without waiting for the full items list.
  const enrichedFeaturedPromise = getFeaturedItems(5).then(
    async (featuredItems) => {
      const tmdbResults = await Promise.all(
        featuredItems.map((item) =>
          item.tmdbId && item.tmdbType
            ? getItemTmdbMetadata(item.tmdbId, item.tmdbType)
            : Promise.resolve(null)
        )
      );
      return featuredItems.map((item, i) => ({
        ...item,
        tmdbMetadata: tmdbResults[i] ?? null,
      }));
    }
  );

  // Await session first so we can pass the correct userId to getExploreItems
  const session = await sessionPromise;
  const currentUserId = session?.user?.id ?? null;

  // Fetch items with correct userId (avoids double-fetch), plus finish parallel work
  const [profileResult, enrichedFeaturedItems, items, driveConnection] =
    await Promise.all([
      profilePromise,
      enrichedFeaturedPromise,
      getExploreItems(50, 0, currentUserId),
      currentUserId ? getGoogleDriveConnection() : Promise.resolve(null),
    ]);
  const driveNeedsReauth = driveConnection?.needsReauth ?? false;

  const profile = profileResult.success ? profileResult.data : null;
  const currentUser = profile
    ? {
        id: profile.id,
        username: profile.username,
        name: profile.name,
      }
    : null;

  return (
    <>
      <SiteHeader
        title="Explore"
        titleHref="/explore"
        driveNeedsReauth={driveNeedsReauth}
      />
      <div className="bg-background text-foreground flex flex-1 flex-col">
        <ExploreClient
          items={items}
          featuredItems={enrichedFeaturedItems}
          currentUser={currentUser}
        />
      </div>
    </>
  );
}
