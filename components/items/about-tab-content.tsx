/**
 * Shared About tab content for item detail pages.
 * Renders TMDB metadata sections (cast, providers, videos, wiki, recommendations)
 * with a section filter toolbar.
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import { Section } from "@/components/ui/section";
import {
  MOCK_WIKI_SECTIONS_MOVIE,
  MOCK_WIKI_SECTIONS_TV,
  ABOUT_SECTION_FILTER_OPTIONS,
} from "@/lib/mock-data";
import type { TmdbItemDetails } from "@/lib/tmdb-client";
import type { TmdbDisplayOptions } from "@/lib/types";

// Lazy-load below-fold sections
const CastRow = dynamic(() => import("@/components/items/cast-row"));
const AboutSection = dynamic(
  () => import("@/components/items/expandable-description")
);
const WatchProviders = dynamic(
  () => import("@/components/items/watch-providers")
);
const VideoRow = dynamic(() => import("@/components/items/video-row"));
const WikiAccordion = dynamic(
  () => import("@/components/items/wiki-accordion")
);
const Recommendations = dynamic(
  () => import("@/components/items/recommendations")
);

interface AboutTabContentProps {
  /** Item description for the About section. */
  description: string | null;
  /** TMDB details (cast, providers, videos, recommendations). */
  tmdbDetails?: TmdbItemDetails | null;
  /** Per-item TMDB display preferences. */
  tmdbDisplayOptions?: TmdbDisplayOptions | null;
  /** Whether the item is a TV show (affects wiki sections). */
  isTV: boolean;
  /** Right-side actions for the toolbar (e.g., Add, Edit, Sync). */
  actions?: React.ReactNode;
}

/**
 * About tab content with section filter and TMDB metadata sections.
 * Manages sectionFilter state internally.
 */
export function AboutTabContent({
  description,
  tmdbDetails,
  tmdbDisplayOptions,
  isTV,
  actions,
}: AboutTabContentProps) {
  const [sectionFilter, setSectionFilter] = useState("all");
  const isSectionVisible = (sectionId: string) =>
    sectionFilter === "all" || sectionFilter === sectionId;

  return (
    <>
      <ContentToolbar
        filterBy={sectionFilter}
        onFilterChange={setSectionFilter as (value: string) => void}
        filterOptions={ABOUT_SECTION_FILTER_OPTIONS}
        actions={actions}
      />
      <Section
        className="py-8"
        aria-label="About"
        data-testid="about-tab-content"
      >
        <div className="space-y-12">
          {tmdbDisplayOptions?.showCast !== false &&
            isSectionVisible("cast") &&
            tmdbDetails?.cast &&
            tmdbDetails.cast.length > 0 && <CastRow cast={tmdbDetails.cast} />}
          {isSectionVisible("about") && description && (
            <AboutSection description={description} />
          )}
          {tmdbDisplayOptions?.showProviders !== false &&
            isSectionVisible("providers") &&
            tmdbDetails?.providers &&
            tmdbDetails.providers.length > 0 && (
              <WatchProviders providers={tmdbDetails.providers} />
            )}
          {tmdbDisplayOptions?.showVideos !== false &&
            isSectionVisible("videos") &&
            tmdbDetails?.videos &&
            tmdbDetails.videos.length > 0 && (
              <VideoRow videos={tmdbDetails.videos} />
            )}
          {isSectionVisible("wiki") && (
            <WikiAccordion
              sections={isTV ? MOCK_WIKI_SECTIONS_TV : MOCK_WIKI_SECTIONS_MOVIE}
            />
          )}
          {tmdbDisplayOptions?.showRecommendations !== false &&
            isSectionVisible("recommendations") &&
            tmdbDetails?.recommendations &&
            tmdbDetails.recommendations.length > 0 && (
              <Recommendations recommendations={tmdbDetails.recommendations} />
            )}
        </div>
      </Section>
    </>
  );
}

export default AboutTabContent;
