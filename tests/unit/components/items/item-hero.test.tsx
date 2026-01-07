/**
 * Unit tests for ItemHero component.
 */

import { describe, it, expect, vi } from "vitest";
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

  describe("file stats", () => {
    it("should show media count when provided", () => {
      render(<ItemHero {...defaultProps} mediaCount={3} />);
      expect(screen.getByText(/3 media/i)).toBeInTheDocument();
    });

    it("should show artwork count when provided", () => {
      render(<ItemHero {...defaultProps} artworkCount={2} />);
      expect(screen.getByText(/2 artwork/i)).toBeInTheDocument();
    });

    it("should show subtitle count when provided", () => {
      render(<ItemHero {...defaultProps} subtitleCount={2} />);
      expect(screen.getByText(/2 subtitle/i)).toBeInTheDocument();
    });

    it("should show child count as items", () => {
      render(<ItemHero {...defaultProps} childCount={5} />);
      expect(screen.getByText(/5 items/i)).toBeInTheDocument();
    });

    it("should show singular item label for count of 1", () => {
      render(<ItemHero {...defaultProps} childCount={1} />);
      expect(screen.getByText("1 item")).toBeInTheDocument();
    });
  });
});
