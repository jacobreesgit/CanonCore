/**
 * Show view component for TV picker.
 * Displays show info and season grid at the initial navigation level.
 */
"use client";

import { useCallback, useRef, useEffect } from "react";
import { Tv } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPosterUrl } from "@/lib/tmdb-client";
import {
  LoadingState,
  ErrorState,
} from "@/components/items/episode-picker-helpers";
import type { ShowViewProps } from "./tv-picker-types";
import type { TMDBSeasonSummary } from "@/lib/tmdb-client";

/**
 * Show view component.
 * Displays show info with a scrollable grid of seasons.
 * Implements roving tabindex keyboard navigation for season cards.
 *
 * @param data - Current picker data containing seasons
 * @param isLoading - Whether seasons are loading
 * @param error - Error message if loading failed
 * @param onSeasonSelect - Handler when a season card is clicked (drill down)
 * @param focusedIndex - Currently focused season index
 * @param onFocusChange - Handler when focus changes
 */
export function ShowView({
  data,
  isLoading,
  error,
  onSeasonSelect,
  focusedIndex,
  onFocusChange,
}: ShowViewProps) {
  const seasons = data.seasons || [];
  const tmdbResult = data.tmdbResult;
  const seasonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Format display title with year
  const displayTitle = tmdbResult
    ? tmdbResult.year
      ? `${tmdbResult.title} (${tmdbResult.year})`
      : tmdbResult.title
    : "";

  // Calculate total episode count
  const totalEpisodes = seasons.reduce(
    (sum, season) => sum + (season.episode_count || 0),
    0
  );

  // Format season/episode count text
  const seasonCount = seasons.length;
  const statsText = `${seasonCount} Season${seasonCount === 1 ? "" : "s"} • ${totalEpisodes} Episode${totalEpisodes === 1 ? "" : "s"}`;

  /**
   * Handles keyboard navigation in season grid.
   * Implements roving tabindex pattern with Home/End support.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let newIndex = index;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          newIndex = Math.min(index + 1, seasons.length - 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          newIndex = Math.max(index - 1, 0);
          break;
        case "Home":
          e.preventDefault();
          newIndex = 0;
          break;
        case "End":
          e.preventDefault();
          newIndex = seasons.length - 1;
          break;
        default:
          return;
      }

      if (newIndex !== index) {
        onFocusChange(newIndex);
        seasonRefs.current[newIndex]?.focus();
      }
    },
    [seasons.length, onFocusChange]
  );

  /**
   * Updates ref array when seasons change.
   */
  useEffect(() => {
    seasonRefs.current = seasonRefs.current.slice(0, seasons.length);
  }, [seasons.length]);

  if (isLoading) {
    return <LoadingState message="Loading seasons…" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (seasons.length === 0) {
    return <ErrorState message="No seasons available" />;
  }

  return (
    <div className="space-y-4">
      {/* Show info header */}
      <div className="flex gap-4">
        {tmdbResult?.posterPath ? (
          <div className="bg-muted relative h-24 w-16 shrink-0 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPosterUrl(tmdbResult.posterPath, "w154") ?? undefined}
              alt=""
              width={64}
              height={96}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="bg-muted flex h-24 w-16 shrink-0 items-center justify-center rounded-lg">
            <Tv className="text-muted-foreground size-6" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-lg font-semibold">{displayTitle}</h3>
          <p className="text-muted-foreground text-sm">{statsText}</p>
          {tmdbResult?.overview && (
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {tmdbResult.overview}
            </p>
          )}
        </div>
      </div>

      {/* Season grid section */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          Or select a season:
        </p>

        <ScrollArea className="h-[220px] pr-3">
          <div
            role="listbox"
            aria-label="Seasons"
            className="space-y-1"
            style={{
              contentVisibility: "auto",
              containIntrinsicSize: "auto 58px",
            }}
          >
            {seasons.map((season: TMDBSeasonSummary, index: number) => (
              <SeasonItemWithKeyboard
                key={season.id}
                ref={(el) => {
                  seasonRefs.current[index] = el;
                }}
                season={season}
                index={index}
                isFocused={focusedIndex === index}
                onSelect={() => onSeasonSelect(season, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onFocus={() => onFocusChange(index)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

interface SeasonItemWithKeyboardProps {
  season: TMDBSeasonSummary;
  index: number;
  isFocused: boolean;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
}

/**
 * Season item with roving tabindex keyboard support.
 */
const SeasonItemWithKeyboard = ({
  ref,
  season,
  index,
  isFocused,
  onSelect,
  onKeyDown,
  onFocus,
}: SeasonItemWithKeyboardProps & {
  ref: React.Ref<HTMLButtonElement>;
}) => {
  return (
    <SeasonItemButton
      ref={ref}
      season={season}
      tabIndex={isFocused ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      aria-posinset={index + 1}
      aria-selected={isFocused}
    />
  );
};

interface SeasonItemButtonProps {
  season: TMDBSeasonSummary;
  tabIndex: number;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
  "aria-posinset": number;
  "aria-selected": boolean;
}

/**
 * Wrapped SeasonItem with ref forwarding and keyboard props.
 */
import { forwardRef } from "react";
import { ChevronRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const SeasonItemButton = forwardRef<HTMLButtonElement, SeasonItemButtonProps>(
  function SeasonItemButton(
    { season, tabIndex, onClick, onKeyDown, onFocus, ...ariaProps },
    ref
  ) {
    const episodeText =
      season.episode_count === 1
        ? "1 episode"
        : `${season.episode_count} episodes`;

    return (
      <button
        ref={ref}
        type="button"
        role="option"
        tabIndex={tabIndex}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        aria-label={`${season.name}, ${episodeText}`}
        {...ariaProps}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
          "transition-colors"
        )}
      >
        {season.poster_path ? (
          <div className="bg-muted relative h-12 w-8 shrink-0 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPosterUrl(season.poster_path, "w92") ?? undefined}
              alt=""
              width={32}
              height={48}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="bg-muted flex h-12 w-8 shrink-0 items-center justify-center rounded-lg">
            <Layers
              className="text-muted-foreground size-4"
              aria-hidden="true"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{season.name}</p>
          <p className="text-muted-foreground text-xs">{episodeText}</p>
        </div>

        <ChevronRight
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
      </button>
    );
  }
);
