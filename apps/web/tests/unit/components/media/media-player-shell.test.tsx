import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import playbackReducer, { playTrack } from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import type { QueueTrack } from "@/lib/store/types";

// Mock Vidstack
const mockRemote = {
  play: vi.fn(),
  pause: vi.fn(),
  seek: vi.fn(),
  changeVolume: vi.fn(),
  toggleMuted: vi.fn(),
};

vi.mock("@vidstack/react", () => ({
  MediaPlayer: ({
    children,
    src,
    viewType,
    ...props
  }: Record<string, unknown>) => (
    <div
      data-testid="media-player"
      data-src={JSON.stringify(src)}
      data-view-type={viewType}
      {...props}
    >
      {children as React.ReactNode}
    </div>
  ),
  MediaProvider: () => <div data-testid="media-provider" />,
  useMediaRemote: () => mockRemote,
  useMediaState: (key: string) => {
    const defaults: Record<string, unknown> = {
      paused: true,
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false,
      fullscreen: false,
    };
    return defaults[key] ?? false;
  },
}));

vi.mock("@/lib/item-file-actions", () => ({
  updatePlaybackPosition: vi.fn(),
}));

// Stub child components that MediaPlayerShell imports directly
vi.mock("@/components/media/playback-keyboard-handler", () => ({
  PlaybackKeyboardHandler: () => null,
}));

vi.mock("@/components/media/mini-player", () => ({
  MiniPlayer: () => <div data-testid="mini-player" />,
}));

const mockTrack: QueueTrack = {
  fileId: "file-1",
  itemId: "item-1",
  filename: "test.mp4",
  mimeType: "video/mp4",
  itemName: "Test",
};

const mockAudioTrack: QueueTrack = {
  fileId: "file-2",
  itemId: "item-2",
  filename: "song.mp3",
  mimeType: "audio/mpeg",
  itemName: "Album",
};

function makeStore() {
  return configureStore({
    reducer: { playback: playbackReducer, uiPrefs: uiPrefsReducer },
  });
}

// vi.mock() is hoisted before imports, so regular import uses mocked version
import { MediaPlayerShell } from "@/components/media/media-player-shell";

describe("MediaPlayerShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when no track is loaded", () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <MediaPlayerShell>
          <div data-testid="child">Hello</div>
        </MediaPlayerShell>
      </Provider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("media-player")).not.toBeInTheDocument();
  });

  it("renders MediaPlayer when a track is loaded", () => {
    const store = makeStore();
    store.dispatch(playTrack(mockTrack));
    render(
      <Provider store={store}>
        <MediaPlayerShell>
          <div data-testid="child">Hello</div>
        </MediaPlayerShell>
      </Provider>
    );
    expect(screen.getByTestId("media-player")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("constructs src from currentTrack fileId and mimeType", () => {
    const store = makeStore();
    store.dispatch(playTrack(mockTrack));
    render(
      <Provider store={store}>
        <MediaPlayerShell>
          <div />
        </MediaPlayerShell>
      </Provider>
    );
    const player = screen.getByTestId("media-player");
    const src = JSON.parse(player.getAttribute("data-src") ?? "{}");
    expect(src.src).toBe("/api/stream/file-1");
    expect(src.type).toBe("video/mp4");
  });

  it("sets viewType to audio for audio mimeType", () => {
    const store = makeStore();
    store.dispatch(playTrack(mockAudioTrack));
    render(
      <Provider store={store}>
        <MediaPlayerShell>
          <div />
        </MediaPlayerShell>
      </Provider>
    );
    expect(
      screen.getByTestId("media-player").getAttribute("data-view-type")
    ).toBe("audio");
  });

  it("sets viewType to video for video mimeType", () => {
    const store = makeStore();
    store.dispatch(playTrack(mockTrack));
    render(
      <Provider store={store}>
        <MediaPlayerShell>
          <div />
        </MediaPlayerShell>
      </Provider>
    );
    expect(
      screen.getByTestId("media-player").getAttribute("data-view-type")
    ).toBe("video");
  });

  it("always renders exactly one MediaProvider", () => {
    const store = makeStore();
    store.dispatch(playTrack(mockTrack));
    render(
      <Provider store={store}>
        <MediaPlayerShell>
          <div />
        </MediaPlayerShell>
      </Provider>
    );
    const providers = screen.getAllByTestId("media-provider");
    expect(providers).toHaveLength(1);
  });
});
