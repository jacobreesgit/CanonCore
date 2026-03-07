import { describe, it, expect } from "vitest";
import uiPrefsReducer, {
  setSidebarCollapsed,
  setDefaultViewMode,
  initialState,
} from "@/lib/store/ui-prefs-slice";

describe("uiPrefsSlice", () => {
  it("returns correct initial state", () => {
    const state = uiPrefsReducer(undefined, { type: "unknown" });
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.defaultViewMode).toBe("grid");
  });

  it("sets sidebar collapsed", () => {
    const state = uiPrefsReducer(initialState, setSidebarCollapsed(true));
    expect(state.sidebarCollapsed).toBe(true);
  });

  it("sets default view mode", () => {
    const state = uiPrefsReducer(initialState, setDefaultViewMode("tree"));
    expect(state.defaultViewMode).toBe("tree");
  });
});
