import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfiniteScrollTrigger } from "@/components/ui/infinite-scroll-trigger";

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit
  ) {}
  observe = mockObserve;
  unobserve = vi.fn();
  disconnect = mockDisconnect;
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

describe("InfiniteScrollTrigger", () => {
  it("renders nothing when no more pages", () => {
    const { container } = render(
      <InfiniteScrollTrigger
        hasNextPage={false}
        isFetchingNextPage={false}
        fetchNextPage={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows spinner when fetching next page", () => {
    render(
      <InfiniteScrollTrigger
        hasNextPage={true}
        isFetchingNextPage={true}
        fetchNextPage={vi.fn()}
      />
    );
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("observes the sentinel element", () => {
    render(
      <InfiniteScrollTrigger
        hasNextPage={true}
        isFetchingNextPage={false}
        fetchNextPage={vi.fn()}
      />
    );
    expect(mockObserve).toHaveBeenCalled();
  });
});
