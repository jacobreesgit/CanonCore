import { describe, it, expect } from "vitest";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import playbackReducer, { playQueue } from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import { QueuePanel } from "@/components/media/queue-panel";
import type { QueueTrack } from "@/lib/store/types";

const tracks: QueueTrack[] = [
  {
    fileId: "f1",
    itemId: "i1",
    filename: "track1.mp4",
    mimeType: "video/mp4",
    itemName: "Item 1",
  },
  {
    fileId: "f2",
    itemId: "i2",
    filename: "track2.mp3",
    mimeType: "audio/mpeg",
    itemName: "Item 2",
  },
  {
    fileId: "f3",
    itemId: "i3",
    filename: "track3.mp4",
    mimeType: "video/mp4",
    itemName: "Item 3",
  },
];

function makeTestStore() {
  return configureStore({
    reducer: { playback: playbackReducer, uiPrefs: uiPrefsReducer },
  });
}

// Sheet portals to document.body, so we need to query within body
function queryBody() {
  return within(document.body);
}

describe("QueuePanel", () => {
  it("shows 'Up Next' heading", () => {
    const store = makeTestStore();
    store.dispatch(playQueue({ tracks, startIndex: 0 }));
    render(
      <Provider store={store}>
        <QueuePanel open onOpenChange={() => {}} />
      </Provider>
    );
    expect(queryBody().getByText("Up Next")).toBeInTheDocument();
  });

  it("displays upcoming tracks", () => {
    const store = makeTestStore();
    store.dispatch(playQueue({ tracks, startIndex: 0 }));
    render(
      <Provider store={store}>
        <QueuePanel open onOpenChange={() => {}} />
      </Provider>
    );
    // track1 is current, track2 and track3 are up next
    expect(queryBody().getByText("track2.mp3")).toBeInTheDocument();
    expect(queryBody().getByText("track3.mp4")).toBeInTheDocument();
  });

  it("shows now playing track", () => {
    const store = makeTestStore();
    store.dispatch(playQueue({ tracks, startIndex: 0 }));
    render(
      <Provider store={store}>
        <QueuePanel open onOpenChange={() => {}} />
      </Provider>
    );
    expect(queryBody().getByText("Now Playing")).toBeInTheDocument();
    expect(queryBody().getByText("track1.mp4")).toBeInTheDocument();
  });

  it("clears queue and removes tracks from DOM", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch(playQueue({ tracks, startIndex: 0 }));
    render(
      <Provider store={store}>
        <QueuePanel open onOpenChange={() => {}} />
      </Provider>
    );
    await user.click(queryBody().getByRole("button", { name: /clear/i }));
    // Up Next tracks should disappear
    expect(queryBody().queryByText("track2.mp3")).not.toBeInTheDocument();
    expect(queryBody().queryByText("track3.mp4")).not.toBeInTheDocument();
  });
});
