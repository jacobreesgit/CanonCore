/**
 * Persistent mini-player bar fixed to the bottom of the viewport.
 * Only renders when a track is loaded. Shows track info, play/pause,
 * skip controls, progress bar, and expand button.
 */

"use client";

import { useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faForwardStep,
  faBackwardStep,
  faXmark,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import {
  pause,
  resume,
  stop,
  skipNext,
  skipPrevious,
  toggleExpanded,
} from "@/lib/store/playback-slice";
import {
  selectCurrentTrack,
  selectIsPlaying,
  selectProgress,
  selectHasNext,
  selectHasPrevious,
} from "@/lib/store/selectors";
import { Button } from "@/components/ui/button";

/**
 * Extracted progress bar — subscribes to selectProgress independently
 * so the parent MiniPlayer doesn't re-render every second.
 */
function MiniPlayerProgress() {
  const progress = useAppSelector(selectProgress);

  return (
    <div
      className="h-0.5 w-full bg-white/10"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Playback progress"
    >
      <div
        className="h-full bg-white/70 transition-[width] duration-1000 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function MiniPlayer() {
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const isPlaying = useAppSelector(selectIsPlaying);
  const hasNext = useAppSelector(selectHasNext);
  const hasPrevious = useAppSelector(selectHasPrevious);

  const handlePlayPause = useCallback(() => {
    dispatch(isPlaying ? pause() : resume());
  }, [dispatch, isPlaying]);

  const handleClose = useCallback(() => {
    dispatch(stop());
  }, [dispatch]);

  if (!currentTrack) return null;

  return (
    <div
      data-testid="mini-player"
      data-player-active
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[var(--dark-900,#0a0a0a)]/95 backdrop-blur-md"
    >
      <MiniPlayerProgress />

      <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4">
        {/* Track info */}
        <button
          onClick={() => dispatch(toggleExpanded())}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
          aria-label="Expand player"
        >
          {currentTrack.posterUrl && (
            <img
              src={currentTrack.posterUrl}
              alt=""
              className="size-10 shrink-0 rounded object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {currentTrack.filename}
            </p>
            <p className="truncate text-xs text-white/60">
              {currentTrack.itemName}
            </p>
          </div>
        </button>

        {/* Controls */}
        <div className="flex [touch-action:manipulation] items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => dispatch(skipPrevious())}
            disabled={!hasPrevious}
            className="size-8 text-white/70 hover:text-white disabled:opacity-30"
            aria-label="Previous"
          >
            <FontAwesomeIcon icon={faBackwardStep} className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handlePlayPause}
            className="size-10 text-white hover:text-white"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <FontAwesomeIcon
              icon={isPlaying ? faPause : faPlay}
              className="size-4"
            />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => dispatch(skipNext())}
            disabled={!hasNext}
            className="size-8 text-white/70 hover:text-white disabled:opacity-30"
            aria-label="Next"
          >
            <FontAwesomeIcon icon={faForwardStep} className="size-3.5" />
          </Button>
        </div>

        {/* Expand + Close */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => dispatch(toggleExpanded())}
            className="size-8 text-white/50 hover:text-white"
            aria-label="Expand player"
          >
            <FontAwesomeIcon icon={faChevronUp} className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="size-8 text-white/50 hover:text-white"
            aria-label="Close player"
          >
            <FontAwesomeIcon icon={faXmark} className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
