import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import playbackReducer, { playTrack } from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import { MiniPlayer } from "@/components/media/mini-player";
import type { QueueTrack } from "@/lib/store/types";

const mockTrack: QueueTrack = {
  fileId: "file-1",
  itemId: "item-1",
  filename: "test-video.mp4",
  mimeType: "video/mp4",
  itemName: "Test Movie",
  posterUrl: "/poster.jpg",
};

function makeTestStore() {
  return configureStore({
    reducer: { playback: playbackReducer, uiPrefs: uiPrefsReducer },
  });
}

describe("Playback integration", () => {
  it("dispatch playTrack → MiniPlayer appears → pause → play", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();

    render(
      <Provider store={store}>
        <MiniPlayer />
      </Provider>
    );

    // Initially no mini-player
    expect(screen.queryByTestId("mini-player")).not.toBeInTheDocument();

    // Dispatch playTrack (simulates what ItemDetailClient does)
    act(() => {
      store.dispatch(playTrack(mockTrack));
    });

    // MiniPlayer should appear with track info
    expect(screen.getByTestId("mini-player")).toBeInTheDocument();
    expect(screen.getByText("test-video.mp4")).toBeInTheDocument();
    expect(screen.getByText("Test Movie")).toBeInTheDocument();

    // Should show Pause button (track is playing)
    const pauseBtn = screen.getByRole("button", { name: "Pause" });
    expect(pauseBtn).toBeInTheDocument();

    // Click Pause → becomes Play
    await user.click(pauseBtn);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();

    // Click Play → becomes Pause
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("close button removes MiniPlayer", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();

    render(
      <Provider store={store}>
        <MiniPlayer />
      </Provider>
    );

    act(() => {
      store.dispatch(playTrack(mockTrack));
    });

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByTestId("mini-player")).not.toBeInTheDocument();
  });
});
