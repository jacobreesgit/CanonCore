import { describe, it, expect } from "vitest";
import {
  selectCurrentTrack,
  selectIsPlaying,
  selectQueue,
  selectQueueIndex,
  selectVolume,
  selectIsMuted,
  selectShuffle,
  selectRepeat,
  selectIsExpanded,
  selectCurrentTime,
  selectDuration,
  selectProgress,
  selectHasNext,
  selectHasPrevious,
  selectUpNext,
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

  it("selectIsPlaying returns false initially", () => {
    expect(selectIsPlaying(baseState)).toBe(false);
  });

  it("selectQueue returns empty array initially", () => {
    expect(selectQueue(baseState)).toEqual([]);
  });

  it("selectQueueIndex returns -1 initially", () => {
    expect(selectQueueIndex(baseState)).toBe(-1);
  });

  it("selectVolume returns 1 initially", () => {
    expect(selectVolume(baseState)).toBe(1);
  });

  it("selectIsMuted returns false initially", () => {
    expect(selectIsMuted(baseState)).toBe(false);
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

  it("selectCurrentTime returns 0 initially", () => {
    expect(selectCurrentTime(baseState)).toBe(0);
  });

  it("selectDuration returns 0 initially", () => {
    expect(selectDuration(baseState)).toBe(0);
  });

  it("selectProgress returns 0 when no duration", () => {
    expect(selectProgress(baseState)).toBe(0);
  });

  it("selectProgress calculates percentage", () => {
    const state: RootState = {
      ...baseState,
      playback: { ...playbackInitial, currentTime: 30, duration: 120 },
    };
    expect(selectProgress(state)).toBe(25);
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
