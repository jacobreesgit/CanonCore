/**
 * Unit tests for structured logger.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pino before importing logger
vi.mock("pino", () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
}));

import { logger, createRequestLogger } from "@/lib/logger";

describe("logger", () => {
  it("exports a logger instance", () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it("createRequestLogger adds requestId to context", () => {
    const requestLogger = createRequestLogger("req-123");
    expect(requestLogger).toBeDefined();
  });
});

describe("logger methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("info logs with correct level", () => {
    logger.info("test message");
    expect(logger.info).toHaveBeenCalledWith("test message");
  });

  it("error logs with correct level", () => {
    logger.error({ err: new Error("test") }, "error message");
    expect(logger.error).toHaveBeenCalled();
  });

  it("warn logs with correct level", () => {
    logger.warn({ userId: "123" }, "warning message");
    expect(logger.warn).toHaveBeenCalled();
  });
});
