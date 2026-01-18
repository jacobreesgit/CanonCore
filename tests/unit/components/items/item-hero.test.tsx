/**
 * Unit tests for ItemHero component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemHero } from "@/components/items/item-hero";

// Mock Shader1 component
vi.mock("@/components/shader1", () => ({
  Shader1: ({ className }: { className?: string }) => (
    <div data-testid="shader1-fallback" className={className}>
      Shader Fallback
    </div>
  ),
}));

// Mock scrollHeight for overflow detection (jsdom doesn't support real layout)
// COLLAPSED_HEIGHT_PX in item-hero.tsx is 56, so we return > 56 for long text
const originalScrollHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollHeight"
);

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      // Simulate overflow for long text (> 100 chars triggers overflow)
      const textLength = this.textContent?.length ?? 0;
      return textLength > 100 ? 200 : 30;
    },
  });
});

afterEach(() => {
  // Restore original descriptor
  if (originalScrollHeightDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollHeight",
      originalScrollHeightDescriptor
    );
  }
});

describe("ItemHero", () => {
  const defaultProps = {
    name: "Breaking Bad",
    description: "A high school chemistry teacher turned meth manufacturer.",
  };

  describe("rendering", () => {
    it("should render item name as heading", () => {
      render(<ItemHero {...defaultProps} />);
      expect(
        screen.getByRole("heading", { name: "Breaking Bad" })
      ).toBeInTheDocument();
    });

    it("should render description when provided", () => {
      render(<ItemHero {...defaultProps} />);
      expect(screen.getByText(/chemistry teacher/)).toBeInTheDocument();
    });

    it("should not render description when null", () => {
      render(<ItemHero name="Test" description={null} />);
      expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
    });
  });

  describe("artwork background", () => {
    it("should show artwork background when artworkId provided", () => {
      render(<ItemHero {...defaultProps} artworkId="art-123" />);
      const hero = screen.getByTestId("item-hero");
      expect(hero).toHaveStyle({
        backgroundImage: "url(/api/artwork/art-123)",
      });
    });

    it("should show fallback when no artworkId", () => {
      render(<ItemHero {...defaultProps} />);
      const fallback = screen.getByTestId("hero-fallback");
      expect(fallback).toBeInTheDocument();
    });
  });

  describe("backgroundUrl prop", () => {
    it("should display backgroundUrl as background", () => {
      render(<ItemHero {...defaultProps} backgroundUrl="/api/user/hero" />);
      const hero = screen.getByTestId("item-hero");
      expect(hero).toHaveStyle({
        backgroundImage: "url(/api/user/hero)",
      });
    });

    it("should take precedence over artworkId", () => {
      render(
        <ItemHero
          {...defaultProps}
          backgroundUrl="/api/user/hero"
          artworkId="art-123"
        />
      );
      const hero = screen.getByTestId("item-hero");
      // backgroundUrl should be used, not artworkId
      expect(hero).toHaveStyle({
        backgroundImage: "url(/api/user/hero)",
      });
    });

    it("should fall back to artworkId when backgroundUrl is null", () => {
      render(
        <ItemHero {...defaultProps} backgroundUrl={null} artworkId="art-456" />
      );
      const hero = screen.getByTestId("item-hero");
      expect(hero).toHaveStyle({
        backgroundImage: "url(/api/artwork/art-456)",
      });
    });
  });

  describe("Shader1 fallback", () => {
    it("should render Shader1 when no background provided", () => {
      render(<ItemHero {...defaultProps} />);
      expect(screen.getByTestId("shader1-fallback")).toBeInTheDocument();
    });

    it("should render Shader1 when both backgroundUrl and artworkId are null", () => {
      render(
        <ItemHero {...defaultProps} backgroundUrl={null} artworkId={null} />
      );
      expect(screen.getByTestId("shader1-fallback")).toBeInTheDocument();
    });

    it("should not render Shader1 when backgroundUrl is provided", () => {
      render(<ItemHero {...defaultProps} backgroundUrl="/api/user/hero" />);
      expect(screen.queryByTestId("shader1-fallback")).not.toBeInTheDocument();
    });

    it("should not render Shader1 when artworkId is provided", () => {
      render(<ItemHero {...defaultProps} artworkId="art-123" />);
      expect(screen.queryByTestId("shader1-fallback")).not.toBeInTheDocument();
    });

    it("should render Shader1 on image load error", () => {
      render(<ItemHero {...defaultProps} backgroundUrl="/api/user/hero" />);

      // Initially no shader (image loading)
      expect(screen.queryByTestId("shader1-fallback")).not.toBeInTheDocument();

      // Simulate image error via hidden img element
      const hiddenImg = document.querySelector('img[src="/api/user/hero"]');
      expect(hiddenImg).toBeInTheDocument();
      fireEvent.error(hiddenImg!);

      // Now shader should appear
      expect(screen.getByTestId("shader1-fallback")).toBeInTheDocument();
    });
  });

  describe("play button", () => {
    it("should show play button when hasMedia is true", () => {
      render(<ItemHero {...defaultProps} hasMedia onPlay={() => {}} />);
      expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    });

    it("should not show play button when hasMedia is false", () => {
      render(<ItemHero {...defaultProps} hasMedia={false} />);
      expect(
        screen.queryByRole("button", { name: /play/i })
      ).not.toBeInTheDocument();
    });

    it("should call onPlay when play button clicked", async () => {
      const user = userEvent.setup();
      const onPlay = vi.fn();
      render(<ItemHero {...defaultProps} hasMedia onPlay={onPlay} />);

      await user.click(screen.getByRole("button", { name: /play/i }));
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it("should show Resume when hasProgress is true", () => {
      render(
        <ItemHero {...defaultProps} hasMedia hasProgress onPlay={() => {}} />
      );
      expect(
        screen.getByRole("button", { name: /resume/i })
      ).toBeInTheDocument();
    });
  });

  describe("collapse/expand", () => {
    it("should render collapse button when onCollapse provided", () => {
      render(
        <ItemHero name="Test" isCollapsed={false} onCollapse={() => {}} />
      );
      expect(
        screen.getByRole("button", { name: /collapse hero/i })
      ).toBeInTheDocument();
    });

    it("should not render collapse button when onCollapse not provided", () => {
      render(<ItemHero name="Test" />);
      expect(
        screen.queryByRole("button", { name: /collapse hero/i })
      ).not.toBeInTheDocument();
    });

    it("should render collapsed state with expand button", () => {
      render(<ItemHero name="Test" isCollapsed={true} onCollapse={() => {}} />);
      expect(
        screen.getByRole("button", { name: /expand hero/i })
      ).toBeInTheDocument();
    });

    it("should call onCollapse when collapse button clicked", async () => {
      const user = userEvent.setup();
      const onCollapse = vi.fn();
      render(
        <ItemHero name="Test" isCollapsed={false} onCollapse={onCollapse} />
      );

      await user.click(screen.getByRole("button", { name: /collapse hero/i }));
      expect(onCollapse).toHaveBeenCalledTimes(1);
    });

    it("should show title in collapsed state", () => {
      render(
        <ItemHero
          name="Breaking Bad"
          isCollapsed={true}
          onCollapse={() => {}}
        />
      );
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    });

    it("should show play button in collapsed state when hasMedia", () => {
      render(
        <ItemHero
          name="Test"
          isCollapsed={true}
          onCollapse={() => {}}
          hasMedia
          onPlay={() => {}}
        />
      );
      expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    });
  });

  describe("description expand/collapse", () => {
    const longDescription = "A".repeat(200);

    it("should show Read More button for long descriptions", () => {
      render(<ItemHero name="Test" description={longDescription} />);
      expect(
        screen.getByRole("button", { name: /read more/i })
      ).toBeInTheDocument();
    });

    it("should not show Read More button for short descriptions", () => {
      render(<ItemHero name="Test" description="Short text" />);
      expect(
        screen.queryByRole("button", { name: /read more/i })
      ).not.toBeInTheDocument();
    });

    it("should toggle to Show Less when expanded", async () => {
      const user = userEvent.setup();
      render(<ItemHero name="Test" description={longDescription} />);

      await user.click(screen.getByRole("button", { name: /read more/i }));

      expect(
        screen.getByRole("button", { name: /show less/i })
      ).toBeInTheDocument();
    });

    it("should toggle back to Read More when collapsed", async () => {
      const user = userEvent.setup();
      render(<ItemHero name="Test" description={longDescription} />);

      await user.click(screen.getByRole("button", { name: /read more/i }));
      await user.click(screen.getByRole("button", { name: /show less/i }));

      expect(
        screen.getByRole("button", { name: /read more/i })
      ).toBeInTheDocument();
    });

    it("should have data-testid for E2E targeting", () => {
      render(<ItemHero name="Test" description={longDescription} />);
      expect(screen.getByTestId("hero-read-more")).toBeInTheDocument();
    });
  });

  describe("go to button", () => {
    const nextItem = { id: "next-item-123", name: "Episode 5" };

    it("should show go to button when nextItem and onGoToNext provided", () => {
      render(
        <ItemHero {...defaultProps} nextItem={nextItem} onGoToNext={() => {}} />
      );
      expect(
        screen.getByRole("button", { name: /go to episode 5/i })
      ).toBeInTheDocument();
    });

    it("should not show go to button when nextItem is null", () => {
      render(
        <ItemHero {...defaultProps} nextItem={null} onGoToNext={() => {}} />
      );
      expect(
        screen.queryByRole("button", { name: /go to/i })
      ).not.toBeInTheDocument();
    });

    it("should not show go to button when onGoToNext is missing", () => {
      render(<ItemHero {...defaultProps} nextItem={nextItem} />);
      expect(
        screen.queryByRole("button", { name: /go to/i })
      ).not.toBeInTheDocument();
    });

    it("should call onGoToNext with nextItem when clicked", async () => {
      const user = userEvent.setup();
      const onGoToNext = vi.fn();
      render(
        <ItemHero
          {...defaultProps}
          nextItem={nextItem}
          onGoToNext={onGoToNext}
        />
      );

      await user.click(
        screen.getByRole("button", { name: /go to episode 5/i })
      );
      expect(onGoToNext).toHaveBeenCalledWith(nextItem);
      expect(onGoToNext).toHaveBeenCalledTimes(1);
    });

    it("should show go to button in collapsed state", () => {
      render(
        <ItemHero
          {...defaultProps}
          isCollapsed={true}
          onCollapse={() => {}}
          nextItem={nextItem}
          onGoToNext={() => {}}
        />
      );
      expect(
        screen.getByRole("button", { name: /go to episode 5/i })
      ).toBeInTheDocument();
    });

    it("should have data-testid for E2E targeting", () => {
      render(
        <ItemHero {...defaultProps} nextItem={nextItem} onGoToNext={() => {}} />
      );
      expect(screen.getByTestId("item-hero-goto")).toBeInTheDocument();
    });
  });
});
