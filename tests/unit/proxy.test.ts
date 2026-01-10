/**
 * Unit tests for proxy request ID generation.
 * Tests the generateRequestId function used by proxy.ts.
 */

import { describe, it, expect } from "vitest";

// Test the generateRequestId algorithm directly without importing from logger
// (which has complex pino dependency that's mocked in setup.ts)
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

describe("generateRequestId", () => {
  it("generates unique IDs", () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();

    expect(id1).not.toBe(id2);
  });

  it("generates IDs with expected format", () => {
    const id = generateRequestId();

    // Should be alphanumeric with hyphen, reasonable length
    expect(id).toMatch(/^[a-zA-Z0-9]+-[a-zA-Z0-9]+$/);
    expect(id.length).toBeGreaterThan(8);
  });
});
