/**
 * Redux slice for persistent UI preferences.
 * Sidebar collapsed state and default view mode.
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UiPrefsState } from "./types";

export const initialState: UiPrefsState = {
  sidebarCollapsed: false,
  defaultViewMode: "grid",
};

const uiPrefsSlice = createSlice({
  name: "uiPrefs",
  initialState,
  reducers: {
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    setDefaultViewMode(state, action: PayloadAction<"grid" | "tree">) {
      state.defaultViewMode = action.payload;
    },
  },
});

export const { setSidebarCollapsed, setDefaultViewMode } = uiPrefsSlice.actions;

export default uiPrefsSlice.reducer;
