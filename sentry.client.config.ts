/**
 * Sentry client-side configuration.
 * Initializes error tracking and performance monitoring in the browser.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Disable performance tracing in dev — the /monitoring tunnel route floods the
  // dev server with requests, each taking 25-50s and competing with page compilations
  tracesSampleRate: process.env.NODE_ENV === "development" ? 0 : 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === "development" ? 0 : 1.0,
  integrations:
    process.env.NODE_ENV === "development" ? [] : [Sentry.replayIntegration()],
  ignoreErrors: [
    // Next.js navigation errors
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    // Rate limit responses (expected behavior)
    "429",
  ],
});
