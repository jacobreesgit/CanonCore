/**
 * Test data generation utilities for E2E tests.
 * Provides collision-free identifiers and common test constants.
 */
import { randomUUID } from "crypto";

/** Default test password meeting validation requirements (8+ chars, uppercase, lowercase, number). */
export const TEST_PASSWORD = "TestPassword123!";

/** E2E Drive test user credentials (pre-created by setup:e2e-drive). */
export const E2E_DRIVE_USER = {
  email: "e2e-drive-test@canoncore.test",
  password: "TestPassword123",
} as const;

/** Seed user credentials (pre-seeded in E2E database). */
export const SEED_USERS = {
  demo: {
    email: "demo@canoncore.com",
    username: "demo",
    password: "SeedPassword123!",
  },
  filmfan: {
    email: "filmfan@canoncore.com",
    username: "filmfan",
    password: "SeedPassword123!",
  },
  testuser: {
    email: "test@canoncore.com",
    username: "testuser",
    password: "SeedPassword123!",
  },
} as const;

/**
 * Generates a collision-free test identifier.
 * Uses UUID prefix for uniqueness across parallel workers.
 *
 * @param prefix - Human-readable prefix (e.g., "movie", "folder")
 * @returns Unique identifier like "movie-a1b2c3d4"
 */
export function testId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/**
 * Generates a unique test email.
 *
 * @param prefix - Optional prefix (default: "test")
 * @returns Unique email like "test-a1b2c3d4@example.com"
 */
export function testEmail(prefix = "test"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

/**
 * Generates a unique test username within the 3-20 char limit.
 *
 * @returns Unique username like "tu_a1b2c3d4"
 */
export function testUsername(): string {
  return `tu_${randomUUID().slice(0, 8)}`;
}

/**
 * Generates a complete test user object.
 */
export function testUser() {
  return {
    email: testEmail(),
    password: TEST_PASSWORD,
    username: testUsername(),
  };
}
