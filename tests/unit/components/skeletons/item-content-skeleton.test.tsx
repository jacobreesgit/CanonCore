import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ItemContentSkeleton } from "@/components/skeletons/item-content-skeleton";

describe("ItemContentSkeleton", () => {
  it("renders skeleton elements", () => {
    const { container } = render(<ItemContentSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(8);
  });

  it("renders hero with viewport-relative height", () => {
    const { container } = render(<ItemContentSkeleton />);
    const hero = container.querySelector("[data-testid='skeleton-hero']");
    expect(hero).toBeTruthy();
    expect(hero?.className).toContain("h-[calc(55vh+var(--header-height))]");
  });

  it("renders tab bar skeleton", () => {
    const { container } = render(<ItemContentSkeleton />);
    const tabBar = container.querySelector(".gap-8");
    expect(tabBar).toBeTruthy();
  });

  it("renders toolbar skeleton with glassmorphism container", () => {
    const { container } = render(<ItemContentSkeleton />);
    const toolbar = container.querySelector(".rounded-xl");
    expect(toolbar).toBeTruthy();
    expect(toolbar?.className).toContain("bg-white/[0.04]");
  });

  it("renders children grid with correct breakpoints", () => {
    const { container } = render(<ItemContentSkeleton />);
    const grid = container.querySelector(".grid-cols-2");
    expect(grid).toBeTruthy();
    const gridCards = grid!.querySelectorAll(
      '[data-slot="skeleton"][class*="aspect-"]'
    );
    expect(gridCards.length).toBe(6);
  });
});
