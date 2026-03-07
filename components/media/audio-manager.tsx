/**
 * Renderless component that bridges Redux playback state to HTML5 Audio API.
 * Lives in root layout — creates a persistent audio element that survives
 * route navigations.
 *
 * Responsibilities:
 * - Sync audio src to currentTrack
 * - Sync play/pause, volume, mute
 * - Dispatch setCurrentTime/setDuration on audio events
 * - Dispatch skipNext on ended event
 * - Persist playback position to server on visibility change + periodically
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import {
  setCurrentTime,
  setDuration,
  skipNext,
  pause,
} from "@/lib/store/playback-slice";
import {
  selectCurrentTrack,
  selectIsPlaying,
  selectVolume,
  selectIsMuted,
} from "@/lib/store/selectors";
import { updatePlaybackPosition } from "@/lib/item-file-actions";

interface AudioManagerProps {
  /** Factory for the audio element — override in tests to inject a mock. */
  createAudio?: () => HTMLAudioElement;
}

export function AudioManager({
  createAudio = () => document.createElement("audio"),
}: AudioManagerProps) {
  const dispatch = useAppDispatch();
  const currentTrack = useAppSelector(selectCurrentTrack);
  const isPlaying = useAppSelector(selectIsPlaying);
  const volume = useAppSelector(selectVolume);
  const isMuted = useAppSelector(selectIsMuted);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastSaveRef = useRef<number>(0);
  const trackIdRef = useRef<string | null>(null);

  // Create audio element once
  useEffect(() => {
    audioRef.current = createAudio();
    audioRef.current.preload = "auto";

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, [createAudio]);

  // Handle track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      audio.pause();
      audio.src = "";
      trackIdRef.current = null;
      return;
    }

    // Only update src if track actually changed
    if (trackIdRef.current !== currentTrack.fileId) {
      // Save position of previous track before switching
      if (trackIdRef.current && audio.currentTime > 0) {
        updatePlaybackPosition(
          trackIdRef.current,
          audio.currentTime,
          audio.duration || null
        );
      }

      trackIdRef.current = currentTrack.fileId;
      audio.src = `/api/stream/${currentTrack.fileId}`;
      audio.load();

      // Resume from saved position if available
      if (currentTrack.playbackPosition && currentTrack.playbackPosition > 0) {
        audio.currentTime = currentTrack.playbackPosition;
      }
    }
  }, [currentTrack]);

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (isPlaying) {
      audio.play().catch(() => {
        // Autoplay blocked — pause in Redux to stay in sync
        dispatch(pause());
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, dispatch]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Sync mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Throttled time update handler — also saves position to server every 30s
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const now = Date.now();
    // Dispatch to Redux every 1s
    if (now - lastUpdateRef.current >= 1000) {
      lastUpdateRef.current = now;
      dispatch(setCurrentTime(audio.currentTime));
    }
    // Persist to server every 30s (limits server action calls)
    if (now - lastSaveRef.current >= 30_000 && trackIdRef.current) {
      lastSaveRef.current = now;
      updatePlaybackPosition(
        trackIdRef.current,
        audio.currentTime,
        audio.duration || null
      );
    }
  }, [dispatch]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      dispatch(setDuration(audio.duration));
    };

    const handleEnded = () => {
      // Save final position
      if (trackIdRef.current) {
        updatePlaybackPosition(trackIdRef.current, 0, audio.duration || null);
      }
      dispatch(skipNext());
    };

    const handleError = () => {
      dispatch(pause());
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [dispatch, handleTimeUpdate]);

  // Save position when tab becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const audio = audioRef.current;
        if (audio && trackIdRef.current && audio.currentTime > 0) {
          updatePlaybackPosition(
            trackIdRef.current,
            audio.currentTime,
            audio.duration || null
          );
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return null;
}
