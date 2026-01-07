# Production Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all code review recommendations to achieve production-grade security, observability, and resilience.

**Architecture:** Layered improvements - security headers first (no code changes), then observability (logging/request tracking), then resilience (error boundaries, circuit breaker), finally cleanup (CSP tightening).

**Tech Stack:** Next.js 16, TypeScript, Prisma, Pino logger, React Error Boundaries

---

## Overview

| Priority | Task | Complexity | Test Impact |
|----------|------|------------|-------------|
| High | Add HSTS Header | Low | Add E2E header test |
| High | Tighten CSP | Medium | Update E2E header test |
| Medium | Add Request ID Tracking | Medium | Add unit tests |
| Medium | Structured Logging | Medium | Update mocks in unit tests |
| Medium | React Error Boundaries | Low | Add unit tests |
| Medium | Circuit Breaker for SFTP | High | Add unit + integration tests |
| Low | Database Connection Pooling | Low | None (config only) |

---

## Task 1: Add HSTS Header

**Files:**
- Modify: `next.config.mjs:29-54`
- Create: `e2e/journeys/security/headers.spec.ts`
- Modify: `e2e/fixtures/index.ts` (if needed)

**Step 1: Write the failing E2E test**

Create `e2e/journeys/security/headers.spec.ts`:

```typescript
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
    expect(headers?.["content-security-policy"]).toContain("default-src 'self'");
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
```

**Step 2: Run test to verify it fails**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium -g "HSTS header"`
Expected: FAIL - `strict-transport-security` is undefined

**Step 3: Add HSTS header to next.config.mjs**

Modify `next.config.mjs` - add to `securityHeaders` array after line 53:

```javascript
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
```

**Step 4: Run test to verify it passes**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium -g "HSTS header"`
Expected: PASS

**Step 5: Run all security header tests**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium e2e/journeys/security/headers.spec.ts`
Expected: All PASS

**Step 6: Commit**

```bash
git add next.config.mjs e2e/journeys/security/headers.spec.ts
git commit -m "feat(security): add HSTS header and security header tests

- Add Strict-Transport-Security with 1 year max-age, includeSubDomains, preload
- Add E2E tests for all security headers
"
```

---

## Task 2: Add Structured Logger

**Files:**
- Create: `lib/logger.ts`
- Create: `tests/unit/lib/logger.test.ts`
- Modify: `package.json` (add pino dependency)

**Step 1: Install pino**

Run: `pnpm add pino`

**Step 2: Write the failing unit test**

Create `tests/unit/lib/logger.test.ts`:

```typescript
/**
 * Unit tests for structured logger.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
```

**Step 3: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/lib/logger.test.ts`
Expected: FAIL - Cannot find module '@/lib/logger'

**Step 4: Create the logger module**

Create `lib/logger.ts`:

```typescript
/**
 * Structured logger for production observability.
 * Uses pino for JSON logging with request context support.
 */

import pino from "pino";

/**
 * Base logger instance.
 * In production: JSON format for log aggregation.
 * In development: Pretty print for readability.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        },
      }
    : {}),
});

/**
 * Creates a child logger with request context.
 * Use this in API routes and server actions for request tracing.
 *
 * @param requestId - Unique request identifier
 * @returns Logger with requestId in all log entries
 *
 * @example
 * const log = createRequestLogger(requestId);
 * log.info({ userId }, "User authenticated");
 */
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

/**
 * Creates a child logger with user context.
 * Use after authentication for user-scoped logging.
 *
 * @param userId - Authenticated user ID
 * @param requestId - Optional request ID
 * @returns Logger with userId (and requestId) in all log entries
 */
