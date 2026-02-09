/**
 * Unit tests for VideoPlayer component.
 * Tests prop handling and callback behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock Vidstack components before imports
// Note: onClick/onDoubleClick are used to trigger callback simulations in tests:
// - click() triggers onTimeUpdate with currentTime: 100
// - dblclick() triggers onEnded
vi.mock("@vidstack/react", () => ({
  MediaPlayer: vi.fn(
    ({ children, className, title, onEnded, onTimeUpdate }) => (
      <div
        data-testid="media-player"
        className={className}
        data-title={title}
        onClick={() => onTimeUpdate?.({ currentTime: 100 })}
        onDoubleClick={() => onEnded?.()}
      >
        {children}
      </div>
    )
  ),
  MediaProvider: vi.fn(({ children }) => (
    <div data-testid="media-provider">{children}</div>
  )),
  Poster: vi.fn(({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img data-testid="poster" src={src} alt={alt} />
  )),
  Track: vi.fn(({ src, label, lang }) => (
    <track
      data-testid="subtitle-track"
      data-src={src}
      data-label={label}
      data-lang={lang}
    />
  )),
}));

vi.mock("@vidstack/react/player/layouts/default", () => ({
  DefaultVideoLayout: vi.fn(() => <div data-testid="video-layout" />),
  defaultLayoutIcons: {},
}));

vi.mock("@vidstack/react/player/styles/default/theme.css", () => ({}));
vi.mock("@vidstack/react/player/styles/default/layouts/video.css", () => ({}));

vi.mock("@/components/shader-background", () => ({
  Shader1: vi.fn(() => <div data-testid="shader-background" />),
}));

import { VideoPlayer } from "@/components/media/media-player";
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

describe("VideoPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with media player container", () => {
    render(<VideoPlayer file={createMockFile()} />);

    expect(screen.getByTestId("media-player")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<VideoPlayer file={createMockFile()} className="custom-class" />);

    const player = screen.getByTestId("media-player");
    expect(player.className).toContain("custom-class");
  });

  it("sets title from filename", () => {
    render(<VideoPlayer file={createMockFile({ filename: "My Movie.mp4" })} />);

    const player = screen.getByTestId("media-player");
    expect(player.dataset.title).toBe("My Movie.mp4");
  });

  it("renders video layout", () => {
    render(<VideoPlayer file={createMockFile()} />);

    expect(screen.getByTestId("video-layout")).toBeInTheDocument();
  });

  it("renders poster when posterUrl provided", () => {
    render(
      <VideoPlayer
        file={createMockFile({ mimeType: "audio/mpeg", filename: "song.mp3" })}
        posterUrl="/artwork.jpg"
      />
    );

    const poster = screen.getByTestId("poster");
    expect(poster).toHaveAttribute("src", "/artwork.jpg");
    expect(poster).toHaveAttribute("alt", "Album artwork");
  });

  it("renders subtitle tracks when provided", () => {
    const subtitles: SerializedItemFile[] = [
      createMockFile({
        id: "sub-1",
        filename: "movie.en.srt",
        fileType: "SUBTITLE",
      }),
      createMockFile({
        id: "sub-2",
        filename: "movie.es.srt",
        fileType: "SUBTITLE",
      }),
    ];

    render(<VideoPlayer file={createMockFile()} subtitles={subtitles} />);

    const tracks = screen.getAllByTestId("subtitle-track");
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toHaveAttribute("data-src", "/api/stream/sub-1");
    expect(tracks[0]).toHaveAttribute("data-lang", "en");
    expect(tracks[1]).toHaveAttribute("data-src", "/api/stream/sub-2");
    expect(tracks[1]).toHaveAttribute("data-lang", "es");
  });

  it("calls onEnded callback when video ends", () => {
    const onEnded = vi.fn();
    render(<VideoPlayer file={createMockFile()} onEnded={onEnded} />);

    // Double-click triggers our mocked onEnded
    const player = screen.getByTestId("media-player");
    player.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("shows shader background for audio without artwork", () => {
    render(
      <VideoPlayer
        file={createMockFile({ mimeType: "audio/mpeg", filename: "song.mp3" })}
      />
    );

    expect(screen.getByTestId("shader-background")).toBeInTheDocument();
  });

  it("does not show shader background for video files", () => {
    render(<VideoPlayer file={createMockFile({ mimeType: "video/mp4" })} />);

    expect(screen.queryByTestId("shader-background")).not.toBeInTheDocument();
  });

  it("infers MIME type from filename when not in database", () => {
    render(
      <VideoPlayer
        file={createMockFile({ mimeType: null, filename: "movie.webm" })}
      />
    );

    // Should render without error, using inferred type
    expect(screen.getByTestId("media-player")).toBeInTheDocument();
  });
});
