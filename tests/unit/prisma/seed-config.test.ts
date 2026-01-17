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

  it("parses SEED_SKIP_DRIVE flag", async () => {
    process.env.SEED_SKIP_DRIVE = "true";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_SKIP_DRIVE).toBe(true);
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
    expect(config.SEED_SKIP_DRIVE).toBe(false);
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

  describe("SEED_GROUPED_STRUCTURE", () => {
    it("defaults to true when not set", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.SEED_GROUPED_STRUCTURE).toBe(true);
    });

    it("parses SEED_GROUPED_STRUCTURE=false", async () => {
      process.env.SEED_GROUPED_STRUCTURE = "false";
      const config = await import("@/prisma/seed-config");
      expect(config.SEED_GROUPED_STRUCTURE).toBe(false);
    });

    it("parses SEED_GROUPED_STRUCTURE=FALSE (case insensitive)", async () => {
      process.env.SEED_GROUPED_STRUCTURE = "FALSE";
      const config = await import("@/prisma/seed-config");
      expect(config.SEED_GROUPED_STRUCTURE).toBe(false);
    });

    it("treats any non-false value as true", async () => {
      process.env.SEED_GROUPED_STRUCTURE = "true";
      const config = await import("@/prisma/seed-config");
      expect(config.SEED_GROUPED_STRUCTURE).toBe(true);
    });
  });

  describe("Doctor Who constants and helpers", () => {
    it("exports CLASSIC_DOCTOR_WHO_ID", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.CLASSIC_DOCTOR_WHO_ID).toBe(121);
    });

    it("exports MODERN_DOCTOR_WHO_ID", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.MODERN_DOCTOR_WHO_ID).toBe(57243);
    });

    it("isClassicDoctorWho returns true for Classic Doctor Who ID", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.isClassicDoctorWho(121)).toBe(true);
    });

    it("isClassicDoctorWho returns false for Modern Doctor Who ID", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.isClassicDoctorWho(57243)).toBe(false);
    });

    it("isModernDoctorWho returns true for Modern Doctor Who ID", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.isModernDoctorWho(57243)).toBe(true);
    });

    it("isModernDoctorWho returns false for Classic Doctor Who ID", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.isModernDoctorWho(121)).toBe(false);
    });

    it("isDoctorWho returns true for Classic Doctor Who ID", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.isDoctorWho(121)).toBe(true);
    });

    it("isDoctorWho returns true for Modern Doctor Who ID", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.isDoctorWho(57243)).toBe(true);
    });

    it("isDoctorWho returns false for other shows", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.isDoctorWho(1396)).toBe(false); // Breaking Bad
      expect(config.isDoctorWho(1399)).toBe(false); // Game of Thrones
    });

    it("TV_SHOW_IDS includes both Doctor Who series", async () => {
      const config = await import("@/prisma/seed-config");
      expect(config.TV_SHOW_IDS).toContain(121); // Classic
      expect(config.TV_SHOW_IDS).toContain(57243); // Modern
    });
  });
});
