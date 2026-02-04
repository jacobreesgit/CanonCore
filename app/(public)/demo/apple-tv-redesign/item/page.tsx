/**
 * Apple TV+ Redesign Demo - Item Page.
 * Single movie view with full hero, cast, trailers, and recommendations.
 */

import { SiteHeader } from "@/components/site-header";
import {
  DemoHero,
  DemoCastRow,
  DemoWatchProviders,
  DemoVideoRow,
  DemoRecommendations,
  DemoWikiAccordion,
  DemoSection,
  DemoAboutSection,
} from "../components";
import { getDemoMovie } from "../lib/tmdb-demo";
import { ItemHeroActions } from "./item-hero-actions";

/**
 * Item page showing a single movie with all metadata sections.
 */
export default async function ItemDemoPage() {
  const movie = await getDemoMovie();

  if (!movie) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--atv-text-secondary)]">
          Failed to load movie data. Check TMDB_API_KEY.
        </p>
      </div>
    );
  }

  // Mock progress for demo
  const mockProgress = 72;

  return (
    <>
      <SiteHeader
        title="Apple TV+ Demo"
        titleHref="/demo/apple-tv-redesign"
        breadcrumbs={[
          {
            id: "item",
            name: movie.title,
            href: "/demo/apple-tv-redesign/item",
          },
        ]}
      />
      <div className="apple-tv-demo flex flex-1 flex-col bg-[var(--atv-bg)] text-[var(--atv-text-primary)]">
        {/* Hero Section */}
        <DemoHero
          backdropUrl={movie.backdropUrl}
          title={movie.title}
          tagline={movie.tagline}
          description={movie.overview}
          metadata={{
            year: movie.year,
            runtime: movie.runtime,
            contentRating: movie.contentRating,
            voteAverage: movie.voteAverage,
          }}
          genres={movie.genres}
          progress={mockProgress}
          progressLabel={`${mockProgress}% watched`}
          variant="item"
          actions={<ItemHeroActions movieTitle={movie.title} />}
        />

        {/* Content Sections */}
        <div className="space-y-12 py-12 md:space-y-16 md:py-16">
          {/* Cast & Crew */}
          <DemoSection>
            <DemoCastRow cast={movie.cast} />
          </DemoSection>

          {/* About */}
          <DemoSection>
            <DemoAboutSection description={movie.overview} />
          </DemoSection>

          {/* Where to Watch */}
          <DemoSection>
            <DemoWatchProviders providers={movie.watchProviders} />
          </DemoSection>

          {/* Trailers & Videos */}
          <DemoSection>
            <DemoVideoRow videos={movie.videos} />
          </DemoSection>

          {/* Learn More (Wiki placeholder) */}
          <DemoSection>
            <DemoWikiAccordion />
          </DemoSection>

          {/* More Like This */}
          <DemoSection>
            <DemoRecommendations recommendations={movie.recommendations} />
          </DemoSection>
        </div>

        {/* Footer spacing */}
        <div className="h-16" />
      </div>
    </>
  );
}
