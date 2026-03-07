/**
 * Fullscreen expanded player view.
 * Renders when Redux isExpanded is true.
 * Uses Radix Dialog (via Shadcn) for proper focus trapping and Escape handling.
 */

"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { closeExpanded } from "@/lib/store/playback-slice";
import { selectCurrentTrack, selectIsExpanded } from "@/lib/store/selectors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

function VideoPlayerSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          aria-hidden="true"
          className="size-8 text-white/70"
        />
        <span className="text-sm text-white/70">Loading player...</span>
      </div>
    </div>
  );
}

const StreamPlayer = dynamic(
  () =>
    import("./media-player").then((mod) => ({
      default: mod.StreamPlayer,
    })),
  { loading: () => <VideoPlayerSkeleton />, ssr: false }
);

export function ExpandedPlayer() {
  const dispatch = useAppDispatch();
  const isExpanded = useAppSelector(selectIsExpanded);
  const currentTrack = useAppSelector(selectCurrentTrack);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) dispatch(closeExpanded());
    },
    [dispatch]
  );

  return (
    <Dialog open={isExpanded && !!currentTrack} onOpenChange={handleOpenChange}>
      <DialogContent
        className="fixed inset-0 max-w-none translate-x-0 translate-y-0 border-none bg-black p-0 data-[state=open]:animate-none"
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogTitle>Playing {currentTrack?.filename}</DialogTitle>
        </VisuallyHidden>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => dispatch(closeExpanded())}
          className="absolute top-4 right-4 z-10 size-10 rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="Minimise player"
        >
          <FontAwesomeIcon
            icon={faChevronDown}
            aria-hidden="true"
            className="size-5"
          />
        </Button>

        {currentTrack && (
          <StreamPlayer
            src={`/api/stream/${currentTrack.fileId}`}
            mimeType={currentTrack.mimeType}
            posterUrl={currentTrack.posterUrl}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
