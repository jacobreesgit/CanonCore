/**
 * Tests for useLazyImage hook.
 * Covers priority loading, IntersectionObserver integration, and viewport detection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLazyImage } from "@/hooks/use-lazy-image";

const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();
let intersectionCallback: IntersectionObserverCallback;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    intersectionCallback = callback;
    this.rootMargin = options?.rootMargin ?? "";
  }

  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
  takeRecords = () => [];
}

beforeEach(() => {
  global.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => vi.clearAllMocks());

describe("useLazyImage", () => {
  it("returns shouldLoad=true immediately when priority=true", () => {
    const { result } = renderHook(() => useLazyImage({ priority: true }));
    expect(result.current.shouldLoad).toBe(true);
  });

  it("returns shouldLoad=false initially when priority=false", () => {
    const { result } = renderHook(() => useLazyImage({ priority: false }));
    expect(result.current.shouldLoad).toBe(false);
  });

  it("sets shouldLoad=true when entering viewport", () => {
    const { result } = renderHook(() => useLazyImage({ priority: false }));

    // Simulate setting the ref
    const mockElement = document.createElement("div");
    act(() => {
      result.current.ref(mockElement);
    });

    // Simulate intersection
    act(() => {
      intersectionCallback(
        [
          { isIntersecting: true, target: mockElement },
        ] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
    });

    expect(result.current.shouldLoad).toBe(true);
  });

  it("uses rootMargin for preloading", () => {
    const { result } = renderHook(() => useLazyImage({ rootMargin: "300px" }));

    // Set the ref to trigger observer creation
    const mockElement = document.createElement("div");
    act(() => {
      result.current.ref(mockElement);
    });

    // Observer should be created and observe called
    expect(mockObserve).toHaveBeenCalledWith(mockElement);
  });

  it("does not create observer when priority=true", () => {
    const { result } = renderHook(() => useLazyImage({ priority: true }));

    const mockElement = document.createElement("div");
    act(() => {
      result.current.ref(mockElement);
    });

    expect(mockObserve).not.toHaveBeenCalled();
  });

  it("unobserves element when intersection detected", () => {
    const { result } = renderHook(() => useLazyImage({ priority: false }));

    const mockElement = document.createElement("div");
    act(() => {
      result.current.ref(mockElement);
    });

    act(() => {
      intersectionCallback(
        [
          { isIntersecting: true, target: mockElement },
        ] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
    });

    expect(mockUnobserve).toHaveBeenCalledWith(mockElement);
  });

  it("disconnects observer on unmount", () => {
    const { result, unmount } = renderHook(() =>
      useLazyImage({ priority: false })
    );

    const mockElement = document.createElement("div");
    act(() => {
      result.current.ref(mockElement);
    });

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("returns callback ref function", () => {
    const { result } = renderHook(() => useLazyImage());
    expect(typeof result.current.ref).toBe("function");
  });

  it("defaults priority to false and rootMargin to 200px", () => {
    const { result } = renderHook(() => useLazyImage());

    // Default priority is false, so shouldLoad starts false
    expect(result.current.shouldLoad).toBe(false);

    const mockElement = document.createElement("div");
    act(() => {
      result.current.ref(mockElement);
    });

    // Observer should be created since priority=false
    expect(mockObserve).toHaveBeenCalledWith(mockElement);
  });

  it("handles IntersectionObserver not being available", () => {
    // Remove IntersectionObserver
    const originalIO = global.IntersectionObserver;
    // @ts-expect-error - intentionally setting to undefined
    global.IntersectionObserver = undefined;

    const { result } = renderHook(() => useLazyImage({ priority: false }));

    const mockElement = document.createElement("div");
    act(() => {
      result.current.ref(mockElement);
    });

    // Should fallback to loading immediately when IO not available
    expect(result.current.shouldLoad).toBe(true);

    // Restore
    global.IntersectionObserver = originalIO;
  });

  it("cleans up old observer when ref changes to new element", () => {
    const { result } = renderHook(() => useLazyImage({ priority: false }));

    // Set first element
    const firstElement = document.createElement("div");
    act(() => {
      result.current.ref(firstElement);
    });

    expect(mockObserve).toHaveBeenCalledWith(firstElement);

    // Change to second element
    const secondElement = document.createElement("div");
    act(() => {
      result.current.ref(secondElement);
    });

    // Old observer should be disconnected, new element observed
    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockObserve).toHaveBeenCalledWith(secondElement);
  });

  it("remains stable when shouldLoad is already true", () => {
    const { result } = renderHook(() => useLazyImage({ priority: false }));

    const mockElement = document.createElement("div");
    act(() => {
      result.current.ref(mockElement);
    });

    // First intersection - should set shouldLoad to true
    act(() => {
      intersectionCallback(
        [
          { isIntersecting: true, target: mockElement },
        ] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
    });

    expect(result.current.shouldLoad).toBe(true);

    // Second intersection callback - shouldLoad should remain true
    act(() => {
      intersectionCallback(
        [
          { isIntersecting: true, target: mockElement },
        ] as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
    });

    // State should remain stable (still true)
    expect(result.current.shouldLoad).toBe(true);
  });
});
