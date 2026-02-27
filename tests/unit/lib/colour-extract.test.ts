import { describe, it, expect, vi, afterEach } from "vitest";
import { extractDominantColour } from "@/lib/colour-extract";

// Mock sharp at module level
vi.mock("sharp", () => ({
  default: vi.fn(),
}));

describe("extractDominantColour", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("extracts hex colour from image buffer", async () => {
    const { default: sharp } = await import("sharp");
    vi.mocked(sharp).mockReturnValue({
      stats: vi.fn().mockResolvedValue({
        dominant: { r: 26, g: 58, b: 92 },
      }),
    } as never);

    const result = await extractDominantColour(Buffer.from("fake-image"));
    expect(result).toBe("#0a3a6d");
  });

  it("extracts hex colour from URL", async () => {
    const { default: sharp } = await import("sharp");
    vi.mocked(sharp).mockReturnValue({
      stats: vi.fn().mockResolvedValue({
        dominant: { r: 255, g: 107, b: 53 },
      }),
    } as never);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      })
    );

    const result = await extractDominantColour(
      "https://image.tmdb.org/t/p/w300/test.jpg"
    );
    expect(result).toBe("#802200");
  });

  it("returns null when extraction fails", async () => {
    const { default: sharp } = await import("sharp");
    vi.mocked(sharp).mockReturnValue({
      stats: vi.fn().mockRejectedValue(new Error("corrupt image")),
    } as never);

    const result = await extractDominantColour(Buffer.from("bad-image"));
    expect(result).toBeNull();
  });

  it("returns null when fetch fails for URL input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );

    const result = await extractDominantColour("https://example.com/404.jpg");
    expect(result).toBeNull();
  });
});
