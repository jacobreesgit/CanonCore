/**
 * Public explore page showcasing recently updated public items.
 * Displays a curated grid of content from all public profiles.
 */

import { Metadata } from "next";
import { getExploreItems } from "@/lib/public-auth";
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
  const items = await getExploreItems(50, 0);

  return <ExploreClient items={items} />;
}
