/**
 * Unit tests for SFTP path and filename utilities.
 */

import { describe, it, expect } from "vitest";
import { sanitizePath, validateFileName, withTimeout } from "@/lib/sftp-utils";

describe("sanitizePath", () => {
  it("joins base and user paths correctly", () => {
    expect(sanitizePath("/home/user", "docs/file.txt")).toBe(
      "/home/user/docs/file.txt"
    );
  });

  it("handles leading slashes in user path", () => {
    expect(sanitizePath("/home/user", "/docs/file.txt")).toBe(
      "/home/user/docs/file.txt"
    );
  });

  it("handles trailing slashes in base path", () => {
    expect(sanitizePath("/home/user/", "docs")).toBe("/home/user/docs");
  });

  it("removes . segments", () => {
    expect(sanitizePath("/home/user", "./docs/./file.txt")).toBe(
      "/home/user/docs/file.txt"
    );
  });

  it("throws on .. traversal attempts", () => {
    expect(() => sanitizePath("/home/user", "../etc/passwd")).toThrow(
      "Path traversal not allowed"
    );
  });

  it("throws on embedded .. traversal", () => {
    expect(() => sanitizePath("/home/user", "docs/../../../etc")).toThrow(
      "Path traversal not allowed"
    );
  });

  it("handles root base path", () => {
    expect(sanitizePath("/", "uploads/file.txt")).toBe("/uploads/file.txt");
  });

  it("normalizes multiple slashes", () => {
    expect(sanitizePath("/home//user", "docs///file.txt")).toBe(
      "/home/user/docs/file.txt"
    );
  });
});

describe("validateFileName", () => {
  it("accepts valid filenames", () => {
    expect(() => validateFileName("document.pdf")).not.toThrow();
    expect(() => validateFileName("my-file_2024.txt")).not.toThrow();
    expect(() => validateFileName("file with spaces.doc")).not.toThrow();
  });

  it("rejects filenames with invalid characters", () => {
    expect(() => validateFileName("file<name>.txt")).toThrow(
      "Filename contains invalid characters"
    );
    expect(() => validateFileName("file:name.txt")).toThrow();
    expect(() => validateFileName('file"name.txt')).toThrow();
    expect(() => validateFileName("file|name.txt")).toThrow();
    expect(() => validateFileName("file?name.txt")).toThrow();
    expect(() => validateFileName("file*name.txt")).toThrow();
  });

  it("rejects . and ..", () => {
    expect(() => validateFileName(".")).toThrow("Invalid filename");
    expect(() => validateFileName("..")).toThrow("Invalid filename");
  });

  it("rejects filenames over 255 characters", () => {
    const longName = "a".repeat(256);
    expect(() => validateFileName(longName)).toThrow("Filename too long");
  });

  it("accepts 255 character filename", () => {
    const maxName = "a".repeat(255);
    expect(() => validateFileName(maxName)).not.toThrow();
  });
});

describe("withTimeout", () => {
  it("resolves when promise completes in time", async () => {
    const fastPromise = Promise.resolve("success");
    const result = await withTimeout(fastPromise, 1000, "test operation");
    expect(result).toBe("success");
  });

  it("rejects when promise times out", async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(
      withTimeout(slowPromise, 100, "slow operation")
    ).rejects.toThrow("slow operation timed out after 100ms");
  });

  it("passes through promise rejections", async () => {
    const failingPromise = Promise.reject(new Error("original error"));
    await expect(withTimeout(failingPromise, 1000, "test")).rejects.toThrow(
      "original error"
    );
  });
});
