/**
 * Slide-out queue panel showing now playing and upcoming tracks.
 * Uses shadcn Sheet for the slide-out panel.
 */

"use client";

import { useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMusic, faPlay, faXmark } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import {
  clearQueue,
  playQueue,
  removeFromQueue,
  skipToIndex,
} from "@/lib/store/playback-slice";
import {
  selectCurrentTrack,
  selectQueue,
  selectQueueIndex,
  selectUpNext,
} from "@/lib/store/selectors";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface QueuePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QueuePanel({ open, onOpenChange }: QueuePanelProps) {
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const queue = useAppSelector(selectQueue);
  const queueIndex = useAppSelector(selectQueueIndex);
  const upNext = useAppSelector(selectUpNext);

  const handleClear = useCallback(() => {
    const prevQueue = [...queue];
    const prevIndex = queueIndex;
    dispatch(clearQueue());
    toast("Queue cleared", {
      action: {
        label: "Undo",
        onClick: () =>
          dispatch(playQueue({ tracks: prevQueue, startIndex: prevIndex })),
      },
    });
  }, [dispatch, queue, queueIndex]);

  const handlePlayIndex = useCallback(
    (index: number) => {
      dispatch(skipToIndex(index));
    },
    [dispatch]
  );

  const handleRemove = useCallback(
    (index: number) => {
      dispatch(removeFromQueue(index));
    },
    [dispatch]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Queue</span>
            {queue.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs text-white/50"
                aria-label="Clear queue"
              >
                Clear
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 overflow-y-auto">
          {/* Now Playing */}
          {currentTrack && (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wider text-white/40 uppercase">
                Now Playing
              </p>
              <QueueTrackItem track={currentTrack} isActive />
            </div>
          )}

          {/* Up Next */}
          {upNext.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wider text-white/40 uppercase">
                Up Next
              </p>
              <div className="space-y-1">
                {upNext.map((track, i) => {
                  const absoluteIndex = queueIndex + 1 + i;
                  return (
                    <QueueTrackItem
                      key={`${track.fileId}-${absoluteIndex}`}
                      track={track}
                      onPlay={() => handlePlayIndex(absoluteIndex)}
                      onRemove={() => handleRemove(absoluteIndex)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {queue.length === 0 && !currentTrack && (
            <div className="flex flex-col items-center gap-2 py-12 text-white/30">
              <FontAwesomeIcon icon={faMusic} className="size-8" />
              <p className="text-sm">Queue is empty</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Single track row in the queue. */
function QueueTrackItem({
  track,
  isActive,
  onPlay,
  onRemove,
}: {
  track: { filename: string; itemName: string; posterUrl?: string };
  isActive?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-3 rounded-md px-2 py-2 ${
        isActive ? "bg-white/5" : "hover:bg-white/5"
      }`}
    >
      {track.posterUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={track.posterUrl}
          alt=""
          className="size-8 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-white/10">
          <FontAwesomeIcon icon={faMusic} className="size-3 text-white/40" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">{track.filename}</p>
        <p className="truncate text-xs text-white/50">{track.itemName}</p>
      </div>

      {!isActive && (
        <div className="flex shrink-0 gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          {onPlay && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPlay}
              className="size-7 text-white/50 hover:text-white"
              aria-label="Play"
            >
              <FontAwesomeIcon icon={faPlay} className="size-3" />
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="size-7 text-white/50 hover:text-red-400"
              aria-label="Remove"
            >
              <FontAwesomeIcon icon={faXmark} className="size-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
