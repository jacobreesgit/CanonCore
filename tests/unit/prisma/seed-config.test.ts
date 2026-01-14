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
});
