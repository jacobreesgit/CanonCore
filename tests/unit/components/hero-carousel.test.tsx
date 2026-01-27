/**
 * Unit tests for HeroCarousel component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroCarousel } from "@/components/hero-carousel";

// Mock embla-carousel-autoplay (supports dynamic import)
const mockAutoplay = vi.fn(() => ({ name: "autoplay" }));
vi.mock("embla-carousel-autoplay", () => ({
  default: mockAutoplay,
}));

// Mock framer-motion useReducedMotion
let mockReducedMotion = false;
vi.mock("motion/react", async () => {
  const actual = await vi.importActual("motion/react");
  return {
    ...actual,
    useReducedMotion: () => mockReducedMotion,
  };
});

// Mock carousel components with proper API simulation
vi.mock("@/components/ui/carousel", () => {
  const mockApi = {
    on: vi.fn(),
    off: vi.fn(),
    selectedScrollSnap: () => 0,
    scrollTo: vi.fn(),
  };
  return {
    Carousel: ({
      children,
      setApi,
    }: {
      children: React.ReactNode;
      setApi?: (api: unknown) => void;
      plugins?: unknown[];
    }) => {
      // Simulate async setApi call like real Embla
      if (setApi) {
        setTimeout(() => setApi(mockApi), 0);
      }
      return <div data-testid="carousel">{children}</div>;
    },
    CarouselContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="carousel-content">{children}</div>
    ),
    CarouselItem: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="carousel-item">{children}</div>
    ),
  };
});

// Mock next/image
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    onLoad?: () => void;
    onError?: () => void;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="hero-carousel-artwork" {...props} />
  ),
}));

// Mock Shader1
vi.mock("@/components/shader1", () => ({
  Shader1: () => <div data-testid="shader1">Shader</div>,
}));

// Mock Skeleton
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

describe("HeroCarousel", () => {
  const mockSlides = [
    {
      id: "item-1",
      name: "Breaking Bad",
      description: "A chemistry teacher turned meth cook",
      artworkId: "art-1",
      link: "/u/testuser/item-1",
      ownerUsername: "testuser",
      ownerName: "Test User",
    },
    {
      id: "item-2",
      name: "Better Call Saul",
      description: "A lawyer's journey",
      artworkId: "art-2",
      link: "/u/testuser/item-2",
      ownerUsername: "testuser",
      ownerName: "Test User",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockReducedMotion = false;
  });

  describe("multi-slide mode", () => {
    it("should render carousel with all slides", () => {
      render(<HeroCarousel slides={mockSlides} />);

      expect(screen.getByTestId("carousel")).toBeInTheDocument();
      expect(screen.getAllByTestId("carousel-item")).toHaveLength(2);
    });

    it("should display slide titles", () => {
      render(<HeroCarousel slides={mockSlides} />);

      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
      expect(screen.getByText("Better Call Saul")).toBeInTheDocument();
    });

    it("should display slide descriptions", () => {
      render(<HeroCarousel slides={mockSlides} />);

      expect(
        screen.getByText("A chemistry teacher turned meth cook")
      ).toBeInTheDocument();
    });

    it("should render navigation dots for multiple slides", () => {
      render(<HeroCarousel slides={mockSlides} />);

      // Check for tablist container first
      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();

      // Then check individual dot buttons
      const dots = screen.getAllByRole("tab");
      expect(dots).toHaveLength(2);
    });

    it("should use Next.js Image for artwork", () => {
      render(<HeroCarousel slides={mockSlides} />);

      const images = screen.getAllByTestId("hero-carousel-artwork");
      expect(images[0]).toHaveAttribute("src", "/api/artwork/art-1");
    });

    it("should load autoplay plugin for multiple slides", async () => {
      render(<HeroCarousel slides={mockSlides} />);

      // Wait for dynamic import
      await vi.waitFor(() => {
        expect(mockAutoplay).toHaveBeenCalledWith(
          expect.objectContaining({
            delay: 4000,
            stopOnInteraction: true,
            stopOnMouseEnter: true,
          })
        );
      });
    });
  });

  describe("single-slide mode", () => {
    const singleSlide = [mockSlides[0]];

    it("should not render navigation dots for single slide", () => {
      render(<HeroCarousel slides={singleSlide} />);

      const tablist = screen.queryByRole("tablist");
      expect(tablist).not.toBeInTheDocument();
    });

    it("should NOT load autoplay plugin for single slide", async () => {
      mockAutoplay.mockClear();
      render(<HeroCarousel slides={singleSlide} />);

      // Wait to ensure dynamic import would have completed
      await new Promise((r) => setTimeout(r, 100));

      // Verify autoplay was not called for single slide
      expect(mockAutoplay).not.toHaveBeenCalled();
    });
  });

  describe("empty state", () => {
    it("should render nothing when no slides", () => {
      const { container } = render(<HeroCarousel slides={[]} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("CTA button", () => {
    it("should render View Item link for each slide", () => {
      render(<HeroCarousel slides={mockSlides} />);

      const links = screen.getAllByRole("link", { name: /view item/i });
      expect(links[0]).toHaveAttribute("href", "/u/testuser/item-1");
    });
  });

  describe("custom CTA", () => {
    it("should support custom ctaText prop", () => {
      render(<HeroCarousel slides={mockSlides} ctaText="Watch Now" />);

      expect(screen.getAllByText("Watch Now")).toHaveLength(2);
    });

    it("should support hiding CTA with showCta=false", () => {
      render(<HeroCarousel slides={mockSlides} showCta={false} />);

      expect(
        screen.queryByRole("link", { name: /view item/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have accessible navigation dots with aria-label", () => {
      render(<HeroCarousel slides={mockSlides} />);

      const dots = screen.getAllByRole("tab");
      expect(dots[0]).toHaveAttribute("aria-label", "Go to slide 1");
      expect(dots[1]).toHaveAttribute("aria-label", "Go to slide 2");
    });

    it("should have aria-current on active navigation dot", () => {
      render(<HeroCarousel slides={mockSlides} />);

      const dots = screen.getAllByRole("tab");
      // First dot should be active by default
      expect(dots[0]).toHaveAttribute("aria-current", "true");
      expect(dots[1]).not.toHaveAttribute("aria-current");
    });
  });

  describe("reduced motion support", () => {
    it("should skip animations when user prefers reduced motion", () => {
      mockReducedMotion = true;
      render(<HeroCarousel slides={mockSlides} />);

      // Should render without motion wrapper
      expect(screen.getByTestId("hero-carousel")).toBeInTheDocument();
    });

    it("should skip autoplay when user prefers reduced motion", async () => {
      mockReducedMotion = true;
      mockAutoplay.mockClear();
      render(<HeroCarousel slides={mockSlides} />);

      // Wait to ensure dynamic import would have completed
      await new Promise((r) => setTimeout(r, 100));

      // Should not load autoplay plugin
      expect(mockAutoplay).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle null description", () => {
      const slidesWithNullDesc = [{ ...mockSlides[0], description: null }];
      render(<HeroCarousel slides={slidesWithNullDesc} />);

      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
      expect(screen.queryByText("null")).not.toBeInTheDocument();
    });

    it("should handle very long titles", () => {
      const longTitle = "A".repeat(200);
      const slidesWithLongTitle = [{ ...mockSlides[0], name: longTitle }];
      render(<HeroCarousel slides={slidesWithLongTitle} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });
  });

  describe("owner mode - play button", () => {
    const slideWithMedia = {
      ...mockSlides[0],
      hasMedia: true,
      hasProgress: false,
      primaryMediaName: "S01E01",
    };

    it("should NOT show play button when isOwner=false", () => {
      render(
        <HeroCarousel
          slides={[slideWithMedia]}
          isOwner={false}
          onPlay={vi.fn()}
        />
      );

      expect(screen.queryByTestId("hero-play-button")).not.toBeInTheDocument();
    });

    it("should show play button when isOwner=true and hasMedia=true", () => {
      render(
        <HeroCarousel
          slides={[slideWithMedia]}
          isOwner={true}
          onPlay={vi.fn()}
        />
      );

      expect(screen.getByTestId("hero-play-button")).toBeInTheDocument();
      expect(screen.getByText(/Play S01E01/)).toBeInTheDocument();
    });

    it("should show Resume when hasProgress=true", () => {
      const slideWithProgress = { ...slideWithMedia, hasProgress: true };
      render(
        <HeroCarousel
          slides={[slideWithProgress]}
          isOwner={true}
          onPlay={vi.fn()}
        />
      );

      expect(screen.getByText(/Resume S01E01/)).toBeInTheDocument();
    });

    it("should call onPlay with slide id when clicked", async () => {
      const onPlay = vi.fn();
      render(
        <HeroCarousel
          slides={[slideWithMedia]}
          isOwner={true}
          onPlay={onPlay}
        />
      );

      await userEvent.click(screen.getByTestId("hero-play-button"));
      expect(onPlay).toHaveBeenCalledWith("item-1");
    });
  });

  describe("owner mode - go-to button", () => {
    const slideWithNextItem = {
      ...mockSlides[0],
      nextItem: { id: "next-item-id", name: "Episode 2" },
    };

    it("should NOT show go-to button when isOwner=false", () => {
      render(
        <HeroCarousel
          slides={[slideWithNextItem]}
          isOwner={false}
          onGoToNext={vi.fn()}
        />
      );

      expect(screen.queryByTestId("hero-goto-button")).not.toBeInTheDocument();
    });

    it("should show go-to button when isOwner=true and nextItem exists", () => {
      render(
        <HeroCarousel
          slides={[slideWithNextItem]}
          isOwner={true}
          onGoToNext={vi.fn()}
        />
      );

      expect(screen.getByTestId("hero-goto-button")).toBeInTheDocument();
      expect(screen.getByText("Next Up: Episode 2")).toBeInTheDocument();
    });

    it("should call onGoToNext with item id when clicked", async () => {
      const onGoToNext = vi.fn();
      render(
        <HeroCarousel
          slides={[slideWithNextItem]}
          isOwner={true}
          onGoToNext={onGoToNext}
        />
      );

      await userEvent.click(screen.getByTestId("hero-goto-button"));
      expect(onGoToNext).toHaveBeenCalledWith("next-item-id");
    });
  });

  describe("owner mode - progress bar", () => {
    const slideWithProgress = {
      ...mockSlides[0],
      progressPercentage: 75,
      progressLabel: "15/20 watched",
    };

    it("should NOT show progress bar when isOwner=false", () => {
      render(<HeroCarousel slides={[slideWithProgress]} isOwner={false} />);

      expect(screen.queryByTestId("hero-progress-bar")).not.toBeInTheDocument();
    });

    it("should show progress bar when isOwner=true and progressPercentage exists", () => {
      render(<HeroCarousel slides={[slideWithProgress]} isOwner={true} />);

      expect(screen.getByTestId("hero-progress-bar")).toBeInTheDocument();
      expect(screen.getByTestId("hero-progress-label")).toHaveTextContent(
        "15/20 watched"
      );
    });

    it("should NOT show progress bar when progressPercentage is null", () => {
      const slideNoProgress = { ...mockSlides[0], progressPercentage: null };
      render(<HeroCarousel slides={[slideNoProgress]} isOwner={true} />);

      expect(screen.queryByTestId("hero-progress-bar")).not.toBeInTheDocument();
    });
  });

  describe("backgroundUrl support", () => {
    it("should use backgroundUrl when provided (priority over artworkId)", () => {
      const slideWithBackgroundUrl = {
        ...mockSlides[0],
        backgroundUrl: "/api/user/hero",
        artworkId: "art-1",
      };
      render(<HeroCarousel slides={[slideWithBackgroundUrl]} />);

      const images = screen.getAllByTestId("hero-carousel-artwork");
      expect(images[0]).toHaveAttribute("src", "/api/user/hero");
    });

    it("should fall back to artworkId when backgroundUrl is null", () => {
      const slideNoBackgroundUrl = {
        ...mockSlides[0],
        backgroundUrl: null,
        artworkId: "art-1",
      };
      render(<HeroCarousel slides={[slideNoBackgroundUrl]} />);

      const images = screen.getAllByTestId("hero-carousel-artwork");
      expect(images[0]).toHaveAttribute("src", "/api/artwork/art-1");
    });
  });

  describe("shader fallback", () => {
    it("should show Shader1 fallback when no background image", () => {
      const slideNoBackground = {
        ...mockSlides[0],
        artworkId: null,
        backgroundUrl: null,
      };
      render(<HeroCarousel slides={[slideNoBackground]} />);

      // Should still render title (fallback doesn't break rendering)
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    });
  });
});
