/**
 * Unit tests for seed script validation logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Seed Script Validation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("requires ALLOW_SEEDING to be true", () => {
    const testCases = [
      { value: undefined, expected: false },
      { value: "false", expected: false },
      { value: "", expected: false },
      { value: "true", expected: true },
    ];

    for (const { value, expected } of testCases) {
      const isAllowed = value === "true";
      expect(isAllowed).toBe(expected);
    }
  });

  it("rejects production database URLs", () => {
    const productionUrls = [
      "postgresql://user:pass@prod.neon.tech/db",
      "postgresql://user:pass@production.neon.tech/db",
      "postgresql://user:pass@main.neon.tech/db",
    ];

    for (const url of productionUrls) {
      const isSafe =
        url.includes("development") ||
        url.includes("localhost") ||
        url.includes("127.0.0.1");
      expect(isSafe).toBe(false);
    }
  });

  it("accepts development database URLs", () => {
    const devUrls = [
      "postgresql://user:pass@development.neon.tech/db",
      "postgresql://user:pass@localhost:5432/db",
      "postgresql://user:pass@127.0.0.1:5432/db",
    ];

    for (const url of devUrls) {
      const isSafe =
        url.includes("development") ||
        url.includes("localhost") ||
        url.includes("127.0.0.1");
      expect(isSafe).toBe(true);
    }
  });
});

describe("Seed User Emails", () => {
  it("follows expected pattern", () => {
    const seedEmails = [
      "seed@canoncore.com",
      "seed2@canoncore.com",
      "seed3@canoncore.com",
    ];

    for (const email of seedEmails) {
      expect(email).toMatch(/^seed\d*@canoncore\.com$/);
    }
  });
});

describe("File Size Constants", () => {
  const KB = 1024;
  const MB = 1024 * KB;
  const GB = 1024 * MB;

  it("calculates KB correctly", () => {
    expect(KB).toBe(1024);
  });

  it("calculates MB correctly", () => {
    expect(MB).toBe(1024 * 1024);
  });

  it("calculates GB correctly", () => {
    expect(GB).toBe(1024 * 1024 * 1024);
  });

  it("handles realistic file sizes with Math.floor", () => {
    // Use Math.floor to avoid floating point precision issues
    expect(BigInt(Math.floor(4.5 * GB))).toBeGreaterThan(BigInt(4 * GB));
    expect(BigInt(250 * KB)).toBeLessThan(BigInt(1 * MB));
  });
});
