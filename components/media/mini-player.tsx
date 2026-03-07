/**
 * Persistent mini-player bar fixed to the bottom of the viewport.
 * Only renders when a track is loaded. Shows track info, play/pause,
 * skip controls, progress bar, and expand button.
 */

"use client";

import { useCallback, useState } from "react";
import { useStore } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faForwardStep,
  faBackwardStep,
  faXmark,
  faChevronUp,
  faListOl,
  faVolumeHigh,
  faVolumeLow,
  faVolumeXmark,
  faShuffle,
  faRepeat,
} from "@fortawesome/free-solid-svg-icons";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import {
  pause,
  resume,
  stop,
  skipNext,
  skipPrevious,
  toggleExpanded,
  toggleMute,
  setVolume,
  toggleShuffle,
  setRepeat,
} from "@/lib/store/playback-slice";
import {
  selectCurrentTrack,
  selectIsPlaying,
  selectProgress,
  selectHasNext,
  selectHasPrevious,
  selectVolume,
  selectIsMuted,
  selectShuffle,
  selectRepeat,
} from "@/lib/store/selectors";
import type { RootState } from "@/lib/store";
import type { RepeatMode } from "@/lib/store/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { QueuePanel } from "./queue-panel";
import { cn } from "@/lib/utils";

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

function volumeIcon(volume: number, isMuted: boolean) {
  if (isMuted || volume === 0) return faVolumeXmark;
  if (volume < 0.5) return faVolumeLow;
  return faVolumeHigh;
}

function repeatLabel(mode: RepeatMode): string {
  if (mode === "one") return "Repeat one";
  if (mode === "all") return "Repeat all";
  return "Repeat";
}

export function MiniPlayer() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const isPlaying = useAppSelector(selectIsPlaying);
  const hasNext = useAppSelector(selectHasNext);
  const hasPrevious = useAppSelector(selectHasPrevious);
  const volume = useAppSelector(selectVolume);
  const isMuted = useAppSelector(selectIsMuted);
  const shuffle = useAppSelector(selectShuffle);
  const repeat = useAppSelector(selectRepeat);

  const [queueOpen, setQueueOpen] = useState(false);

  const handlePlayPause = useCallback(() => {
    dispatch(isPlaying ? pause() : resume());
  }, [dispatch, isPlaying]);

  const handleClose = useCallback(() => {
    dispatch(stop());
  }, [dispatch]);

  const cycleRepeat = useCallback(() => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const currentRepeat = store.getState().playback.repeat;
    const next = modes[(modes.indexOf(currentRepeat) + 1) % modes.length];
    dispatch(setRepeat(next));
  }, [dispatch, store]);

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
            /* eslint-disable-next-line @next/next/no-img-element */
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
            onClick={() => dispatch(toggleShuffle())}
            className={cn(
              "hidden size-8 sm:inline-flex",
              shuffle ? "text-white" : "text-white/30 hover:text-white/60"
            )}
            aria-label="Shuffle"
          >
            <FontAwesomeIcon icon={faShuffle} className="size-3" />
          </Button>

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

          <Button
            variant="ghost"
            size="icon"
            onClick={cycleRepeat}
            className={cn(
              "relative hidden size-8 sm:inline-flex",
              repeat !== "off"
                ? "text-white"
                : "text-white/30 hover:text-white/60"
            )}
            aria-label={repeatLabel(repeat)}
          >
            <FontAwesomeIcon icon={faRepeat} className="size-3" />
            {repeat === "one" && (
              <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold text-white">
                1
              </span>
            )}
          </Button>
        </div>

        {/* Volume — desktop only */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => dispatch(toggleMute())}
            className="size-8 text-white/50 hover:text-white"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            <FontAwesomeIcon
              icon={volumeIcon(volume, isMuted)}
              className="size-3.5"
            />
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.01}
            onValueChange={([v]) => dispatch(setVolume(v))}
            className="w-20"
            aria-label="Volume"
          />
        </div>

        {/* Queue + Expand + Close */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setQueueOpen(true)}
            className="size-8 text-white/50 hover:text-white"
            aria-label="Queue"
          >
            <FontAwesomeIcon icon={faListOl} className="size-3.5" />
          </Button>

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

      <QueuePanel open={queueOpen} onOpenChange={setQueueOpen} />
    </div>
  );
}