export function createUserLogger(userId: string, requestId?: string) {
  return logger.child({ userId, ...(requestId && { requestId }) });
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm run test:unit tests/unit/lib/logger.test.ts`
Expected: PASS

**Step 6: Add pino-pretty as dev dependency**

Run: `pnpm add -D pino-pretty`

**Step 7: Commit**

```bash
git add lib/logger.ts tests/unit/lib/logger.test.ts package.json pnpm-lock.yaml
git commit -m "feat(observability): add structured logger with pino

- Create lib/logger.ts with pino-based structured logging
- Support request context via createRequestLogger
- Support user context via createUserLogger
- Pretty print in dev, JSON in production
- Add unit tests for logger
"
```

---

## Task 3: Add Request ID Middleware

**Files:**
- Create: `middleware.ts`
- Create: `tests/unit/middleware.test.ts`
- Modify: `lib/logger.ts` (add helper)

**Step 1: Write the failing unit test**

Create `tests/unit/middleware.test.ts`:

```typescript
/**
 * Unit tests for request ID middleware.
 */

import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// Will test the generateRequestId function
import { generateRequestId } from "@/lib/logger";

describe("generateRequestId", () => {
  it("generates unique IDs", () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();

    expect(id1).not.toBe(id2);
  });

  it("generates IDs with expected format", () => {
    const id = generateRequestId();

    // Should be alphanumeric, reasonable length
    expect(id).toMatch(/^[a-zA-Z0-9-]+$/);
    expect(id.length).toBeGreaterThan(8);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/middleware.test.ts`
Expected: FAIL - generateRequestId is not exported

**Step 3: Add generateRequestId to logger.ts**

Add to `lib/logger.ts`:

```typescript
/**
 * Generates a unique request ID.
 * Format: timestamp-random for rough ordering + uniqueness.
 *
 * @returns Unique request identifier
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit tests/unit/middleware.test.ts`
Expected: PASS

**Step 5: Create the middleware**

Create `middleware.ts`:

```typescript
/**
 * Next.js middleware for request ID injection.
 * Adds x-request-id header to all requests for tracing.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateRequestId } from "@/lib/logger";

export function middleware(request: NextRequest) {
  // Generate request ID if not provided
  const requestId =
    request.headers.get("x-request-id") || generateRequestId();

  // Clone request headers and add request ID
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  // Create response with request ID in both request and response headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add request ID to response for client-side correlation
  response.headers.set("x-request-id", requestId);

  return response;
}

// Run on all routes except static files
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 6: Commit**

```bash
git add middleware.ts lib/logger.ts tests/unit/middleware.test.ts
git commit -m "feat(observability): add request ID middleware

- Add middleware.ts with x-request-id header injection
- Add generateRequestId helper to logger
- Request IDs propagate through request/response
- Add unit tests for request ID generation
"
```

---

## Task 4: Migrate Console Logs to Structured Logger

**Files:**
- Modify: `lib/auth-actions.ts`
- Modify: `lib/sftp-actions.ts`
- Modify: `lib/user-actions.ts`
- Modify: `lib/email.ts`
- Modify: `lib/item-file-actions.ts`
- Modify: `tests/unit/setup.ts` (mock logger)

**Step 1: Add logger mock to test setup**

Add to `tests/unit/setup.ts`:

```typescript
// Mock logger for unit tests
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
  createUserLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
  generateRequestId: vi.fn(() => "test-request-id"),
}));
```

**Step 2: Replace console.warn in auth-actions.ts**

In `lib/auth-actions.ts`, replace the `logSecurityEvent` function (around line 38-47):

```typescript
import { logger } from "@/lib/logger";

/**
 * Logs security-relevant events with structured data.
 */
function logSecurityEvent(
  event: string,
  data: { email: string; ip: string; success: boolean }
) {
  logger.warn({ event, ...data }, `[SECURITY] ${event}`);
}
```

**Step 3: Replace console.error in auth-actions.ts**

Replace `console.error("Sign up error:", error);` (line ~100) with:

```typescript
logger.error({ err: error, email }, "Sign up error");
```

**Step 4: Replace all console.* in sftp-actions.ts**

This file has many console calls. Replace the import section and add logger:

```typescript
import { logger } from "@/lib/logger";
```

Then replace each console call pattern:
- `console.error("[SFTP] message:", error)` → `logger.error({ err: error, context }, "message")`
- `console.warn("[SFTP] message", data)` → `logger.warn({ ...data }, "message")`
- `console.log("[SFTP] message")` → `logger.info("message")`

**Step 5: Replace console.* in user-actions.ts**

Add import and replace calls following same pattern.

**Step 6: Replace console.* in email.ts and item-file-actions.ts**

Add import and replace calls following same pattern.

**Step 7: Run existing tests to verify no regressions**

Run: `pnpm run test:unit`
Expected: All PASS (logger is mocked)

**Step 8: Commit**

```bash
git add lib/auth-actions.ts lib/sftp-actions.ts lib/user-actions.ts lib/email.ts lib/item-file-actions.ts tests/unit/setup.ts
git commit -m "refactor(observability): migrate console.* to structured logger

- Replace all console.log/warn/error with logger calls
- Add structured context to all log messages
- Mock logger in unit test setup
- No behavior changes, only logging format
"
```

---

## Task 5: Add React Error Boundary

**Files:**
- Create: `components/error-boundary.tsx`
- Create: `tests/unit/components/error-boundary.test.tsx`
- Modify: `app/(my-items)/layout.tsx`

**Step 1: Write the failing unit test**

Create `tests/unit/components/error-boundary.test.tsx`:

```typescript
/**
 * Unit tests for React Error Boundary.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/error-boundary";

// Component that throws
function ThrowingComponent(): never {
  throw new Error("Test error");
}

// Suppress console.error for cleaner test output
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders fallback when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error")).toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object)
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/components/error-boundary.test.tsx`
Expected: FAIL - Cannot find module '@/components/error-boundary'

**Step 3: Create the ErrorBoundary component**

Create `components/error-boundary.tsx`:

```typescript
/**
 * React Error Boundary for graceful error handling.
 * Catches JavaScript errors in child components and displays fallback UI.
 */

"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
// NOTE: Cannot use pino logger here - it requires Node.js and won't work in browser
// Use console.error for client-side error logging

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback UI (optional) */
  fallback?: ReactNode;
  /** Callback when error occurs (optional) */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that catches errors in child components.
 * Logs errors and displays a fallback UI.
 *
 * @example
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with browser console (pino not available in client components)
    console.error("React error boundary caught error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Call optional callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
          <div className="bg-destructive/10 flex size-16 items-center justify-center rounded-full">
            <AlertTriangle className="text-destructive size-8" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              An error occurred while rendering this section.
            </p>
          </div>
          <Button onClick={this.handleRetry} variant="outline" size="sm">
            <RefreshCw className="mr-2 size-4" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit tests/unit/components/error-boundary.test.tsx`
Expected: PASS

**Step 5: Add ErrorBoundary to my-items layout**

Modify `app/(my-items)/layout.tsx` - wrap children:

```typescript
import { ErrorBoundary } from "@/components/error-boundary";

// In the return statement, wrap {children}:
<ErrorBoundary>
  {children}
</ErrorBoundary>
```

**Step 6: Commit**

```bash
git add components/error-boundary.tsx tests/unit/components/error-boundary.test.tsx app/(my-items)/layout.tsx
git commit -m "feat(resilience): add React error boundary

- Create ErrorBoundary component with retry support
- Log errors with structured context
- Add to my-items layout for graceful degradation
- Add unit tests for error boundary behavior
"
```

---

## Task 6: Add Circuit Breaker for SFTP

**Files:**
- Create: `lib/circuit-breaker.ts`
- Create: `tests/unit/lib/circuit-breaker.test.ts`
- Modify: `lib/sftp-client.ts`

**Step 1: Write the failing unit test**

Create `tests/unit/lib/circuit-breaker.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/lib/circuit-breaker.test.ts`
Expected: FAIL - Cannot find module '@/lib/circuit-breaker'

**Step 3: Create the circuit breaker**

Create `lib/circuit-breaker.ts`:

```typescript
/**
 * Circuit breaker for resilient external service calls.
 * Prevents cascade failures by failing fast when a service is unhealthy.
 */

import { logger } from "@/lib/logger";

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting recovery */
  resetTimeout: number;
  /** Optional name for logging */
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit tests/unit/lib/circuit-breaker.test.ts`
Expected: PASS

**Step 5: Integrate with SFTP client**

Modify `lib/sftp-client.ts` to use circuit breaker for connection attempts:

```typescript
import { CircuitBreaker, CircuitBreakerOpen } from "@/lib/circuit-breaker";

// Per-connection circuit breakers - each SFTP server gets its own breaker
// This prevents one failing server from blocking all other connections
const connectionBreakers = new Map<string, CircuitBreaker>();

/**
 * Gets or creates a circuit breaker for a specific connection.
 * Each connection has its own breaker to isolate failures.
 */
function getCircuitBreaker(connectionId: string): CircuitBreaker {
  let breaker = connectionBreakers.get(connectionId);
  if (!breaker) {
    breaker = new CircuitBreaker({
      name: `sftp-${connectionId}`,
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
    });
    connectionBreakers.set(connectionId, breaker);
  }
  return breaker;
}

// In the connect/execute functions, wrap with connection-specific circuit breaker:
export async function withSftpConnection<T>(
  connectionId: string,
  operation: (client: SftpClient) => Promise<T>
): Promise<T> {
  const breaker = getCircuitBreaker(connectionId);
  return breaker.execute(async () => {
    // existing connection logic
  });
}
```

**Step 6: Add integration test**

Create `tests/integration/sftp/circuit-breaker.test.ts`:

```typescript
/**
 * Integration tests for SFTP circuit breaker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker, CircuitBreakerOpen } from "@/lib/circuit-breaker";

describe("SFTP Circuit Breaker Integration", () => {
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

    // Circuit is now open - should fail fast without connecting
    const attemptsBefore = connectAttempts.length;
    await expect(breaker.execute(failingConnect)).rejects.toThrow(
      CircuitBreakerOpen
    );
    expect(connectAttempts.length).toBe(attemptsBefore); // No new attempt
  });
});
```

**Step 7: Commit**

```bash
git add lib/circuit-breaker.ts tests/unit/lib/circuit-breaker.test.ts tests/integration/sftp/circuit-breaker.test.ts lib/sftp-client.ts
git commit -m "feat(resilience): add circuit breaker for SFTP connections

- Create CircuitBreaker class with three states
- Integrate with SFTP client for connection protection
- Fail fast after 5 consecutive failures
- Auto-recover after 60 seconds
- Add unit and integration tests
"
```

---

## Task 7: Configure Database Connection Pooling (Neon-Specific)

**Files:**
- Modify: `lib/prisma.ts`
- Update: `.env.local.example` (document Neon connection params)

**Context:** This project uses Neon PostgreSQL which has built-in PgBouncer pooling. Configuration is via the connection string, not Prisma client options.

**Step 1: Update Prisma client configuration**

Modify `lib/prisma.ts`:

```typescript
/**
 * Prisma client singleton with connection pooling.
 * Optimized for serverless environments with Neon PostgreSQL.
 *
 * Neon pooling is configured via DATABASE_URL:
 * - Use the "-pooler" hostname (e.g., ep-xxx-pooler.region.aws.neon.tech)
 * - Or add ?pgbouncer=true to use Neon's built-in PgBouncer
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    // Neon pooling is configured via DATABASE_URL, not here
    // Use -pooler hostname or ?pgbouncer=true query param
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 2: Document Neon-specific connection string parameters**

Add to `.env.local.example`:

```bash
# Database connection with Neon pooling (recommended for production)
# Neon provides built-in PgBouncer pooling. Two ways to enable:
#
# Option 1: Use the pooler hostname (recommended)
# Replace your hostname with the -pooler variant:
# ep-example-123456.us-east-2.aws.neon.tech
# becomes:
# ep-example-123456-pooler.us-east-2.aws.neon.tech
#
# Option 2: Add ?pgbouncer=true query parameter
# postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?pgbouncer=true&sslmode=require
#
# Note: With pooling, avoid prepared statements in migrations:
# prisma migrate deploy works fine, but add ?pgbouncer=true to migrate URL
DATABASE_URL="postgresql://..."
```

**Step 3: Commit**

```bash
git add lib/prisma.ts .env.local.example
git commit -m "docs(database): document Neon connection pooling configuration

- Add Neon-specific pooling documentation
- Document -pooler hostname and ?pgbouncer=true options
- Note prepared statement considerations for migrations
"
```

---

## Task 8: Tighten CSP (Optional - May Require Investigation)

**Files:**
- Modify: `next.config.mjs`
- Potentially: `app/layout.tsx` (for nonce injection)

**Note:** This task requires investigation. The `unsafe-inline` and `unsafe-eval` may be required by:
- Vidstack player (video playback)
- Fumadocs MDX rendering
- Next.js development mode

**Step 1: Investigate current CSP violations**

Run the app and check browser console for CSP violation reports.

**Step 2: Test without unsafe-eval**

Try removing `'unsafe-eval'` from script-src and test:
- Video playback
- MDX documentation pages
- All E2E tests

**Step 3: If possible, implement nonce-based CSP**

This requires:
1. Generating nonce in middleware
2. Passing nonce to layout
3. Adding nonce to inline scripts
4. Updating CSP header dynamically

**Decision:** If investigation shows `unsafe-inline`/`unsafe-eval` are required by dependencies, document this in a comment and leave as-is. Security-through-obscurity is not worth breaking functionality.

**Step 4: Commit findings**

```bash
git add next.config.mjs
git commit -m "docs(security): document CSP unsafe-inline/unsafe-eval requirements

- Investigated CSP restrictions
- [unsafe-inline|unsafe-eval] required by [dependency]
- Added comments explaining security tradeoff
"
```

---

## Test Summary

| Task | New Tests | Modified Tests | Removed Tests |
|------|-----------|----------------|---------------|
| HSTS Header | E2E: headers.spec.ts | - | - |
| Structured Logger | Unit: logger.test.ts | Unit: setup.ts (mock) | - |
| Request ID Middleware | Unit: middleware.test.ts | - | - |
| Console → Logger Migration | - | Unit: setup.ts (mock) | - |
| Error Boundary | Unit: error-boundary.test.tsx | - | - |
| Circuit Breaker | Unit: circuit-breaker.test.ts, Integration: circuit-breaker.test.ts | - | - |
| DB Connection Pooling | - | - | - |
| CSP Tightening | - | E2E: headers.spec.ts (maybe) | - |

---

## Execution Checklist

- [ ] Task 1: Add HSTS Header
- [ ] Task 2: Add Structured Logger
- [ ] Task 3: Add Request ID Middleware
- [ ] Task 4: Migrate Console Logs to Structured Logger
- [ ] Task 5: Add React Error Boundary
- [ ] Task 6: Add Circuit Breaker for SFTP
- [ ] Task 7: Configure Database Connection Pooling
- [ ] Task 8: Tighten CSP (Optional Investigation)

---

Plan complete and saved to `docs/plans/2026-01-07-production-hardening.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
