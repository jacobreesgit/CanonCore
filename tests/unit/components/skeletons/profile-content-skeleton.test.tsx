import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProfileContentSkeleton } from "@/components/skeletons/profile-content-skeleton";

describe("ProfileContentSkeleton", () => {
  it("renders skeleton elements", () => {
    const { container } = render(<ProfileContentSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    // Hero avatar + name + username + tabs + toolbar + 8 grid cards + shelf skeletons
    expect(skeletons.length).toBeGreaterThan(10);
  });

  it("renders hero area with viewport-relative height", () => {
    const { container } = render(<ProfileContentSkeleton />);
    const hero = container.querySelector("[data-testid='skeleton-hero']");
    expect(hero).toBeTruthy();
    expect(hero?.className).toContain("h-[calc(55vh+var(--header-height))]");
  });

  it("renders avatar skeleton with correct responsive sizes", () => {
    const { container } = render(<ProfileContentSkeleton />);
    const avatar = container.querySelector('[data-slot="skeleton"].size-28');
    expect(avatar).toBeTruthy();
  });

  it("renders poster grid with correct column breakpoints", () => {
    const { container } = render(<ProfileContentSkeleton />);
    const grid = container.querySelector(".grid-cols-3");
    expect(grid).toBeTruthy();
    const posters = grid!.querySelectorAll(
      '[data-slot="skeleton"][class*="aspect-"]'
    );
    expect(posters.length).toBe(8);
  });

  it("renders tab bar with correct gap", () => {
    const { container } = render(<ProfileContentSkeleton />);
    const tabBar = container.querySelector(".gap-8");
    expect(tabBar).toBeTruthy();
  });
});
