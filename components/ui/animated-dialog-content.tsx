/**
 * Animated dialog content with smooth height transitions between steps.
 * Uses explicit height measurement for buttery-smooth spring animations.
 * Technique inspired by react-bits Stepper: measure content, animate container.
 * Respects prefers-reduced-motion for accessibility.
 */

"use client";

import * as React from "react";
import {
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  useEffect,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnimatedDialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /** Unique key for current step (triggers animation on change). */
  stepKey: string;
  /** Whether to show close button (default: true). */
  showClose?: boolean;
}

interface StepContentProps {
  /** Unique key for AnimatePresence. */
  stepKey: string;
  /** Callback to report measured height. */
  onHeightReady: (height: number) => void;
  /** Whether to skip all motion (first render). */
  skipMotion: boolean;
  /** Whether to reduce motion. */
  reduceMotion: boolean;
  /** Content to render. */
  children: React.ReactNode;
}

/**
 * Inner content wrapper that measures its height and reports it.
 * Positioned absolutely so it doesn't affect container height directly.
 * Uses ResizeObserver for dynamic height detection (e.g., tab switches).
 */
function StepContent({
  stepKey,
  onHeightReady,
  skipMotion,
  reduceMotion,
  children,
}: StepContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Use ResizeObserver to detect height changes from any source
  // (tab switches, content loading, collapsibles, etc.)
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Initial measurement
    onHeightReady(element.offsetHeight);

    // Watch for size changes
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use borderBoxSize for accurate measurement including padding
        const height =
          entry.borderBoxSize?.[0]?.blockSize ??
          entry.target.getBoundingClientRect().height;
        onHeightReady(height);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightReady]);

  // On first render, skip all motion - just render content directly
  if (skipMotion) {
    return (
      <div ref={ref} className="absolute inset-x-1 top-0 space-y-4">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      key={stepKey}
      className="absolute inset-x-1 top-0 space-y-4"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      transition={
        reduceMotion ? { duration: 0.05 } : { duration: 0.25, ease: "easeOut" }
      }
    >
      {children}
    </motion.div>
  );
}

/**
 * Dialog content wrapper with animated height transitions.
 * Uses explicit height measurement for smooth spring animations.
 *
 * @param stepKey - Unique identifier for current step
 * @param showClose - Whether to show close button
 * @param className - Additional classes
 * @param children - Dialog content
 */
function AnimatedDialogContent({
  className,
  children,
  stepKey,
  showClose = true,
  ...props
}: AnimatedDialogContentProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const contentRef = useRef<HTMLDivElement>(null);
  // Track if this is the first render (no motion) vs step changes (with motion)
  const [state, setState] = useState({
    height: 0,
    isFirstRender: true,
  });

  // Reset scroll position when step changes
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [stepKey]);

  // Stable callback for height updates
  const handleHeightReady = useCallback((newHeight: number) => {
    setState((prev) => ({
      height: newHeight,
      // After first measurement, subsequent changes will animate
      isFirstRender: prev.isFirstRender && prev.height === 0,
    }));
  }, []);

  // On first render, use simple container with no motion
  if (state.isFirstRender) {
    return (
      <DialogPrimitive.Portal data-slot="dialog-portal">
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
        />
        <DialogPrimitive.Content
          ref={contentRef}
          data-slot="dialog-content"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid max-h-[95vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
            className
          )}
          {...props}
        >
          <StepContent
            key={stepKey}
            stepKey={stepKey}
            onHeightReady={handleHeightReady}
            skipMotion={true}
            reduceMotion={shouldReduceMotion}
          >
            {children}
          </StepContent>

          {showClose && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 cursor-pointer rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }

  // After first render, use animated container for step transitions
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
      />
      <DialogPrimitive.Content
        ref={contentRef}
        data-slot="dialog-content"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid max-h-[95vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
          className
        )}
        {...props}
      >
        {/* Container animates height explicitly with spring */}
        {/* Content is absolutely positioned so it doesn't push container */}
        {/* mode="sync" allows crossfade (both visible during transition) */}
        {/* Negative margin + padding creates space for focus rings without affecting layout */}
        <motion.div
          className="-mx-1 px-1"
          style={{ position: "relative", overflow: "hidden" }}
          animate={{ height: state.height }}
          initial={false}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 35 }
          }
        >
          <AnimatePresence mode="sync" initial={false}>
            <StepContent
              key={stepKey}
              stepKey={stepKey}
              onHeightReady={handleHeightReady}
              skipMotion={false}
              reduceMotion={shouldReduceMotion}
            >
              {children}
            </StepContent>
          </AnimatePresence>
        </motion.div>

        {showClose && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 cursor-pointer rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { AnimatedDialogContent };
export type { AnimatedDialogContentProps };
