/**
 * Circuit breaker for resilient external service calls.
 * Prevents cascade failures by failing fast when a service is unhealthy.
 */

import { logger } from "@/lib/logger";

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerOptions {
  /** Number of failures before opening circuit. */
  failureThreshold: number;
  /** Time in ms before attempting recovery. */
  resetTimeout: number;
  /** Optional name for logging. */
  name?: string;
}

/**
 * Error thrown when circuit breaker is open.
 */
export class CircuitBreakerOpen extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is open`);
    this.name = "CircuitBreakerOpen";
  }
}

/**
 * Circuit breaker implementation.
 * States: closed (normal) → open (failing fast) → half-open (testing recovery)
 *
 * @example
 * const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 30000 });
 * const result = await breaker.execute(() => fetchData());
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailureTime = 0;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      name: "default",
      ...options,
    };
  }

  /**
   * Gets the current circuit state.
   *
   * @returns Current state: closed, open, or half-open
   */
  getState(): CircuitState {
    if (this.state === "open") {
      // Check if we should transition to half-open
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure > this.options.resetTimeout) {
        this.state = "half-open";
        logger.info(
          { breaker: this.options.name },
          "Circuit breaker transitioned to half-open"
        );
      }
    }
    return this.state;
  }

  /**
   * Executes a function with circuit breaker protection.
   *
   * @param fn - Function to execute
   * @returns Result of the function
   * @throws CircuitBreakerOpen when circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === "open") {
      throw new CircuitBreakerOpen(this.options.name);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "half-open") {
      logger.info(
        { breaker: this.options.name },
        "Circuit breaker closed after successful test"
      );
    }
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "half-open") {
      // Any failure in half-open reopens the circuit
      this.state = "open";
      logger.warn(
        { breaker: this.options.name },
        "Circuit breaker re-opened after failure in half-open"
      );
    } else if (this.failures >= this.options.failureThreshold) {
      this.state = "open";
      logger.warn(
        { breaker: this.options.name, failures: this.failures },
        "Circuit breaker opened after threshold reached"
      );
    }
  }
}
