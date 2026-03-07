import { describe, it, expect, beforeEach } from "vitest";
import {
  loadPersistedState,
  STORAGE_KEY_VOLUME,
  STORAGE_KEY_MUTED,
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
    expect(state.playback.volume).toBe(1);
    expect(state.playback.isMuted).toBe(false);
    expect(state.playback.repeat).toBe("off");
    expect(state.uiPrefs.sidebarCollapsed).toBe(false);
    expect(state.uiPrefs.defaultViewMode).toBe("grid");
  });

  it("restores persisted values", () => {
    localStorage.setItem(STORAGE_KEY_VOLUME, "0.7");
    localStorage.setItem(STORAGE_KEY_MUTED, "true");
    localStorage.setItem(STORAGE_KEY_REPEAT, "all");
    localStorage.setItem(STORAGE_KEY_SIDEBAR, "true");
    localStorage.setItem(STORAGE_KEY_VIEW_MODE, "tree");

    const state = loadPersistedState();
    expect(state.playback.volume).toBe(0.7);
    expect(state.playback.isMuted).toBe(true);
    expect(state.playback.repeat).toBe("all");
    expect(state.uiPrefs.sidebarCollapsed).toBe(true);
    expect(state.uiPrefs.defaultViewMode).toBe("tree");
  });

  it("ignores invalid values gracefully", () => {
    localStorage.setItem(STORAGE_KEY_VOLUME, "not-a-number");
    localStorage.setItem(STORAGE_KEY_REPEAT, "invalid");

    const state = loadPersistedState();
    expect(state.playback.volume).toBe(1);
    expect(state.playback.repeat).toBe("off");
  });

  it("rejects out-of-range values", () => {
    localStorage.setItem(STORAGE_KEY_VOLUME, "999");
    const high = loadPersistedState();
    expect(high.playback.volume).toBe(1); // rejects > 1

    localStorage.setItem(STORAGE_KEY_VOLUME, "-0.5");
    const low = loadPersistedState();
    expect(low.playback.volume).toBe(1); // rejects < 0
  });
});
