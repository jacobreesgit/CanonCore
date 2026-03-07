import { describe, it, expect } from "vitest";
import playbackReducer, {
  playTrack,
  pause,
  resume,
  setCurrentTime,
  setDuration,
  setVolume,
  toggleMute,
  toggleShuffle,
  setRepeat,
  toggleExpanded,
  stop,
  seekTo,
  clearSeekTarget,
  playQueue,
  addToQueue,
  playNext,
  removeFromQueue,
  clearQueue,
  reorderQueue,
  skipNext,
  skipPrevious,
  skipToIndex,
  initialState,
} from "@/lib/store/playback-slice";
import type { QueueTrack } from "@/lib/store/types";

const mockTrack: QueueTrack = {
  fileId: "file-1",
  itemId: "item-1",
  filename: "test-video.mp4",
  mimeType: "video/mp4",
  itemName: "Test Item",
  posterUrl: "/api/artwork/art-1",
  duration: 3600,
  playbackPosition: 120,
};

const mockTrack2: QueueTrack = {
  fileId: "file-2",
  itemId: "item-2",
  filename: "test-audio.mp3",
  mimeType: "audio/mpeg",
  itemName: "Test Audio",
};

describe("playbackSlice", () => {
  describe("initial state", () => {
    it("returns correct initial state", () => {
      const state = playbackReducer(undefined, { type: "unknown" });
      expect(state).toEqual(initialState);
      expect(state.currentTrack).toBeNull();
      expect(state.queue).toEqual([]);
      expect(state.isPlaying).toBe(false);
      expect(state.volume).toBe(1);
      expect(state.repeat).toBe("off");
    });
  });

  describe("playTrack", () => {
    it("sets current track and starts playing", () => {
      const state = playbackReducer(initialState, playTrack(mockTrack));
      expect(state.currentTrack).toEqual(mockTrack);
      expect(state.isPlaying).toBe(true);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
    });

    it("replaces current track when already playing", () => {
      let state = playbackReducer(initialState, playTrack(mockTrack));
      state = playbackReducer(state, playTrack(mockTrack2));
      expect(state.currentTrack).toEqual(mockTrack2);
      expect(state.isPlaying).toBe(true);
    });
  });

  describe("pause / resume", () => {
    it("pauses playback", () => {
      let state = playbackReducer(initialState, playTrack(mockTrack));
      state = playbackReducer(state, pause());
      expect(state.isPlaying).toBe(false);
    });

    it("resumes playback", () => {
      let state = playbackReducer(initialState, playTrack(mockTrack));
      state = playbackReducer(state, pause());
      state = playbackReducer(state, resume());
      expect(state.isPlaying).toBe(true);
    });

    it("resume does nothing when no track loaded", () => {
      const state = playbackReducer(initialState, resume());
      expect(state.isPlaying).toBe(false);
    });
  });

  describe("time and duration", () => {
    it("sets current time", () => {
      const state = playbackReducer(initialState, setCurrentTime(42.5));
      expect(state.currentTime).toBe(42.5);
    });

    it("sets duration", () => {
      const state = playbackReducer(initialState, setDuration(3600));
      expect(state.duration).toBe(3600);
    });
  });

  describe("volume controls", () => {
    it("sets volume", () => {
      const state = playbackReducer(initialState, setVolume(0.5));
      expect(state.volume).toBe(0.5);
    });

    it("clamps volume to 0-1 range", () => {
      let state = playbackReducer(initialState, setVolume(1.5));
      expect(state.volume).toBe(1);
      state = playbackReducer(state, setVolume(-0.5));
      expect(state.volume).toBe(0);
    });

    it("toggles mute", () => {
      let state = playbackReducer(initialState, toggleMute());
      expect(state.isMuted).toBe(true);
      state = playbackReducer(state, toggleMute());
      expect(state.isMuted).toBe(false);
    });
  });

  describe("shuffle and repeat", () => {
    it("toggles shuffle", () => {
      let state = playbackReducer(initialState, toggleShuffle());
      expect(state.shuffle).toBe(true);
      state = playbackReducer(state, toggleShuffle());
      expect(state.shuffle).toBe(false);
    });

    it("sets repeat mode", () => {
      let state = playbackReducer(initialState, setRepeat("one"));
      expect(state.repeat).toBe("one");
      state = playbackReducer(state, setRepeat("all"));
      expect(state.repeat).toBe("all");
    });
  });

  describe("expanded view", () => {
    it("toggles expanded state", () => {
      let state = playbackReducer(initialState, toggleExpanded());
      expect(state.isExpanded).toBe(true);
      state = playbackReducer(state, toggleExpanded());
      expect(state.isExpanded).toBe(false);
    });
  });

  describe("queue management", () => {
    describe("playQueue", () => {
      it("replaces queue and plays from start", () => {
        const state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2] })
        );
        expect(state.queue).toHaveLength(2);
        expect(state.queueIndex).toBe(0);
        expect(state.currentTrack).toEqual(mockTrack);
        expect(state.isPlaying).toBe(true);
      });

      it("plays from specified start index", () => {
        const state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2], startIndex: 1 })
        );
        expect(state.queueIndex).toBe(1);
        expect(state.currentTrack).toEqual(mockTrack2);
      });
    });

    describe("addToQueue", () => {
      it("adds track to end of queue", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack] })
        );
        state = playbackReducer(state, addToQueue(mockTrack2));
        expect(state.queue).toHaveLength(2);
        expect(state.queue[1]).toEqual(mockTrack2);
      });
    });

    describe("playNext", () => {
      it("inserts track after current", () => {
        const mockTrack3: QueueTrack = {
          fileId: "file-3",
          itemId: "item-3",
          filename: "inserted.mp4",
          mimeType: "video/mp4",
          itemName: "Inserted",
        };
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2] })
        );
        state = playbackReducer(state, playNext(mockTrack3));
        expect(state.queue[1]).toEqual(mockTrack3);
        expect(state.queue[2]).toEqual(mockTrack2);
      });
    });

    describe("removeFromQueue", () => {
      it("removes track and adjusts index", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2], startIndex: 1 })
        );
        state = playbackReducer(state, removeFromQueue(0));
        expect(state.queue).toHaveLength(1);
        expect(state.queueIndex).toBe(0);
      });

      it("handles removing current track", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2] })
        );
        state = playbackReducer(state, removeFromQueue(0));
        expect(state.queueIndex).toBe(0);
        expect(state.currentTrack).toEqual(mockTrack2);
      });
    });

    describe("clearQueue", () => {
      it("empties queue but keeps current track", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2] })
        );
        state = playbackReducer(state, clearQueue());
        expect(state.queue).toHaveLength(0);
        expect(state.queueIndex).toBe(-1);
        expect(state.currentTrack).toEqual(mockTrack); // still loaded
      });
    });

    describe("reorderQueue", () => {
      it("moves track and updates index", () => {
        const mockTrack3: QueueTrack = {
          fileId: "file-3",
          itemId: "item-3",
          filename: "third.mp4",
          mimeType: "video/mp4",
          itemName: "Third",
        };
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2, mockTrack3] })
        );
        // Playing index 0, move index 2 to index 0
        state = playbackReducer(
          state,
          reorderQueue({ fromIndex: 2, toIndex: 0 })
        );
        expect(state.queue[0]).toEqual(mockTrack3);
        expect(state.queueIndex).toBe(1); // pushed right
      });
    });
  });

  describe("skip navigation", () => {
    describe("skipNext", () => {
      it("advances to next track", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2] })
        );
        state = playbackReducer(state, skipNext());
        expect(state.queueIndex).toBe(1);
        expect(state.currentTrack).toEqual(mockTrack2);
      });

      it("stops at end without repeat", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack], startIndex: 0 })
        );
        state = playbackReducer(state, skipNext());
        expect(state.isPlaying).toBe(false);
      });

      it("loops with repeat all", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2], startIndex: 1 })
        );
        state = playbackReducer(state, setRepeat("all"));
        state = playbackReducer(state, skipNext());
        expect(state.queueIndex).toBe(0);
        expect(state.currentTrack).toEqual(mockTrack);
      });

      it("restarts track with repeat one", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2] })
        );
        state = playbackReducer(state, setRepeat("one"));
        state = playbackReducer(state, setCurrentTime(50));
        state = playbackReducer(state, skipNext());
        expect(state.queueIndex).toBe(0); // same track
        expect(state.currentTime).toBe(0); // restarted
      });
    });

    describe("skipPrevious", () => {
      it("goes to previous track when within 3 seconds", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2], startIndex: 1 })
        );
        state = playbackReducer(state, setCurrentTime(2));
        state = playbackReducer(state, skipPrevious());
        expect(state.queueIndex).toBe(0);
        expect(state.currentTrack).toEqual(mockTrack);
      });

      it("restarts current track when past 3 seconds", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2], startIndex: 1 })
        );
        state = playbackReducer(state, setCurrentTime(10));
        state = playbackReducer(state, skipPrevious());
        expect(state.queueIndex).toBe(1); // same track
        expect(state.currentTime).toBe(0); // restarted
      });

      it("loops to end with repeat all", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2], startIndex: 0 })
        );
        state = playbackReducer(state, setRepeat("all"));
        state = playbackReducer(state, skipPrevious());
        expect(state.queueIndex).toBe(1);
      });
    });

    describe("skipToIndex", () => {
      it("jumps to specific queue index", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack, mockTrack2] })
        );
        state = playbackReducer(state, skipToIndex(1));
        expect(state.queueIndex).toBe(1);
        expect(state.currentTrack).toEqual(mockTrack2);
        expect(state.isPlaying).toBe(true);
      });

      it("ignores out-of-bounds index", () => {
        let state = playbackReducer(
          initialState,
          playQueue({ tracks: [mockTrack] })
        );
        state = playbackReducer(state, skipToIndex(5));
        expect(state.queueIndex).toBe(0); // unchanged
      });
    });
  });

  describe("stop", () => {
    it("clears everything", () => {
      let state = playbackReducer(
        initialState,
        playQueue({ tracks: [mockTrack, mockTrack2] })
      );
      state = playbackReducer(state, toggleExpanded());
      state = playbackReducer(state, stop());
      expect(state.currentTrack).toBeNull();
      expect(state.isPlaying).toBe(false);
      expect(state.isExpanded).toBe(false);
      expect(state.queueIndex).toBe(-1);
    });
  });

  describe("seekTo / clearSeekTarget", () => {
    it("should set seekTarget and update currentTime", () => {
      let state = playbackReducer(initialState, playTrack(mockTrack));
      state = playbackReducer(state, seekTo(42));
      expect(state.seekTarget).toBe(42);
      expect(state.currentTime).toBe(42);
    });

    it("should clear seekTarget", () => {
      let state = playbackReducer(initialState, seekTo(42));
      state = playbackReducer(state, clearSeekTarget());
      expect(state.seekTarget).toBeNull();
    });

    it("should clear seekTarget on playTrack", () => {
      let state = playbackReducer(initialState, seekTo(42));
      state = playbackReducer(state, playTrack(mockTrack));
      expect(state.seekTarget).toBeNull();
    });

    it("should clear seekTarget on skipNext", () => {
      let state = playbackReducer(
        initialState,
        playQueue({ tracks: [mockTrack, mockTrack2] })
      );
      state = playbackReducer(state, seekTo(42));
      state = playbackReducer(state, skipNext());
      expect(state.seekTarget).toBeNull();
    });
  });
});
