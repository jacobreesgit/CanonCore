/**
 * Redux slice for media playback state.
 * Manages now-playing, play/pause, volume, shuffle/repeat, and expanded view.
 * Queue management is in separate actions below.
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PlaybackState, QueueTrack, RepeatMode } from "./types";

export const initialState: PlaybackState = {
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  shuffle: false,
  repeat: "off",
  isExpanded: false,
};

const playbackSlice = createSlice({
  name: "playback",
  initialState,
  reducers: {
    /** Load and immediately play a track (resets time, clears queue context). */
    playTrack(state, action: PayloadAction<QueueTrack>) {
      state.currentTrack = action.payload;
      state.isPlaying = true;
      state.currentTime = 0;
      state.duration = 0;
      state.queueIndex = -1;
    },

    /** Pause playback. */
    pause(state) {
      state.isPlaying = false;
    },

    /** Resume playback (only if a track is loaded). */
    resume(state) {
      if (state.currentTrack) {
        state.isPlaying = true;
      }
    },

    /** Update current playback time (from audio element timeupdate). */
    setCurrentTime(state, action: PayloadAction<number>) {
      state.currentTime = action.payload;
    },

    /** Update track duration (from audio element loadedmetadata). */
    setDuration(state, action: PayloadAction<number>) {
      state.duration = action.payload;
    },

    /** Set volume (clamped to 0-1). */
    setVolume(state, action: PayloadAction<number>) {
      state.volume = Math.max(0, Math.min(1, action.payload));
    },

    /** Toggle mute on/off. */
    toggleMute(state) {
      state.isMuted = !state.isMuted;
    },

    /** Toggle shuffle mode. */
    toggleShuffle(state) {
      state.shuffle = !state.shuffle;
    },

    /** Set repeat mode. */
    setRepeat(state, action: PayloadAction<RepeatMode>) {
      state.repeat = action.payload;
    },

    /** Toggle expanded (fullscreen) player view. */
    toggleExpanded(state) {
      state.isExpanded = !state.isExpanded;
    },

    /** Close expanded view. */
    closeExpanded(state) {
      state.isExpanded = false;
    },

    /** Stop playback entirely and clear current track. */
    stop(state) {
      state.currentTrack = null;
      state.isPlaying = false;
      state.currentTime = 0;
      state.duration = 0;
      state.queueIndex = -1;
      state.isExpanded = false;
    },

    // --- Queue management ---

    /** Replace the entire queue and start playing from the given index. */
    playQueue(
      state,
      action: PayloadAction<{ tracks: QueueTrack[]; startIndex?: number }>
    ) {
      const { tracks, startIndex = 0 } = action.payload;
      state.queue = tracks;
      state.queueIndex = startIndex;
      state.currentTrack = tracks[startIndex] ?? null;
      state.isPlaying = !!state.currentTrack;
      state.currentTime = 0;
      state.duration = 0;
    },

    /** Add a track to the end of the queue. */
    addToQueue(state, action: PayloadAction<QueueTrack>) {
      state.queue.push(action.payload);
    },

    /** Insert a track immediately after the current track ("Play Next"). */
    playNext(state, action: PayloadAction<QueueTrack>) {
      const insertIndex = state.queueIndex >= 0 ? state.queueIndex + 1 : 0;
      state.queue.splice(insertIndex, 0, action.payload);
    },

    /** Remove a track from the queue by index. */
    removeFromQueue(state, action: PayloadAction<number>) {
      const removeIndex = action.payload;
      if (removeIndex < 0 || removeIndex >= state.queue.length) return;

      state.queue.splice(removeIndex, 1);

      // Adjust queueIndex if needed
      if (removeIndex < state.queueIndex) {
        state.queueIndex--;
      } else if (removeIndex === state.queueIndex) {
        // Removed the currently playing track from queue
        // Load the next track at the same index (or previous if at end)
        if (state.queue.length === 0) {
          state.queueIndex = -1;
        } else {
          state.queueIndex = Math.min(state.queueIndex, state.queue.length - 1);
          state.currentTrack = state.queue[state.queueIndex];
          state.currentTime = 0;
          state.duration = 0;
        }
      }
    },

    /** Clear all tracks from the queue (does not stop current track). */
    clearQueue(state) {
      state.queue = [];
      state.queueIndex = -1;
    },

    /** Move a queue item from one index to another (drag reorder). */
    reorderQueue(
      state,
      action: PayloadAction<{ fromIndex: number; toIndex: number }>
    ) {
      const { fromIndex, toIndex } = action.payload;
      if (
        fromIndex < 0 ||
        fromIndex >= state.queue.length ||
        toIndex < 0 ||
        toIndex >= state.queue.length
      ) {
        return;
      }

      const [moved] = state.queue.splice(fromIndex, 1);
      state.queue.splice(toIndex, 0, moved);

      // Update queueIndex to follow the currently playing track
      if (state.queueIndex === fromIndex) {
        state.queueIndex = toIndex;
      } else if (fromIndex < state.queueIndex && toIndex >= state.queueIndex) {
        state.queueIndex--;
      } else if (fromIndex > state.queueIndex && toIndex <= state.queueIndex) {
        state.queueIndex++;
      }
    },

    /** Skip to the next track in the queue. */
    skipNext(state) {
      if (state.queue.length === 0) return;

      if (state.repeat === "one") {
        // Repeat one: restart current track
        state.currentTime = 0;
        return;
      }

      const nextIndex = state.queueIndex + 1;

      if (nextIndex < state.queue.length) {
        state.queueIndex = nextIndex;
        state.currentTrack = state.queue[nextIndex];
        state.currentTime = 0;
        state.duration = 0;
        state.isPlaying = true;
      } else if (state.repeat === "all") {
        // Loop back to start
        state.queueIndex = 0;
        state.currentTrack = state.queue[0];
        state.currentTime = 0;
        state.duration = 0;
        state.isPlaying = true;
      } else {
        // End of queue, no repeat
        state.isPlaying = false;
      }
    },

    /** Skip to the previous track in the queue (or restart if >3s in). */
    skipPrevious(state) {
      if (state.queue.length === 0) return;

      // If more than 3 seconds in, restart current track
      if (state.currentTime > 3) {
        state.currentTime = 0;
        return;
      }

      const prevIndex = state.queueIndex - 1;

      if (prevIndex >= 0) {
        state.queueIndex = prevIndex;
        state.currentTrack = state.queue[prevIndex];
        state.currentTime = 0;
        state.duration = 0;
        state.isPlaying = true;
      } else if (state.repeat === "all") {
        // Loop to end
        const lastIndex = state.queue.length - 1;
        state.queueIndex = lastIndex;
        state.currentTrack = state.queue[lastIndex];
        state.currentTime = 0;
        state.duration = 0;
        state.isPlaying = true;
      } else {
        // At start, just restart
        state.currentTime = 0;
      }
    },

    /** Skip to a specific index in the queue. */
    skipToIndex(state, action: PayloadAction<number>) {
      const index = action.payload;
      if (index < 0 || index >= state.queue.length) return;

      state.queueIndex = index;
      state.currentTrack = state.queue[index];
      state.currentTime = 0;
      state.duration = 0;
      state.isPlaying = true;
    },
  },
});

export const {
  playTrack,
  pause,
  resume,
  setCurrentTime,
  setDuration,
  setVolume,
  toggleMute,
  toggleShuffle,
  setRepeat,
  toggleExpanded,
  closeExpanded,
  stop,
  playQueue,
  addToQueue,
  playNext,
  removeFromQueue,
  clearQueue,
  reorderQueue,
  skipNext,
  skipPrevious,
  skipToIndex,
} = playbackSlice.actions;

export default playbackSlice.reducer;
