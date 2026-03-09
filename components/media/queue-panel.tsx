/**
 * Slide-out queue panel showing now playing and upcoming tracks.
 * Uses shadcn Sheet for the slide-out panel.
 * Up Next list supports drag-to-reorder via dnd-kit.
 *
 * Cinematic glass design — frosted backdrop over the player,
 * elevated "Now Playing" card, refined track rows.
 */

"use client";

import { memo, useCallback } from "react";
import { useMediaState } from "@vidstack/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMusic,
  faPlay,
  faXmark,
  faGripVertical,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import {
  clearQueue,
  playQueue,
  removeFromQueue,
  reorderQueue,
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface QueuePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container?: HTMLElement | null;
}

export function QueuePanel({ open, onOpenChange, container }: QueuePanelProps) {
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const paused = useMediaState("paused");
  const queue = useAppSelector(selectQueue);
  const queueIndex = useAppSelector(selectQueueIndex);
  const upNext = useAppSelector(selectUpNext);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const fromIndex = Number(active.id);
      const toIndex = Number(over.id);
      dispatch(reorderQueue({ fromIndex, toIndex }));
    },
    [dispatch]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-80 border-l-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-2xl sm:w-96"
        container={container}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-white">Queue</span>
              {queue.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.08] px-1.5 text-xs font-medium text-white/60 tabular-nums">
                  {queue.length}
                </span>
              )}
            </div>
            {queue.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs font-medium text-white/60 transition-colors hover:text-white/80"
                aria-label="Clear queue"
              >
                Clear
              </button>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Playback queue showing current and upcoming tracks
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pt-5 pb-6">
          {/* ── Now Playing ──────────────────────────────────────── */}
          {currentTrack && (
            <div>
              <p className="mb-3 text-xs font-medium tracking-wider text-white/60 uppercase">
                Now Playing
              </p>
              <NowPlayingCard track={currentTrack} paused={paused} />
            </div>
          )}

          {/* ── Divider ──────────────────────────────────────────── */}
          {currentTrack && upNext.length > 0 && (
            <div className="h-px bg-gradient-to-r from-white/[0.06] via-white/[0.04] to-transparent" />
          )}

          {/* ── Up Next ──────────────────────────────────────────── */}
          {upNext.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-medium tracking-wider text-white/60 uppercase">
                Up Next
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={upNext.map((_, i) => queueIndex + 1 + i)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-0.5">
                    {upNext.map((track, i) => {
                      const absoluteIndex = queueIndex + 1 + i;
                      return (
                        <SortableQueueTrackItem
                          key={`${track.fileId}-${absoluteIndex}`}
                          id={absoluteIndex}
                          track={track}
                          index={i + 1}
                          onPlay={() => handlePlayIndex(absoluteIndex)}
                          onRemove={() => handleRemove(absoluteIndex)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* ── Empty state ──────────────────────────────────────── */}
          {queue.length === 0 && !currentTrack && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04]">
                <FontAwesomeIcon
                  icon={faMusic}
                  className="size-6 text-white/20"
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/60">
                  Queue is empty
                </p>
                <p className="mt-1 text-xs text-white/50">
                  Play something to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Elevated Now Playing card with larger artwork and playing indicator. */
function NowPlayingCard({
  track,
  paused,
}: {
  track: { filename: string; itemName: string; posterUrl?: string };
  paused: boolean;
}) {
  return (
    <div className="group flex items-center gap-3.5 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.06]">
      {/* Artwork */}
      <div className="relative shrink-0">
        {track.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={track.posterUrl}
            alt=""
            className="size-12 rounded-lg object-cover shadow-lg shadow-black/40"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-lg bg-white/[0.08] shadow-lg shadow-black/40">
            <FontAwesomeIcon icon={faMusic} className="size-4 text-white/30" />
          </div>
        )}
        {/* Playing indicator dot */}
        <div className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[#0a0a0a] bg-emerald-400" />
      </div>

      {/* Track info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {track.filename}
        </p>
        <p className="mt-0.5 truncate text-xs text-white/60">
          {track.itemName}
        </p>
      </div>

      {/* Animated equaliser bars — paused when media is paused */}
      <div className="flex h-4 items-end gap-[2px] pr-1">
        <span
          className={cn(
            "w-[3px] animate-[eq-bar_0.8s_ease-in-out_infinite] rounded-full bg-emerald-400/70",
            paused && "[animation-play-state:paused]"
          )}
        />
        <span
          className={cn(
            "w-[3px] animate-[eq-bar_0.8s_ease-in-out_0.2s_infinite] rounded-full bg-emerald-400/70",
            paused && "[animation-play-state:paused]"
          )}
        />
        <span
          className={cn(
            "w-[3px] animate-[eq-bar_0.8s_ease-in-out_0.4s_infinite] rounded-full bg-emerald-400/70",
            paused && "[animation-play-state:paused]"
          )}
        />
      </div>
    </div>
  );
}

/** Sortable track row in the Up Next list with drag handle. */
const SortableQueueTrackItem = memo(function SortableQueueTrackItem({
  id,
  track,
  index,
  onPlay,
  onRemove,
}: {
  id: number;
  track: { filename: string; itemName: string; posterUrl?: string };
  index: number;
  onPlay?: () => void;
  onRemove?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={cn(
          "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.04]",
          isDragging && "bg-white/[0.04] select-none"
        )}
      >
        {/* Drag handle */}
        <button
          {...listeners}
          className="shrink-0 cursor-grab touch-none text-white/15 transition-colors hover:text-white/40 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <FontAwesomeIcon icon={faGripVertical} className="size-3" />
        </button>

        {/* Track index — hidden on hover, shows play */}
        <div className="relative flex size-5 shrink-0 items-center justify-center">
          <span className="text-xs text-white/25 tabular-nums group-hover:invisible">
            {index}
          </span>
          {onPlay && (
            <button
              onClick={onPlay}
              className="absolute inset-0 hidden items-center justify-center text-white/60 transition-colors group-hover:flex hover:text-white"
              aria-label="Play"
            >
              <FontAwesomeIcon icon={faPlay} className="size-2.5" />
            </button>
          )}
        </div>

        {/* Artwork */}
        {track.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={track.posterUrl}
            alt=""
            className="size-9 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded bg-white/[0.06]">
            <FontAwesomeIcon icon={faMusic} className="size-3 text-white/25" />
          </div>
        )}

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-white/80">{track.filename}</p>
          <p className="mt-0.5 truncate text-xs text-white/50">
            {track.itemName}
          </p>
        </div>

        {/* Remove action */}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="size-7 shrink-0 text-white/30 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-red-400"
            aria-label="Remove"
          >
            <FontAwesomeIcon icon={faXmark} className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
});
