/**
 * Persistent mini-player bar fixed to the bottom of the viewport.
 * Uses Vidstack headless hooks (useMediaState, useMediaRemote) for
 * playback controls. Redux handles queue/track/expansion only.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faPause,
  faForwardStep,
  faBackwardStep,
  faXmark,
  faChevronUp,
  faChevronDown,
  faListOl,
  faVolumeHigh,
  faVolumeLow,
  faVolumeXmark,
  faShuffle,
  faRepeat,
  faExpand,
  faCompress,
} from "@fortawesome/free-solid-svg-icons";
import { useMediaState, useMediaRemote, useMediaPlayer } from "@vidstack/react";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import FocusTrap from "focus-trap-react";
import {
  stop,
  skipNext,
  skipPrevious,
  toggleExpanded,
  closeExpanded,
  toggleShuffle,
  setRepeat,
} from "@/lib/store/playback-slice";
import {
  selectCurrentTrack,
  selectHasNext,
  selectHasPrevious,
  selectShuffle,
  selectRepeat,
  selectIsExpanded,
  selectIsVideoFile,
} from "@/lib/store/selectors";
import type { RepeatMode } from "@/lib/store/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ExpandedViewport } from "./expanded-viewport";
import { QueuePanel } from "./queue-panel";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format-time";
import { updatePlaybackPosition } from "@/lib/item-file-actions";

/**
 * Extracted seek bar — subscribes to Vidstack time independently
 * so the parent MiniPlayer doesn't re-render every second.
 */
function MiniPlayerProgress() {
  const remote = useMediaRemote();
  const currentTime = useMediaState("currentTime");
  const duration = useMediaState("duration");

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = useCallback(
    ([value]: number[]) => {
      if (duration <= 0) return;
      remote.seek((value / 100) * duration);
    },
    [remote, duration]
  );

  return (
    <div className="flex items-center gap-2 px-4 sm:px-6">
      <span className="hidden text-[10px] text-white/60 tabular-nums sm:inline">
        {duration > 0 ? formatTime(currentTime) : "0:00"}
      </span>
      <Slider
        value={[progress]}
        max={100}
        step={0.1}
        onValueChange={handleSeek}
        aria-label="Seek"
        aria-valuetext={
          duration > 0
            ? `${formatTime(currentTime)} of ${formatTime(duration)}`
            : undefined
        }
        className="h-1 w-full"
      />
      <span className="hidden text-[10px] text-white/60 tabular-nums sm:inline">
        {duration > 0 ? formatTime(duration) : "0:00"}
      </span>
    </div>
  );
}

function volumeIcon(volume: number, isMuted: boolean) {
  if (isMuted || volume === 0) return faVolumeXmark;
  if (volume < 0.5) return faVolumeLow;
  return faVolumeHigh;
}

/** Volume slider extracted to avoid re-creating onValueChange on every render. */
function VolumeSlider({
  volume,
  muted,
  remote,
}: {
  volume: number;
  muted: boolean;
  remote: ReturnType<typeof useMediaRemote>;
}) {
  const handleChange = useCallback(
    ([v]: number[]) => remote.changeVolume(v),
    [remote]
  );
  return (
    <Slider
      value={[muted ? 0 : volume]}
      max={1}
      step={0.01}
      onValueChange={handleChange}
      className="w-20"
      aria-label="Volume"
    />
  );
}

function repeatLabel(mode: RepeatMode): string {
  if (mode === "one") return "Repeat one";
  if (mode === "all") return "Repeat all";
  return "Repeat";
}

