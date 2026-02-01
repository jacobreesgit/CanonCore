/**
 * Vidstack media player wrapper.
 * Handles playback with subtitle support and progress tracking.
 * Shows artwork for audio files.
 */

"use client";

import { useRef, useCallback, useEffect } from "react";
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaPlayerInstance,
  type MediaTimeUpdateEventDetail,
  type PlayerSrc,
} from "@vidstack/react";
import { DefaultVideoLayout } from "@vidstack/react/player/layouts/default";
import { mediaPlayerIcons } from "./media-player-icons";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import type { SerializedItemFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getMimeTypeByExtension } from "@/lib/file-type-utils";
import { Shader1 } from "@/components/shader1";

interface VideoPlayerProps {
  /** The media file to play */
  file: SerializedItemFile;
  /** Optional subtitle files to load */
  subtitles?: SerializedItemFile[];
  /** Optional poster/artwork URL (displayed for audio files or before video plays) */
  posterUrl?: string;
  /** Callback fired when time updates (throttled) */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Callback fired when video ends */
  onEnded?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Video player with Vidstack.
 * Features auto-resume, subtitle support, and progress tracking.
 */
export function VideoPlayer({
  file,
  subtitles,
  posterUrl,
  onTimeUpdate,
  onEnded,
  className,
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const lastUpdateRef = useRef<number>(0);

  // Debounced time update handler (every 5 seconds max)
  const handleTimeUpdate = useCallback(
    (detail: MediaTimeUpdateEventDetail) => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= 5000) {
        lastUpdateRef.current = now;
        const duration = playerRef.current?.state.duration || 0;
        onTimeUpdate?.(detail.currentTime, duration);
      }
    },
    [onTimeUpdate]
  );

  const handleEnded = useCallback(() => {
    onEnded?.();
  }, [onEnded]);

  // Seek to saved position when mounted
  useEffect(() => {
    if (playerRef.current && file.playbackPosition) {
      const player = playerRef.current;
      const timeout = setTimeout(() => {
        player.currentTime = file.playbackPosition || 0;
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [file.playbackPosition]);

  const streamUrl = `/api/stream/${file.id}`;
  // Prioritize filename inference over database value (more reliable)
  const inferredMimeType = getMimeTypeByExtension(file.filename);
  const mimeType = inferredMimeType || file.mimeType || "video/mp4";
  const isAudio = mimeType.startsWith("audio/");
  // Audio without artwork shows shader background (cinematic experience)
  const showShaderBackground = isAudio && !posterUrl;

  return (
    <MediaPlayer
      ref={playerRef}
      src={{ src: streamUrl, type: mimeType } as PlayerSrc}
      title={file.filename || "Media"}
      poster={posterUrl}
      viewType="video"
      crossOrigin
      playsInline
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      className={cn("h-full w-full", className)}
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

      {/* Show artwork as background for audio files with poster */}
      {isAudio && posterUrl && (
        <Poster
          className="absolute inset-0 block h-full w-full object-cover"
          src={posterUrl}
          alt="Album artwork"
        />
      )}

      {/* Show animated shader background for audio without artwork */}
      {showShaderBackground && (
        <div className="absolute inset-0 z-0">
          {typeof window !== "undefined" && navigator.webdriver ? (
            <div className="h-full w-full bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900" />
          ) : (
            <Shader1 className="h-full" />
          )}
        </div>
      )}

      {/* Always use video layout for cinematic experience */}
      <DefaultVideoLayout
        icons={mediaPlayerIcons}
        colorScheme="dark"
        noScrubGesture={false}
        smallLayoutWhen={false}
      />
    </MediaPlayer>
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
