/**
 * Redux slice for media playback state.
 * Manages queue lifecycle, shuffle/repeat, and expanded view.
 * Playback transport state (play/pause, time, volume) is owned by Vidstack.
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PlaybackState, QueueTrack, RepeatMode } from "./types";

export const initialState: PlaybackState = {
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  shuffle: false,
  repeat: "off",
  isExpanded: false,
};

const playbackSlice = createSlice({
  name: "playback",
  initialState,
  reducers: {
    /** Load a track (clears queue). Vidstack handles actual playback. */
    playTrack(state, action: PayloadAction<QueueTrack>) {
      state.currentTrack = action.payload;
      state.queue = [];
      state.queueIndex = -1;
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

    /** Set expanded view to a specific value. */
    setExpanded(state, action: PayloadAction<boolean>) {
      state.isExpanded = action.payload;
    },

    /** Stop playback entirely and clear current track + queue. */
    stop(state) {
      state.currentTrack = null;
      state.queue = [];
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
        // Repeat one: keep same track (component handles restart via Vidstack)
        return;
      }

      if (state.shuffle) {
        // Pick a random index that isn't the current one
        const candidates = state.queue
          .map((_, i) => i)
          .filter((i) => i !== state.queueIndex);
        if (candidates.length === 0) return;
        const nextIndex =
          candidates[Math.floor(Math.random() * candidates.length)];
        state.queueIndex = nextIndex;
        state.currentTrack = state.queue[nextIndex];
        return;
      }

      const nextIndex = state.queueIndex + 1;

      if (nextIndex < state.queue.length) {
        state.queueIndex = nextIndex;
        state.currentTrack = state.queue[nextIndex];
      } else if (state.repeat === "all") {
        // Loop back to start
        state.queueIndex = 0;
        state.currentTrack = state.queue[0];
      }
      // End of queue without repeat: do nothing (component handles stop)
    },

    /** Skip to the previous track in the queue. */
    skipPrevious(state) {
      if (state.queue.length === 0) return;

      if (state.shuffle) {
        // Pick a random index that isn't the current one
        const candidates = state.queue
          .map((_, i) => i)
          .filter((i) => i !== state.queueIndex);
        if (candidates.length === 0) return;
        const prevIndex =
          candidates[Math.floor(Math.random() * candidates.length)];
        state.queueIndex = prevIndex;
        state.currentTrack = state.queue[prevIndex];
        return;
      }

      const prevIndex = state.queueIndex - 1;

      if (prevIndex >= 0) {
        state.queueIndex = prevIndex;
        state.currentTrack = state.queue[prevIndex];
      } else if (state.repeat === "all") {
        // Loop to end
        const lastIndex = state.queue.length - 1;
        state.queueIndex = lastIndex;
        state.currentTrack = state.queue[lastIndex];
      }
      // At start without repeat: do nothing (component handles restart via Vidstack)
    },

    /** Skip to a specific index in the queue. */
    skipToIndex(state, action: PayloadAction<number>) {
      const index = action.payload;
      if (index < 0 || index >= state.queue.length) return;

      state.queueIndex = index;
      state.currentTrack = state.queue[index];
    },
  },
});

export const {
  playTrack,
  toggleShuffle,
  setRepeat,
  toggleExpanded,
  closeExpanded,
  setExpanded,
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
