/**
 * Global keyboard shortcuts for media playback.
 * Space: play/pause (ignored when focused on inputs/textareas/buttons)
 * M: toggle mute
 *
 * Uses store.getState() inside the handler so the effect never re-subscribes.
 * Without this, every isPlaying toggle would tear down and re-attach the
 * window listener — violating the event-handler-refs and defer-reads patterns.
 */

"use client";

import { useEffect } from "react";
import { useStore } from "react-redux";
import { useAppDispatch } from "@/lib/store/hooks";
import { pause, resume, toggleMute } from "@/lib/store/playback-slice";
import type { RootState } from "@/lib/store";

/** Elements where Space/M should not be intercepted. */
const INTERACTIVE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

export function PlaybackKeyboardHandler() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (INTERACTIVE_TAGS.has(active.tagName) || active.isContentEditable)
      ) {
        return;
      }

      const { currentTrack, isPlaying } = store.getState().playback;

      switch (e.key) {
        case " ":
          if (!currentTrack) return;
          e.preventDefault();
          dispatch(isPlaying ? pause() : resume());
          break;
        case "m":
        case "M":
          if (!currentTrack) return;
          dispatch(toggleMute());
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, store]);

  return null;
}
