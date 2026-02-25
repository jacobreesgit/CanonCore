/**
 * Integration tests for schema migration safety.
 * Verifies that prisma migrate deploy is idempotent (safe to run multiple times).
 */

import { execSync } from "child_process";
import { describe, it, expect } from "vitest";

describe("schema migration idempotency", () => {
  it("prisma migrate deploy succeeds when run twice consecutively", () => {
    // First run — apply any pending migrations
    const firstRun = execSync("npx prisma migrate deploy", {
      encoding: "utf-8",
      env: { ...process.env },
      timeout: 60_000,
    });
    expect(firstRun).toBeDefined();

    // Second run — should succeed with "no pending migrations"
    const secondRun = execSync("npx prisma migrate deploy", {
      encoding: "utf-8",
      env: { ...process.env },
      timeout: 60_000,
    });
    expect(secondRun).toBeDefined();
    // Prisma outputs "No pending migrations to apply." when up-to-date
    expect(secondRun).toContain("No pending migrations");
  });
});
