/**
 * Unit tests for preloadImages utility function.
 * Tests image preloading behavior including success, error, and timeout handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store references to trigger callbacks
const mockImages: Array<{
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}> = [];

// Create a proper class mock for Image
class MockImage {
  src: string = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    mockImages.push(this);
  }
}

// Mock the global Image constructor before importing
vi.stubGlobal("Image", MockImage);

// Import after mocking
import { preloadImages } from "@/lib/image-preload";

describe("preloadImages", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockImages.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately for empty array", async () => {
    const promise = preloadImages([]);
    await expect(promise).resolves.toBeUndefined();
  });

  it("creates Image instances for each artwork ID", () => {
    const artworkIds = ["id1", "id2", "id3"];
    preloadImages(artworkIds);

    expect(mockImages).toHaveLength(3);
    expect(mockImages[0].src).toBe("/api/artwork/id1");
    expect(mockImages[1].src).toBe("/api/artwork/id2");
    expect(mockImages[2].src).toBe("/api/artwork/id3");
  });

  it("resolves when all images load successfully", async () => {
    const artworkIds = ["id1", "id2"];
    const promise = preloadImages(artworkIds);

    // Simulate images loading
    mockImages[0].onload?.();
    mockImages[1].onload?.();

    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves when some images fail (doesn't block UI)", async () => {
    const artworkIds = ["id1", "id2", "id3"];
    const promise = preloadImages(artworkIds);

    // Simulate mixed results: one success, one error, one success
    mockImages[0].onload?.();
    mockImages[1].onerror?.();
    mockImages[2].onload?.();

    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves when all images fail", async () => {
    const artworkIds = ["id1", "id2"];
    const promise = preloadImages(artworkIds);

    // Simulate all errors
    mockImages[0].onerror?.();
    mockImages[1].onerror?.();

    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves on timeout if images are slow", async () => {
    const artworkIds = ["id1", "id2"];
    const promise = preloadImages(artworkIds, 3000);

    // Don't trigger any callbacks, let timeout fire
    vi.advanceTimersByTime(3000);

    await expect(promise).resolves.toBeUndefined();
  });

  it("uses custom timeout value", async () => {
    const artworkIds = ["id1"];
    const promise = preloadImages(artworkIds, 1000);

    // Advance less than timeout
    vi.advanceTimersByTime(500);

    // Promise should not be resolved yet (no way to test pending easily,
    // but we can verify it resolves after full timeout)
    vi.advanceTimersByTime(500);

    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves only once even if timeout fires after images load", async () => {
    const artworkIds = ["id1"];
    const promise = preloadImages(artworkIds, 3000);

    // Image loads immediately
    mockImages[0].onload?.();

    // Timeout fires later (should be no-op)
    vi.advanceTimersByTime(3000);

    await expect(promise).resolves.toBeUndefined();
  });

  it("handles single image", async () => {
    const artworkIds = ["single-id"];
    const promise = preloadImages(artworkIds);

    expect(mockImages).toHaveLength(1);
    expect(mockImages[0].src).toBe("/api/artwork/single-id");

    mockImages[0].onload?.();

    await expect(promise).resolves.toBeUndefined();
  });

  it("handles many images (up to 8 for first fold)", async () => {
    const artworkIds = Array.from({ length: 8 }, (_, i) => `id-${i}`);
    const promise = preloadImages(artworkIds);

    expect(mockImages).toHaveLength(8);

    // Load all images
    mockImages.forEach((img) => img.onload?.());

    await expect(promise).resolves.toBeUndefined();
  });
});
