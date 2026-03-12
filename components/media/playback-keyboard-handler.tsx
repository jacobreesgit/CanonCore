/**
 * Global keyboard shortcuts for media playback.
 * Space: play/pause
 * M: toggle mute
 * ArrowLeft/Right: seek ±10s
 * ArrowUp/Down: volume ±0.1
 *
 * Uses Vidstack hooks (useMediaRemote, useMediaPlayer, useMediaState)
 * instead of Redux for transport control.
 */

"use client";

import { useEffect } from "react";
import { useMediaRemote, useMediaState, useMediaPlayer } from "@vidstack/react";
import { useAppSelector } from "@/lib/store/hooks";
import { selectCurrentTrack, selectIsExpanded } from "@/lib/store/selectors";

const INTERACTIVE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

export function PlaybackKeyboardHandler() {
  const currentTrack = useAppSelector(selectCurrentTrack);
  const isExpanded = useAppSelector(selectIsExpanded);
  const remote = useMediaRemote();
  const player = useMediaPlayer();
  const paused = useMediaState("paused");
  const isFullscreen = useMediaState("fullscreen");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (INTERACTIVE_TAGS.has(active.tagName) ||
          active.isContentEditable ||
          active.getAttribute("role") === "button")
      ) {
        return;
      }

      if (!currentTrack) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (paused) {
            remote.play();
          } else {
            remote.pause();
          }
          break;
        case "m":
        case "M":
          remote.toggleMuted();
          break;
        // Seek ±10s — read currentTime imperatively from player instance
        case "ArrowLeft":
          e.preventDefault();
          if (player) {
            remote.seek(Math.max(player.currentTime - 10, 0));
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (player) {
            const target = player.currentTime + 10;
            remote.seek(
              player.duration ? Math.min(target, player.duration) : target
            );
          }
          break;
        // Volume ±0.1
        case "ArrowUp":
          e.preventDefault();
          if (player) {
            remote.changeVolume(Math.min(player.volume + 0.1, 1));
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (player) {
            remote.changeVolume(Math.max(player.volume - 0.1, 0));
          }
          break;
        case "f":
        case "F":
          if (isExpanded || isFullscreen) {
            if (isFullscreen) {
              remote.exitFullscreen();
            } else {
              remote.enterFullscreen();
            }
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTrack, remote, player, paused, isExpanded, isFullscreen]);

  return null;
}
