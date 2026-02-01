/**
 * Unit tests for seed configuration flags.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("seed-config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("parses SEED_ONLY_MOVIES flag", async () => {
    process.env.SEED_ONLY_MOVIES = "true";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_ONLY_MOVIES).toBe(true);
  });

  it("parses SEED_ONLY_SHOWS flag", async () => {
    process.env.SEED_ONLY_SHOWS = "true";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_ONLY_SHOWS).toBe(true);
  });

  it("parses SEED_SKIP_ARTWORK flag", async () => {
    process.env.SEED_SKIP_ARTWORK = "true";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_SKIP_ARTWORK).toBe(true);
  });

  it("parses SEED_QUIET flag", async () => {
    process.env.SEED_QUIET = "true";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_QUIET).toBe(true);
  });

  it("parses SEED_MOVIE_COUNT as number", async () => {
    process.env.SEED_MOVIE_COUNT = "5";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_MOVIE_COUNT).toBe(5);
  });

  it("parses SEED_SHOW_COUNT as number", async () => {
    process.env.SEED_SHOW_COUNT = "3";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_SHOW_COUNT).toBe(3);
  });

  it("parses SEED_USER_EMAIL as string", async () => {
    process.env.SEED_USER_EMAIL = "custom@test.com";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_USER_EMAIL).toBe("custom@test.com");
  });

  it("defaults boolean flags to false", async () => {
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_ONLY_MOVIES).toBe(false);
    expect(config.SEED_ONLY_SHOWS).toBe(false);
    expect(config.SEED_SKIP_ARTWORK).toBe(false);
    expect(config.SEED_QUIET).toBe(false);
  });

  it("defaults count flags to 0 (unlimited)", async () => {
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_MOVIE_COUNT).toBe(0);
    expect(config.SEED_SHOW_COUNT).toBe(0);
  });

  it("defaults SEED_USER_EMAIL to null", async () => {
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_USER_EMAIL).toBe(null);
  });

  it("getEffectiveMovieIds returns limited movies when SEED_MOVIE_COUNT set", async () => {
    process.env.SEED_MOVIE_COUNT = "3";
    const config = await import("@/prisma/seed-config");
    const ids = config.getEffectiveMovieIds();
    expect(ids).toHaveLength(3);
  });

  it("getEffectiveMovieIds returns empty when SEED_ONLY_SHOWS is true", async () => {
    process.env.SEED_ONLY_SHOWS = "true";
    const config = await import("@/prisma/seed-config");
    const ids = config.getEffectiveMovieIds();
    expect(ids).toHaveLength(0);
  });

  it("getEffectiveTVShowIds returns empty when SEED_ONLY_MOVIES is true", async () => {
    process.env.SEED_ONLY_MOVIES = "true";
    const config = await import("@/prisma/seed-config");
    const ids = config.getEffectiveTVShowIds();
    expect(ids).toHaveLength(0);
  });

  it("getEffectiveSeedUsers returns single user when SEED_USER_EMAIL set", async () => {
    process.env.SEED_USER_EMAIL = "custom@test.com";
    const config = await import("@/prisma/seed-config");
    const users = config.getEffectiveSeedUsers();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("custom@test.com");
  });

  describe("SEED_MOVIE_IDS", () => {
    it("defaults to null when not set", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.SEED_MOVIE_IDS).toBe(null);
    });

    it("parses comma-separated movie IDs", async () => {
      process.env.SEED_MOVIE_IDS = "278,238,155";
      const config = await import("@/prisma/seed-config");
      expect(config.SEED_MOVIE_IDS).toEqual([278, 238, 155]);
    });

    it("trims whitespace from IDs", async () => {
      process.env.SEED_MOVIE_IDS = "278, 238 , 155";
      const config = await import("@/prisma/seed-config");
      expect(config.SEED_MOVIE_IDS).toEqual([278, 238, 155]);
    });

    it("getEffectiveMovieIds uses SEED_MOVIE_IDS when set", async () => {
      process.env.SEED_MOVIE_IDS = "278,155";
      const config = await import("@/prisma/seed-config");
      const ids = config.getEffectiveMovieIds();
      expect(ids).toEqual([278, 155]);
    });

    it("SEED_MOVIE_IDS takes precedence over SEED_MOVIE_COUNT", async () => {
      process.env.SEED_MOVIE_IDS = "278,155";
      process.env.SEED_MOVIE_COUNT = "5";
      const config = await import("@/prisma/seed-config");
      const ids = config.getEffectiveMovieIds();
      expect(ids).toEqual([278, 155]);
    });

    it("SEED_ONLY_SHOWS still takes precedence over SEED_MOVIE_IDS", async () => {
      process.env.SEED_MOVIE_IDS = "278,155";
      process.env.SEED_ONLY_SHOWS = "true";
      const config = await import("@/prisma/seed-config");
      const ids = config.getEffectiveMovieIds();
      expect(ids).toHaveLength(0);
    });
  });

  describe("SEED_SHOW_IDS", () => {
    it("defaults to null when not set", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.SEED_SHOW_IDS).toBe(null);
    });

    it("parses comma-separated show IDs", async () => {
      process.env.SEED_SHOW_IDS = "1396,71912";
      const config = await import("@/prisma/seed-config");
      expect(config.SEED_SHOW_IDS).toEqual([1396, 71912]);
    });

    it("getEffectiveTVShowIds uses SEED_SHOW_IDS when set", async () => {
      process.env.SEED_SHOW_IDS = "1396,71912";
      const config = await import("@/prisma/seed-config");
      const ids = config.getEffectiveTVShowIds();
      expect(ids).toEqual([1396, 71912]);
    });

    it("SEED_SHOW_IDS takes precedence over SEED_SHOW_COUNT", async () => {
      process.env.SEED_SHOW_IDS = "1396";
      process.env.SEED_SHOW_COUNT = "5";
      const config = await import("@/prisma/seed-config");
      const ids = config.getEffectiveTVShowIds();
      expect(ids).toEqual([1396]);
    });

    it("SEED_ONLY_MOVIES still takes precedence over SEED_SHOW_IDS", async () => {
      process.env.SEED_SHOW_IDS = "1396,71912";
      process.env.SEED_ONLY_MOVIES = "true";
      const config = await import("@/prisma/seed-config");
      const ids = config.getEffectiveTVShowIds();
      expect(ids).toHaveLength(0);
    });
  });

  describe("USER_CONTENT_DISTRIBUTION uniqueness", () => {
    it("has no overlapping movie IDs between users", async () => {
      const config = await import("@/prisma/seed-config");
      const seen = new Set<number>();
      const duplicates: number[] = [];

      Object.values(config.USER_CONTENT_DISTRIBUTION).forEach((userConfig) => {
        userConfig.movieIds.forEach((id) => {
          if (seen.has(id)) {
            duplicates.push(id);
          }
          seen.add(id);
        });
      });

      expect(duplicates).toEqual([]);
    });

    it("has no overlapping show IDs between users", async () => {
      const config = await import("@/prisma/seed-config");
      const seen = new Set<number>();
      const duplicates: number[] = [];

      Object.values(config.USER_CONTENT_DISTRIBUTION).forEach((userConfig) => {
        userConfig.showIds.forEach((id) => {
          if (seen.has(id)) {
            duplicates.push(id);
          }
          seen.add(id);
        });
      });

      expect(duplicates).toEqual([]);
    });

    it("all user movie IDs exist in MOVIE_IDS", async () => {
      const config = await import("@/prisma/seed-config");
      const movieIdSet = new Set(config.MOVIE_IDS);
      const missingIds: number[] = [];

      Object.values(config.USER_CONTENT_DISTRIBUTION).forEach((userConfig) => {
        userConfig.movieIds.forEach((id) => {
          if (!movieIdSet.has(id)) {
            missingIds.push(id);
          }
        });
      });

      expect(missingIds).toEqual([]);
    });

    it("all user show IDs exist in TV_SHOW_IDS", async () => {
      const config = await import("@/prisma/seed-config");
      const showIdSet = new Set(config.TV_SHOW_IDS);
      const missingIds: number[] = [];

      Object.values(config.USER_CONTENT_DISTRIBUTION).forEach((userConfig) => {
        userConfig.showIds.forEach((id) => {
          if (!showIdSet.has(id)) {
            missingIds.push(id);
          }
        });
      });

      expect(missingIds).toEqual([]);
    });

    it("test user has empty content arrays", async () => {
      const config = await import("@/prisma/seed-config");
      const testConfig = config.USER_CONTENT_DISTRIBUTION["test@canoncore.com"];

      expect(testConfig.movieIds).toEqual([]);
      expect(testConfig.showIds).toEqual([]);
    });

    it("validateContentDistribution does not throw for valid config", async () => {
      const config = await import("@/prisma/seed-config");
      expect(() => config.validateContentDistribution()).not.toThrow();
    });
  });
});
