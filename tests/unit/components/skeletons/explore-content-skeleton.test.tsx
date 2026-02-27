/**
 * These tests guard CLS-critical dimensions by asserting specific Tailwind
 * classes (grid columns, hero height, gap values). The skeleton must match
 * the real page layout exactly to prevent layout shift when Suspense
 * streams in the actual content. Class-name coupling is intentional.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ExploreContentSkeleton } from "@/components/skeletons/explore-content-skeleton";

describe("ExploreContentSkeleton", () => {
  it("renders skeleton elements", () => {
    const { container } = render(<ExploreContentSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it("renders hero with viewport-relative height", () => {
    const { container } = render(<ExploreContentSkeleton />);
    const hero = container.querySelector("[data-testid='skeleton-hero']");
    expect(hero).toBeTruthy();
    expect(hero?.className).toContain("h-[calc(55vh+var(--header-height))]");
  });

  it("renders poster grid with correct column breakpoints", () => {
    const { container } = render(<ExploreContentSkeleton />);
    const grid = container.querySelector(".grid-cols-3");
    expect(grid).toBeTruthy();
    const posters = grid!.querySelectorAll(
      '[data-slot="skeleton"][class*="aspect-"]'
    );
    expect(posters.length).toBe(12);
  });

  it("renders tab bar with gap-8", () => {
    const { container } = render(<ExploreContentSkeleton />);
    const tabBar = container.querySelector(".gap-8");
    expect(tabBar).toBeTruthy();
  });

  it("renders carousel dot indicators area", () => {
    const { container } = render(<ExploreContentSkeleton />);
    const dots = container.querySelector("[data-testid='skeleton-dots']");
    expect(dots).toBeTruthy();
  });
});
