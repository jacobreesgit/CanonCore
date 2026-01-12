/**
 * Episode picker for TV show metadata drill-down.
 * Allows users to select a specific season and episode when applying TMDB metadata.
 * Provides escape hatches to use show or season metadata instead.
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  Tv,
  Film,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getSeasonsAction, getEpisodesAction } from "@/lib/tmdb-actions";
import type { TMDBSeasonSummary, TMDBEpisode } from "@/lib/tmdb-client";

/** Selection mode for what level of metadata to use */
export type EpisodePickerSelection =
  | { type: "show" }
  | { type: "season"; seasonNumber: number }
  | { type: "episode"; seasonNumber: number; episodeNumber: number };

interface EpisodePickerProps {
  /** Whether the picker is open */
  open: boolean;
  /** Callback when picker open state changes */
  onOpenChange: (open: boolean) => void;
  /** TMDB TV show ID */
  tvId: number;
  /** TV show title for display */
  showTitle: string;
  /** TV show year for display */
  showYear?: string;
  /** Callback when user makes a selection */
  onSelect: (selection: EpisodePickerSelection) => void;
  /** Callback when user cancels */
  onCancel: () => void;
}

/** View state for drill-down navigation */
type ViewState =
  | { view: "seasons" }
  | { view: "episodes"; season: TMDBSeasonSummary };

/**
 * Episode picker dialog for TV show metadata selection.
 * Provides drill-down navigation: Show → Season → Episode.
 *
 * @param open - Whether picker is visible
 * @param onOpenChange - Callback for visibility changes
 * @param tvId - TMDB TV show ID
 * @param showTitle - Show title for display
 * @param showYear - Show year for display
 * @param onSelect - Callback with user's selection
 * @param onCancel - Callback when cancelled
 */
