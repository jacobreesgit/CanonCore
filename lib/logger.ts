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
