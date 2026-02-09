/**
 * Unit tests for CinematicHero component.
 * Tests the unified hero with carousel, item detail, and profile modes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CinematicHero } from "@/components/hero";
import type { HeroSlide } from "@/components/hero";

// Mock IntersectionObserver for Embla
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
global.IntersectionObserver = mockIntersectionObserver;

// Mock ResizeObserver for Embla
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia for reduced motion detection
let mockPrefersReducedMotion = false;
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches:
      query === "(prefers-reduced-motion: reduce)"
        ? mockPrefersReducedMotion
        : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock embla-carousel-react
const mockScrollTo = vi.fn();
const mockScrollNext = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockEmblaApi = {
  on: mockOn,
  off: mockOff,
  selectedScrollSnap: vi.fn(() => 0),
  scrollTo: mockScrollTo,
  scrollNext: mockScrollNext,
};
vi.mock("embla-carousel-react", () => ({
  default: vi.fn(() => [vi.fn(), mockEmblaApi]),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    onLoad,
    onError,
    ...props
  }: {
    src: string;
    alt: string;
    onLoad?: () => void;
    onError?: () => void;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      data-testid="hero-carousel-artwork"
      onLoad={onLoad}
      onError={onError}
      {...props}
    />
  ),
}));

// Mock ShaderBackground
vi.mock("@/components/shader-background", () => ({
  Shader1: () => <div data-testid="shader1">Shader</div>,
}));

// Mock Skeleton
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

// Mock MetadataLine
vi.mock("@/components/items/metadata-line", () => ({
  MetadataLine: ({
    year,
    voteAverage,
    genres,
  }: {
    year?: string;
    voteAverage?: number;
    genres?: string[];
  }) => (
    <div data-testid="metadata-line">
      {year} {voteAverage}
      {genres && genres.length > 0 && (
        <span data-testid="metadata-genres">{genres.join(", ")}</span>
      )}
    </div>
  ),
}));

// Mock ProgressBar
vi.mock("@/components/ui/progress-bar", () => ({
  ProgressBar: ({ progress, label }: { progress: number; label?: string }) => (
    <div data-testid="progress-bar" data-progress={progress}>
      {label}
    </div>
  ),
}));

// Mock HeroAvatar
vi.mock("@/components/hero/hero-avatar", () => ({
  HeroAvatar: ({ username }: { username: string }) => (
    <div data-testid="hero-avatar">@{username}</div>
  ),
}));

describe("CinematicHero", () => {
  const mockSlides: HeroSlide[] = [
    {
      id: "1",
      name: "Breaking Bad",
      description: "A chemistry teacher turned meth cook",
      artworkId: "art-1",
      link: "/u/testuser/item-1",
      attribution: "Shared by @testuser",
    },
    {
      id: "2",
      name: "Better Call Saul",
      description: null,
      artworkId: "art-2",
      link: "/u/testuser/item-2",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrefersReducedMotion = false;
  });

  describe("multi-slide mode", () => {
    it("should render carousel with test id", () => {
      render(<CinematicHero slides={mockSlides} />);

      expect(screen.getByTestId("hero-carousel")).toBeInTheDocument();
    });

    it("should display active slide title", () => {
      render(<CinematicHero slides={mockSlides} />);

      expect(
        screen.getByRole("heading", { name: "Breaking Bad" })
      ).toBeInTheDocument();
    });

    it("should display active slide description", () => {
      render(<CinematicHero slides={mockSlides} />);

      expect(
        screen.getByText("A chemistry teacher turned meth cook")
      ).toBeInTheDocument();
    });

    it("should render navigation dots for multiple slides", () => {
      render(<CinematicHero slides={mockSlides} />);

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();

      const dots = screen.getAllByRole("tab");
      expect(dots).toHaveLength(2);
    });

    it("should use Next.js Image for artwork", () => {
      render(<CinematicHero slides={mockSlides} />);

      const images = screen.getAllByTestId("hero-carousel-artwork");
      expect(images.length).toBeGreaterThanOrEqual(1);
      expect(images[0]).toHaveAttribute("src", "/api/artwork/art-1");
    });

    it("should display attribution text", () => {
      render(<CinematicHero slides={mockSlides} />);

      expect(screen.getByText("Shared by @testuser")).toBeInTheDocument();
    });
  });

  describe("single-slide mode", () => {
    const singleSlide: HeroSlide[] = [mockSlides[0]];

    it("should not render navigation dots for single slide", () => {
      render(<CinematicHero slides={singleSlide} />);

      const tablist = screen.queryByRole("tablist");
      expect(tablist).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("should render nothing when no slides", () => {
      const { container } = render(<CinematicHero slides={[]} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("renderActions", () => {
    it("should render actions from renderActions callback", () => {
      render(
        <CinematicHero
          slides={mockSlides}
          renderActions={(slide) => (
            <button data-testid="custom-action">{slide.name} action</button>
          )}
        />
      );

      expect(screen.getByTestId("custom-action")).toBeInTheDocument();
      expect(screen.getByText("Breaking Bad action")).toBeInTheDocument();
    });
  });

  describe("static actions", () => {
    it("should render static actions prop for single slide", () => {
      render(
        <CinematicHero
          slides={[mockSlides[0]]}
          actions={<button data-testid="static-action">Play</button>}
        />
      );

      expect(screen.getByTestId("static-action")).toBeInTheDocument();
    });
  });

  describe("TMDB metadata", () => {
    it("should render tagline when provided", () => {
      const slides: HeroSlide[] = [
        { ...mockSlides[0], tagline: "Long live the fighters." },
      ];
      render(<CinematicHero slides={slides} />);

      expect(screen.getByText(/Long live the fighters/)).toBeInTheDocument();
    });

    it("should render MetadataLine when metadata provided", () => {
      const slides: HeroSlide[] = [
        {
          ...mockSlides[0],
          metadata: { year: "2024", voteAverage: 8.5 },
        },
      ];
      render(<CinematicHero slides={slides} />);

      expect(screen.getByTestId("metadata-line")).toBeInTheDocument();
    });

    it("should render genres inline in MetadataLine", () => {
      const slides: HeroSlide[] = [
        { ...mockSlides[0], genres: ["Drama", "Crime"] },
      ];
      render(<CinematicHero slides={slides} />);

      expect(screen.getByTestId("metadata-line")).toBeInTheDocument();
      expect(screen.getByTestId("metadata-genres")).toBeInTheDocument();
      expect(screen.getByText("Drama, Crime")).toBeInTheDocument();
    });
  });

  describe("progress bar", () => {
    it("should render ProgressBar when progress provided", () => {
      const slides: HeroSlide[] = [
        { ...mockSlides[0], progress: 50, progressLabel: "5/10 watched" },
      ];
      render(<CinematicHero slides={slides} />);

      const progressBar = screen.getByTestId("progress-bar");
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute("data-progress", "50");
    });
  });

  describe("profile avatar mode", () => {
    it("should render avatar when profile data provided", () => {
      const slides: HeroSlide[] = [
        {
          id: "profile-1",
          name: "Film Fan",
          profile: {
            id: "user-1",
            username: "filmfan",
            name: "Film Fan",
            hasImage: true,
          },
        },
      ];
      render(<CinematicHero slides={slides} />);

      expect(screen.getByTestId("hero-avatar")).toBeInTheDocument();
      // Username appears in both avatar mock and profile username paragraph
      expect(screen.getAllByText("@filmfan").length).toBeGreaterThanOrEqual(1);
    });

    it("should render inline progress in profile mode", () => {
      const slides: HeroSlide[] = [
        {
          id: "profile-1",
          name: "Film Fan",
          progress: 72,
          progressLabel: "72% watched",
          profile: {
            id: "user-1",
            username: "filmfan",
            name: "Film Fan",
            hasImage: false,
          },
        },
      ];
      render(<CinematicHero slides={slides} />);

      expect(screen.getByText("72% watched")).toBeInTheDocument();
    });
  });

  describe("heading level", () => {
    it("should default to h2", () => {
      render(<CinematicHero slides={[mockSlides[0]]} />);

      const heading = screen.getByRole("heading", { name: "Breaking Bad" });
      expect(heading.tagName).toBe("H2");
    });

    it("should use h1 when specified", () => {
      render(<CinematicHero slides={[mockSlides[0]]} headingLevel="h1" />);

      const heading = screen.getByRole("heading", { name: "Breaking Bad" });
      expect(heading.tagName).toBe("H1");
    });
  });

  describe("accessibility", () => {
    it("should have accessible navigation dots with aria-label", () => {
      render(<CinematicHero slides={mockSlides} />);

      const dots = screen.getAllByRole("tab");
      expect(dots[0]).toHaveAttribute(
        "aria-label",
        "Go to slide 1: Breaking Bad"
      );
      expect(dots[1]).toHaveAttribute(
        "aria-label",
        "Go to slide 2: Better Call Saul"
      );
    });

    it("should have aria-selected on active navigation dot", () => {
      render(<CinematicHero slides={mockSlides} />);

      const dots = screen.getAllByRole("tab");
      expect(dots[0]).toHaveAttribute("aria-selected", "true");
      expect(dots[1]).toHaveAttribute("aria-selected", "false");
    });

    it("should have accessible region label", () => {
      render(<CinematicHero slides={mockSlides} />);

      const region = screen.getByRole("region");
      expect(region).toHaveAttribute("aria-label", "Featured content carousel");
    });
  });

  describe("reduced motion support", () => {
    it("should render correctly when user prefers reduced motion", () => {
      mockPrefersReducedMotion = true;
      render(<CinematicHero slides={mockSlides} />);

      expect(screen.getByTestId("hero-carousel")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Breaking Bad" })
      ).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("should handle null description", () => {
      const slidesWithNull: HeroSlide[] = [
        { ...mockSlides[0], description: null },
      ];
      render(<CinematicHero slides={slidesWithNull} />);

      expect(
        screen.getByRole("heading", { name: "Breaking Bad" })
      ).toBeInTheDocument();
      expect(
        screen.queryByText("A chemistry teacher turned meth cook")
      ).not.toBeInTheDocument();
    });

    it("should handle very long titles", () => {
      const longTitle = "A".repeat(200);
      const slidesWithLongTitle: HeroSlide[] = [
        { ...mockSlides[0], name: longTitle },
      ];
      render(<CinematicHero slides={slidesWithLongTitle} />);

      expect(
        screen.getByRole("heading", { name: longTitle })
      ).toBeInTheDocument();
    });
  });

  describe("backgroundUrl support", () => {
    it("should use backgroundUrl when provided (priority over artworkId)", () => {
      const slidesWithUrl: HeroSlide[] = [
        {
          ...mockSlides[0],
          backgroundUrl: "/api/user/hero?userId=123",
          artworkId: "art-1",
        },
      ];
      render(<CinematicHero slides={slidesWithUrl} />);

      const images = screen.getAllByTestId("hero-carousel-artwork");
      expect(images[0]).toHaveAttribute("src", "/api/user/hero?userId=123");
    });

    it("should fall back to artworkId when backgroundUrl is null", () => {
      const slidesWithNull: HeroSlide[] = [
        { ...mockSlides[0], backgroundUrl: null, artworkId: "art-1" },
      ];
      render(<CinematicHero slides={slidesWithNull} />);

      const images = screen.getAllByTestId("hero-carousel-artwork");
      expect(images[0]).toHaveAttribute("src", "/api/artwork/art-1");
    });
  });

  describe("shader fallback", () => {
    it("should show Shader1 fallback when no background image", () => {
      const slidesWithoutArt: HeroSlide[] = [
        { ...mockSlides[0], artworkId: null, backgroundUrl: null },
      ];

      render(<CinematicHero slides={slidesWithoutArt} />);

      expect(screen.getByTestId("shader1")).toBeInTheDocument();
    });

    it("should show gradient fallback when disableShader is true", () => {
      const slidesWithoutArt: HeroSlide[] = [
        { ...mockSlides[0], artworkId: null, backgroundUrl: null },
      ];

      render(<CinematicHero slides={slidesWithoutArt} disableShader />);

      expect(screen.getByTestId("hero-fallback")).toBeInTheDocument();
      expect(screen.queryByTestId("shader1")).not.toBeInTheDocument();
    });
  });
});
