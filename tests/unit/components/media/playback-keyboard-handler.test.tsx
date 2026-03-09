import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import playbackReducer, { playTrack } from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import type { QueueTrack } from "@/lib/store/types";

// Configurable Vidstack mock state
const vidstackState: Record<string, unknown> = {
  paused: true,
};

const mockRemote = {
  play: vi.fn(),
  pause: vi.fn(),
  seek: vi.fn(),
  changeVolume: vi.fn(),
  toggleMuted: vi.fn(),
};

const mockPlayer = {
  currentTime: 50,
  volume: 0.8,
  duration: 120,
};

vi.mock("@vidstack/react", () => ({
  useMediaState: (key: string) => vidstackState[key] ?? false,
  useMediaRemote: () => mockRemote,
  useMediaPlayer: () => mockPlayer,
}));

const mockTrack: QueueTrack = {
  fileId: "f1",
  itemId: "i1",
  filename: "test.mp4",
  mimeType: "video/mp4",
  itemName: "Test",
};

function makeTestStore() {
  return configureStore({
    reducer: { playback: playbackReducer, uiPrefs: uiPrefsReducer },
  });
}

// vi.mock() is hoisted before imports, so regular import uses mocked version
import { PlaybackKeyboardHandler } from "@/components/media/playback-keyboard-handler";

describe("PlaybackKeyboardHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vidstackState.paused = true;
    mockPlayer.currentTime = 50;
    mockPlayer.volume = 0.8;
    mockPlayer.duration = 120;
  });

  it("should call remote.play() on Space when paused", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    vidstackState.paused = true;

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });

    expect(mockRemote.play).toHaveBeenCalled();
  });

  it("should call remote.pause() on Space when playing", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    vidstackState.paused = false;

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });

    expect(mockRemote.pause).toHaveBeenCalled();
  });

  it("should not act on Space when no track is loaded", () => {
    const store = makeTestStore();

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });

    expect(mockRemote.play).not.toHaveBeenCalled();
    expect(mockRemote.pause).not.toHaveBeenCalled();
  });

  it("should not intercept Space when focused on an input", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
        <input data-testid="text-input" />
      </Provider>
    );

    const input = document.querySelector("input")!;
    input.focus();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });

    expect(mockRemote.play).not.toHaveBeenCalled();
    expect(mockRemote.pause).not.toHaveBeenCalled();
  });

  it("should toggle mute on M key", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    });

    expect(mockRemote.toggleMuted).toHaveBeenCalled();
  });

  it("should seek backward on ArrowLeft", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    mockPlayer.currentTime = 50;

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    });

    expect(mockRemote.seek).toHaveBeenCalledWith(40);
  });

  it("should clamp seek backward to 0", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    mockPlayer.currentTime = 5;

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    });

    expect(mockRemote.seek).toHaveBeenCalledWith(0);
  });

  it("should seek forward on ArrowRight", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    mockPlayer.currentTime = 50;

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });

    expect(mockRemote.seek).toHaveBeenCalledWith(60);
  });

  it("should increase volume on ArrowUp", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    mockPlayer.volume = 0.8;

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });

    expect(mockRemote.changeVolume).toHaveBeenCalledWith(
      expect.closeTo(0.9, 5)
    );
  });

  it("should clamp volume up to 1", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    mockPlayer.volume = 0.95;

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });

    expect(mockRemote.changeVolume).toHaveBeenCalledWith(1);
  });

  it("should decrease volume on ArrowDown", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    mockPlayer.volume = 0.8;

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });

    expect(mockRemote.changeVolume).toHaveBeenCalledWith(
      expect.closeTo(0.7, 5)
    );
  });

  it("should clamp volume down to 0", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    mockPlayer.volume = 0.05;

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });

    expect(mockRemote.changeVolume).toHaveBeenCalledWith(0);
  });

  it("should clamp seek forward to duration", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    mockPlayer.currentTime = 115;
    mockPlayer.duration = 120;

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });

    expect(mockRemote.seek).toHaveBeenCalledWith(120);
  });

  it("should not act on Space when focused on element with role=button", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
        <div role="button" tabIndex={0} data-testid="role-btn" />
      </Provider>
    );

    const roleBtn = document.querySelector("[data-testid='role-btn']")!;
    (roleBtn as HTMLElement).focus();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });

    expect(mockRemote.play).not.toHaveBeenCalled();
    expect(mockRemote.pause).not.toHaveBeenCalled();
  });
});
