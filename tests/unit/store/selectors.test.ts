import { describe, it, expect } from "vitest";
import {
  selectCurrentTrack,
  selectQueue,
  selectQueueIndex,
  selectShuffle,
  selectRepeat,
  selectIsExpanded,
  selectHasNext,
  selectHasPrevious,
  selectUpNext,
  selectIsVideoFile,
} from "@/lib/store/selectors";
import { initialState as playbackInitial } from "@/lib/store/playback-slice";
import { initialState as uiPrefsInitial } from "@/lib/store/ui-prefs-slice";
import type { RootState } from "@/lib/store";
import type { QueueTrack } from "@/lib/store/types";

const mockTrack: QueueTrack = {
  fileId: "file-1",
  itemId: "item-1",
  filename: "test.mp4",
  mimeType: "video/mp4",
  itemName: "Test",
};

const baseState: RootState = {
  playback: playbackInitial,
  uiPrefs: uiPrefsInitial,
};

describe("playback selectors", () => {
  it("selectCurrentTrack returns null when empty", () => {
    expect(selectCurrentTrack(baseState)).toBeNull();
  });

  it("selectQueue returns empty array initially", () => {
    expect(selectQueue(baseState)).toEqual([]);
  });

  it("selectQueueIndex returns -1 initially", () => {
    expect(selectQueueIndex(baseState)).toBe(-1);
  });

  it("selectShuffle returns false initially", () => {
    expect(selectShuffle(baseState)).toBe(false);
  });

  it("selectRepeat returns off initially", () => {
    expect(selectRepeat(baseState)).toBe("off");
  });

  it("selectIsExpanded returns false initially", () => {
    expect(selectIsExpanded(baseState)).toBe(false);
  });

  it("selectHasNext is true when tracks remain", () => {
    const state: RootState = {
      ...baseState,
      playback: {
        ...playbackInitial,
        queue: [mockTrack, { ...mockTrack, fileId: "file-2" }],
        queueIndex: 0,
      },
    };
    expect(selectHasNext(state)).toBe(true);
  });

  it("selectHasNext with repeat all is true at end", () => {
    const state: RootState = {
      ...baseState,
      playback: {
        ...playbackInitial,
        queue: [mockTrack],
        queueIndex: 0,
        repeat: "all",
      },
    };
    expect(selectHasNext(state)).toBe(true);
  });

  it("selectHasPrevious is false at start without repeat", () => {
    const state: RootState = {
      ...baseState,
      playback: {
        ...playbackInitial,
        queue: [mockTrack],
        queueIndex: 0,
      },
    };
    expect(selectHasPrevious(state)).toBe(false);
  });

  it("selectUpNext returns remaining tracks after current", () => {
    const track2 = { ...mockTrack, fileId: "file-2" };
    const state: RootState = {
      ...baseState,
      playback: {
        ...playbackInitial,
        queue: [mockTrack, track2],
        queueIndex: 0,
      },
    };
    expect(selectUpNext(state)).toEqual([track2]);
  });
});

describe("selectIsVideoFile", () => {
  it("returns true for video/* mimeType", () => {
    const state: RootState = {
      ...baseState,
      playback: {
        ...playbackInitial,
        currentTrack: { ...mockTrack, mimeType: "video/mp4" },
      },
    };
    expect(selectIsVideoFile(state)).toBe(true);
  });

  it("returns false for audio/* mimeType", () => {
    const state: RootState = {
      ...baseState,
      playback: {
        ...playbackInitial,
        currentTrack: { ...mockTrack, mimeType: "audio/mpeg" },
      },
    };
    expect(selectIsVideoFile(state)).toBe(false);
  });

  it("returns false when no track is loaded", () => {
    const state: RootState = {
      ...baseState,
      playback: { ...playbackInitial, currentTrack: null },
    };
    expect(selectIsVideoFile(state)).toBe(false);
  });
});
