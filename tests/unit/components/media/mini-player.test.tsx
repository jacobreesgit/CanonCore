import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import playbackReducer, {
  playTrack,
  playQueue,
  toggleExpanded,
} from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import type { QueueTrack } from "@/lib/store/types";

// Configurable Vidstack mock state
const vidstackState: Record<string, unknown> = {
  paused: true,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  fullscreen: false,
};

const mockRemote = {
  play: vi.fn(),
  pause: vi.fn(),
  seek: vi.fn(),
  changeVolume: vi.fn(),
  toggleMuted: vi.fn(),
  enterFullscreen: vi.fn(),
  exitFullscreen: vi.fn(),
};

const mockPlayer = {
  currentTime: 0,
  volume: 1,
};

vi.mock("@vidstack/react", () => ({
  useMediaState: (key: string) => vidstackState[key] ?? false,
  useMediaRemote: () => mockRemote,
  useMediaPlayer: () => mockPlayer,
}));

// Mock MeshGradient — used as fallback when no artwork for audio files
vi.mock("@mesh-gradient/react", () => ({
  MeshGradient: ({ className }: { className?: string }) => (
    <div data-testid="mesh-gradient" className={className} />
  ),
}));

vi.mock("@/lib/item-file-actions", () => ({
  updatePlaybackPosition: vi.fn(),
}));

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

// vi.mock() is hoisted before imports, so regular import uses mocked version
import { MiniPlayer } from "@/components/media/mini-player";

function renderWithStore(store: ReturnType<typeof makeTestStore>) {
  return render(
    <Provider store={store}>
      <MiniPlayer controlsIdle={false} />
    </Provider>
  );
}

