/**
 * Integration tests for TMDB metadata application.
 * Tests the full flow of applying TMDB metadata to items.
 * Uses mocked TMDB API responses to avoid hitting the real API.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import type { Session } from "next-auth";
import {
  applyMetadataAction,
  updateTmdbDisplayOptions,
} from "@/lib/tmdb-actions";
import { createItem, getItem } from "@/lib/item-actions";
import { prisma } from "@/lib/prisma";
import "../setup";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock TMDB client functions
vi.mock("@/lib/tmdb-client", () => ({
  searchMedia: vi.fn(),
  getMovie: vi.fn(),
  getTVShow: vi.fn(),
  extractYear: vi.fn((date: string) => (date ? date.split("-")[0] : "")),
  truncateOverview: vi.fn((text: string) =>
    text && text.length > 200 ? text.slice(0, 197) + "..." : text || ""
  ),
  isTMDBConfigured: vi.fn(() => true),
}));

// Mock next/cache revalidation
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { getMovie, getTVShow } from "@/lib/tmdb-client";

// Cast to bypass complex types
const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

// Test user IDs
const TEST_USER_ID = `test-tmdb-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `tmdb-${Date.now()}@test.example.com`;

describe("TMDB apply metadata integration", () => {
  beforeAll(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        passwordHash: "hashed",
      },
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock auth to return test user
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      expires: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.itemFile.deleteMany({
      where: { item: { userId: TEST_USER_ID } },
    });
    await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  });

  it("applies movie metadata to an item", async () => {
    // Create an item
    const createResult = await createItem(null, "Untitled Movie");
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Failed to create item");
    const itemId = createResult.data!.id;

    // Mock TMDB movie response
    vi.mocked(getMovie).mockResolvedValue({
      id: 278,
      title: "The Shawshank Redemption",
      overview:
        "Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison.",
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
      release_date: "1994-09-23",
      tagline: "",
      runtime: null,
      vote_average: 0,
      vote_count: 0,
      genres: [],
    });

    // Apply metadata
    const result = await applyMetadataAction(itemId, 278, "movie");

    expect(result.success).toBe(true);

    // Verify the item was updated
    const getResult = await getItem(itemId);
    expect(getResult.success).toBe(true);
    if (!getResult.success) throw new Error("Failed to get item");

    expect(getResult.data?.item.name).toBe("The Shawshank Redemption (1994)");
    expect(getResult.data?.item.description).toContain("Framed in the 1940s");
  });

  it("applies TV show metadata to an item", async () => {
    // Create an item
    const createResult = await createItem(null, "Untitled Show");
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Failed to create item");
    const itemId = createResult.data!.id;

    // Mock TMDB TV show response
    vi.mocked(getTVShow).mockResolvedValue({
      id: 1396,
      name: "Breaking Bad",
      overview:
        "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine.",
      poster_path: "/bb-poster.jpg",
      backdrop_path: "/bb-backdrop.jpg",
      first_air_date: "2008-01-20",
      number_of_seasons: 5,
      tagline: "",
      vote_average: 0,
      vote_count: 0,
      genres: [],
    });

    // Apply metadata
    const result = await applyMetadataAction(itemId, 1396, "tv");

    expect(result.success).toBe(true);

    // Verify the item was updated
    const getResult = await getItem(itemId);
    expect(getResult.success).toBe(true);
    if (!getResult.success) throw new Error("Failed to get item");

    expect(getResult.data?.item.name).toBe("Breaking Bad (2008)");
    expect(getResult.data?.item.description).toContain("chemistry teacher");
  });

  it("handles movie not found on TMDB", async () => {
    // Create an item
    const createResult = await createItem(null, "Unknown Movie");
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Failed to create item");
    const itemId = createResult.data!.id;

    // Mock TMDB returning null (not found)
    vi.mocked(getMovie).mockResolvedValue(null);

    // Apply metadata
    const result = await applyMetadataAction(itemId, 999999, "movie");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Movie not found on TMDB");
    }

    // Verify the item was NOT updated
    const getResult = await getItem(itemId);
    expect(getResult.success).toBe(true);
    if (!getResult.success) throw new Error("Failed to get item");

    expect(getResult.data?.item.name).toBe("Unknown Movie");
  });

  it("handles TV show not found on TMDB", async () => {
    // Create an item
    const createResult = await createItem(null, "Unknown Show");
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Failed to create item");
    const itemId = createResult.data!.id;

    // Mock TMDB returning null (not found)
    vi.mocked(getTVShow).mockResolvedValue(null);

    // Apply metadata
    const result = await applyMetadataAction(itemId, 999999, "tv");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("TV show not found on TMDB");
    }

    // Verify the item was NOT updated
    const getResult = await getItem(itemId);
    expect(getResult.success).toBe(true);
    if (!getResult.success) throw new Error("Failed to get item");

    expect(getResult.data?.item.name).toBe("Unknown Show");
  });

  it("rejects applying metadata to non-existent item", async () => {
    vi.mocked(getMovie).mockResolvedValue({
      id: 278,
      title: "The Shawshank Redemption",
      overview: "Test",
      poster_path: null,
      backdrop_path: null,
      release_date: "1994-09-23",
      tagline: "",
      runtime: null,
      vote_average: 0,
      vote_count: 0,
      genres: [],
    });

    const result = await applyMetadataAction("non-existent-id", 278, "movie");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Item not found");
    }
  });

  it("rejects applying metadata to another user's item", async () => {
    // Create another user
    const otherUserId = `other-user-${Date.now()}`;
    await prisma.user.create({
      data: {
        id: otherUserId,
        email: `other-${Date.now()}@test.example.com`,
        passwordHash: "hashed",
      },
    });

    // Create item as other user
    const item = await prisma.item.create({
      data: {
        name: "Other User's Item",
        userId: otherUserId,
        order: 0,
      },
    });

    vi.mocked(getMovie).mockResolvedValue({
      id: 278,
      title: "The Shawshank Redemption",
      overview: "Test",
      poster_path: null,
      backdrop_path: null,
      release_date: "1994-09-23",
      tagline: "",
      runtime: null,
      vote_average: 0,
      vote_count: 0,
      genres: [],
    });

    // Try to apply metadata as test user
    const result = await applyMetadataAction(item.id, 278, "movie");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Item not found");
    }

    // Clean up
    await prisma.item.delete({ where: { id: item.id } });
    await prisma.user.delete({ where: { id: otherUserId } });
  });

  it("handles movie without release date", async () => {
    // Create an item
    const createResult = await createItem(null, "Dateless Movie");
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Failed to create item");
    const itemId = createResult.data!.id;

    // Mock TMDB movie without release date
    vi.mocked(getMovie).mockResolvedValue({
      id: 999,
      title: "Upcoming Film",
      overview: "A movie without a release date.",
      poster_path: null,
      backdrop_path: null,
      release_date: "",
      tagline: "",
      runtime: null,
      vote_average: 0,
      vote_count: 0,
      genres: [],
    });

    // Apply metadata
    const result = await applyMetadataAction(itemId, 999, "movie");

    expect(result.success).toBe(true);

    // Verify the item was updated without year in title
    const getResult = await getItem(itemId);
    expect(getResult.success).toBe(true);
    if (!getResult.success) throw new Error("Failed to get item");

    expect(getResult.data?.item.name).toBe("Upcoming Film");
  });

  it("truncates long overview to 200 characters", async () => {
    // Create an item
    const createResult = await createItem(null, "Long Description Movie");
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Failed to create item");
    const itemId = createResult.data!.id;

    // Create a very long overview
    const longOverview = "A".repeat(300);

    // Mock TMDB movie with long overview
    vi.mocked(getMovie).mockResolvedValue({
      id: 123,
      title: "Verbose Film",
      overview: longOverview,
      poster_path: null,
      backdrop_path: null,
      release_date: "2023-01-01",
      tagline: "",
      runtime: null,
      vote_average: 0,
      vote_count: 0,
      genres: [],
    });

    // Apply metadata
    const result = await applyMetadataAction(itemId, 123, "movie");

    expect(result.success).toBe(true);

    // Verify the description was truncated
    const getResult = await getItem(itemId);
    expect(getResult.success).toBe(true);
    if (!getResult.success) throw new Error("Failed to get item");

    expect(getResult.data?.item.description?.length).toBeLessThanOrEqual(200);
  });
});

describe("updateTmdbDisplayOptions integration", () => {
  beforeAll(async () => {
    // Recreate test user (first describe block's afterAll deletes it)
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        passwordHash: "hashed",
      },
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      expires: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  });

  it("persists display options to database", async () => {
    // Create an item with TMDB metadata
    const createResult = await createItem(null, "Display Options Test");
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Failed to create item");
    const itemId = createResult.data!.id;

    // Set tmdbId directly since applyMetadataAction requires TMDB mocks
    await prisma.item.update({
      where: { id: itemId },
      data: { tmdbId: 278, tmdbType: "movie" },
    });

    // Update display options
    const result = await updateTmdbDisplayOptions(itemId, {
      showTagline: true,
      showMetadata: false,
      showGenres: true,
      showCast: false,
      showProviders: true,
      showVideos: false,
      showRecommendations: true,
    });

    expect(result).toEqual({ success: true });

    // Verify in database
    const updatedItem = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        tmdbShowTagline: true,
        tmdbShowMetadata: true,
        tmdbShowGenres: true,
        tmdbShowCast: true,
        tmdbShowProviders: true,
        tmdbShowVideos: true,
        tmdbShowRecommendations: true,
      },
    });

    expect(updatedItem).toEqual({
      tmdbShowTagline: true,
      tmdbShowMetadata: false,
      tmdbShowGenres: true,
      tmdbShowCast: false,
      tmdbShowProviders: true,
      tmdbShowVideos: false,
      tmdbShowRecommendations: true,
    });
  });

  it("rejects when item has no TMDB metadata", async () => {
    // Create a plain item (no TMDB)
    const createResult = await createItem(null, "No TMDB Item");
    expect(createResult.success).toBe(true);
    if (!createResult.success) throw new Error("Failed to create item");
    const itemId = createResult.data!.id;

    const result = await updateTmdbDisplayOptions(itemId, {
      showTagline: true,
      showMetadata: true,
      showGenres: true,
      showCast: true,
      showProviders: true,
      showVideos: true,
      showRecommendations: true,
    });

    expect(result).toEqual({
      success: false,
      error: "Item has no TMDB metadata",
    });
  });

  it("rejects when item does not exist", async () => {
    const result = await updateTmdbDisplayOptions("nonexistent-id", {
      showTagline: true,
      showMetadata: true,
      showGenres: true,
      showCast: true,
      showProviders: true,
      showVideos: true,
      showRecommendations: true,
    });

    expect(result).toEqual({
      success: false,
      error: "Item not found",
    });
  });

  it("applies poster-only update without clobbering backdrop", async () => {
    // Create item with existing TMDB data
    const item = await prisma.item.create({
      data: {
        name: "Test Movie",
        userId: TEST_USER_ID,
        tmdbId: 100,
        tmdbType: "movie",
        tmdbPosterPath: "/old-poster.jpg",
        tmdbBackdropPath: "/existing-backdrop.jpg",
      },
    });

    vi.mocked(getMovie).mockResolvedValue({
      id: 100,
      title: "Test Movie",
      overview: "A test movie",
      poster_path: "/new-poster.jpg",
      backdrop_path: "/new-backdrop.jpg",
      release_date: "2024-01-01",
    } as never);

    await applyMetadataAction(item.id, 100, "movie", {
      updateName: false,
      updateDescription: false,
      updatePoster: true,
      updateBackdrop: false,
      posterPath: "/new-poster.jpg",
    });

    const updated = await prisma.item.findUnique({ where: { id: item.id } });
    expect(updated?.tmdbPosterPath).toBe("/new-poster.jpg");
    expect(updated?.tmdbBackdropPath).toBe("/existing-backdrop.jpg");
  });
});
