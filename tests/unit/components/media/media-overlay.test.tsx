/**
 * Unit tests for MediaOverlay component.
 * Tests overlay behavior, keyboard shortcuts, and callbacks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

// Mock Vidstack and VideoPlayer before imports
vi.mock("@vidstack/react", () => ({
  MediaPlayer: vi.fn(({ children }) => <div>{children}</div>),
  MediaProvider: vi.fn(({ children }) => <div>{children}</div>),
  Poster: vi.fn(() => null),
  Track: vi.fn(() => null),
}));

vi.mock("@vidstack/react/player/layouts/default", () => ({
  DefaultVideoLayout: vi.fn(() => null),
  defaultLayoutIcons: {},
}));

vi.mock("@vidstack/react/player/styles/default/theme.css", () => ({}));
vi.mock("@vidstack/react/player/styles/default/layouts/video.css", () => ({}));

vi.mock("@/components/shader1", () => ({
  Shader1: vi.fn(() => null),
}));

// Mock VideoPlayer to avoid nested complexity
// Note: onClick/onDoubleClick are used to trigger callback simulations in tests:
// - click() triggers onTimeUpdate(position: 100, duration: 300)
// - dblclick() triggers onEnded
vi.mock("@/components/media/media-player", () => ({
  VideoPlayer: vi.fn(({ onTimeUpdate, onEnded }) => (
    <div
      role="application"
      aria-label="Video player"
      onClick={() => onTimeUpdate?.(100, 300)}
      onDoubleClick={() => onEnded?.()}
    />
  )),
}));

import { MediaOverlay } from "@/components/media/media-overlay";
import type { SerializedItemFile } from "@/lib/types";

const createMockFile = (
  overrides: Partial<SerializedItemFile> = {}
): SerializedItemFile => ({
  id: "file-123",
  filename: "test-video.mp4",
  mimeType: "video/mp4",
  fileType: "MEDIA",
  playbackPosition: 0,
  playbackDuration: null,
  size: 1000000,
  isPrimary: false,
  isHero: false,
  driveFileId: "drive-123",
  itemId: "item-123",
  syncStatus: "SYNCED",
  syncError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("MediaOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders dialog with correct aria attributes", async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(<MediaOverlay file={createMockFile()} onClose={onClose} />);
    });

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-label", "Playing test-video.mp4");
    });
  });

  it("renders close button", async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(<MediaOverlay file={createMockFile()} onClose={onClose} />);
    });

    await waitFor(() => {
      const closeButton = screen.getByRole("button", { name: "Close player" });
      expect(closeButton).toBeInTheDocument();
    });
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(<MediaOverlay file={createMockFile()} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Close player" })
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close player" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape key press", async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(<MediaOverlay file={createMockFile()} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks body scroll when mounted", async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(<MediaOverlay file={createMockFile()} onClose={onClose} />);
    });

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll on unmount", async () => {
    const onClose = vi.fn();

    const { unmount } = render(
      <MediaOverlay file={createMockFile()} onClose={onClose} />
    );

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    unmount();

    expect(document.body.style.overflow).toBe("");
  });

  it("calls onPositionUpdate with position when closing after playback", async () => {
    const onClose = vi.fn();
    const onPositionUpdate = vi.fn();

    await act(async () => {
      render(
        <MediaOverlay
          file={createMockFile({ playbackPosition: 50 })}
          onClose={onClose}
          onPositionUpdate={onPositionUpdate}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Simulate time update by clicking the player mock
    await act(async () => {
      fireEvent.click(
        screen.getByRole("application", { name: "Video player" })
      );
    });

    // Close the overlay
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close player" }));
    });

    expect(onPositionUpdate).toHaveBeenCalledWith("file-123", 100, 300);
  });

  it("resets position to 0 when video ends", async () => {
    const onClose = vi.fn();
    const onPositionUpdate = vi.fn();

    await act(async () => {
      render(
        <MediaOverlay
          file={createMockFile()}
          onClose={onClose}
          onPositionUpdate={onPositionUpdate}
        />
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole("application", { name: "Video player" })
      ).toBeInTheDocument();
    });

    // Simulate ended event by double-clicking the player mock
    await act(async () => {
      fireEvent.doubleClick(
        screen.getByRole("application", { name: "Video player" })
      );
    });

    expect(onPositionUpdate).toHaveBeenCalledWith("file-123", 0, null);
  });

  it("renders VideoPlayer with correct props", async () => {
    const onClose = vi.fn();
    const mockFile = createMockFile();
    const subtitles: SerializedItemFile[] = [];

    await act(async () => {
      render(
        <MediaOverlay
          file={mockFile}
          subtitles={subtitles}
          posterUrl="/poster.jpg"
          onClose={onClose}
        />
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole("application", { name: "Video player" })
      ).toBeInTheDocument();
    });
  });
});
