/**
 * Public explore page showcasing featured and recent public items.
 * Features a Hero226 carousel with 5 featured items at the top.
 */

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getExploreItems, getFeaturedItems } from "@/lib/public-auth";
import { getProfile } from "@/lib/user-actions";
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

  return (
    <>
      <SiteHeader title="Explore" titleHref="/explore" />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <ExploreClient
          items={itemsWithProgress}
          featuredItems={featuredItems}
          currentUser={currentUser}
        />
      </div>
    </>
  );
}
