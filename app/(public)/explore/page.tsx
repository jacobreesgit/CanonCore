/**
 * Public explore page showcasing recently updated public items.
 * Displays a curated grid of content from all public profiles.
 */

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getExploreItems } from "@/lib/public-auth";
import { getProfile } from "@/lib/user-actions";
import { SiteHeader } from "@/components/site-header";
import { ExploreClient } from "./explore-client";

export const metadata: Metadata = {
  title: "Explore | CanonCore",
  description:
    "Discover public collections from the CanonCore community. Browse and fork curated media libraries.",
  openGraph: {
    title: "Explore | CanonCore",
    description:
      "Discover public collections from the CanonCore community. Browse and fork curated media libraries.",
    type: "website",
  },
};

/**
 * Explore page server component.
 * Fetches public items and renders the explore interface.
 */
export default async function ExplorePage() {
  // Get session and profile in parallel
  const [session, profileResult] = await Promise.all([auth(), getProfile()]);
  const currentUserId = session?.user?.id ?? null;
  const profile = profileResult.success ? profileResult.data : null;
  const currentUser = profile
    ? {
        id: profile.id,
        username: profile.username,
        name: profile.name,
      }
    : null;

  // Fetch items with progress for current user's items
  const items = await getExploreItems(50, 0, currentUserId);

  return (
    <>
      <SiteHeader title="Explore" titleHref="/explore" />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <ExploreClient items={items} currentUser={currentUser} />
      </div>
    </>
  );
}