export function EpisodePicker({
  open,
  onOpenChange,
  tvId,
  showTitle,
  showYear,
  onSelect,
  onCancel,
}: EpisodePickerProps) {
  // View state for drill-down
  const [viewState, setViewState] = useState<ViewState>({ view: "seasons" });

  // Data state
  const [seasons, setSeasons] = useState<TMDBSeasonSummary[]>([]);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);

  // Loading states
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

  // Error states
  const [seasonsError, setSeasonsError] = useState<string | null>(null);
  const [episodesError, setEpisodesError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setViewState({ view: "seasons" });
      setSeasons([]);
      setEpisodes([]);
      setSeasonsError(null);
      setEpisodesError(null);
    }
  }, [open]);

  // Fetch seasons when dialog opens
  useEffect(() => {
    if (!open || seasons.length > 0) return;

    async function fetchSeasons() {
      setIsLoadingSeasons(true);
      setSeasonsError(null);

      try {
        const result = await getSeasonsAction(tvId);
        if (result.success && result.data) {
          setSeasons(result.data);
        } else if (!result.success) {
          setSeasonsError(result.error);
        } else {
          setSeasonsError("Failed to load seasons");
        }
      } catch {
        setSeasonsError("Failed to load seasons");
      } finally {
        setIsLoadingSeasons(false);
      }
    }

    fetchSeasons();
  }, [open, tvId, seasons.length]);

  /**
   * Handles season selection - fetches episodes for that season.
   */
  const handleSeasonSelect = useCallback(
    async (season: TMDBSeasonSummary) => {
      setViewState({ view: "episodes", season });
      setIsLoadingEpisodes(true);
      setEpisodesError(null);
      setEpisodes([]);

      try {
        const result = await getEpisodesAction(tvId, season.season_number);
        if (result.success && result.data) {
          setEpisodes(result.data);
        } else if (!result.success) {
          setEpisodesError(result.error);
        } else {
          setEpisodesError("Failed to load episodes");
        }
      } catch {
        setEpisodesError("Failed to load episodes");
      } finally {
        setIsLoadingEpisodes(false);
      }
    },
    [tvId]
  );

  /**
   * Handles back navigation from episodes to seasons.
   */
  const handleBack = useCallback(() => {
    setViewState({ view: "seasons" });
    setEpisodes([]);
    setEpisodesError(null);
  }, []);

  /**
   * Handles "Use Show Metadata" selection.
   */
  const handleUseShowMetadata = useCallback(() => {
    onSelect({ type: "show" });
  }, [onSelect]);

  /**
   * Handles "Use Season Metadata" selection.
   */
  const handleUseSeasonMetadata = useCallback(() => {
    if (viewState.view === "episodes") {
      onSelect({
        type: "season",
        seasonNumber: viewState.season.season_number,
      });
    }
  }, [viewState, onSelect]);

  /**
   * Handles episode selection.
   */
  const handleEpisodeSelect = useCallback(
    (episode: TMDBEpisode) => {
      if (viewState.view === "episodes") {
        onSelect({
          type: "episode",
          seasonNumber: viewState.season.season_number,
          episodeNumber: episode.episode_number,
        });
      }
    },
    [viewState, onSelect]
  );

  /**
   * Handles cancel action.
   */
  const handleCancel = useCallback(() => {
    onCancel();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const displayTitle = showYear ? `${showTitle} (${showYear})` : showTitle;
  const isEpisodesView = viewState.view === "episodes";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-blue-500/10 ring-1 ring-blue-500/20"
              )}
            >
              {isEpisodesView ? (
                <Film className="size-5 text-blue-500" />
              ) : (
                <Tv className="size-5 text-blue-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg">
                {isEpisodesView ? "Select Episode" : "Select Season"}
              </DialogTitle>
              <DialogDescription className="truncate text-sm">
                {isEpisodesView ? viewState.season.name : displayTitle}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Breadcrumb navigation */}
        {isEpisodesView && (
          <div className="flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="size-4" />
              <span className="max-w-[150px] truncate">{displayTitle}</span>
            </button>
            <ChevronRight className="text-muted-foreground/50 size-4" />
            <span className="text-foreground font-medium">
              {viewState.season.name}
            </span>
          </div>
        )}

        {/* Content area */}
        <div className="min-h-[280px]">
          {/* Seasons view */}
          {viewState.view === "seasons" && (
            <>
              {isLoadingSeasons ? (
                <LoadingState message="Loading seasons..." />
              ) : seasonsError ? (
                <ErrorState message={seasonsError} />
              ) : (
                <ScrollArea className="h-[280px] pr-3">
                  <div className="space-y-1">
                    {seasons.map((season) => (
                      <SeasonItem
                        key={season.id}
                        season={season}
                        onClick={() => handleSeasonSelect(season)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </>
          )}

          {/* Episodes view */}
          {viewState.view === "episodes" && (
            <>
              {isLoadingEpisodes ? (
                <LoadingState message="Loading episodes..." />
              ) : episodesError ? (
                <ErrorState message={episodesError} />
              ) : (
                <ScrollArea className="h-[280px] pr-3">
                  <div className="space-y-1">
                    {episodes.map((episode) => (
                      <EpisodeItem
                        key={episode.id}
                        episode={episode}
                        onClick={() => handleEpisodeSelect(episode)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>

            {isEpisodesView && (
              <Button
                variant="ghost"
                onClick={handleBack}
                className="flex-1 sm:hidden"
              >
                <ChevronLeft className="mr-1 size-4" />
                Back
              </Button>
            )}
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
            {isEpisodesView && (
              <Button
                variant="ghost"
                onClick={handleUseSeasonMetadata}
                className="flex-1 text-xs sm:flex-none"
              >
                <Layers className="mr-1 size-4" />
                Use Season
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={handleUseShowMetadata}
              className="flex-1 text-xs sm:flex-none"
            >
              <Tv className="mr-1 size-4" />
              Use Show
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Season list item component.
 */
function SeasonItem({
  season,
  onClick,
}: {
  season: TMDBSeasonSummary;
  onClick: () => void;
}) {
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
      {/* Season poster or placeholder */}
      {season.poster_path ? (
        <div className="bg-muted relative h-12 w-8 shrink-0 overflow-hidden rounded">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://image.tmdb.org/t/p/w92${season.poster_path}`}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="bg-muted flex h-12 w-8 shrink-0 items-center justify-center rounded">
          <Layers className="text-muted-foreground size-4" />
        </div>
      )}

      {/* Season info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{season.name}</p>
        <p className="text-muted-foreground text-xs">{episodeText}</p>
      </div>

      {/* Chevron */}
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </button>
  );
}

/**
 * Episode list item component.
 */
function EpisodeItem({
  episode,
  onClick,
}: {
  episode: TMDBEpisode;
  onClick: () => void;
}) {
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
      {/* Episode still or placeholder */}
      {episode.still_path ? (
        <div className="bg-muted relative h-10 w-16 shrink-0 overflow-hidden rounded">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://image.tmdb.org/t/p/w185${episode.still_path}`}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="bg-muted flex h-10 w-16 shrink-0 items-center justify-center rounded">
          <Film className="text-muted-foreground size-4" />
        </div>
      )}

      {/* Episode info */}
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

      {/* Chevron */}
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </button>
  );
}

/**
 * Loading state for content area.
 */
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
      <Loader2 className="text-muted-foreground size-8 animate-spin" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

/**
 * Error state for content area.
 */
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
      <div className="bg-destructive/10 flex size-12 items-center justify-center rounded-full">
        <Tv className="text-destructive size-6" />
      </div>
      <p className="text-muted-foreground text-center text-sm">{message}</p>
    </div>
  );
}
