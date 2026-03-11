/**
 * Unit tests for AES-256-GCM credential encryption.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("crypto", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Valid 32-byte key encoded as base64 ("testkeythatis32byteslongXXXXXXXX")
    process.env.ENCRYPTION_KEY = "dGVzdGtleXRoYXRpczMyYnl0ZXNsb25nWFhYWFhYWFg=";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("encryptCredential", () => {
    it("encrypts plaintext to base64 string", async () => {
      const { encryptCredential } = await import("@/lib/crypto");
      const encrypted = encryptCredential("my-secret-password");
      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe("my-secret-password");
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it("produces different output for same input (random IV)", async () => {
      const { encryptCredential } = await import("@/lib/crypto");
      const encrypted1 = encryptCredential("password");
      const encrypted2 = encryptCredential("password");
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe("decryptCredential", () => {
    it("decrypts back to original plaintext", async () => {
      const { encryptCredential, decryptCredential } =
        await import("@/lib/crypto");
      const original = "my-secret-password";
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });

    it("handles special characters", async () => {
      const { encryptCredential, decryptCredential } =
        await import("@/lib/crypto");
      const original = "p@$$w0rd!#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = encryptCredential(original);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(original);
    });

    it("throws on tampered ciphertext", async () => {
      const { encryptCredential, decryptCredential } =
        await import("@/lib/crypto");
      const encrypted = encryptCredential("password");
      const tampered = encrypted.slice(0, -4) + "XXXX";
      expect(() => decryptCredential(tampered)).toThrow();
    });
  });

  describe("missing ENCRYPTION_KEY", () => {
    it("throws when key is not set", async () => {
      delete process.env.ENCRYPTION_KEY;
      vi.resetModules();
      const { encryptCredential } = await import("@/lib/crypto");
      expect(() => encryptCredential("test")).toThrow(
        "ENCRYPTION_KEY environment variable is required"
      );
    });
  });
});
