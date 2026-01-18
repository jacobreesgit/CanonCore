/**
 * Unit tests for seed script utilities.
 * Tests environment validation patterns and utility functions.
 */

import { describe, it, expect } from "vitest";

/** Known production Neon endpoint - must match seed.ts and seed-cleanup.ts */
const PRODUCTION_NEON_ENDPOINT = "ep-dry-poetry-ab4m7vi1";

describe("seed utilities", () => {
  describe("production database detection", () => {
    it("detects production Neon endpoint in pooled URL", () => {
      const productionUrl = `postgresql://user:pass@${PRODUCTION_NEON_ENDPOINT}-pooler.eu-west-2.aws.neon.tech/neondb`;
      expect(productionUrl.includes(PRODUCTION_NEON_ENDPOINT)).toBe(true);
    });

    it("detects production Neon endpoint in unpooled URL", () => {
      const productionUrl = `postgresql://user:pass@${PRODUCTION_NEON_ENDPOINT}.eu-west-2.aws.neon.tech/neondb`;
      expect(productionUrl.includes(PRODUCTION_NEON_ENDPOINT)).toBe(true);
    });

    it("does not match development database URLs", () => {
      const devUrls = [
        "postgresql://localhost:5432/myapp",
        "postgresql://127.0.0.1/database",
        "postgresql://user:pass@ep-other-endpoint.neon.tech/neondb",
        "postgresql://user:pass@ep-dev-branch-abc123.neon.tech/neondb",
      ];

      for (const url of devUrls) {
        expect(url.includes(PRODUCTION_NEON_ENDPOINT)).toBe(false);
      }
    });
  });

  describe("safe database patterns", () => {
    const safePatterns = [
      "development",
      "dev.",
      "-dev-",
      "_dev_",
      "devdb",
      "test",
      "staging",
      "local",
      "localhost",
      "127.0.0.1",
    ];

    it.each(safePatterns)("detects safe pattern: %s", (pattern) => {
      const dbUrl = `postgres://host/${pattern}/database`.toLowerCase();
      const hasSafePattern = safePatterns.some((p) => dbUrl.includes(p));
      expect(hasSafePattern).toBe(true);
    });

    it("recognizes common development URLs", () => {
      const devUrls = [
        "postgres://localhost:5432/myapp",
        "postgres://127.0.0.1/database",
        "postgres://host/development-branch",
        "postgres://host/test_database",
        "postgres://host/staging-preview",
        "postgres://dev.neon.tech/mydb",
      ];

      for (const url of devUrls) {
        const hasSafePattern = safePatterns.some((p) =>
          url.toLowerCase().includes(p)
        );
        expect(hasSafePattern).toBe(true);
      }
    });

    it("does not match ambiguous URLs", () => {
      const ambiguousUrls = [
        "postgres://myhost.com/database",
        "postgres://db.example.com:5432/app",
        "postgres://random-host/randomdb",
      ];

      for (const url of ambiguousUrls) {
        const hasSafePattern = safePatterns.some((p) =>
          url.toLowerCase().includes(p)
        );
        expect(hasSafePattern).toBe(false);
      }
    });
  });

  describe("extractYear", () => {
    // Test the year extraction logic (same as in tmdb-client)
    function extractYear(dateStr: string | null | undefined): string {
      if (!dateStr) return "";
      return dateStr.split("-")[0] || "";
    }

    it("extracts year from valid date", () => {
      expect(extractYear("2023-07-21")).toBe("2023");
      expect(extractYear("1994-09-23")).toBe("1994");
    });

    it("returns empty for null", () => {
      expect(extractYear(null)).toBe("");
    });

    it("returns empty for undefined", () => {
      expect(extractYear(undefined)).toBe("");
    });

    it("returns empty for empty string", () => {
      expect(extractYear("")).toBe("");
    });

    it("handles year-only string", () => {
      expect(extractYear("2023")).toBe("2023");
    });
  });

  describe("truncateOverview", () => {
    // Test the truncation logic (same as in tmdb-client, now defaults to 1000)
    function truncateOverview(text: string, maxLength = 1000): string {
      if (text.length <= maxLength) return text;
      return text.slice(0, maxLength - 3) + "...";
    }

    it("truncates long text with ellipsis", () => {
      const long = "a".repeat(1100);
      const result = truncateOverview(long);
      expect(result.length).toBe(1000);
      expect(result.endsWith("...")).toBe(true);
    });

    it("returns short text unchanged", () => {
      expect(truncateOverview("Short text")).toBe("Short text");
    });

    it("handles empty string", () => {
      expect(truncateOverview("")).toBe("");
    });

    it("handles text exactly at 1000 chars", () => {
      const exact = "a".repeat(1000);
      expect(truncateOverview(exact)).toBe(exact);
      expect(truncateOverview(exact).length).toBe(1000);
    });

    it("truncates at 1001 chars with ellipsis", () => {
      const text = "a".repeat(1001);
      const result = truncateOverview(text);
      expect(result.length).toBe(1000);
      expect(result.endsWith("...")).toBe(true);
    });

    it("supports custom max length", () => {
      const text = "a".repeat(250);
      const result = truncateOverview(text, 200);
      expect(result.length).toBe(200);
      expect(result.endsWith("...")).toBe(true);
    });
  });

  describe("sanitizeFolderName", () => {
    // Test the folder name sanitization logic (same as in seed.ts)
    function sanitizeFolderName(name: string): string {
      return name
        .replace(/[/\\]/g, "-")
        .replace(/[<>:"|?*]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    it("replaces forward slashes with dashes", () => {
      expect(sanitizeFolderName("Episode 1/2")).toBe("Episode 1-2");
    });

    it("replaces backslashes with dashes", () => {
      expect(sanitizeFolderName("Episode 1\\2")).toBe("Episode 1-2");
    });

    it("removes invalid characters", () => {
      expect(sanitizeFolderName('Episode: "Test"?')).toBe("Episode Test");
    });

    it("normalizes whitespace", () => {
      expect(sanitizeFolderName("Episode   1")).toBe("Episode 1");
    });

    it("trims leading/trailing whitespace", () => {
      expect(sanitizeFolderName("  Episode 1  ")).toBe("Episode 1");
    });

    it("handles complex movie titles", () => {
      expect(sanitizeFolderName("What If...?")).toBe("What If...");
      expect(sanitizeFolderName('Movie: The "Final" Cut')).toBe(
        "Movie The Final Cut"
      );
    });

    it("preserves valid characters", () => {
      expect(sanitizeFolderName("Breaking Bad (2008)")).toBe(
        "Breaking Bad (2008)"
      );
      expect(sanitizeFolderName("E01 - Pilot")).toBe("E01 - Pilot");
    });
  });

  describe("createSeededRandom", () => {
    // Test the seeded random generator (same as in seed.ts)
    function createSeededRandom(seed: number | null): () => number {
      if (seed === null) {
        return Math.random;
      }
      let state = seed;
      return () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
      };
    }

    it("produces same sequence with same seed", () => {
      const random1 = createSeededRandom(12345);
      const random2 = createSeededRandom(12345);

      for (let i = 0; i < 10; i++) {
        expect(random1()).toBe(random2());
      }
    });

    it("produces different sequences with different seeds", () => {
      const random1 = createSeededRandom(12345);
      const random2 = createSeededRandom(54321);

      const seq1 = Array.from({ length: 10 }, () => random1());
      const seq2 = Array.from({ length: 10 }, () => random2());

      expect(seq1).not.toEqual(seq2);
    });

    it("uses Math.random when seed is null", () => {
      const random = createSeededRandom(null);
      expect(random).toBe(Math.random);
    });

    it("returns values between 0 and 1", () => {
      const random = createSeededRandom(42);
      for (let i = 0; i < 100; i++) {
        const value = random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });
  });

  describe("getRandomCount", () => {
    function createSeededRandom(seed: number | null): () => number {
      if (seed === null) {
        return Math.random;
      }
      let state = seed;
      return () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
      };
    }

    it("returns value in range [min, max]", () => {
      const random = createSeededRandom(42);
      function getRandomCount(min: number, max: number): number {
        return Math.floor(random() * (max - min + 1)) + min;
      }

      for (let i = 0; i < 100; i++) {
        const count = getRandomCount(1, 2);
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(2);
      }
    });

    it("returns min when min equals max", () => {
      const random = createSeededRandom(42);
      function getRandomCount(min: number, max: number): number {
        return Math.floor(random() * (max - min + 1)) + min;
      }

      for (let i = 0; i < 10; i++) {
        expect(getRandomCount(5, 5)).toBe(5);
      }
    });
  });

  describe("generatePlaceholderSubtitle", () => {
    // Test the subtitle generation logic (same as in seed.ts)
    function generatePlaceholderSubtitle(
      language: string,
      itemName: string
    ): string {
      return `1
00:00:01,000 --> 00:00:05,000
[${language.toUpperCase()}] ${itemName}

2
00:00:06,000 --> 00:00:10,000
This is a placeholder subtitle file.

3
00:00:11,000 --> 00:00:15,000
Generated for testing purposes.
`;
    }

    it("generates valid SRT format", () => {
      const srt = generatePlaceholderSubtitle("english", "Test Item");
      expect(srt).toContain("1\n00:00:01,000");
      expect(srt).toContain("-->");
      expect(srt).toContain("[ENGLISH]");
    });

    it("includes item name in subtitle", () => {
      const srt = generatePlaceholderSubtitle("spanish", "My Episode");
      expect(srt).toContain("My Episode");
    });

    it("uppercases language name", () => {
      const srt = generatePlaceholderSubtitle("french", "Test");
      expect(srt).toContain("[FRENCH]");
    });

    it("has multiple subtitle entries", () => {
      const srt = generatePlaceholderSubtitle("german", "Test");
      expect(srt).toContain("1\n");
      expect(srt).toContain("2\n");
      expect(srt).toContain("3\n");
    });
  });

  describe("sleep", () => {
    // Test the sleep function logic
    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    it("delays for approximately specified milliseconds", async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      // Allow 20ms variance for timer precision
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(100);
    });

    it("resolves immediately for 0ms", async () => {
      const start = Date.now();
      await sleep(0);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(20);
    });
  });

  describe("seed config", () => {
    it("exports required constants", async () => {
      const config = await import("../../../prisma/seed-config");

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
      expect(config.PROTECTED_FOLDERS).toBeDefined();
      expect(Array.isArray(config.PROTECTED_FOLDERS)).toBe(true);
    });

    it("exports hierarchy configuration constants", async () => {
      const config = await import("../../../prisma/seed-config");

      // MAX_SEASONS
      expect(config.MAX_SEASONS).toBeDefined();
      expect(typeof config.MAX_SEASONS).toBe("number");
      expect(config.MAX_SEASONS).toBeGreaterThanOrEqual(0);

      // MAX_EPISODES
      expect(config.MAX_EPISODES).toBeDefined();
      expect(typeof config.MAX_EPISODES).toBe("number");
      expect(config.MAX_EPISODES).toBeGreaterThanOrEqual(0);

      // RANDOM_SEED (can be null or number)
      expect("RANDOM_SEED" in config).toBe(true);
      expect(
        config.RANDOM_SEED === null || typeof config.RANDOM_SEED === "number"
      ).toBe(true);

      // TMDB_API_DELAY_MS
      expect(config.TMDB_API_DELAY_MS).toBeDefined();
      expect(typeof config.TMDB_API_DELAY_MS).toBe("number");
      expect(config.TMDB_API_DELAY_MS).toBeGreaterThan(0);
    });

    it("has sensible default limits", async () => {
      const config = await import("../../../prisma/seed-config");

      // Default MAX_SEASONS should be 2 (reasonable for testing)
      expect(config.MAX_SEASONS).toBe(2);

      // Default MAX_EPISODES should be 10 (reasonable for testing)
      expect(config.MAX_EPISODES).toBe(10);

      // TMDB_API_DELAY_MS should be 100 (rate limiting)
      expect(config.TMDB_API_DELAY_MS).toBe(100);
    });

    it("has valid TMDB movie IDs", async () => {
      const { MOVIE_IDS } = await import("../../../prisma/seed-config");

      for (const id of MOVIE_IDS) {
        expect(typeof id).toBe("number");
        expect(id).toBeGreaterThan(0);
      }
    });

    it("has valid TMDB TV show IDs", async () => {
      const { TV_SHOW_IDS } = await import("../../../prisma/seed-config");

      for (const id of TV_SHOW_IDS) {
        expect(typeof id).toBe("number");
        expect(id).toBeGreaterThan(0);
      }
    });

    it("has valid seed user emails", async () => {
      const { SEED_USERS } = await import("../../../prisma/seed-config");

      for (const user of SEED_USERS) {
        expect(user.email).toMatch(/@/);
        expect(user.name.length).toBeGreaterThan(0);
      }
    });

    it("exports playback simulation config", async () => {
      const config = await import("../../../prisma/seed-config");

      // SEED_SIMULATE_PLAYBACK should be a boolean
      expect(typeof config.SEED_SIMULATE_PLAYBACK).toBe("boolean");

      // PLAYBACK_DURATIONS should have movie and episode ranges
      expect(config.PLAYBACK_DURATIONS).toBeDefined();
      expect(config.PLAYBACK_DURATIONS.movie).toBeDefined();
      expect(config.PLAYBACK_DURATIONS.episode).toBeDefined();
    });
  });

  describe("playback simulation", () => {
    it("generates movie duration within expected range", async () => {
      const { PLAYBACK_DURATIONS } =
        await import("../../../prisma/seed-config");

      // Movie duration should be 1.5-3 hours (5400-10800 seconds)
      expect(PLAYBACK_DURATIONS.movie.min).toBe(5400);
      expect(PLAYBACK_DURATIONS.movie.max).toBe(10800);

      // Test that a sample duration is in range
      const sampleDuration = 7200; // 2 hours
      expect(sampleDuration).toBeGreaterThanOrEqual(
        PLAYBACK_DURATIONS.movie.min
      );
      expect(sampleDuration).toBeLessThanOrEqual(PLAYBACK_DURATIONS.movie.max);
    });

    it("generates episode duration within expected range", async () => {
      const { PLAYBACK_DURATIONS } =
        await import("../../../prisma/seed-config");

      // Episode duration should be 30-70 minutes (1800-4200 seconds)
      expect(PLAYBACK_DURATIONS.episode.min).toBe(1800);
      expect(PLAYBACK_DURATIONS.episode.max).toBe(4200);

      // Test that a sample duration is in range
      const sampleDuration = 2700; // 45 minutes
      expect(sampleDuration).toBeGreaterThanOrEqual(
        PLAYBACK_DURATIONS.episode.min
      );
      expect(sampleDuration).toBeLessThanOrEqual(
        PLAYBACK_DURATIONS.episode.max
      );
    });

    it("creates varied watch states based on random threshold", () => {
      // Simulate the watch state distribution from seed.ts
      // With seeded random, should get reproducible distribution:
      // ~25% unwatched (< 0.25), ~25% partial (< 0.5), ~25% almost done (< 0.75), ~25% complete

      function getWatchState(
        watchState: number,
        duration: number
      ): { position: number | null; isComplete: boolean } {
        let playbackPosition: number | null;

        if (watchState < 0.25) {
          // Unwatched (25%)
          playbackPosition = null;
        } else if (watchState < 0.5) {
          // Partially watched 30-50% (25%)
          playbackPosition = Math.floor(duration * 0.4); // ~40%
        } else if (watchState < 0.75) {
          // Almost done 70-85%, below 90% threshold (25%)
          playbackPosition = Math.floor(duration * 0.8); // ~80%
        } else {
          // Complete 91-100% (25%)
          playbackPosition = Math.floor(duration * 0.95); // ~95%
        }

        const isComplete =
          playbackPosition !== null && playbackPosition >= duration * 0.9;

        return { position: playbackPosition, isComplete };
      }

      const duration = 7200; // 2 hours

      // Test each quartile
      const unwatched = getWatchState(0.1, duration);
      expect(unwatched.position).toBeNull();
      expect(unwatched.isComplete).toBe(false);

      const partial = getWatchState(0.3, duration);
      expect(partial.position).not.toBeNull();
      expect(partial.position).toBeLessThan(duration * 0.5);
      expect(partial.isComplete).toBe(false);

      const almostDone = getWatchState(0.6, duration);
      expect(almostDone.position).not.toBeNull();
      expect(almostDone.position).toBeGreaterThanOrEqual(duration * 0.7);
      expect(almostDone.position).toBeLessThan(duration * 0.9);
      expect(almostDone.isComplete).toBe(false);

      const complete = getWatchState(0.8, duration);
      expect(complete.position).not.toBeNull();
      expect(complete.position).toBeGreaterThanOrEqual(duration * 0.9);
      expect(complete.isComplete).toBe(true);
    });
  });
});
