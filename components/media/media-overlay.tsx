/**
 * Fullscreen media player overlay with cinematic aesthetics.
 * Displays video player with dark backdrop and theatrical transitions.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "./media-player";
import type { SerializedItemFile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MediaOverlayProps {
  /** The media file to play */
  file: SerializedItemFile;
  /** Optional subtitle files */
  subtitles?: SerializedItemFile[];
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
 * Fullscreen overlay for immersive media playback.
 * Features cinematic dark backdrop, vignette effects, and escape key support.
 *
 * @param file - The media file to play
 * @param subtitles - Optional subtitle tracks
 * @param onClose - Callback to close the overlay
 * @param onPositionUpdate - Callback to save playback position
 */
export function MediaOverlay({
  file,
  subtitles,
  onClose,
  onPositionUpdate,
}: MediaOverlayProps) {
  const [lastPosition, setLastPosition] = useState(file.playbackPosition ?? 0);
  const [lastDuration, setLastDuration] = useState<number | null>(
    file.playbackDuration ?? null
  );
  const [isClosing, setIsClosing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Track mount state for portal and lock body scroll
  useEffect(() => {
    // Use microtask to avoid synchronous setState in effect body
    queueMicrotask(() => setIsMounted(true));
    // Lock body scroll
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Animated close handler
  const handleClose = useCallback(async () => {
    // Start exit animation
    setIsClosing(true);

    // Save position if we have progress
    if (lastPosition > 0) {
      onPositionUpdate?.(file.id, lastPosition, lastDuration);
    }

    // Wait for animation to complete
    await new Promise((resolve) => setTimeout(resolve, 300));
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

  // Reset position only when video actually ends (100%)
  const handleEnded = useCallback(() => {
    // Reset to 0 when video completes
    onPositionUpdate?.(file.id, 0, lastDuration);
    setLastPosition(0);
  }, [file.id, lastDuration, onPositionUpdate]);

  // Click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        handleClose();
      }
    },
    [handleClose]
  );

  if (!isMounted) return null;

  const overlayContent = (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className={cn(
        // Base overlay styles
        "fixed inset-0 z-50 flex items-center justify-center",
        // Cinematic black backdrop
        "bg-black",
        // Entry animation
        !isClosing && "animate-in fade-in duration-500",
        // Exit animation
        isClosing && "animate-out fade-out duration-300"
      )}
      style={{
        // Subtle vignette effect for theater feel
        background: `
          radial-gradient(
            ellipse at center,
            rgba(0, 0, 0, 0.85) 0%,
            rgba(0, 0, 0, 0.95) 50%,
            rgba(0, 0, 0, 1) 100%
          )
        `,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${file.filename}`}
    >
      {/* Ambient gradient accents */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse at 20% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)
          `,
        }}
      />

      {/* Film grain texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Close button - top right */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className={cn(
          "absolute top-4 right-4 z-10",
          "size-12 rounded-full",
          // Glass morphism style
          "bg-white/5 backdrop-blur-sm",
          "border border-white/10",
          // Hover glow effect
          "transition-all duration-300",
          "hover:border-white/20 hover:bg-white/10",
          "hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]",
          // Focus styles
          "focus-visible:ring-2 focus-visible:ring-white/30",
          "focus-visible:outline-none",
          // Text color
          "text-white/70 hover:text-white"
        )}
        aria-label="Close player"
      >
        <X className="size-6" />
      </Button>

      {/* Media title - top left */}
      <div
        className={cn(
          "absolute top-6 left-6 z-10 max-w-[50%]",
          "transition-opacity duration-500",
          "group-hover:opacity-100"
        )}
      >
        <h2
          className={cn(
            "truncate text-lg font-medium text-white/90",
            "drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
          )}
        >
          {file.filename}
        </h2>
        {lastDuration && lastDuration > 0 && (
          <p className="mt-1 text-sm text-white/50">
            {formatDuration(lastDuration)}
          </p>
        )}
      </div>

      {/* Player container with cinematic frame */}
      <div
        className={cn(
          "relative w-full max-w-[90vw] lg:max-w-[85vw] xl:max-w-[1600px]",
          // Subtle entry animation
          !isClosing && "animate-in zoom-in-95 delay-150 duration-500",
          isClosing && "animate-out zoom-out-95 duration-200"
        )}
      >
        {/* Ambient glow behind player */}
        <div
          className="absolute -inset-[10%] -z-10 opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(59, 130, 246, 0.2) 0%, transparent 70%)",
          }}
        />

        {/* Player */}
        <VideoPlayer
          file={file}
          subtitles={subtitles}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
      </div>

      {/* Keyboard hint - bottom center */}
      <div
        className={cn(
          "absolute bottom-6 left-1/2 -translate-x-1/2",
          "flex items-center gap-2",
          "text-xs text-white/30",
          "transition-opacity duration-500"
        )}
      >
        <kbd className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono">
          ESC
        </kbd>
        <span>to close</span>
      </div>
    </div>
  );

  // Render in portal to escape any parent stacking contexts
  return createPortal(overlayContent, document.body);
}

/**
 * Formats duration in seconds to human-readable string.
 * Examples: 3600 → "1:00:00", 125 → "2:05"
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
