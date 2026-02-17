/**
 * Next.js instrumentation hook for OpenTelemetry and Sentry.
 * Registers OTel for distributed tracing and loads Sentry configs
 * for server-side and edge error tracking.
 */

import * as Sentry from "@sentry/nextjs";
import { registerOTel } from "@vercel/otel";

export async function register() {
  registerOTel({ serviceName: "canoncore" });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