export function MiniPlayer({ controlsIdle }: { controlsIdle: boolean }) {
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const hasNext = useAppSelector(selectHasNext);
  const hasPrevious = useAppSelector(selectHasPrevious);
  const shuffle = useAppSelector(selectShuffle);
  const repeat = useAppSelector(selectRepeat);
  const isExpanded = useAppSelector(selectIsExpanded);
  const isVideoFile = useAppSelector(selectIsVideoFile);

  // Vidstack headless hooks — only subscribe to state that drives UI rendering.
  // DO NOT subscribe to currentTime here — it fires ~60fps and would re-render
  // the entire MiniPlayer. MiniPlayerProgress handles its own subscription.
  const remote = useMediaRemote();
  const player = useMediaPlayer();
  const paused = useMediaState("paused");
  const volume = useMediaState("volume");
  const muted = useMediaState("muted");
  const isFullscreen = useMediaState("fullscreen");

  const [queueOpen, setQueueOpen] = useState(false);

  // Escape key handler for expanded viewport — stops propagation so
  // the queue panel Sheet doesn't also close when both are open.
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (queueOpen) {
          setQueueOpen(false);
        } else {
          dispatch(closeExpanded());
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, queueOpen, dispatch]);

  const handlePlayPause = useCallback(() => {
    if (paused) {
      remote.play();
    } else {
      remote.pause();
    }
  }, [paused, remote]);

  const handleSkipPrevious = useCallback(() => {
    // Read currentTime IMPERATIVELY from the player instance — no subscription.
    if (player && player.currentTime > 3) {
      remote.seek(0);
      return;
    }
    dispatch(skipPrevious());
  }, [player, remote, dispatch]);

  const handleClose = useCallback(async () => {
    // Save position before stopping — read imperatively from player.
    if (player && currentTrack) {
      const time = player.currentTime;
      if (time > 0) {
        await updatePlaybackPosition(
          currentTrack.fileId,
          time,
          player.duration || null
        );
      }
    }
    dispatch(stop());
  }, [dispatch, player, currentTrack]);

  const cycleRepeat = useCallback(() => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const idx = modes.indexOf(repeat);
    dispatch(setRepeat(modes[(idx + 1) % modes.length]));
  }, [dispatch, repeat]);

  const handleFullscreen = useCallback(() => {
    if (isFullscreen) {
      remote.exitFullscreen();
    } else {
      remote.enterFullscreen();
    }
  }, [isFullscreen, remote]);

  if (!currentTrack) return null;

  return (
    <>
      {/* Expanded viewport rendered OUTSIDE mini player to avoid backdrop-filter
          containing block issue */}
      <AnimatePresence>
        {isExpanded && currentTrack && (
          <FocusTrap
            focusTrapOptions={{
              allowOutsideClick: true,
              escapeDeactivates: false,
              fallbackFocus: "[data-testid='expanded-viewport']",
            }}
          >
            <motion.div
              data-testid="expanded-viewport"
              role="dialog"
              aria-modal="true"
              aria-label={`Now playing: ${currentTrack.filename}`}
              tabIndex={-1}
              className={cn(
                "fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-[var(--dark-900,#0a0a0a)] pt-[env(safe-area-inset-top)] transition-[padding] duration-300",
                controlsIdle
                  ? ""
                  : "pb-[calc(4rem+2px)] max-lg:pb-[calc(4rem+4rem+2px+env(safe-area-inset-bottom))]"
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ExpandedViewport
                currentTrack={currentTrack}
                isVideoFile={isVideoFile}
              />
            </motion.div>
          </FocusTrap>
        )}
      </AnimatePresence>

      <div
        data-testid="mini-player"
        data-player-active
        data-player-expanded={isExpanded || undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 bg-black/90 pb-2 backdrop-blur-xl transition-[opacity,transform] duration-300 max-lg:bottom-16 max-lg:pb-[calc(0.5rem+env(safe-area-inset-bottom))]",
          isExpanded ? "z-[70]" : "z-40",
          controlsIdle && "pointer-events-none translate-y-full opacity-0"
        )}
      >
        {/* ── Progress bar — full-width, edge-to-edge ───────────────── */}
        <MiniPlayerProgress />

        {/* ── Three-column grid: track | transport | utilities ───────── */}
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:gap-4 sm:px-6">
          {/* Left — Track info */}
          <button
            onClick={() => dispatch(toggleExpanded())}
            className="flex min-w-0 items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
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
              <p className="truncate text-xs text-white/50">
                {currentTrack.itemName}
              </p>
            </div>
          </button>

          {/* Center — Transport controls */}
          <div className="flex [touch-action:manipulation] items-center gap-1 sm:gap-2">
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
              onClick={handleSkipPrevious}
              disabled={!hasPrevious}
              className="size-8 text-white/60 hover:text-white disabled:opacity-25"
              aria-label="Previous"
            >
              <FontAwesomeIcon icon={faBackwardStep} className="size-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handlePlayPause}
              className="size-10 text-white hover:text-white/80"
              aria-label={paused ? "Play" : "Pause"}
            >
              <FontAwesomeIcon
                icon={paused ? faPlay : faPause}
                className="size-[18px]"
              />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => dispatch(skipNext())}
              disabled={!hasNext}
              className="size-8 text-white/60 hover:text-white disabled:opacity-25"
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

          {/* Right — Volume + utilities */}
          <div className="flex items-center justify-end gap-1">
            {/* Volume — desktop only */}
            <div className="hidden items-center gap-1 sm:flex">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remote.toggleMuted()}
                className="size-8 text-white/40 hover:text-white/80"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                <FontAwesomeIcon
                  icon={volumeIcon(volume, muted)}
                  className="size-3.5"
                />
              </Button>
              <VolumeSlider volume={volume} muted={muted} remote={remote} />
            </div>

            <div className="hidden h-5 w-px bg-white/10 sm:block" />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQueueOpen(true)}
              className="size-8 text-white/40 hover:text-white/80"
              aria-label="Queue"
            >
              <FontAwesomeIcon icon={faListOl} className="size-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleFullscreen}
              disabled={!isExpanded && !isFullscreen}
              className="hidden size-8 text-white/40 hover:text-white/80 sm:inline-flex"
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              <FontAwesomeIcon
                icon={isFullscreen ? faCompress : faExpand}
                className="size-3.5"
              />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                dispatch(isExpanded ? closeExpanded() : toggleExpanded())
              }
              className="size-8 text-white/40 hover:text-white/80"
              aria-label={isExpanded ? "Collapse player" : "Expand player"}
            >
              <FontAwesomeIcon
                icon={isExpanded ? faChevronDown : faChevronUp}
                className="size-3.5"
              />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="size-8 text-white/40 hover:text-white/80"
              aria-label="Close player"
            >
              <FontAwesomeIcon icon={faXmark} className="size-3.5" />
            </Button>
          </div>
        </div>

        <QueuePanel
          open={queueOpen}
          onOpenChange={setQueueOpen}
          container={isFullscreen && player ? player.el : undefined}
        />
      </div>
    </>
  );
}
