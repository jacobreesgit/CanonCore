/**
 * Next.js proxy for request ID injection and bot protection.
 * Implements multi-layer defense against aggressive crawlers:
 * 1. Fast-path for common browsers (99% of traffic)
 * 2. Block aggressive AI scrapers (403)
 * 3. Rate-limit beneficial search engines
 * 4. Add request ID for tracing
 *
 * Performance: Optimized for minimal overhead on legitimate traffic.
 * Security: Logs all blocked attempts for audit trail.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateRequestId, logger } from "@/lib/logger";
import { rateLimiters } from "@/lib/rate-limit";
import {
  BLOCKED_BOT_PATTERNS,
  ALLOWED_BOT_PATTERNS,
  COMMON_BROWSER_PATTERN,
  BOT_INDICATOR_PATTERN,
} from "@/lib/bot-patterns";

/**
 * Check if user-agent matches any blocked bot pattern.
 *
 * @param userAgent - The User-Agent header string from the request
 * @returns True if the user-agent matches a blocked bot pattern
 *
 * @example
 * isBlockedBot("meta-externalagent/1.1") // true
 * isBlockedBot("Mozilla/5.0 Chrome/120.0") // false
 */
function isBlockedBot(userAgent: string): boolean {
  return BLOCKED_BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Check if user-agent matches any beneficial bot pattern.
 *
 * @param userAgent - The User-Agent header string from the request
 * @returns True if the user-agent matches a beneficial bot pattern
 *
 * @example
 * isBeneficialBot("Googlebot/2.1") // true
 * isBeneficialBot("Mozilla/5.0 Chrome/120.0") // false
 */
function isBeneficialBot(userAgent: string): boolean {
  return ALLOWED_BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Check if user-agent is a common browser (fast path).
 *
 * @param userAgent - The User-Agent header string from the request
 * @returns True if likely a common browser
 */
function isCommonBrowser(userAgent: string): boolean {
  return (
    COMMON_BROWSER_PATTERN.test(userAgent) &&
    !BOT_INDICATOR_PATTERN.test(userAgent)
  );
}

/**
 * Proxy that handles bot protection and adds request ID to all requests.
 * Implements multi-layer defense with optimized fast-path for legitimate users.
 *
 * Architecture:
 * 1. Fast-path: Common browsers skip bot checks entirely
 * 2. Block layer: Aggressive AI scrapers get 403 immediately
 * 3. Rate-limit layer: Beneficial bots are throttled
 * 4. Tracing layer: All requests get request ID
 *
 * @param request - Incoming Next.js request
 * @returns NextResponse with appropriate handling
 */
export async function proxy(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "";
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const path = request.nextUrl.pathname;

  // FAST PATH: Common browsers (99% of traffic)
  // Skip bot detection entirely for performance
  if (isCommonBrowser(userAgent)) {
    return handleNormalRequest(request);
  }

  // LAYER 1: Block aggressive AI scrapers immediately
  if (isBlockedBot(userAgent)) {
    // Security audit log for monitoring and analysis
    logger.info(
      {
        userAgent,
        ip,
        path,
        timestamp: new Date().toISOString(),
      },
      "Blocked aggressive bot crawler"
    );

    return new NextResponse("Forbidden: Bot crawling not allowed", {
      status: 403,
      headers: {
        "Content-Type": "text/plain",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  // LAYER 2: Rate-limit beneficial bots
  if (isBeneficialBot(userAgent)) {
    // Skip rate limiting if bypass flag is set (for E2E tests)
    if (process.env.BYPASS_RATE_LIMIT !== "true") {
      try {
        // Use IP + user-agent for more granular rate limiting
        // Prevents single bot from consuming entire quota with multiple IPs
        const rateLimitKey = `${ip}:${userAgent.substring(0, 100)}`;
        const { success, limit, remaining, reset } =
          await rateLimiters.botCrawl.limit(rateLimitKey);

        if (!success) {
          // Log rate limit events for monitoring
          logger.info(
            {
              userAgent,
              ip,
              path,
              limit,
              remaining: 0,
              reset,
            },
            "Rate limited beneficial bot"
          );

          return new NextResponse("Too Many Requests", {
            status: 429,
            headers: {
              "Content-Type": "text/plain",
              "Retry-After": "60",
              "X-RateLimit-Limit": String(limit),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(reset),
            },
          });
        }

        // Add rate limit headers to successful responses for transparency
        const response = handleNormalRequest(request);
        response.headers.set("X-RateLimit-Limit", String(limit));
        response.headers.set("X-RateLimit-Remaining", String(remaining));
        response.headers.set("X-RateLimit-Reset", String(reset));
        return response;
      } catch (error) {
        // Log rate limit errors but don't block on Redis failure
        // Graceful degradation: allow request to proceed
        logger.error(
          {
            err: error,
            userAgent,
            ip,
            path,
          },
          "Bot rate limit check failed, allowing request"
        );
      }
    }
  }

  // LAYER 3: Normal request processing
  return handleNormalRequest(request);
}

/**
 * Handle normal request with request ID injection.
 *
 * @param request - Incoming Next.js request
 * @returns NextResponse with request ID headers
 */
function handleNormalRequest(request: NextRequest): NextResponse {
  // Generate request ID if not provided
  const requestId = request.headers.get("x-request-id") || generateRequestId();

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
