/**
 * Integration tests for SFTP circuit breaker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker, CircuitBreakerOpen } from "@/lib/circuit-breaker";

describe("SFTP Circuit Breaker Integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prevents rapid reconnection attempts after failures", async () => {
    const breaker = new CircuitBreaker({
      name: "sftp-test",
      failureThreshold: 3,
      resetTimeout: 1000,
    });

    const connectAttempts: number[] = [];
    const failingConnect = async () => {
      connectAttempts.push(Date.now());
      throw new Error("Connection refused");
    };

    // First 3 attempts go through
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingConnect)).rejects.toThrow(
        "Connection refused"
      );
    }

    expect(connectAttempts).toHaveLength(3);

    // Circuit is now open - should fail fast without connecting
    const attemptsBefore = connectAttempts.length;
    await expect(breaker.execute(failingConnect)).rejects.toThrow(
      CircuitBreakerOpen
    );
    expect(connectAttempts.length).toBe(attemptsBefore); // No new attempt
  });

  it("recovers after timeout period", async () => {
    const breaker = new CircuitBreaker({
      name: "sftp-recovery",
      failureThreshold: 2,
      resetTimeout: 5000,
    });

    const failingFn = vi.fn().mockRejectedValue(new Error("fail"));
    const successFn = vi.fn().mockResolvedValue("connected");

    // Open the circuit
    await expect(breaker.execute(failingFn)).rejects.toThrow("fail");
    await expect(breaker.execute(failingFn)).rejects.toThrow("fail");
    expect(breaker.getState()).toBe("open");

    // Should be open now
    await expect(breaker.execute(successFn)).rejects.toThrow(
      CircuitBreakerOpen
    );

    // Advance time past reset timeout
    vi.advanceTimersByTime(5001);

    // Should be half-open now
    expect(breaker.getState()).toBe("half-open");

    // Success should close the circuit
    await breaker.execute(successFn);
    expect(breaker.getState()).toBe("closed");
  });
});
