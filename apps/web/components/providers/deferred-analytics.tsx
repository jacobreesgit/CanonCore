/**
 * Deferred Vercel Analytics and Speed Insights loader.
 * Loads analytics after hydration to avoid blocking initial render.
 */

"use client";

import dynamic from "next/dynamic";

const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((mod) => mod.Analytics),
  { ssr: false }
);

const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights),
  { ssr: false }
);

/**
 * Wrapper that loads Vercel Analytics and Speed Insights after hydration.
 * Keeps performance tracking out of the critical rendering path.
 */
export function DeferredAnalytics() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
