/**
 * Test user utilities and constants.
 */

export const TEST_PASSWORD = "TestPassword123!";
export const WEAK_PASSWORD = "weak";
export const INVALID_EMAIL = "not-an-email";

/**
 * Generates a unique email for testing.
 */
export function generateUniqueEmail(prefix = "test"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@example.com`;
}

/**
 * Generates a complete test user object.
 */
export function generateTestUserData() {
  return {
    email: generateUniqueEmail(),
    password: TEST_PASSWORD,
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
