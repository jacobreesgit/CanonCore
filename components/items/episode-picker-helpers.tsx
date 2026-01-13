/**
 * Shared helper components for episode picker UI.
 * Used by AddItemDialog and ItemSettingsDialog for TV show navigation.
 */

"use client";

import { ChevronRight, Film, Layers, Loader2, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPosterUrl, getStillUrl } from "@/lib/tmdb-client";
import type { TMDBSeasonSummary, TMDBEpisode } from "@/lib/tmdb-client";

interface SeasonItemProps {
  /** Season data from TMDB */
  season: TMDBSeasonSummary;
  /** Click handler for season selection */
  onClick: () => void;
}

/**
 * Season list item component for TV show episode picker.
 * Displays season poster, name, and episode count.
 *
 * @param season - TMDB season data
 * @param onClick - Handler for selection
 */
export function SeasonItem({ season, onClick }: SeasonItemProps) {
  const episodeText =
    season.episode_count === 1
      ? "1 episode"
      : `${season.episode_count} episodes`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
        "transition-colors"
      )}
    >
      {season.poster_path ? (
        <div className="bg-muted relative h-12 w-8 shrink-0 overflow-hidden rounded">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getPosterUrl(season.poster_path, "w92") ?? undefined}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="bg-muted flex h-12 w-8 shrink-0 items-center justify-center rounded">
          <Layers className="text-muted-foreground size-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{season.name}</p>
        <p className="text-muted-foreground text-xs">{episodeText}</p>
      </div>

      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </button>
  );
}

interface EpisodeItemProps {
  /** Episode data from TMDB */
  episode: TMDBEpisode;
  /** Click handler for episode selection */
  onClick: () => void;
}

/**
 * Episode list item component for TV show episode picker.
 * Displays episode still, number, name, and overview.
 *
 * @param episode - TMDB episode data
 * @param onClick - Handler for selection
 */
export function EpisodeItem({ episode, onClick }: EpisodeItemProps) {
  const episodeNum = String(episode.episode_number).padStart(2, "0");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
        "transition-colors"
      )}
    >
      {episode.still_path ? (
        <div className="bg-muted relative h-10 w-16 shrink-0 overflow-hidden rounded">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getStillUrl(episode.still_path, "w300") ?? undefined}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="bg-muted flex h-10 w-16 shrink-0 items-center justify-center rounded">
          <Film className="text-muted-foreground size-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          <span className="text-muted-foreground mr-1.5 font-mono text-xs">
            {episodeNum}
          </span>
          {episode.name}
        </p>
        {episode.overview && (
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {episode.overview}
          </p>
        )}
      </div>

      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </button>
  );
}

interface LoadingStateProps {
  /** Message to display while loading */
  message: string;
}

/**
 * Loading state component for content areas.
 * Displays a spinner with a message.
 *
 * @param message - Loading message to display
 */
export function LoadingState({ message }: LoadingStateProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
      <Loader2 className="text-muted-foreground size-8 animate-spin" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  /** Error message to display */
  message: string;
}

/**
 * Error state component for content areas.
 * Displays an error icon with a message.
 *
 * @param message - Error message to display
 */
export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
      <div className="bg-destructive/10 flex size-12 items-center justify-center rounded-full">
        <Tv className="text-destructive size-6" />
      </div>
      <p className="text-muted-foreground text-center text-sm">{message}</p>
    </div>
  );
}
