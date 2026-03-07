import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
  filename: "breaking-bad-s01e01.mkv",
  mimeType: "video/mp4",
  itemName: "Breaking Bad",
  posterUrl: "/api/artwork/art-1",
};

function makeTestStore() {
  return configureStore({
    reducer: { playback: playbackReducer, uiPrefs: uiPrefsReducer },
  });
}

function renderWithStore(store: ReturnType<typeof makeTestStore>) {
  return render(
    <Provider store={store}>
      <MiniPlayer />
    </Provider>
  );
}

describe("MiniPlayer", () => {
  it("renders nothing when no track is playing", () => {
    const store = makeTestStore();
    const { container } = renderWithStore(store);
    expect(container.querySelector("[data-testid='mini-player']")).toBeNull();
  });

  it("renders when a track is playing", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);
    expect(screen.getByTestId("mini-player")).toBeInTheDocument();
  });

  it("displays track name and item name", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);
    expect(screen.getByText("breaking-bad-s01e01.mkv")).toBeInTheDocument();
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
  });

  it("has play/pause button", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("toggles pause/resume on click", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);

    // Click Pause -> button should become Play
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();

    // Click Play -> button should become Pause
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("has close button that stops playback", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);

    await user.click(screen.getByRole("button", { name: /close/i }));
    // MiniPlayer should unmount when no track is loaded
    expect(screen.queryByTestId("mini-player")).not.toBeInTheDocument();
  });
});
