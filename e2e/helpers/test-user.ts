/**
 * Test user utilities and constants.
 */

export const TEST_PASSWORD = "TestPassword123!";
export const WEAK_PASSWORD = "weak";
export const INVALID_EMAIL = "not-an-email";

/**
 * E2E Drive test user credentials.
 * This user is created by `pnpm run setup:e2e-drive` with pre-synced Drive content.
 */
export const E2E_DRIVE_USER_EMAIL = "e2e-drive-test@canoncore.test";
export const E2E_DRIVE_USER_PASSWORD = "TestPassword123";

/**
 * Generates a unique email for testing.
 * Combines timestamp + random string to avoid collisions in parallel execution.
 */
export function generateUniqueEmail(prefix = "test"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@example.com`;
}

/**
 * Generates a unique username for testing.
 * Uses timestamp base36 + random chars to stay within username limits (3-20 chars)
 * while avoiding collisions in parallel test execution.
 */
export function generateUniqueUsername(prefix = "tu"): string {
  // Convert timestamp to base36 for shorter string, take last 8 chars
  const timestampBase36 = Date.now().toString(36).slice(-8);
  // Add 4 random chars for collision resistance
  const random = Math.random().toString(36).substring(2, 6);
  // Result: prefix (2) + timestamp (8) + random (4) = 14 chars max
  return `${prefix}${timestampBase36}${random}`;
}

/**
 * Generates a complete test user object with username.
 */
export function generateTestUserData() {
  return {
    email: generateUniqueEmail(),
    password: TEST_PASSWORD,
    username: generateUniqueUsername(),
  };
}

/**
 * Common test data for validation testing.
 */
export const ValidationTestData = {
  emptyEmail: "",
  emptyPassword: "",
  invalidEmail: INVALID_EMAIL,
  shortPassword: WEAK_PASSWORD,
  mismatchedPassword: "DifferentPassword123!",
} as const;
