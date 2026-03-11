/**
 * Animated floating paths background component for auth pages.
 * Respects prefers-reduced-motion for accessibility.
 * Uses static paths in Playwright tests for stability.
 */

"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

export function FloatingPaths({ position }: { position: number }) {
  const shouldReduceMotion = useReducedMotion();
  // navigator.webdriver check for Playwright test stability
  const isPlaywright =
    typeof window !== "undefined" && navigator.webdriver === true;

  const paths = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
          380 - i * 5 * position
        } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
          152 - i * 5 * position
        } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
          684 - i * 5 * position
        } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
        width: 0.5 + i * 0.03,
        // Pre-calculate random duration to avoid impure render
        duration: 20 + i * 0.3,
      })),
    [position]
  );

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="h-full w-full text-slate-950 dark:text-white"
        fill="none"
        viewBox="0 0 696 316"
      >
        <title>Background Paths</title>
        {paths.map((path) =>
          shouldReduceMotion || isPlaywright ? (
            <path
              d={path.d}
              key={path.id}
              stroke="currentColor"
              strokeOpacity={0.1 + path.id * 0.03}
              strokeWidth={path.width}
            />
          ) : (
            <motion.path
              animate={{
                pathLength: 1,
                opacity: [0.3, 0.6, 0.3],
                pathOffset: [0, 1, 0],
              }}
              d={path.d}
              initial={{ pathLength: 0.3, opacity: 0.6 }}
              key={path.id}
              stroke="currentColor"
              strokeOpacity={0.1 + path.id * 0.03}
              strokeWidth={path.width}
              transition={{
                duration: path.duration,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            />
          )
        )}
      </svg>
    </div>
  );
}
