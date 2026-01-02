/**
 * Unit tests for SFTP fixture functions.
 */

import { describe, it, expect } from "vitest";
import { getSftpConfigForWorker } from "../../../e2e/fixtures/sftp.fixture";

describe("getSftpConfigForWorker", () => {
  it("returns port 2222 for parallelIndex 0", () => {
    const config = getSftpConfigForWorker(0);
    expect(config.port).toBe(2222);
    expect(config.host).toBe("localhost");
    expect(config.username).toBe("testuser");
    expect(config.password).toBe("testpass");
    expect(config.basePath).toBe("/upload");
  });

  it("returns port 2223 for parallelIndex 1", () => {
    const config = getSftpConfigForWorker(1);
    expect(config.port).toBe(2223);
  });

  it("returns port 2225 for parallelIndex 3", () => {
    const config = getSftpConfigForWorker(3);
    expect(config.port).toBe(2225);
  });

  it("returns port 2229 for parallelIndex 7 (max)", () => {
    const config = getSftpConfigForWorker(7);
    expect(config.port).toBe(2229);
  });

  it("throws for negative parallelIndex", () => {
    expect(() => getSftpConfigForWorker(-1)).toThrow(/Invalid parallelIndex/);
  });

  it("throws for parallelIndex >= MAX_WORKERS (8)", () => {
    expect(() => getSftpConfigForWorker(8)).toThrow(/Invalid parallelIndex/);
  });

  it("throws for very large parallelIndex", () => {
    expect(() => getSftpConfigForWorker(100)).toThrow(/Invalid parallelIndex/);
  });

  it("error message includes valid range", () => {
    expect(() => getSftpConfigForWorker(10)).toThrow(/Must be 0-7/);
  });
});
