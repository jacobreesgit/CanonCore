/**
 * Shared Redux store exports.
 * Provides reducers, types, and actions.
 * The store factory (makeStore) stays in apps/web since it wires
 * platform-specific persistence middleware.
 */

import { combineReducers } from "@reduxjs/toolkit";
import playbackReducer from "./playback-slice";
import uiPrefsReducer from "./ui-prefs-slice";

/** Combined reducer for the store. Used to derive RootState. */
export const rootReducer = combineReducers({
  playback: playbackReducer,
  uiPrefs: uiPrefsReducer,
});

/** Root state type derived from the combined reducer. */
export type RootState = ReturnType<typeof rootReducer>;

// Re-export slice reducers for apps to use in configureStore
export { default as playbackReducer } from "./playback-slice";
export { default as uiPrefsReducer } from "./ui-prefs-slice";

// Re-export all actions and types
export {
  initialState as playbackInitialState,
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
} from "./playback-slice";
export {
  initialState as uiPrefsInitialState,
  setSidebarCollapsed,
  setDefaultViewMode,
} from "./ui-prefs-slice";
export * from "./types";
