/**
 * Apple TV+ Redesign Demo - Explore Page.
 * Public discovery with hero carousel and recently shared grid.
 */

import { SiteHeader } from "@/components/site-header";
import { DemoHeroCarousel, DemoSection } from "../components";
import {
  getDemoFeaturedItems,
  getDemoMovieGrid,
  getDemoTvShowGrid,
  MOCK_USERS,
} from "../lib/tmdb-demo";
import { ExploreContent } from "./explore-content";

/**
 * Explore page showing featured carousel and public items grid.
 */
export default async function ExploreDemoPage() {
  // Fetch all data in parallel
  const [featuredItems, movieItems, tvItems] = await Promise.all([
    getDemoFeaturedItems(),
    getDemoMovieGrid(),
    getDemoTvShowGrid(),
  ]);

  // Add mock owner and progress data to featured items
  const featuredWithOwners = featuredItems.map((item, index) => ({
    ...item,
    owner: MOCK_USERS[index % MOCK_USERS.length],
  }));

  // Combine movies and TV shows for the grid with deterministic mock data
  // Using index-based seeding for consistent results across renders
  const allItems = [...movieItems, ...tvItems].map((item, index) => ({
    ...item,
    owner: MOCK_USERS[index % MOCK_USERS.length],
    // Deterministic progress based on index (every 3rd item has progress)
    progress: index % 3 === 0 ? (index * 17) % 100 : undefined,
  }));

  // Deterministic reordering based on item ID for consistent display
  const sortedItems = [...allItems].sort(
    (a, b) => ((a.id * 7) % 100) - ((b.id * 7) % 100)
  );

  return (
    <>
      <SiteHeader
        title="Apple TV+ Demo"
        titleHref="/demo/apple-tv-redesign"
        breadcrumbs={[
          {
            id: "explore",
            name: "Explore",
            href: "/demo/apple-tv-redesign/explore",
          },
        ]}
      />
      <div className="apple-tv-demo flex flex-1 flex-col bg-[var(--atv-bg)] text-[var(--atv-text-primary)]">
        {/* Hero Carousel */}
        <DemoHeroCarousel items={featuredWithOwners} />

        {/* Content with interactive toolbar */}
        <DemoSection className="py-8 md:py-12">
          <ExploreContent items={sortedItems} />
        </DemoSection>

        {/* Footer spacing */}
        <div className="h-16" />
      </div>
    </>
  );
}
