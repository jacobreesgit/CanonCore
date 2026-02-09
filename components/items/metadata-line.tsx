/**
 * Metadata line displaying year, runtime, content rating, and vote average.
 * Uses tabular-nums for aligned numbers and subtle separator dots.
 */

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRuntime } from "@/lib/tmdb-client";

interface MetadataLineProps {
  /** Release year (e.g., "2024"). */
  year?: string;
  /** Runtime in minutes. */
  runtime?: number;
  /** Content rating (e.g., "PG-13", "TV-MA"). */
  contentRating?: string;
  /** Vote average (0-10). */
  voteAverage?: number;
  /** Genre names to display inline. */
  genres?: string[];
  /** Maximum number of genres to show. */
  maxGenres?: number;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Displays metadata in format: "2024 • 2h 46m • PG-13 • ★ 8.8"
 */
export function MetadataLine({
  year,
  runtime,
  contentRating,
  voteAverage,
  genres,
  maxGenres = 3,
  className,
}: MetadataLineProps) {
  const items: React.ReactNode[] = [];

  if (year) {
    items.push(<span key="year">{year}</span>);
  }

  if (runtime) {
    items.push(<span key="runtime">{formatRuntime(runtime)}</span>);
  }

  if (contentRating && contentRating !== "NR") {
    items.push(
      <span
        key="rating"
        className="rounded border border-white/30 px-1.5 py-0.5 text-xs"
      >
        {contentRating}
      </span>
    );
  }

  if (typeof voteAverage === "number" && voteAverage > 0) {
    items.push(
      <span key="vote" className="inline-flex items-center gap-1">
        <Star className="size-3.5 fill-current" aria-hidden="true" />
        <span>{voteAverage.toFixed(1)}</span>
      </span>
    );
  }

  if (genres && genres.length > 0) {
    const visibleGenres = genres.slice(0, maxGenres);
    items.push(<span key="genres">{visibleGenres.join(", ")}</span>);
  }

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1",
        "text-sm tracking-wide tabular-nums",
        "text-white/60",
        className
      )}
    >
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-3">
          {index > 0 && (
            <span className="text-white/30" aria-hidden="true">
              •
            </span>
          )}
          {item}
        </span>
      ))}
    </div>
  );
}
