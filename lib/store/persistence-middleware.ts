/**
 * Listener middleware for persisting playback and UI preferences to localStorage.
 * Persists: repeat mode, sidebar collapsed, default view mode.
 * Does NOT persist: queue, current track, playback position (those are server-side).
 * Volume/mute are now owned by Vidstack (persisted via its own storage).
 */

import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { setRepeat } from "./playback-slice";
import { setSidebarCollapsed, setDefaultViewMode } from "./ui-prefs-slice";
import { initialState as playbackInitial } from "./playback-slice";
import { initialState as uiPrefsInitial } from "./ui-prefs-slice";
import type { RootState } from "./index";
import type { RepeatMode } from "./types";

export const STORAGE_KEY_REPEAT = "canoncore-player-repeat:v1";
export const STORAGE_KEY_SIDEBAR = "canoncore-sidebar-collapsed:v1";
export const STORAGE_KEY_VIEW_MODE = "canoncore-default-view-mode:v1";

/** Keys from the old persistence scheme — cleaned up on first load. */
const LEGACY_KEYS = ["canoncore-player-volume:v1", "canoncore-player-muted:v1"];

const VALID_REPEAT_MODES: RepeatMode[] = ["off", "one", "all"];
const VALID_VIEW_MODES = ["grid", "tree"] as const;

/** Load persisted state from localStorage to hydrate the store. */
export function loadPersistedState(): {
  playback: Pick<typeof playbackInitial, "repeat">;
  uiPrefs: typeof uiPrefsInitial;
} {
  const defaults = {
    playback: {
      repeat: playbackInitial.repeat,
    },
    uiPrefs: { ...uiPrefsInitial },
  };

  try {
    // Clean up legacy keys from old persistence scheme
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key);
    }

    const repeat = localStorage.getItem(
      STORAGE_KEY_REPEAT
    ) as RepeatMode | null;
    if (repeat && VALID_REPEAT_MODES.includes(repeat)) {
      defaults.playback.repeat = repeat;
    }

    const sidebar = localStorage.getItem(STORAGE_KEY_SIDEBAR);
    if (sidebar === "true" || sidebar === "false") {
      defaults.uiPrefs.sidebarCollapsed = sidebar === "true";
    }

    const viewMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
    if (
      viewMode &&
      (VALID_VIEW_MODES as readonly string[]).includes(viewMode)
    ) {
      defaults.uiPrefs.defaultViewMode = viewMode as "grid" | "tree";
    }
  } catch {
    // localStorage unavailable
  }

  return defaults;
}

/** Listener middleware that persists state changes to localStorage. */
export const persistenceMiddleware = createListenerMiddleware();

persistenceMiddleware.startListening({
  matcher: isAnyOf(setRepeat),
  effect: (_action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    try {
      localStorage.setItem(STORAGE_KEY_REPEAT, state.playback.repeat);
    } catch {
      // localStorage unavailable
    }
  },
});

persistenceMiddleware.startListening({
  matcher: isAnyOf(setSidebarCollapsed, setDefaultViewMode),
  effect: (_action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    try {
      localStorage.setItem(
        STORAGE_KEY_SIDEBAR,
        String(state.uiPrefs.sidebarCollapsed)
      );
      localStorage.setItem(
        STORAGE_KEY_VIEW_MODE,
        state.uiPrefs.defaultViewMode
      );
    } catch {
      // localStorage unavailable
    }
  },
});
