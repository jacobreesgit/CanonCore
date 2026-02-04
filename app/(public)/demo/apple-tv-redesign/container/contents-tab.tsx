/**
 * Client component for container page Contents tab.
 * Interactive toolbar and seasons grid.
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getPosterUrl } from "@/lib/tmdb-client";
import {
  DemoToolbar,
  DemoMobileOptionsSheet,
  DemoPosterGrid,
  DemoProgressBar,
} from "../components";

interface Season {
  id: number;
  seasonNumber: number;
  name: string;
  posterPath: string | null;
  episodeCount: number;
  progress: number;
  watchedEpisodes: number;
}

interface ContentsTabProps {
  seasons: Season[];
}

/**
 * Contents tab with interactive toolbar and seasons grid.
 */
export function ContentsTab({ seasons }: ContentsTabProps) {
  const [sortValue, setSortValue] = useState("custom");
  const [filterValue, setFilterValue] = useState("all");

  return (
    <div className="space-y-8">
      {/* Toolbar */}
      <div className="hidden md:block">
        <DemoToolbar
          sortValue={sortValue}
          onSortChange={setSortValue}
          filterValue={filterValue}
          onFilterChange={setFilterValue}
          showViewToggle={false}
        />
      </div>
      {/* Mobile toolbar */}
      <div className="flex items-center justify-between md:hidden">
        <DemoMobileOptionsSheet
          sortValue={sortValue}
          onSortChange={setSortValue}
          filterValue={filterValue}
          onFilterChange={setFilterValue}
          className="md:hidden"
        />
      </div>

      {/* Section header */}
      <h3
        className={cn(
          "text-xs font-medium tracking-[0.2em] uppercase",
          "text-[var(--atv-text-tertiary)]"
        )}
      >
        Seasons
      </h3>

      {/* Seasons grid */}
      <DemoPosterGrid stagger={false}>
        {seasons.map((season) => (
          <Link
            key={season.id}
            href="/demo/apple-tv-redesign/item"
            className={cn(
              "group relative overflow-hidden rounded-lg",
              "aspect-[2/3]",
              "bg-[var(--atv-surface)]",
              "transition-all duration-300",
              "hover:z-10 hover:scale-105",
              "hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
              "focus-visible:z-10 focus-visible:scale-105",
              "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
            )}
          >
            {/* Poster */}
            {season.posterPath ? (
              <Image
                src={getPosterUrl(season.posterPath) || ""}
                alt={season.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--atv-surface)] to-[var(--atv-bg)]">
                <span className="text-4xl font-bold text-white/20">
                  S{season.seasonNumber}
                </span>
              </div>
            )}

            {/* Gradient */}
            <div
              className="absolute inset-x-0 bottom-0 h-1/2"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
              }}
              aria-hidden="true"
            />

            {/* Info */}
            <div className="absolute inset-x-0 bottom-0 p-3">
              <h4 className="text-sm font-semibold text-white">
                {season.name}
              </h4>
              <p className="text-xs text-white/60">
                {season.watchedEpisodes}/{season.episodeCount} episodes
              </p>

              {/* Progress bar */}
              <div className="mt-2">
                <DemoProgressBar progress={season.progress} compact />
              </div>
            </div>
          </Link>
        ))}

        {/* Extras placeholder */}
        <Link
          href="/demo/apple-tv-redesign/item"
          className={cn(
            "flex items-center justify-center",
            "aspect-[2/3] rounded-lg",
            "border-2 border-dashed border-[var(--atv-border)]",
            "bg-[var(--atv-surface)]/30",
            "hover:border-white/30 hover:bg-[var(--atv-surface)]/50",
            "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none",
            "transition-colors"
          )}
        >
          <div className="text-center">
            <span className="text-2xl">Extras</span>
            <p className="mt-2 text-sm text-[var(--atv-text-tertiary)]">
              Behind the scenes
            </p>
          </div>
        </Link>
      </DemoPosterGrid>
    </div>
  );
}
