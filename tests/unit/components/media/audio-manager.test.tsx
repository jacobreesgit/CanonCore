import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import playbackReducer, {
  playTrack,
  playQueue,
  pause,
  setVolume,
  toggleMute,
  stop,
  seekTo,
} from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import { AudioManager } from "@/components/media/audio-manager";
import type { QueueTrack } from "@/lib/store/types";

vi.mock("@/lib/item-file-actions", () => ({
  updatePlaybackPosition: vi.fn(),
}));

// MediaMetadata is not available in jsdom
globalThis.MediaMetadata =
  globalThis.MediaMetadata ??
  (class MediaMetadata {
    title: string;
    artist: string;
    artwork: { src: string; sizes: string }[];
    constructor(init: {
      title?: string;
      artist?: string;
      artwork?: { src: string; sizes: string }[];
    }) {
      this.title = init.title ?? "";
      this.artist = init.artist ?? "";
      this.artwork = init.artwork ?? [];
    }
  } as unknown as typeof globalThis.MediaMetadata);

const mockTrack: QueueTrack = {
  fileId: "file-1",
  itemId: "item-1",
  filename: "test.mp4",
  mimeType: "video/mp4",
  itemName: "Test",
};

function makeTestStore() {
  return configureStore({
    reducer: { playback: playbackReducer, uiPrefs: uiPrefsReducer },
  });
}

/** Creates a mock audio element with an event listener registry. */
function createMockAudio() {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  return {
    element: {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      src: "",
      volume: 1,
      muted: false,
      currentTime: 0,
      duration: 0,
      preload: "",
      addEventListener: vi.fn(
        (event: string, handler: (...args: unknown[]) => void) => {
          listeners.set(event, handler);
        }
      ),
      removeEventListener: vi.fn(),
    } as unknown as HTMLAudioElement,
    listeners,
    /** Simulate firing an audio event. */
    fire(event: string) {
      listeners.get(event)?.();
    },
  };
}

function renderWithStore(
  store: ReturnType<typeof makeTestStore>,
  audio: ReturnType<typeof createMockAudio>
) {
  return render(
    <Provider store={store}>
      <AudioManager createAudio={() => audio.element} />
    </Provider>
  );
}

describe("AudioManager", () => {
  it("renders nothing visible", () => {
    const audio = createMockAudio();
    const store = makeTestStore();
    const { container } = renderWithStore(store, audio);
    expect(container.innerHTML).toBe("");
  });

  it("sets audio src and calls load when track changes", () => {
    const audio = createMockAudio();
    const store = makeTestStore();
    renderWithStore(store, audio);
    act(() => {
      store.dispatch(playTrack(mockTrack));
    });
    expect(audio.element.src).toBe("/api/stream/file-1");
    expect(audio.element.load).toHaveBeenCalled();
  });

  it("calls play when isPlaying becomes true", () => {
    const audio = createMockAudio();
    const store = makeTestStore();
    renderWithStore(store, audio);
    act(() => {
      store.dispatch(playTrack(mockTrack));
    });
    expect(audio.element.play).toHaveBeenCalled();
  });

  it("calls pause when paused", () => {
    const audio = createMockAudio();
    const store = makeTestStore();
    renderWithStore(store, audio);
    act(() => {
      store.dispatch(playTrack(mockTrack));
    });
    act(() => {
      store.dispatch(pause());
    });
    expect(audio.element.pause).toHaveBeenCalled();
  });

  it("updates volume", () => {
    const audio = createMockAudio();
    const store = makeTestStore();
    renderWithStore(store, audio);
    act(() => {
      store.dispatch(setVolume(0.5));
    });
    expect(audio.element.volume).toBe(0.5);
  });

  it("updates muted", () => {
    const audio = createMockAudio();
    const store = makeTestStore();
    renderWithStore(store, audio);
    act(() => {
      store.dispatch(toggleMute());
    });
    expect(audio.element.muted).toBe(true);
  });

  it("clears src on stop", () => {
    const audio = createMockAudio();
    const store = makeTestStore();
    renderWithStore(store, audio);
    act(() => {
      store.dispatch(playTrack(mockTrack));
    });
    act(() => {
      store.dispatch(stop());
    });
    expect(audio.element.src).toBe("");
    expect(audio.element.pause).toHaveBeenCalled();
  });

  it("dispatches setDuration on loadedmetadata event", () => {
    const audio = createMockAudio();
    const store = makeTestStore();
    renderWithStore(store, audio);
    act(() => {
      store.dispatch(playTrack(mockTrack));
    });
    // Simulate the audio element reporting its duration
    Object.defineProperty(audio.element, "duration", {
      value: 120,
      writable: true,
    });
    act(() => {
      audio.fire("loadedmetadata");
    });
    expect(store.getState().playback.duration).toBe(120);
  });

  it("dispatches skipNext on ended event (advances queue)", () => {
    const audio = createMockAudio();
    const mockTrack2: QueueTrack = { ...mockTrack, fileId: "file-2" };
    const store = makeTestStore();
    renderWithStore(store, audio);
    act(() => {
      store.dispatch(playQueue({ tracks: [mockTrack, mockTrack2] }));
    });
    act(() => {
      audio.fire("ended");
    });
    expect(store.getState().playback.queueIndex).toBe(1);
    expect(store.getState().playback.currentTrack?.fileId).toBe("file-2");
  });

  it("dispatches pause on error event", () => {
    const audio = createMockAudio();
    const store = makeTestStore();
    renderWithStore(store, audio);
    act(() => {
      store.dispatch(playTrack(mockTrack));
    });
    act(() => {
      audio.fire("error");
    });
    expect(store.getState().playback.isPlaying).toBe(false);
  });

  it("should set MediaSession metadata when track changes", () => {
    const audio = createMockAudio();
    const store = makeTestStore();

    // Mock navigator.mediaSession
    const mockMediaSession = {
      metadata: null as MediaMetadata | null,
      setActionHandler: vi.fn(),
    };
    Object.defineProperty(navigator, "mediaSession", {
      value: mockMediaSession,
      writable: true,
      configurable: true,
    });

    renderWithStore(store, audio);

    act(() => {
      store.dispatch(playTrack(mockTrack));
    });

    expect(mockMediaSession.metadata).not.toBeNull();
    expect(mockMediaSession.metadata?.title).toBe("test.mp4");
    expect(mockMediaSession.metadata?.artist).toBe("Test");
  });

  it("should seek audio element when seekTarget is set", () => {
    const audio = createMockAudio();
    const store = makeTestStore();
    renderWithStore(store, audio);

    act(() => {
      store.dispatch(playTrack(mockTrack));
    });

    // Simulate audio playing at 10s
    audio.element.currentTime = 10;

    // User seeks to 60s via seekTo action
    act(() => {
      store.dispatch(seekTo(60));
    });

    // AudioManager should sync the seek to the audio element
    expect(audio.element.currentTime).toBe(60);
    // seekTarget should be cleared after sync
    expect(store.getState().playback.seekTarget).toBeNull();
  });
});
