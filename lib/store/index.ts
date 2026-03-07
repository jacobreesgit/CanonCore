/**
 * Redux store factory and type exports.
 * Store is created via factory function (Next.js App Router requirement —
 * prevents cross-request state leakage on the server).
 * Typed hooks live in ./hooks.ts to keep server-importable types separate.
 */

import { configureStore } from "@reduxjs/toolkit";
import playbackReducer from "./playback-slice";
import uiPrefsReducer from "./ui-prefs-slice";

export function makeStore() {
  return configureStore({
    reducer: {
      playback: playbackReducer,
      uiPrefs: uiPrefsReducer,
    },
  });
}

// Infer types from the store factory
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
