/**
 * Apple TV+ Redesign Demo - Container Page.
 * TV show view with Contents/About tabs and seasons grid.
 */

import { SiteHeader } from "@/components/site-header";
import {
  DemoHero,
  DemoTabs,
  DemoCastRow,
  DemoWatchProviders,
  DemoVideoRow,
  DemoRecommendations,
  DemoWikiAccordion,
  DemoSection,
  DemoAboutSection,
  DEFAULT_TV_SECTIONS,
} from "../components";
import { getDemoTvShow } from "../lib/tmdb-demo";
import { ContainerHeroActions } from "./container-hero-actions";
import { ContentsTab } from "./contents-tab";

/**
 * Container page showing a TV show with tabbed interface.
 */
export default async function ContainerDemoPage() {
  const tvShow = await getDemoTvShow();

  if (!tvShow) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--atv-text-secondary)]">
          Failed to load TV show data. Check TMDB_API_KEY.
        </p>
      </div>
    );
  }

  // Calculate mock progress for demo
  const totalEpisodes = tvShow.seasons.reduce(
    (sum, s) => sum + s.episodeCount,
    0
  );
  const watchedEpisodes = Math.floor(totalEpisodes * 0.45);
  const overallProgress = Math.round((watchedEpisodes / totalEpisodes) * 100);

  // Season progress mock data
  const seasonProgress = tvShow.seasons.map((season, index) => ({
    ...season,
    progress: index === 0 ? 100 : index === 1 ? 40 : 0,
    watchedEpisodes:
      index === 0
        ? season.episodeCount
        : index === 1
          ? Math.floor(season.episodeCount * 0.4)
          : 0,
  }));

  return (
    <>
      <SiteHeader
        title="Apple TV+ Demo"
        titleHref="/demo/apple-tv-redesign"
        breadcrumbs={[
          {
            id: "container",
            name: tvShow.name,
            href: "/demo/apple-tv-redesign/container",
          },
        ]}
      />
      <div className="apple-tv-demo flex flex-1 flex-col bg-[var(--atv-bg)] text-[var(--atv-text-primary)]">
        {/* Hero Section */}
        <DemoHero
          backdropUrl={tvShow.backdropUrl}
          title={tvShow.name}
          tagline={tvShow.tagline}
          metadata={{
            year: tvShow.year,
            contentRating: tvShow.contentRating,
            voteAverage: tvShow.voteAverage,
          }}
          genres={tvShow.genres}
          progress={overallProgress}
          progressLabel={`${watchedEpisodes}/${totalEpisodes} episodes`}
          variant="container"
          actions={<ContainerHeroActions showName={tvShow.name} />}
        />

        {/* Tabbed Content */}
        <DemoSection className="py-8">
          <DemoTabs
            tabs={[
              {
                id: "contents",
                label: "Contents",
                content: <ContentsTab seasons={seasonProgress} />,
              },
              {
                id: "about",
                label: "About",
                content: <AboutTab tvShow={tvShow} />,
              },
            ]}
            defaultTab="contents"
          />
        </DemoSection>

        {/* Footer spacing */}
        <div className="h-16" />
      </div>
    </>
  );
}

/**
 * About tab with cast, description, and metadata.
 */
function AboutTab({
  tvShow,
}: {
  tvShow: NonNullable<Awaited<ReturnType<typeof getDemoTvShow>>>;
}) {
  return (
    <div className="space-y-12">
      {/* Cast & Crew */}
      <DemoCastRow cast={tvShow.cast} />

      {/* About */}
      <DemoAboutSection description={tvShow.overview} title="About This Show" />

      {/* Where to Watch */}
      <DemoWatchProviders providers={tvShow.watchProviders} />

      {/* Trailers & Videos */}
      <DemoVideoRow videos={tvShow.videos} />

      {/* Learn More (Wiki placeholder) */}
      <DemoWikiAccordion sections={DEFAULT_TV_SECTIONS} />

      {/* More Like This */}
      <DemoRecommendations recommendations={tvShow.recommendations} />
    </div>
  );
}
