/**
 * Fullscreen media player overlay.
 * Simple black backdrop with fullscreen video player.
 * VideoPlayer is dynamically imported to defer Vidstack library load.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SerializedItemFile } from "@/lib/types";

/**
 * Loading skeleton for VideoPlayer while Vidstack loads.
 */
function VideoPlayerSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2
          aria-hidden="true"
          className="size-8 animate-spin text-white/70"
        />
        <span className="text-sm text-white/70">Loading player…</span>
      </div>
    </div>
  );
}

/**
 * Dynamically imported VideoPlayer to defer Vidstack bundle.
 */
const VideoPlayer = dynamic(
  () => import("./media-player").then((mod) => mod.VideoPlayer),
  { loading: () => <VideoPlayerSkeleton />, ssr: false }
);

interface MediaOverlayProps {
  /** The media file to play */
  file: SerializedItemFile;
  /** Optional subtitle files */
  subtitles?: SerializedItemFile[];
  /** Optional poster/artwork URL for audio files */
  posterUrl?: string;
  /** Callback to close the overlay */
  onClose: () => void;
  /** Callback to update playback position */
  onPositionUpdate?: (
    fileId: string,
    position: number,
    duration: number | null
  ) => void;
}

/**
 * Fullscreen overlay for media playback.
 * Simple black backdrop with escape key support.
 */
export function MediaOverlay({
  file,
  subtitles,
  posterUrl,
  onClose,
  onPositionUpdate,
}: MediaOverlayProps) {
  const [lastPosition, setLastPosition] = useState(file.playbackPosition ?? 0);
  const [lastDuration, setLastDuration] = useState<number | null>(
    file.playbackDuration ?? null
  );
  const [isMounted, setIsMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Track mount state for portal and lock body scroll
  useEffect(() => {
    queueMicrotask(() => setIsMounted(true));
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Close handler
  const handleClose = useCallback(() => {
    if (lastPosition > 0) {
      onPositionUpdate?.(file.id, lastPosition, lastDuration);
    }
    onClose();
  }, [file.id, lastPosition, lastDuration, onClose, onPositionUpdate]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  // Track time updates
  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      setLastPosition(currentTime);
      if (duration > 0) {
        setLastDuration(duration);
      }
    },
    []
  );

  // Reset position when video ends
  const handleEnded = useCallback(() => {
    onPositionUpdate?.(file.id, 0, lastDuration);
    setLastPosition(0);
  }, [file.id, lastDuration, onPositionUpdate]);

  if (!isMounted) return null;

  const overlayContent = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${file.filename}`}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 size-10 rounded-full bg-black/50 text-white hover:bg-black/70"
        aria-label="Close player"
      >
        <X aria-hidden="true" className="size-5" />
      </Button>

      {/* Player */}
      <VideoPlayer
        file={file}
        subtitles={subtitles}
        posterUrl={posterUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
    </div>
  );

  return createPortal(overlayContent, document.body);
}
