/**
 * Storybook decorator for reduced motion testing.
 * Applies/removes reduced motion class based on global toolbar selection.
 */
"use client";

import { useEffect } from "react";

interface StoryContext {
  globals: {
    reducedMotion?: "no-preference" | "reduce";
  };
}

interface ReducedMotionWrapperProps {
  reducedMotion?: "no-preference" | "reduce";
  children: React.ReactNode;
}

/**
 * Wrapper component that applies reduced motion styles.
 * Uses useEffect to manage document classes based on the reducedMotion prop.
 */
function ReducedMotionWrapper({
  reducedMotion,
  children,
}: ReducedMotionWrapperProps) {
  useEffect(() => {
    if (reducedMotion === "reduce") {
      document.documentElement.classList.add("reduce-motion");
      document.documentElement.style.setProperty("--reduce-motion", "reduce");
    } else {
      document.documentElement.classList.remove("reduce-motion");
      document.documentElement.style.removeProperty("--reduce-motion");
    }

    return () => {
      document.documentElement.classList.remove("reduce-motion");
      document.documentElement.style.removeProperty("--reduce-motion");
    };
  }, [reducedMotion]);

  return <>{children}</>;
}

/**
 * Decorator that simulates prefers-reduced-motion media query.
 * Adds/removes a CSS class that can be targeted for reduced motion styles.
 *
 * @param Story - The story component to wrap
 * @param context - Storybook context containing global values
 * @returns Story with reduced motion class applied when enabled
 */
export const withReducedMotion = (
  Story: React.ComponentType,
  context: StoryContext
) => (
  <ReducedMotionWrapper reducedMotion={context.globals.reducedMotion}>
    <Story />
  </ReducedMotionWrapper>
);
