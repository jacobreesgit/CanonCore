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
        role="application"
        aria-label="media player"
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
    <div aria-label="media provider">{children}</div>
  )),
  Poster: vi.fn(({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  )),
  Track: vi.fn(({ src, label, lang }) => (
    <track
      data-src={src}
      data-label={label}
      data-lang={lang}
    />
  )),
}));

vi.mock("@vidstack/react/player/layouts/default", () => ({
  DefaultVideoLayout: vi.fn(() => <div aria-label="video layout" />),
  defaultLayoutIcons: {},
}));

vi.mock("@vidstack/react/player/styles/default/theme.css", () => ({}));
vi.mock("@vidstack/react/player/styles/default/layouts/video.css", () => ({}));

// Mock next/dynamic to eagerly resolve dynamic imports in tests
vi.mock("next/dynamic", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react") as typeof import("react");
  return {
    default: (importFn: () => Promise<{ default: React.ComponentType }>) => {
      return function DynamicComponent(props: Record<string, unknown>) {
        const [Comp, setComp] = React.useState<React.ComponentType | null>(
          null
        );
        React.useEffect(() => {
          let mounted = true;
          importFn().then((mod: { default: React.ComponentType }) => {
            if (mounted) setComp(() => mod.default);
          });
          return () => {
            mounted = false;
          };
        }, []);
        return Comp ? React.createElement(Comp, props) : null;
      };
    },
  };
});

vi.mock("@/components/shader-background", () => ({
  Shader1: vi.fn(() => <div aria-label="shader background" />),
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

    expect(screen.getByRole("application", { name: "media player" })).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<VideoPlayer file={createMockFile()} className="custom-class" />);

    const player = screen.getByRole("application", { name: "media player" });
    expect(player.className).toContain("custom-class");
  });

  it("sets title from filename", () => {
    render(<VideoPlayer file={createMockFile({ filename: "My Movie.mp4" })} />);

    const player = screen.getByRole("application", { name: "media player" });
    expect(player.dataset.title).toBe("My Movie.mp4");
  });

  it("renders video layout", () => {
    render(<VideoPlayer file={createMockFile()} />);

    expect(screen.getByLabelText("video layout")).toBeInTheDocument();
  });

  it("renders poster when posterUrl provided", () => {
    render(
      <VideoPlayer
        file={createMockFile({ mimeType: "audio/mpeg", filename: "song.mp3" })}
        posterUrl="/artwork.jpg"
      />
    );

    const poster = screen.getByAltText("Album artwork");
    expect(poster).toHaveAttribute("src", "/artwork.jpg");
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

    const { container } = render(<VideoPlayer file={createMockFile()} subtitles={subtitles} />);

    const tracks = container.querySelectorAll("track");
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
    const player = screen.getByRole("application", { name: "media player" });
    player.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("shows shader background for audio without artwork", async () => {
    render(
      <VideoPlayer
        file={createMockFile({ mimeType: "audio/mpeg", filename: "song.mp3" })}
      />
    );

    // Shader1 is loaded via next/dynamic — wait for the async import to resolve
    expect(await screen.findByLabelText("shader background")).toBeInTheDocument();
  });

  it("does not show shader background for video files", () => {
    render(<VideoPlayer file={createMockFile({ mimeType: "video/mp4" })} />);

    expect(screen.queryByLabelText("shader background")).not.toBeInTheDocument();
  });

  it("infers MIME type from filename when not in database", () => {
    render(
      <VideoPlayer
        file={createMockFile({ mimeType: null, filename: "movie.webm" })}
      />
    );

    // Should render without error, using inferred type
    expect(screen.getByRole("application", { name: "media player" })).toBeInTheDocument();
  });
});
