/**
 * Sentry client-side configuration.
 * Initializes error tracking and performance monitoring in the browser.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  ignoreErrors: [
    // Next.js navigation errors
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    // Rate limit responses (expected behavior)
    "429",
  ],
});
