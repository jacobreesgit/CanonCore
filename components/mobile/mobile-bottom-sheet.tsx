/**
 * Base bottom sheet component for mobile navigation.
 * Wraps Vaul drawer with consistent configuration for swipe gestures,
 * safe area handling, and accessibility features.
 */

"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Props for MobileBottomSheet component.
 */
export interface MobileBottomSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Sheet content */
  children: React.ReactNode;
  /** Snap points for sheet height (e.g., ["50%", "90%"] or ["auto"]) */
  snapPoints?: (string | number)[];
  /** Whether to enable keyboard repositioning when input is focused */
  repositionInputs?: boolean;
  /** Optional className for content container */
  className?: string;
  /** Accessible title for screen readers (required) */
  title: string;
  /** Optional description for screen readers */
  description?: string;
  /** Optional callback when close animation completes */
  onAnimationEnd?: (open: boolean) => void;
}

/**
 * Base bottom sheet component wrapping Vaul drawer.
 * Provides consistent mobile sheet behavior with:
 * - Spring animations (respects prefers-reduced-motion)
 * - Handle indicator at top
 * - Background scale effect for depth
 * - Safe area padding for notched devices
 * - Swipe-to-close and backdrop dismiss
 * - Focus trapping and screen reader support
 *
 * @param open - Whether the sheet is open
 * @param onOpenChange - Callback when open state changes
 * @param children - Sheet content
 * @param snapPoints - Sheet height snap points
 * @param repositionInputs - Auto-expand when keyboard opens
 * @param className - Additional styles for content
 * @param title - Accessible title (required)
 * @param description - Accessible description
 * @param onAnimationEnd - Callback when animation completes
 */
export function MobileBottomSheet({
  open,
  onOpenChange,
  children,
  snapPoints,
  repositionInputs = false,
  className,
  title,
  description,
  onAnimationEnd,
}: MobileBottomSheetProps) {
  const { reducedMotion: prefersReducedMotion } = useReducedMotion();

  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground
      repositionInputs={repositionInputs}
      snapPoints={snapPoints}
      onAnimationEnd={onAnimationEnd}
      handleOnly
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            // Safari fix: aggressive GPU compositing to prevent overlay disappearing during momentum scroll
            // translateZ(0) forces a new compositing layer, will-change hints to keep it
            "isolate [transform:translateZ(0)] transform-gpu [will-change:transform,opacity] [backface-visibility:hidden]",
            !prefersReducedMotion &&
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DrawerPrimitive.Content
          className={cn(
            "bg-background fixed inset-x-0 bottom-0 z-50 flex max-h-[96vh] flex-col overscroll-contain rounded-t-xl border-t",
            "pb-[env(safe-area-inset-bottom)]",
            // Safari fix: match overlay compositing to prevent rendering glitches
            "[transform:translateZ(0)] transform-gpu [will-change:transform] [backface-visibility:hidden]",
            className
          )}
          aria-describedby={description ? "sheet-description" : undefined}
        >
          {/* Handle - with handleOnly, this is the only draggable area */}
          <DrawerPrimitive.Handle className="bg-muted mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full" />

          {/* Accessible title (visually hidden but announced) */}
          <DrawerPrimitive.Title className="sr-only">
            {title}
          </DrawerPrimitive.Title>

          {/* Optional description */}
          {description && (
            <DrawerPrimitive.Description
              id="sheet-description"
              className="sr-only"
            >
              {description}
            </DrawerPrimitive.Description>
          )}

          {children}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

/**
 * Header section for bottom sheet with visible title.
 */
export function MobileBottomSheetHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 px-4 pt-4 pb-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Visible title for bottom sheet header.
 */
export function MobileBottomSheetTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

/**
 * Scrollable content area for bottom sheet.
 * Uses data-vaul-no-drag to prevent Vaul from capturing touch events,
 * allowing content to scroll instead of triggering drawer dismiss.
 */
export function MobileBottomSheetContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-4 py-4", className)}
      data-vaul-no-drag
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Footer section for bottom sheet.
 */
export function MobileBottomSheetFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 px-4 pb-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}
