/**
 * Unit tests for seed configuration.
 * Tests data integrity and validation of seed config.
 */

import { describe, it, expect } from "vitest";

describe("seed-config", () => {
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

  describe("exports", () => {
    it("exports required constants", async () => {
      const config = await import("@/prisma/seed-config");

      expect(config.MOVIE_IDS).toBeDefined();
      expect(Array.isArray(config.MOVIE_IDS)).toBe(true);
      expect(config.MOVIE_IDS.length).toBeGreaterThan(0);

      expect(config.TV_SHOW_IDS).toBeDefined();
      expect(Array.isArray(config.TV_SHOW_IDS)).toBe(true);
      expect(config.TV_SHOW_IDS.length).toBeGreaterThan(0);

      expect(config.SEED_USERS).toBeDefined();
      expect(config.SEED_USERS.length).toBeGreaterThanOrEqual(1);
      expect(config.SEED_USERS[0]).toHaveProperty("email");
      expect(config.SEED_USERS[0]).toHaveProperty("name");

      expect(config.DEFAULT_SEED_PASSWORD).toBeDefined();
      expect(typeof config.DEFAULT_SEED_PASSWORD).toBe("string");

      expect(config.SEED_DRIVE_FOLDER_NAME).toBeDefined();
    });

    it("exports hierarchy configuration constants", async () => {
      const config = await import("@/prisma/seed-config");

      expect(config.MAX_SEASONS).toBe(5);
      expect(config.MAX_EPISODES).toBe(10);
      expect(config.TMDB_API_DELAY_MS).toBe(100);
    });

    it("has valid TMDB movie IDs", async () => {
      const { MOVIE_IDS } = await import("@/prisma/seed-config");

      for (const id of MOVIE_IDS) {
        expect(typeof id).toBe("number");
        expect(id).toBeGreaterThan(0);
      }
    });

    it("has valid TMDB TV show IDs", async () => {
      const { TV_SHOW_IDS } = await import("@/prisma/seed-config");

      for (const id of TV_SHOW_IDS) {
        expect(typeof id).toBe("number");
        expect(id).toBeGreaterThan(0);
      }
    });

    it("has valid seed user emails", async () => {
      const { SEED_USERS } = await import("@/prisma/seed-config");

      for (const user of SEED_USERS) {
        expect(user.email).toMatch(/@/);
        expect(user.name.length).toBeGreaterThan(0);
      }
    });

    it("exports playback duration config", async () => {
      const config = await import("@/prisma/seed-config");

      expect(config.PLAYBACK_DURATIONS).toBeDefined();
      expect(config.PLAYBACK_DURATIONS.movie).toBeDefined();
      expect(config.PLAYBACK_DURATIONS.episode).toBeDefined();

      // Movie duration should be 1.5-3 hours (5400-10800 seconds)
      expect(config.PLAYBACK_DURATIONS.movie.min).toBe(5400);
      expect(config.PLAYBACK_DURATIONS.movie.max).toBe(10800);

      // Episode duration should be 30-70 minutes (1800-4200 seconds)
      expect(config.PLAYBACK_DURATIONS.episode.min).toBe(1800);
      expect(config.PLAYBACK_DURATIONS.episode.max).toBe(4200);
    });
  });

  describe("user content helpers", () => {
    it("getMovieIdsForUser returns correct IDs for demo user", async () => {
      const config = await import("@/prisma/seed-config");
      const movieIds = config.getMovieIdsForUser("demo@canoncore.com");

      expect(Array.isArray(movieIds)).toBe(true);
      expect(movieIds.length).toBeGreaterThan(0);
    });

    it("getMovieIdsForUser returns empty array for unknown user", async () => {
      const config = await import("@/prisma/seed-config");
      const movieIds = config.getMovieIdsForUser("unknown@example.com");

      expect(movieIds).toEqual([]);
    });

    it("getTVShowIdsForUser returns correct IDs for demo user", async () => {
      const config = await import("@/prisma/seed-config");
      const showIds = config.getTVShowIdsForUser("demo@canoncore.com");

      expect(Array.isArray(showIds)).toBe(true);
      expect(showIds.length).toBeGreaterThan(0);
    });

    it("getTVShowIdsForUser returns empty array for unknown user", async () => {
      const config = await import("@/prisma/seed-config");
      const showIds = config.getTVShowIdsForUser("unknown@example.com");

      expect(showIds).toEqual([]);
    });
  });
});
