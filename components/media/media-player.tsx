/**
 * Vidstack media player wrapper with cinematic styling.
 * Handles playback with subtitle support and progress tracking.
 */

"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import {
  MediaPlayer,
  MediaProvider,
  Track,
  type MediaPlayerInstance,
  type MediaTimeUpdateEventDetail,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import type { SerializedItemFile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  /** The media file to play */
  file: SerializedItemFile;
  /** Optional subtitle files to load */
  subtitles?: SerializedItemFile[];
  /** Callback fired when time updates (throttled) */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Callback fired when video ends */
  onEnded?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Cinematic video player with Vidstack.
 * Features auto-resume, subtitle support, and progress tracking.
 *
 * @param file - The media file to play
 * @param subtitles - Optional subtitle tracks
 * @param onTimeUpdate - Progress callback
 * @param onEnded - Completion callback
 */
export function VideoPlayer({
  file,
  subtitles,
  onTimeUpdate,
  onEnded,
  className,
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const lastUpdateRef = useRef<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Debounced time update handler (every 5 seconds max)
  const handleTimeUpdate = useCallback(
    (detail: MediaTimeUpdateEventDetail) => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= 5000) {
        lastUpdateRef.current = now;
        // Get duration from the player state
        const duration = playerRef.current?.state.duration || 0;
        onTimeUpdate?.(detail.currentTime, duration);
      }
    },
    [onTimeUpdate]
  );

  const handleEnded = useCallback(() => {
    onEnded?.();
  }, [onEnded]);

  const handleCanPlay = useCallback(() => {
    setIsLoaded(true);
  }, []);

  // Seek to saved position when loaded
  useEffect(() => {
    if (isLoaded && playerRef.current && file.playbackPosition) {
      const player = playerRef.current;
      // Small delay to ensure player is ready
      const timeout = setTimeout(() => {
        player.currentTime = file.playbackPosition || 0;
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isLoaded, file.playbackPosition]);

  const streamUrl = `/api/stream/${file.id}`;

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg",
        // Cinematic frame with subtle ambient glow
        "ring-1 ring-white/5",
        "shadow-[0_0_80px_rgba(0,0,0,0.8),inset_0_0_60px_rgba(0,0,0,0.3)]",
        // Fade in animation
        "animate-in fade-in duration-700",
        className
      )}
    >
      {/* Ambient glow effect behind player */}
      <div
        className="pointer-events-none absolute -inset-4 -z-10 opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
        }}
      />

      <MediaPlayer
        ref={playerRef}
        src={streamUrl}
        aspectRatio="16/9"
        crossOrigin
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onCanPlay={handleCanPlay}
        className="h-full w-full"
      >
        <MediaProvider>
          {subtitles?.map((sub, idx) => (
            <Track
              key={sub.id}
              src={`/api/stream/${sub.id}`}
              kind="subtitles"
              label={sub.filename.replace(/\.[^/.]+$/, "")}
              lang={extractLanguageCode(sub.filename)}
              default={idx === 0}
            />
          ))}
        </MediaProvider>

        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          colorScheme="dark"
          noScrubGesture={false}
        />
      </MediaPlayer>

      {/* Loading shimmer overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4">
            <div className="relative size-12">
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
              <div className="absolute inset-2 animate-pulse rounded-full bg-blue-500/40" />
              <div className="absolute inset-4 rounded-full bg-blue-500" />
            </div>
            <p className="animate-pulse text-sm font-medium tracking-wide text-white/60">
              Loading media...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Extracts language code from subtitle filename.
 * Examples: "movie.en.srt" → "en", "movie.english.vtt" → "en"
 */
function extractLanguageCode(filename: string): string {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const parts = nameWithoutExt.split(".");
  const lastPart = parts[parts.length - 1]?.toLowerCase() || "";

  // Common language codes/names
  const languageMap: Record<string, string> = {
    en: "en",
    eng: "en",
    english: "en",
    es: "es",
    spa: "es",
    spanish: "es",
    fr: "fr",
    fra: "fr",
    french: "fr",
    de: "de",
    deu: "de",
    german: "de",
    it: "it",
    ita: "it",
    italian: "it",
    pt: "pt",
    por: "pt",
    portuguese: "pt",
    ja: "ja",
    jpn: "ja",
    japanese: "ja",
    ko: "ko",
    kor: "ko",
    korean: "ko",
    zh: "zh",
    chi: "zh",
    chinese: "zh",
    ru: "ru",
    rus: "ru",
    russian: "ru",
    ar: "ar",
    ara: "ar",
    arabic: "ar",
  };

  return languageMap[lastPart] || lastPart || "en";
}
