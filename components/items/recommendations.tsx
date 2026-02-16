/**
 * Recommendations section showing similar movies/shows.
 * Uses TMDB recommendation data or mock data.
 */

"use client";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isValidImagePath } from "@/lib/tmdb-client";
import { PosterCard } from "./poster-card";
import type { Recommendation } from "@/lib/tmdb-client";

interface RecommendationsProps {
  /** Recommendations from TMDB or mock data. */
  recommendations: Recommendation[];
  /** Section title. */
  title?: string;
  /** Additional CSS classes. */
  className?: string;
  /** Base URL for poster images (default: TMDB poster base URL). */
  posterBaseUrl?: string;
}

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w780";

/**
 * Displays recommendation poster cards.
 * Hover shows "Add to Library" suggestion.
 */
export function Recommendations({
  recommendations,
  title = "More Like This",
  className,
  posterBaseUrl = TMDB_POSTER_BASE,
}: RecommendationsProps) {
  if (recommendations.length === 0) return null;

  const handleAddClick = (rec: Recommendation) => {
    toast.info(`Search for "${rec.title}" to add`, {
      description: "Use the search feature to add this to your library.",
    });
  };

  return (
    <section className={className}>
      <h2
        className={cn(
          "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--tertiary-foreground)]"
        )}
      >
        {title}
      </h2>

      <div
        className={cn(
          "grid gap-4",
          "grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        )}
      >
        {recommendations.map((rec) => {
          const posterUrl =
            rec.posterPath && isValidImagePath(rec.posterPath)
              ? `${posterBaseUrl}${rec.posterPath}`
              : null;
          return (
            <PosterCard
              key={rec.id}
              posterUrl={posterUrl}
              title={rec.title}
              aria-label={`Add "${rec.title}" to library`}
              onClick={() => handleAddClick(rec)}
            />
          );
        })}
      </div>
    </section>
  );
}

export default Recommendations;
