/**
 * These tests guard CLS-critical dimensions by asserting specific Tailwind
 * classes (grid columns, hero height, gap values). The skeleton must match
 * the real page layout exactly to prevent layout shift when Suspense
 * streams in the actual content. Class-name coupling is intentional.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PlaylistContentSkeleton } from "@/components/skeletons/playlist-content-skeleton";

describe("PlaylistContentSkeleton", () => {
  it("renders skeleton elements", () => {
    const { container } = render(<PlaylistContentSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it("renders hero with viewport-relative height", () => {
    const { container } = render(<PlaylistContentSkeleton />);
    const hero = container.querySelector("[data-testid='skeleton-hero']");
    expect(hero).toBeTruthy();
    expect(hero?.className).toContain("h-[calc(55vh+var(--header-height))]");
  });

  it("renders poster grid (not rows)", () => {
    const { container } = render(<PlaylistContentSkeleton />);
    const grid = container.querySelector(".grid-cols-3");
    expect(grid).toBeTruthy();
    const posters = grid!.querySelectorAll(
      '[data-slot="skeleton"][class*="aspect-"]'
    );
    expect(posters.length).toBe(6);
  });

  it("renders tab bar with gap-8", () => {
    const { container } = render(<PlaylistContentSkeleton />);
    const tabBar = container.querySelector(".gap-8");
    expect(tabBar).toBeTruthy();
  });
});
