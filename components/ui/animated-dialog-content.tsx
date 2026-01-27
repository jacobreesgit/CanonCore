/**
 * Animated dialog content with smooth height transitions between steps.
 * Uses slot-based API: header and footer are fixed, only body animates.
 * Follows Motion best practices: content flows normally, container animates height.
 * Respects prefers-reduced-motion for accessibility.
 *
 * Note: Child components with their own ScrollArea (like image-selection-grid)
 * work correctly since they have explicit maxHeight constraints. The body
 * section's overflow-y-auto only activates for unconstrained content.
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
  /** Fixed header content (rendered outside animated area). */
  header?: React.ReactNode;
  /** Fixed footer content (rendered outside animated area). */
  footer?: React.ReactNode;
}

interface BodyContentProps {
  /** Unique key for AnimatePresence. */
  stepKey: string;
  /** Callback to report measured height. */
  onHeightReady: (height: number) => void;
  /** Whether to reduce motion. */
  reduceMotion: boolean;
  /** Content to render. */
  children: React.ReactNode;
}

/**
 * Inner body wrapper that measures its height and reports it.
 * Content flows normally - no absolute positioning to avoid clipping.
 * Uses ResizeObserver for dynamic height detection (e.g., tab switches).
 */
function BodyContent({
  stepKey,
  onHeightReady,
  reduceMotion,
  children,
}: BodyContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Use ResizeObserver to detect height changes from any source
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Initial measurement
    onHeightReady(element.offsetHeight);

    // Watch for size changes
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height =
          entry.borderBoxSize?.[0]?.blockSize ??
          entry.target.getBoundingClientRect().height;
        onHeightReady(height);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightReady]);

  return (
    <motion.div
      ref={ref}
      key={stepKey}
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
 * Header and footer are fixed; only body content animates.
 *
 * @param stepKey - Unique identifier for current step
 * @param showClose - Whether to show close button
 * @param header - Fixed header content (outside animated area)
 * @param footer - Fixed footer content (outside animated area)
 * @param children - Body content (animates between steps)
 */
function AnimatedDialogContent({
  className,
  children,
  stepKey,
  showClose = true,
  header,
  footer,
  ...props
}: AnimatedDialogContentProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  // Reset scroll position when step changes
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [stepKey]);

  // Stable callback for height updates
  const handleHeightReady = useCallback((newHeight: number) => {
    setHeight(newHeight);
  }, []);

  const dialogContent = (
    <>
      {/* Fixed Header */}
      {header && (
        <div data-slot="dialog-header-wrapper" className="shrink-0">
          {header}
        </div>
      )}

      {/* Animated Body */}
      <div
        ref={bodyRef}
        data-slot="dialog-body"
        className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6"
      >
        <motion.div
          animate={{ height }}
          initial={false}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 35 }
          }
        >
          <AnimatePresence mode="sync" initial={false}>
            <BodyContent
              key={stepKey}
              stepKey={stepKey}
              onHeightReady={handleHeightReady}
              reduceMotion={shouldReduceMotion}
            >
              {children}
            </BodyContent>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Fixed Footer */}
      {footer && (
        <div data-slot="dialog-footer-wrapper" className="shrink-0">
          {footer}
        </div>
      )}

      {/* Close Button */}
      {showClose && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          className="ring-offset-background focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 cursor-pointer rounded-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </>
  );

  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex max-h-[95vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col gap-4 overscroll-contain rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
          className
        )}
        {...props}
      >
        {dialogContent}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { AnimatedDialogContent };
export type { AnimatedDialogContentProps };
