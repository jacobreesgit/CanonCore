/**
 * Unit tests for seed content hash computation.
 * Tests determinism, uniqueness, and edge cases for incremental seeding.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the seed-config module with test data
vi.mock("../../../prisma/seed-config", async () => {
  const actual = await vi.importActual("../../../prisma/seed-config");
  return {
    ...actual,
    SEED_USERS: [
      {
        email: "demo@canoncore.com",
        name: "Demo",
        username: "demo",
        isPublic: true,
        avatarSeed: "demo-avatar",
        heroSeed: "demo-hero",
        heroUrl: null,
      },
      {
        email: "test@canoncore.com",
        name: "Test",
        username: "test",
        isPublic: false,
        avatarSeed: null,
        heroSeed: null,
        heroUrl: null,
      },
    ],
    USER_CONTENT_DISTRIBUTION: {
      "demo@canoncore.com": { movieIds: [550, 680], showIds: [1396] },
      "test@canoncore.com": { movieIds: [550], showIds: [] },
    },
    USER_PROGRESS_RANGES: {
      "demo@canoncore.com": { min: 0.5, max: 1.0 },
      "test@canoncore.com": { min: 0.0, max: 0.5 },
    },
    USER_PINNED_ITEMS: {
      "demo@canoncore.com": [1396, 603],
      "test@canoncore.com": [],
    },
    MAX_SEASONS: 5,
    MAX_EPISODES: 10,
    SEED_GROUPED_STRUCTURE: false,
    SEED_SIMULATE_PLAYBACK: true,
  };
});

import {
  computeUserContentHash,
  computeAllUserHashes,
} from "../../../prisma/seed-config";

describe("computeUserContentHash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces same hash for same input (deterministic)", () => {
    const hash1 = computeUserContentHash("demo@canoncore.com");
    const hash2 = computeUserContentHash("demo@canoncore.com");
    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different users", () => {
    const demoHash = computeUserContentHash("demo@canoncore.com");
    const testHash = computeUserContentHash("test@canoncore.com");
    expect(demoHash).not.toBe(testHash);
  });

  it("returns empty string for missing user", () => {
    const hash = computeUserContentHash("nonexistent@canoncore.com");
    expect(hash).toBe("");
  });

  it("includes version prefix", () => {
    const hash = computeUserContentHash("demo@canoncore.com");
    expect(hash).toMatch(/^v3:/);
  });

  it("produces 64-char hex hash after version prefix", () => {
    const hash = computeUserContentHash("demo@canoncore.com");
    const hashPart = hash.replace(/^v3:/, "");
    expect(hashPart).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("computeAllUserHashes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Map with seed user hashes", () => {
    const hashes = computeAllUserHashes();

    expect(hashes).toBeInstanceOf(Map);
    expect(hashes.size).toBeGreaterThan(0);
    // Check that at least demo user is present (from real SEED_USERS)
    expect(hashes.has("demo@canoncore.com")).toBe(true);
  });

  it("returns non-empty versioned hashes for all users", () => {
    const hashes = computeAllUserHashes();

    for (const [, hash] of hashes) {
      // Only check users that have content configured
      if (hash !== "") {
        expect(hash).toMatch(/^v3:/);
      }
    }
  });

  it("returns different hashes for different users with content", () => {
    const hashes = computeAllUserHashes();
    const hashValues = [...hashes.values()].filter((h) => h !== "");

    // All non-empty hashes should be unique
    const uniqueHashes = new Set(hashValues);
    expect(uniqueHashes.size).toBe(hashValues.length);
  });
});
