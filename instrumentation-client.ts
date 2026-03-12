/**
 * Client-side instrumentation hook.
 * Required by Sentry SDK for Next.js client-side initialization.
 */

import * as Sentry from "@sentry/nextjs";

import "./sentry.client.config";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
