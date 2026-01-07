# Deployment 0.26.0 - Production Hardening

**Date**: 2026-01-07
**Branch**: development

## Summary

This release adds production infrastructure for security, observability, and resilience. SFTP connections now use circuit breakers to prevent cascade failures, structured logging enables log aggregation, and request IDs allow distributed tracing.

## Changes

### HSTS Security Header

Added Strict-Transport-Security header to enforce HTTPS:

| Setting           | Value                                   |
| ----------------- | --------------------------------------- |
| max-age           | 31536000 (1 year)                       |
| includeSubDomains | Yes                                     |
| preload           | Yes (eligible for browser preload list) |

The CSP configuration was also documented with notes explaining why `unsafe-inline` is necessary for Vidstack and Fumadocs.

### Structured Logging with Pino

Replaced console logging with Pino structured logger:

| Feature       | Description                             |
| ------------- | --------------------------------------- |
| JSON output   | Production logs as JSON for aggregation |
| Pretty print  | Development logs with colors            |
| Child loggers | Request and user context propagation    |
| Log levels    | Configurable via LOG_LEVEL env var      |

Functions: `logger`, `createRequestLogger(requestId)`, `createUserLogger(userId, requestId?)`

### Request ID Middleware

New middleware injects unique request IDs for distributed tracing:

| Header       | Description                           |
| ------------ | ------------------------------------- |
| x-request-id | Added to request and response headers |
| Format       | `{timestamp-base36}-{random}`         |
| Source       | Uses incoming header or generates new |

### Circuit Breaker for SFTP

Circuit breaker pattern prevents cascade failures when SFTP servers are unhealthy:

| Parameter        | Value | Description                     |
| ---------------- | ----- | ------------------------------- |
| failureThreshold | 5     | Failures before opening circuit |
| resetTimeout     | 60s   | Time before testing recovery    |
| States           | 3     | closed → open → half-open       |

Per-connection breakers prevent one bad connection from affecting others.

### React Error Boundary

Error boundary wraps protected routes to catch render errors:

| Feature       | Description                              |
| ------------- | ---------------------------------------- |
| Fallback UI   | "Something went wrong" message           |
| Error logging | Logs errors for debugging                |
| Customizable  | Accepts custom fallback and onError prop |

Integrated in `app/(my-items)/layout.tsx` around children.

### Developer Experience

Check script now auto-formats code before linting:

```bash
# Old
pnpm run check  # format:check (read-only)

# New
pnpm run check  # format (auto-fix)
```

## Files Changed

```
# New infrastructure
lib/logger.ts                              # Pino structured logging
lib/circuit-breaker.ts                     # Circuit breaker pattern
middleware.ts                              # Request ID middleware
components/error-boundary.tsx              # React error boundary

# New tests
tests/unit/lib/logger.test.ts              # Logger unit tests
tests/unit/lib/circuit-breaker.test.ts     # Circuit breaker unit tests
tests/unit/middleware.test.ts              # Request ID tests
tests/unit/components/error-boundary.test.tsx  # Error boundary tests
tests/integration/sftp/circuit-breaker.test.ts # Integration tests
e2e/journeys/security/headers.spec.ts      # Security header E2E

# Modified files
next.config.mjs                            # HSTS header + CSP docs
lib/sftp-client.ts                         # Circuit breaker integration
lib/sftp-actions.ts                        # Console → logger migration
lib/auth-actions.ts                        # Console → logger migration
lib/email.ts                               # Console → logger migration
lib/user-actions.ts                        # Console → logger migration
lib/item-file-actions.ts                   # Console → logger migration
lib/prisma.ts                              # Connection event logging
app/(my-items)/layout.tsx                  # Error boundary wrapper
knip.json                                  # pino-pretty ignore
package.json                               # Version + check script
```

## Test Results

- **Unit tests**: 481 passed
- **Integration tests**: 67 passed
- **E2E tests**: 135 passed (4 skipped)

### New Tests

| Test File                             | Tests | Coverage                     |
| ------------------------------------- | ----- | ---------------------------- |
| circuit-breaker.test.ts (unit)        | 7     | State transitions, execution |
| circuit-breaker.test.ts (integration) | 2     | Reconnection, recovery       |
| logger.test.ts                        | 3     | ID generation, format        |
| middleware.test.ts                    | 2     | ID generation, uniqueness    |
| error-boundary.test.tsx               | 4     | Render, fallback, callback   |
| headers.spec.ts (E2E)                 | 1     | HSTS verification            |

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install` (adds pino, pino-pretty)
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No database migrations required.

## Environment Variables

**Optional:**

| Variable  | Default | Description                            |
| --------- | ------- | -------------------------------------- |
| LOG_LEVEL | info    | Pino log level (debug/info/warn/error) |

## Architecture Notes

### Circuit Breaker State Machine

```
CLOSED (normal operation)
    │
    │ failureThreshold reached
    ▼
OPEN (fail fast, no calls)
    │
    │ resetTimeout elapsed
    ▼
HALF-OPEN (test one call)
    │
    ├── success → CLOSED
    └── failure → OPEN
```

### Logger Hierarchy

```
logger (base)
  └── createRequestLogger(requestId)
        └── child({ userId }) for user context
```

### Request ID Flow

```
Request → Middleware (generate/pass ID) → Server Action → Logger → Response
                                                    │
                                                    └── x-request-id header
```
