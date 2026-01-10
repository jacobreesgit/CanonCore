/**
 * Next.js proxy for request ID injection.
 * Adds x-request-id header to all requests for tracing.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateRequestId } from "@/lib/logger";

/**
 * Proxy that adds request ID to all requests.
 * Enables distributed tracing and log correlation.
 */
export function proxy(request: NextRequest) {
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
