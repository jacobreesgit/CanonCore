/**
 * E2E tests for security headers.
 * Verifies OWASP-recommended headers are present on all responses.
 */

import { test, expect } from "../../fixtures";

test.describe("Security Headers", () => {
  test("includes HSTS header", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers();

    expect(headers?.["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains; preload"
    );
  });

  test("includes CSP header", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers();

    expect(headers?.["content-security-policy"]).toBeDefined();
    expect(headers?.["content-security-policy"]).toContain(
      "default-src 'self'"
    );
  });

  test("includes X-Frame-Options header", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers();

    expect(headers?.["x-frame-options"]).toBe("DENY");
  });

  test("includes X-Content-Type-Options header", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers();

    expect(headers?.["x-content-type-options"]).toBe("nosniff");
  });
});
