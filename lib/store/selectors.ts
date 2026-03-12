/**
 * Redux selectors for playback and UI preferences state.
 * Uses createSelector for selectors that allocate (e.g. array slice).
 */

import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "./index";

// --- Playback selectors ---

export const selectCurrentTrack = (state: RootState) =>
  state.playback.currentTrack;
export const selectQueue = (state: RootState) => state.playback.queue;
export const selectQueueIndex = (state: RootState) => state.playback.queueIndex;
export const selectShuffle = (state: RootState) => state.playback.shuffle;
export const selectRepeat = (state: RootState) => state.playback.repeat;
export const selectIsExpanded = (state: RootState) => state.playback.isExpanded;

/** Whether the current track is a video file (mimeType starts with "video/"). */
export const selectIsVideoFile = (state: RootState): boolean => {
  const track = state.playback.currentTrack;
  return track?.mimeType.startsWith("video/") ?? false;
};

/** Whether there is a next track to skip to. */
export const selectHasNext = (state: RootState): boolean => {
  const { queue, queueIndex, repeat } = state.playback;
  if (queue.length === 0 || queueIndex < 0) return false;
  if (repeat === "all") return true;
  return queueIndex < queue.length - 1;
};

/** Whether there is a previous track or can restart current track. */
export const selectHasPrevious = (state: RootState): boolean => {
  const { currentTrack, queue, queueIndex, repeat } = state.playback;
  // Always allow previous when a track is loaded (enables restart via seek to 0)
  if (currentTrack && queue.length === 0) return true;
  if (queue.length === 0 || queueIndex < 0) return false;
  if (repeat === "all") return true;
  return queueIndex > 0;
};

/** Tracks after the current index (the "Up Next" list). Memoised to avoid re-renders. */
export const selectUpNext = createSelector(
  [selectQueue, selectQueueIndex],
  (queue, queueIndex) => queue.slice(queueIndex + 1)
);

// --- UI preferences selectors ---

export const selectSidebarCollapsed = (state: RootState) =>
  state.uiPrefs.sidebarCollapsed;
export const selectDefaultViewMode = (state: RootState) =>
  state.uiPrefs.defaultViewMode;