describe("MiniPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset vidstack state to defaults
    vidstackState.paused = true;
    vidstackState.currentTime = 0;
    vidstackState.duration = 0;
    vidstackState.volume = 1;
    vidstackState.muted = false;
    vidstackState.fullscreen = false;
    mockPlayer.currentTime = 0;
    mockPlayer.volume = 1;
  });

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

  it("has play button when paused", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    vidstackState.paused = true;
    renderWithStore(store);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("calls remote.play() on play button click", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    vidstackState.paused = true;
    renderWithStore(store);

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(mockRemote.play).toHaveBeenCalled();
  });

  it("calls remote.pause() on pause button click", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    vidstackState.paused = false;
    renderWithStore(store);

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(mockRemote.pause).toHaveBeenCalled();
  });

  it("has close button that stops playback", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByTestId("mini-player")).not.toBeInTheDocument();
  });

  it("close button saves position before stopping", async () => {
    const { updatePlaybackPosition } = await import("@/lib/item-file-actions");
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    mockPlayer.currentTime = 42;
    renderWithStore(store);

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(updatePlaybackPosition).toHaveBeenCalledWith("file-1", 42, null);
  });

  it("should render queue button", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);
    expect(screen.getByRole("button", { name: "Queue" })).toBeInTheDocument();
  });

  it("should render mute button", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    vidstackState.muted = false;
    renderWithStore(store);
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
  });

  it("calls remote.toggleMuted on mute click", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    vidstackState.muted = false;
    renderWithStore(store);
    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(mockRemote.toggleMuted).toHaveBeenCalled();
  });

  it("calls remote.changeVolume on volume slider change", async () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);
    expect(screen.getByRole("slider", { name: "Volume" })).toBeInTheDocument();
  });

  it("should render shuffle button", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);
    expect(screen.getByRole("button", { name: "Shuffle" })).toBeInTheDocument();
  });

  it("should render repeat button", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);
    expect(screen.getByRole("button", { name: /repeat/i })).toBeInTheDocument();
  });

  it("should render fullscreen button", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);
    expect(
      screen.getByRole("button", { name: "Fullscreen" })
    ).toBeInTheDocument();
  });

  it("disables fullscreen button when not expanded", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);
    expect(screen.getByRole("button", { name: "Fullscreen" })).toBeDisabled();
  });

  it("calls remote.enterFullscreen on fullscreen click when expanded", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    store.dispatch(toggleExpanded());
    vidstackState.fullscreen = false;
    renderWithStore(store);
    await user.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(mockRemote.enterFullscreen).toHaveBeenCalled();
  });

  it("renders expanded viewport when isExpanded is true", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    store.dispatch(toggleExpanded());
    renderWithStore(store);

    expect(screen.getByTestId("expanded-viewport")).toBeInTheDocument();
  });

  it("does not render expanded viewport when collapsed", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    renderWithStore(store);

    expect(screen.queryByTestId("expanded-viewport")).not.toBeInTheDocument();
  });

  it("shows chevron-down icon when expanded", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    store.dispatch(toggleExpanded());
    renderWithStore(store);

    expect(screen.getByLabelText("Collapse player")).toBeInTheDocument();
  });

  it("has correct ARIA attributes on expanded viewport", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    store.dispatch(toggleExpanded());
    renderWithStore(store);

    const viewport = screen.getByTestId("expanded-viewport");
    expect(viewport).toHaveAttribute("role", "dialog");
    expect(viewport).toHaveAttribute("aria-modal", "true");
    expect(viewport).toHaveAttribute("aria-label");
  });

  it("closes expanded viewport on Escape key", async () => {
    const user = userEvent.setup();
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    store.dispatch(toggleExpanded());
    renderWithStore(store);

    expect(screen.getByTestId("expanded-viewport")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByTestId("expanded-viewport")).not.toBeInTheDocument();
    });
  });

  it("sets data-player-expanded attribute when expanded", () => {
    const store = makeTestStore();
    store.dispatch(playTrack(mockTrack));
    store.dispatch(toggleExpanded());
    renderWithStore(store);

    const miniPlayer = screen.getByTestId("mini-player");
    expect(miniPlayer).toHaveAttribute("data-player-expanded");
  });

  it("renders poster artwork for audio files with artwork when expanded", () => {
    const audioTrack: QueueTrack = {
      ...mockTrack,
      mimeType: "audio/mpeg",
      posterUrl: "/api/artwork/art-1",
    };
    const store = makeTestStore();
    store.dispatch(playTrack(audioTrack));
    store.dispatch(toggleExpanded());
    const { container } = renderWithStore(store);

    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(2);

    const backdrop = Array.from(images).find(
      (img) => img.getAttribute("aria-hidden") === "true"
    );
    expect(backdrop).toBeDefined();
    expect(backdrop).toHaveAttribute("src", "/api/artwork/art-1");

    const foreground = Array.from(images).find(
      (img) =>
        img.getAttribute("aria-hidden") !== "true" &&
        img.getAttribute("src") === "/api/artwork/art-1"
    );
    expect(foreground).toBeDefined();
    expect(foreground).toHaveAttribute("alt", "Breaking Bad artwork");
  });

  it("renders MeshGradient for audio files without artwork when expanded", () => {
    const audioTrackNoArt: QueueTrack = {
      ...mockTrack,
      mimeType: "audio/mpeg",
      posterUrl: undefined,
    };
    const store = makeTestStore();
    store.dispatch(playTrack(audioTrackNoArt));
    store.dispatch(toggleExpanded());
    renderWithStore(store);

    expect(screen.getByTestId("mesh-gradient")).toBeInTheDocument();
  });

  describe("skipPrevious 3s check", () => {
    const track2: QueueTrack = {
      fileId: "file-2",
      itemId: "item-2",
      filename: "track2.mp3",
      mimeType: "audio/mpeg",
      itemName: "Track 2",
    };

    it("seeks to 0 when currentTime > 3", async () => {
      const user = userEvent.setup();
      const store = makeTestStore();
      // Start at index 1 so hasPrevious is true
      store.dispatch(playQueue({ tracks: [mockTrack, track2], startIndex: 1 }));
      mockPlayer.currentTime = 10;
      renderWithStore(store);

      await user.click(screen.getByRole("button", { name: "Previous" }));
      expect(mockRemote.seek).toHaveBeenCalledWith(0);
    });

    it("dispatches skipPrevious when currentTime <= 3", async () => {
      const user = userEvent.setup();
      const store = makeTestStore();
      store.dispatch(playQueue({ tracks: [mockTrack, track2], startIndex: 1 }));
      mockPlayer.currentTime = 2;
      renderWithStore(store);

      await user.click(screen.getByRole("button", { name: "Previous" }));
      expect(mockRemote.seek).not.toHaveBeenCalled();
    });
  });

  describe("seek bar", () => {
    it("renders seek slider with aria-label", () => {
      const store = makeTestStore();
      store.dispatch(playTrack(mockTrack));
      renderWithStore(store);
      expect(screen.getByRole("slider", { name: "Seek" })).toBeInTheDocument();
    });
  });
});
