/**
 * Deferred Vercel Analytics loader.
 * Loads analytics after hydration to avoid blocking initial render.
 */

"use client";

import dynamic from "next/dynamic";

const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((mod) => mod.Analytics),
  { ssr: false }
);

/**
 * Wrapper that loads Vercel Analytics after hydration.
 * Keeps analytics out of the critical rendering path.
 */
export function DeferredAnalytics() {
  return <Analytics />;
}
