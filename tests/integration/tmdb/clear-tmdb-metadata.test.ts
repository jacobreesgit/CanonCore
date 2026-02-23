/**
 * Integration tests for clearing TMDB metadata fields.
 * Tests real database operations with mocked auth and TMDB client.
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
import { clearTmdbFieldAction } from "@/lib/tmdb-actions";
import { prisma } from "@/lib/prisma";
import "../setup";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock TMDB client (required by tmdb-actions module)
vi.mock("@/lib/tmdb-client", () => ({
  isTMDBConfigured: vi.fn(() => true),
  searchMedia: vi.fn(),
  getMovie: vi.fn(),
  getTVShow: vi.fn(),
  extractYear: vi.fn(),
  truncateOverview: vi.fn(),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";

const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

const TEST_USER_ID = `test-clear-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `clear-${Date.now()}@test.example.com`;
const OTHER_USER_ID = `test-clear-other-${Date.now()}`;

describe("TMDB clear metadata integration", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        passwordHash: "hashed",
      },
    });
    await prisma.user.create({
      data: {
        id: OTHER_USER_ID,
        email: `other-${Date.now()}@test.example.com`,
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
    await prisma.itemFile.deleteMany({
      where: { item: { userId: { in: [TEST_USER_ID, OTHER_USER_ID] } } },
    });
    await prisma.item.deleteMany({
      where: { userId: { in: [TEST_USER_ID, OTHER_USER_ID] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_USER_ID, OTHER_USER_ID] } },
    });
  });

  /** Helper to create an item with TMDB metadata already applied. */
  async function createItemWithTmdb(overrides?: Record<string, unknown>) {
    return prisma.item.create({
      data: {
        name: "The Dark Knight",
        description: "When the menace known as the Joker...",
        userId: TEST_USER_ID,
        tmdbId: 155,
        tmdbType: "movie",
        tmdbPosterPath: "/poster.jpg",
        tmdbBackdropPath: "/backdrop.jpg",
        tmdbShowTagline: true,
        tmdbShowMetadata: true,
        tmdbShowGenres: true,
        tmdbShowCast: true,
        tmdbShowProviders: true,
        tmdbShowVideos: true,
        tmdbShowRecommendations: false,
        ...overrides,
      },
    });
  }

  it("clears poster path while preserving other TMDB fields", async () => {
    const item = await createItemWithTmdb();

    const result = await clearTmdbFieldAction(item.id, "poster");

    expect(result).toEqual({ success: true });

    const updated = await prisma.item.findUnique({ where: { id: item.id } });
    expect(updated?.tmdbPosterPath).toBeNull();
    expect(updated?.tmdbBackdropPath).toBe("/backdrop.jpg");
    expect(updated?.tmdbId).toBe(155);
    expect(updated?.tmdbType).toBe("movie");
  });

  it("clears backdrop path while preserving other TMDB fields", async () => {
    const item = await createItemWithTmdb();

    const result = await clearTmdbFieldAction(item.id, "backdrop");

    expect(result).toEqual({ success: true });

    const updated = await prisma.item.findUnique({ where: { id: item.id } });
    expect(updated?.tmdbBackdropPath).toBeNull();
    expect(updated?.tmdbPosterPath).toBe("/poster.jpg");
    expect(updated?.tmdbId).toBe(155);
  });

  it("fully detaches TMDB: nulls all fields, resets display options, preserves name/description", async () => {
    const item = await createItemWithTmdb();

    const result = await clearTmdbFieldAction(item.id, "all");

    expect(result).toEqual({ success: true });

    const updated = await prisma.item.findUnique({ where: { id: item.id } });
    expect(updated?.tmdbId).toBeNull();
    expect(updated?.tmdbType).toBeNull();
    expect(updated?.tmdbPosterPath).toBeNull();
    expect(updated?.tmdbBackdropPath).toBeNull();
    // Display options reset to defaults
    expect(updated?.tmdbShowTagline).toBe(true);
    expect(updated?.tmdbShowRecommendations).toBe(true);
    // Name and description preserved
    expect(updated?.name).toBe("The Dark Knight");
    expect(updated?.description).toBe("When the menace known as the Joker...");
  });

  it("rejects clearing by non-owner", async () => {
    const item = await createItemWithTmdb();

    mockAuth.mockResolvedValue({
      user: { id: OTHER_USER_ID, email: "other@test.com" },
      expires: new Date().toISOString(),
    });

    const result = await clearTmdbFieldAction(item.id, "poster");
    expect(result).toEqual({ success: false, error: "Unauthorized" });

    // Verify nothing changed
    const unchanged = await prisma.item.findUnique({
      where: { id: item.id },
    });
    expect(unchanged?.tmdbPosterPath).toBe("/poster.jpg");
  });
});
