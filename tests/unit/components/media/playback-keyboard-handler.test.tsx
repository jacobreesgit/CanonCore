import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import playbackReducer, { playTrack } from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import { PlaybackKeyboardHandler } from "@/components/media/playback-keyboard-handler";
import type { QueueTrack } from "@/lib/store/types";

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

describe("PlaybackKeyboardHandler", () => {
  it("should pause on Space when playing", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });

    expect(store.getState().playback.isPlaying).toBe(false);
  });

  it("should resume on Space when paused", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(store.getState().playback.isPlaying).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(store.getState().playback.isPlaying).toBe(true);
  });

  it("should not pause on Space when no track is loaded", () => {
    const store = makeTestStore();

    render(
      <Provider store={store}>
        <PlaybackKeyboardHandler />
      </Provider>
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });

    expect(store.getState().playback.isPlaying).toBe(false);
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

    expect(store.getState().playback.isPlaying).toBe(true);
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

    expect(store.getState().playback.isMuted).toBe(true);
  });
});
