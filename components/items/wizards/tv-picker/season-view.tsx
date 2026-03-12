/**
 * Season view component for TV picker.
 * Displays season info and episode list after drilling down from show view.
 */
"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { forwardRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faFilm,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPosterUrl, getStillUrl } from "@/lib/tmdb-client";
import { cn } from "@/lib/utils";
import {
  LoadingState,
  ErrorState,
} from "@/components/items/episode-picker-helpers";
import type { SeasonViewProps } from "./tv-picker-types";
import type { TMDBEpisode } from "@/lib/tmdb-client";

/**
 * Season view component.
 * Displays season info with a scrollable list of episodes.
 * Implements keyboard navigation for episode list.
 *
 * @param data - Current picker data containing episodes
 * @param selectedSeason - The selected season
 * @param isLoading - Whether episodes are loading
 * @param error - Error message if loading failed
 * @param onEpisodeSelect - Handler when an episode is selected
 */
export function SeasonView({
  data,
  selectedSeason,
  isLoading,
  error,
  onEpisodeSelect,
}: SeasonViewProps) {
  const episodes = useMemo(() => data.episodes || [], [data.episodes]);
  const episodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Format episode count text
  const episodeCount = episodes.length;
  const episodeText = `${episodeCount} Episode${episodeCount === 1 ? "" : "s"}`;

  /**
   * Focus the heading when season view mounts (for accessibility).
   */
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      headingRef.current?.focus();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  /**
   * Handles keyboard navigation in episode list.
   * Implements listbox navigation pattern with Up/Down arrows.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let newIndex = index;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          newIndex = Math.min(index + 1, episodes.length - 1);
          break;
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
          newIndex = episodes.length - 1;
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onEpisodeSelect(episodes[index]);
          return;
        default:
          return;
      }

      if (newIndex !== index) {
        setFocusedIndex(newIndex);
        episodeRefs.current[newIndex]?.focus();
      }
    },
    [episodes, onEpisodeSelect]
  );

  /**
   * Updates ref array when episodes change.
   */
  useEffect(() => {
    episodeRefs.current = episodeRefs.current.slice(0, episodes.length);
  }, [episodes.length]);

  if (isLoading) {
    return <LoadingState message="Loading episodes…" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (episodes.length === 0) {
    return <ErrorState message="No episodes available" />;
  }

  return (
    <div className="space-y-4">
      {/* Season heading - receives focus on mount for accessibility */}
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="text-foreground font-medium outline-none"
      >
        {selectedSeason.name}
      </h3>

      {/* Season info header */}
      <div className="flex gap-4">
        {selectedSeason.poster_path ? (
          <div className="bg-muted relative h-20 w-14 shrink-0 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                getPosterUrl(selectedSeason.poster_path, "w154") ?? undefined
              }
              alt=""
              width={56}
              height={80}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="bg-muted flex h-20 w-14 shrink-0 items-center justify-center rounded-lg">
            <FontAwesomeIcon
              icon={faLayerGroup}
              className="text-muted-foreground size-5"
              aria-hidden="true"
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-muted-foreground text-sm">{episodeText}</p>
          {selectedSeason.overview && (
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {selectedSeason.overview}
            </p>
          )}
        </div>
      </div>

      {/* Episode list section */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          Or select an episode:
        </p>

        <ScrollArea className="h-[220px] pr-3">
          <div
            role="listbox"
            aria-label="Episodes"
            className="space-y-1"
            style={{
              contentVisibility: "auto",
              containIntrinsicSize: "auto 62px",
            }}
          >
            {episodes.map((episode: TMDBEpisode, index: number) => (
              <EpisodeItemWithKeyboard
                key={episode.id}
                ref={(el) => {
                  episodeRefs.current[index] = el;
                }}
                episode={episode}
                index={index}
                isFocused={focusedIndex === index}
                onSelect={() => onEpisodeSelect(episode)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onFocus={() => setFocusedIndex(index)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

interface EpisodeItemWithKeyboardProps {
  episode: TMDBEpisode;
  index: number;
  isFocused: boolean;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
}

/**
 * Episode item with roving tabindex keyboard support.
 */
const EpisodeItemWithKeyboard = forwardRef<
  HTMLButtonElement,
  EpisodeItemWithKeyboardProps
>(function EpisodeItemWithKeyboard(
  { episode, index, isFocused, onSelect, onKeyDown, onFocus },
  ref
) {
  const episodeNum = String(episode.episode_number).padStart(2, "0");

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      tabIndex={isFocused ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      aria-label={`Episode ${episode.episode_number}, ${episode.name}`}
      aria-posinset={index + 1}
      aria-selected={isFocused}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
        "transition-colors"
      )}
    >
      {episode.still_path ? (
        <div className="bg-muted relative h-12 w-20 shrink-0 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getStillUrl(episode.still_path, "w300") ?? undefined}
            alt=""
            width={80}
            height={48}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="bg-muted flex h-12 w-20 shrink-0 items-center justify-center rounded-lg">
          <FontAwesomeIcon
            icon={faFilm}
            className="text-muted-foreground size-4"
            aria-hidden="true"
          />
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

      <FontAwesomeIcon
        icon={faChevronRight}
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
    </button>
  );
});
