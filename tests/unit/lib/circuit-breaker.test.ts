/**
 * Unit tests for circuit breaker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker, CircuitBreakerOpen } from "@/lib/circuit-breaker";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in closed state", () => {
    expect(breaker.getState()).toBe("closed");
  });

  it("executes function when closed", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await breaker.execute(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalled();
  });

  it("opens after failure threshold", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // First 3 failures
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow("fail");
    }

    // Circuit should be open
    expect(breaker.getState()).toBe("open");
  });

  it("rejects immediately when open", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow("fail");
    }

    // Reset mock to track new calls
    fn.mockClear();

    // Should reject without calling fn
    await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpen);
    expect(fn).not.toHaveBeenCalled();
  });

  it("transitions to half-open after timeout", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow("fail");
    }

    expect(breaker.getState()).toBe("open");

    // Advance time past reset timeout
    vi.advanceTimersByTime(30001);

    expect(breaker.getState()).toBe("half-open");
  });

  it("closes after successful call in half-open", async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error("fail"));
    const successFn = vi.fn().mockResolvedValue("success");

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingFn)).rejects.toThrow("fail");
    }

    // Advance to half-open
    vi.advanceTimersByTime(30001);
    expect(breaker.getState()).toBe("half-open");

    // Successful call should close
    await breaker.execute(successFn);
    expect(breaker.getState()).toBe("closed");
  });

  it("re-opens after failure in half-open", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toThrow("fail");
    }

    // Advance to half-open
    vi.advanceTimersByTime(30001);
    expect(breaker.getState()).toBe("half-open");

    // Failure should re-open
    await expect(breaker.execute(fn)).rejects.toThrow("fail");
    expect(breaker.getState()).toBe("open");
  });
});
