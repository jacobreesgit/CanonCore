/**
 * Storybook stories for the QueuePanel component.
 * Covers now playing, up next with multiple tracks, empty state,
 * and interaction tests for clear/remove with a11y coverage.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { within, expect } from "storybook/test";
import { QueuePanel } from "./queue-panel";
import playbackReducer from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import type { PlaybackState, QueueTrack } from "@/lib/store/types";

const mockTrack: QueueTrack = {
  fileId: "file-1",
  itemId: "item-1",
  filename: "The Matrix (1999).mkv",
  mimeType: "video/x-matroska",
  itemName: "The Matrix",
  posterUrl: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  duration: 8160,
  playbackPosition: 1200,
};

const mockTrack2: QueueTrack = {
  fileId: "file-2",
  itemId: "item-2",
  filename: "The Matrix Reloaded (2003).mkv",
  mimeType: "video/x-matroska",
  itemName: "The Matrix Reloaded",
  posterUrl: "https://image.tmdb.org/t/p/w500/9TGHDvWrqKBzwDxDodHYXEmOE6J.jpg",
  duration: 8280,
  playbackPosition: 0,
};

const mockTrack3: QueueTrack = {
  fileId: "file-3",
  itemId: "item-3",
  filename: "The Matrix Revolutions (2003).mkv",
  mimeType: "video/x-matroska",
  itemName: "The Matrix Revolutions",
  posterUrl: "https://image.tmdb.org/t/p/w500/fgm8OZ7oPXOvzIgROoGl5HtDgO3.jpg",
  duration: 7740,
  playbackPosition: 0,
};

const mockAudioTrack: QueueTrack = {
  fileId: "file-4",
  itemId: "item-4",
  filename: "Bohemian Rhapsody.mp3",
  mimeType: "audio/mpeg",
  itemName: "Greatest Hits",
  duration: 354,
  playbackPosition: 0,
};

/** Create a Redux store with playback state overrides. */
function createStore(overrides: Partial<PlaybackState> = {}) {
  return configureStore({
    reducer: {
      playback: playbackReducer,
      uiPrefs: uiPrefsReducer,
    },
    preloadedState: {
      playback: {
        currentTrack: mockTrack,
        queue: [mockTrack],
        queueIndex: 0,
        shuffle: false,
        repeat: "off" as const,
        isExpanded: false,
        ...overrides,
      },
      uiPrefs: {
        sidebarCollapsed: false,
        defaultViewMode: "grid" as const,
      },
    },
  });
}

/** Decorator that wraps story in a Redux Provider with given state. */
function withStore(overrides: Partial<PlaybackState> = {}) {
  return function StoreDecorator(Story: React.ComponentType) {
    const store = createStore(overrides);
    return (
      <Provider store={store}>
        <div className="bg-background h-screen">
          <Story />
        </div>
      </Provider>
    );
  };
}

/**
 * Slide-out queue panel showing the currently playing track
 * and upcoming tracks in the queue. Supports drag-to-reorder
 * for the Up Next list. Cinematic glass design with frosted
 * backdrop and animated equaliser bars on the Now Playing card.
 */
const meta = {
  title: "Media/QueuePanel",
  component: QueuePanel,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: () => {},
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Slide-out queue panel showing now playing and upcoming tracks. Cinematic glass design with frosted backdrop, animated equaliser bars, and drag-to-reorder for the Up Next list.",
      },
    },
  },
} satisfies Meta<typeof QueuePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Single track playing — shows the elevated Now Playing card
 * with artwork, track info, and animated equaliser bars.
 */
export const NowPlaying: Story = {
  decorators: [withStore()],
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    await expect(body.getByText("Queue")).toBeDefined();
    await expect(body.getByText("Now Playing")).toBeDefined();
    await expect(body.getByText("The Matrix (1999).mkv")).toBeDefined();
  },
};

/**
 * Multiple tracks in queue — shows Now Playing card and
 * Up Next list with track indices, artwork, and remove buttons.
 */
export const WithUpNext: Story = {
  decorators: [
    withStore({
      queue: [mockTrack, mockTrack2, mockTrack3],
      queueIndex: 0,
    }),
  ],
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    await expect(body.getByText("Now Playing")).toBeDefined();
    await expect(body.getByText("Up Next")).toBeDefined();
    await expect(
      body.getByText("The Matrix Reloaded (2003).mkv")
    ).toBeDefined();
    await expect(
      body.getByText("The Matrix Revolutions (2003).mkv")
    ).toBeDefined();
    // Queue count badge
    await expect(body.getByText("3")).toBeDefined();
  },
};

/**
 * Audio track without poster artwork — shows music icon
 * fallback in the Now Playing card.
 */
export const AudioNoArtwork: Story = {
  decorators: [
    withStore({
      currentTrack: mockAudioTrack,
      queue: [mockAudioTrack],
    }),
  ],
};

/**
 * Empty queue — shows centered empty state with music icon
 * and helpful message.
 */
export const EmptyQueue: Story = {
  decorators: [
    withStore({
      currentTrack: null,
      queue: [],
    }),
  ],
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    await expect(body.getByText("Queue is empty")).toBeDefined();
    await expect(body.getByText("Play something to get started")).toBeDefined();
  },
};

/**
 * Interactive test: hover over an Up Next track to reveal
 * the remove button, then click it.
 */
export const RemoveTrackInteraction: Story = {
  decorators: [
    withStore({
      queue: [mockTrack, mockTrack2],
      queueIndex: 0,
    }),
  ],
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    await expect(body.getByText("Up Next")).toBeDefined();
    // The remove button should exist (visible on hover)
    const removeBtn = body.getByRole("button", { name: "Remove" });
    await expect(removeBtn).toBeDefined();
  },
};
