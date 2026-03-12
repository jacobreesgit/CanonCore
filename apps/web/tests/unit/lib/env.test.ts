// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Run in node environment so t3-env treats this as server-side
// (jsdom defines `window`, which t3-env interprets as client).

describe("lib/env", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exports env object with validated properties", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
    vi.stubEnv("AUTH_SECRET", "test-secret");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "test@example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");

    const { env } = await import("@/lib/env");

    expect(env.DATABASE_URL).toBe("postgresql://test:test@localhost:5432/test");
    expect(env.AUTH_SECRET).toBe("test-secret");
    expect(env.RESEND_API_KEY).toBe("re_test_key");
    expect(env.UPSTASH_REDIS_REST_URL).toBe("https://test.upstash.io");
  });

  it("uses default EMAIL_FROM when not provided", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
    vi.stubEnv("AUTH_SECRET", "test-secret");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    // EMAIL_FROM intentionally not set

    const { env } = await import("@/lib/env");

    expect(env.EMAIL_FROM).toBe("noreply@canoncore.com");
  });

  it("allows optional vars to be undefined", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
    vi.stubEnv("AUTH_SECRET", "test-secret");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");
    // GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BYPASS_RATE_LIMIT not set

    const { env } = await import("@/lib/env");

    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(env.BYPASS_RATE_LIMIT).toBeUndefined();
  });

  it("throws when required DATABASE_URL is missing", async () => {
    // Stub to empty string — z.string().min(1) rejects it.
    // vi.stubEnv can't delete vars (CI sets them as job-level env),
    // so empty string simulates "missing" for validation purposes.
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_SECRET", "test-secret");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");

    await expect(() => import("@/lib/env")).rejects.toThrow();
  });

  it("throws when required AUTH_SECRET is missing", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
    // Stub to empty string — z.string().min(1) rejects it.
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv("ENCRYPTION_KEY", "test-encryption-key");

    await expect(() => import("@/lib/env")).rejects.toThrow();
  });
});
