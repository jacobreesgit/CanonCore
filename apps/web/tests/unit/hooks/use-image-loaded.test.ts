/**
 * Tests for useImageLoaded hook.
 * Covers cached image detection, load/error states, and src changes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImageLoaded } from "@/hooks/use-image-loaded";

describe("useImageLoaded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns loaded false initially", () => {
    const { result } = renderHook(() => useImageLoaded());
    expect(result.current.loaded).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("sets loaded true when onLoad is called", () => {
    const { result } = renderHook(() => useImageLoaded());
    act(() => result.current.onLoad());
    expect(result.current.loaded).toBe(true);
  });

  it("sets error true when onError is called", () => {
    const { result } = renderHook(() => useImageLoaded());
    act(() => result.current.onError());
    expect(result.current.error).toBe(true);
  });

  it("resets state when src changes", () => {
    const { result, rerender } = renderHook(({ src }) => useImageLoaded(src), {
      initialProps: { src: "/image1.jpg" },
    });

    act(() => result.current.onLoad());
    expect(result.current.loaded).toBe(true);

    rerender({ src: "/image2.jpg" });
    expect(result.current.loaded).toBe(false);
  });

  // CRITICAL: This tests the primary bug fix - cached images
  it("detects cached image via img.complete on mount", () => {
    const { result } = renderHook(() => useImageLoaded("/cached-image.jpg"));

    // Simulate attaching ref to a cached image element
    const mockImg = document.createElement("img");
    Object.defineProperty(mockImg, "complete", { value: true });
    Object.defineProperty(mockImg, "naturalHeight", { value: 100 });

    act(() => {
      // Manually set the ref (simulating React attaching it)
      (
        result.current.ref as React.MutableRefObject<HTMLImageElement | null>
      ).current = mockImg;
    });

    // Re-render to trigger the useEffect that checks img.complete
    const { result: result2 } = renderHook(() =>
      useImageLoaded("/cached-image.jpg")
    );

    act(() => {
      (
        result2.current.ref as React.MutableRefObject<HTMLImageElement | null>
      ).current = mockImg;
    });

    // Trigger effect by changing src back
    const { result: result3, rerender } = renderHook(
      ({ src }) => useImageLoaded(src),
      { initialProps: { src: "/other.jpg" } }
    );

    // Set up cached image on the ref before changing src
    act(() => {
      (
        result3.current.ref as React.MutableRefObject<HTMLImageElement | null>
      ).current = mockImg;
    });

    // Rerender with the cached image src - this should detect the cached image
    rerender({ src: "/cached-image.jpg" });

    // The hook should detect the cached image and set loaded to true
    expect(result3.current.loaded).toBe(true);
  });

  it("does not set loaded for broken images (naturalHeight = 0)", () => {
    const { result, rerender } = renderHook(({ src }) => useImageLoaded(src), {
      initialProps: { src: "/other.jpg" },
    });

    // Simulate a broken/error image (complete but no height)
    const mockBrokenImg = document.createElement("img");
    Object.defineProperty(mockBrokenImg, "complete", { value: true });
    Object.defineProperty(mockBrokenImg, "naturalHeight", { value: 0 });

    act(() => {
      (
        result.current.ref as React.MutableRefObject<HTMLImageElement | null>
      ).current = mockBrokenImg;
    });

    rerender({ src: "/broken-image.jpg" });

    // Should NOT be loaded because naturalHeight is 0
    expect(result.current.loaded).toBe(false);
  });

  it("clears error state when onLoad is called after error", () => {
    const { result } = renderHook(() => useImageLoaded());

    act(() => result.current.onError());
    expect(result.current.error).toBe(true);

    act(() => result.current.onLoad());
    expect(result.current.error).toBe(false);
    expect(result.current.loaded).toBe(true);
  });

  it("returns a ref object", () => {
    const { result } = renderHook(() => useImageLoaded());
    expect(result.current.ref).toBeDefined();
    expect(result.current.ref.current).toBeNull();
  });
});
