import { describe, it, expect, beforeEach } from "vitest";
import {
  loadPersistedState,
  STORAGE_KEY_REPEAT,
  STORAGE_KEY_SIDEBAR,
  STORAGE_KEY_VIEW_MODE,
} from "@/lib/store/persistence-middleware";

describe("loadPersistedState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when localStorage is empty", () => {
    const state = loadPersistedState();
    expect(state.playback.repeat).toBe("off");
    expect(state.uiPrefs.sidebarCollapsed).toBe(false);
    expect(state.uiPrefs.defaultViewMode).toBe("grid");
  });

  it("restores persisted values", () => {
    localStorage.setItem(STORAGE_KEY_REPEAT, "all");
    localStorage.setItem(STORAGE_KEY_SIDEBAR, "true");
    localStorage.setItem(STORAGE_KEY_VIEW_MODE, "tree");

    const state = loadPersistedState();
    expect(state.playback.repeat).toBe("all");
    expect(state.uiPrefs.sidebarCollapsed).toBe(true);
    expect(state.uiPrefs.defaultViewMode).toBe("tree");
  });

  it("ignores invalid repeat values gracefully", () => {
    localStorage.setItem(STORAGE_KEY_REPEAT, "invalid");

    const state = loadPersistedState();
    expect(state.playback.repeat).toBe("off");
  });

  it("cleans up legacy volume/muted keys", () => {
    localStorage.setItem("canoncore-player-volume:v1", "0.7");
    localStorage.setItem("canoncore-player-muted:v1", "true");

    loadPersistedState();

    expect(localStorage.getItem("canoncore-player-volume:v1")).toBeNull();
    expect(localStorage.getItem("canoncore-player-muted:v1")).toBeNull();
  });
});
