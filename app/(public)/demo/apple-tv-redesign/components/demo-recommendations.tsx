/**
 * Recommendations row showing similar movies/shows.
 * Uses real TMDB recommendation data.
 */

"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPosterUrl } from "@/lib/tmdb-client";
import type { DemoRecommendation } from "../lib/tmdb-demo";

interface DemoRecommendationsProps {
  /** Recommendations from TMDB. */
  recommendations: DemoRecommendation[];
  /** Section title. */
  title?: string;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Displays recommendation poster cards from TMDB.
 * Hover shows "Add to Library" button.
 */
export function DemoRecommendations({
  recommendations,
  title = "More Like This",
  className,
}: DemoRecommendationsProps) {
  if (recommendations.length === 0) return null;

  const handleAddClick = (rec: DemoRecommendation) => {
    toast.info(`Search for "${rec.title}" to add`, {
      description: "Use the search feature to add this to your library.",
    });
  };

  return (
    <section className={className}>
      <h2
        className={cn(
          "mb-4 text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--atv-text-tertiary)]"
        )}
      >
        {title}
      </h2>

      {/* Grid of recommendations */}
      <div
        className={cn(
          "grid gap-4",
          "grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
        )}
      >
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className={cn(
              "group relative overflow-hidden rounded-lg",
              "aspect-[2/3]",
              "bg-[var(--atv-surface)]"
            )}
          >
            {/* Poster */}
            {rec.posterPath ? (
              <Image
                src={getPosterUrl(rec.posterPath) || ""}
                alt={rec.title}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 16vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-2xl font-bold text-white/20">
                  {rec.title.charAt(0)}
                </span>
              </div>
            )}

            {/* Hover overlay with Add button */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-2",
                "bg-black/60 opacity-0",
                "transition-opacity duration-200",
                "group-hover:opacity-100"
              )}
            >
              <button
                onClick={() => handleAddClick(rec)}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full",
                  "bg-white/20 backdrop-blur-sm",
                  "hover:bg-white/30",
                  "transition-colors duration-150",
                  "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                )}
                aria-label={`Add ${rec.title} to library`}
              >
                <Plus className="size-5 text-white" />
              </button>
              <span className="text-xs text-white/70">Add to Library</span>
            </div>

            {/* Title at bottom */}
            <div
              className="absolute inset-x-0 bottom-0 p-2"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
              }}
            >
              <p className={cn("truncate text-xs font-medium", "text-white")}>
                {rec.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
