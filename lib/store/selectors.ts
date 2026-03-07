/**
 * Redux selectors for playback and UI preferences state.
 * Plain functions — no reselect needed for these simple derivations.
 */

import type { RootState } from "./index";

// --- Playback selectors ---

export const selectCurrentTrack = (state: RootState) =>
  state.playback.currentTrack;
export const selectIsPlaying = (state: RootState) => state.playback.isPlaying;
export const selectQueue = (state: RootState) => state.playback.queue;
export const selectQueueIndex = (state: RootState) => state.playback.queueIndex;
export const selectVolume = (state: RootState) => state.playback.volume;
export const selectIsMuted = (state: RootState) => state.playback.isMuted;
export const selectShuffle = (state: RootState) => state.playback.shuffle;
export const selectRepeat = (state: RootState) => state.playback.repeat;
export const selectIsExpanded = (state: RootState) => state.playback.isExpanded;
export const selectCurrentTime = (state: RootState) =>
  state.playback.currentTime;
export const selectDuration = (state: RootState) => state.playback.duration;

/** Progress as a percentage (0-100). Returns 0 if no duration. */
export const selectProgress = (state: RootState): number => {
  const { currentTime, duration } = state.playback;
  if (duration <= 0) return 0;
  return (currentTime / duration) * 100;
};

/** Whether there is a next track to skip to. */
export const selectHasNext = (state: RootState): boolean => {
  const { queue, queueIndex, repeat } = state.playback;
  if (queue.length === 0) return false;
  if (repeat === "all") return true;
  return queueIndex < queue.length - 1;
};

/** Whether there is a previous track to skip to. */
export const selectHasPrevious = (state: RootState): boolean => {
  const { queue, queueIndex, repeat } = state.playback;
  if (queue.length === 0) return false;
  if (repeat === "all") return true;
  return queueIndex > 0;
};

/** Tracks after the current index (the "Up Next" list). */
export const selectUpNext = (state: RootState) => {
  const { queue, queueIndex } = state.playback;
  return queue.slice(queueIndex + 1);
};

// --- UI preferences selectors ---

export const selectSidebarCollapsed = (state: RootState) =>
  state.uiPrefs.sidebarCollapsed;
export const selectDefaultViewMode = (state: RootState) =>
  state.uiPrefs.defaultViewMode;
