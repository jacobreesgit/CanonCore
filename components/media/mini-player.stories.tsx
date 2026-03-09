/**
 * Storybook stories for the MiniPlayer component.
 * Covers collapsed/expanded states, audio/video tracks, shuffle/repeat,
 * and expand/collapse interaction tests with a11y coverage.
 *
 * MiniPlayer uses Vidstack headless hooks (useMediaState, useMediaRemote,
 * useMediaPlayer), so all stories wrap in a <MediaPlayer> context.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { userEvent, within, expect } from "storybook/test";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import { MiniPlayer } from "./mini-player";
import playbackReducer from "@/lib/store/playback-slice";
import uiPrefsReducer from "@/lib/store/ui-prefs-slice";
import type { PlaybackState } from "@/lib/store/types";

const mockTrack = {
  fileId: "file-1",
  itemId: "item-1",
  filename: "The Matrix (1999).mkv",
  mimeType: "video/x-matroska",
  itemName: "The Matrix",
  posterUrl: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  duration: 8160,
  playbackPosition: 1200,
};

const mockAudioTrack = {
  ...mockTrack,
  fileId: "file-2",
  filename: "Bohemian Rhapsody.mp3",
  mimeType: "audio/mpeg",
  itemName: "Greatest Hits",
  duration: 354,
  playbackPosition: 0,
};

const mockAudioTrackNoArt = {
  ...mockAudioTrack,
  posterUrl: undefined,
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

/**
 * Decorator that wraps story in Redux Provider + Vidstack MediaPlayer.
 * MediaPlayer is required because MiniPlayer uses useMediaState/useMediaRemote hooks.
 */
function withStore(overrides: Partial<PlaybackState> = {}) {
  return function StoreDecorator(Story: React.ComponentType) {
    const store = createStore(overrides);
    return (
      <Provider store={store}>
        <MediaPlayer
          src=""
          viewType="audio"
          className="contents"
          keyShortcuts={{ toggleFullscreen: null }}
        >
          <MediaProvider className="hidden" />
          <div className="bg-background h-screen">
            <Story />
          </div>
        </MediaPlayer>
      </Provider>
    );
  };
}

/**
 * Unified media player bar fixed to the bottom of the viewport.
 * Collapses into a compact bar with track info, controls, and queue.
 * Expands into a full viewport showing video (Vidstack), artwork,
 * or a MeshGradient for audio.
 */
const meta = {
  title: "Media/MiniPlayer",
  component: MiniPlayer,
  tags: ["autodocs"],
  args: {
    controlsIdle: false,
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Unified media player bar fixed to the bottom of the viewport. Collapses into a compact bar with track info, controls, and queue. Expands into a full viewport showing video (Vidstack), artwork, or a MeshGradient for audio.",
      },
    },
  },
} satisfies Meta<typeof MiniPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default collapsed state showing track info, playback controls,
 * volume, and queue/expand/close buttons.
 */
export const Collapsed: Story = {
  decorators: [withStore()],
  parameters: {
    docs: {
      description: {
        story:
          "Default collapsed state showing track info, playback controls, volume, and queue/expand/close buttons.",
      },
    },
  },
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    await expect(body.getByLabelText("Play")).toBeDefined();
    await expect(body.getByLabelText("Close player")).toBeDefined();
  },
};

/**
 * Expanded state with Vidstack video player in the viewport.
 * Mini bar stays at the bottom with identical controls.
 */
export const ExpandedVideo: Story = {
  decorators: [withStore({ currentTrack: mockTrack, isExpanded: true })],
  parameters: {
    docs: {
      description: {
        story:
          "Expanded state with Vidstack video player in the viewport. Mini bar stays at the bottom with identical controls.",
      },
    },
  },
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    const viewport = await body.findByTestId("expanded-viewport");
    await expect(viewport).toHaveAttribute("role", "dialog");
    await expect(viewport).toHaveAttribute("aria-modal", "true");
    await expect(body.getByLabelText("Collapse player")).toBeDefined();
  },
};

/**
 * Expanded state for audio files with artwork.
 * Shows poster image scaled up with a blurred backdrop.
 */
export const ExpandedAudioWithArtwork: Story = {
  decorators: [withStore({ currentTrack: mockAudioTrack, isExpanded: true })],
  parameters: {
    docs: {
      description: {
        story:
          "Expanded state for audio files with artwork. Shows poster image scaled up with a blurred backdrop.",
      },
    },
  },
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    const viewport = await body.findByTestId("expanded-viewport");
    const img = viewport.querySelector("img:not([aria-hidden])");
    await expect(img).toBeTruthy();
  },
};

/**
 * Expanded state for audio files without artwork.
 * Shows animated MeshGradient shader background.
 */
export const ExpandedAudioNoArtwork: Story = {
  decorators: [
    withStore({ currentTrack: mockAudioTrackNoArt, isExpanded: true }),
  ],
  parameters: {
    docs: {
      description: {
        story:
          "Expanded state for audio files without artwork. Shows animated MeshGradient shader background.",
      },
    },
  },
};

/**
 * Collapsed state with shuffle enabled and repeat-one active.
 */
export const ShuffleAndRepeat: Story = {
  decorators: [withStore({ shuffle: true, repeat: "one" })],
  parameters: {
    docs: {
      description: {
        story: "Collapsed state with shuffle enabled and repeat-one active.",
      },
    },
  },
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);
    await expect(body.getByLabelText("Shuffle")).toBeDefined();
    await expect(body.getByLabelText("Repeat one")).toBeDefined();
  },
};

/**
 * Interactive test: click expand, verify viewport appears with a11y
 * attributes, then click collapse.
 */
export const ExpandCollapseInteraction: Story = {
  decorators: [withStore()],
  parameters: {
    docs: {
      description: {
        story:
          "Interactive test: click expand, verify viewport appears with a11y attributes, then click collapse.",
      },
    },
  },
  play: async ({ canvasElement: _canvasElement }) => {
    const body = within(document.body);

    // The chevron-up button labelled "Expand player"
    const expandBtns = body.getAllByLabelText("Expand player");
    // Use the last one (the chevron button, not the track info area)
    const expandBtn = expandBtns[expandBtns.length - 1];
    await userEvent.click(expandBtn);

    const viewport = await body.findByTestId("expanded-viewport");
    await expect(viewport).toHaveAttribute("role", "dialog");
    await expect(viewport).toHaveAttribute("aria-modal", "true");

    const collapseBtn = body.getByLabelText("Collapse player");
    await userEvent.click(collapseBtn);
  },
};
