/**
 * Responsive poster grid with Apple TV+ column counts.
 * Supports staggered animation on load.
 */

import { cn } from "@/lib/utils";

interface DemoPosterGridProps {
  /** Grid items. */
  children: React.ReactNode;
  /** Enable staggered fade-in animation. */
  stagger?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Responsive grid for poster cards.
 * Columns: 2 (mobile) → 4 (tablet) → 5 (desktop) → 6 (large) → 7 (xl)
 */
export function DemoPosterGrid({
  children,
  stagger = true,
  className,
}: DemoPosterGridProps) {
  return (
    <div
      className={cn(
        "grid gap-6 md:gap-8",
        "grid-cols-2", // Mobile: 2 columns
        "sm:grid-cols-4", // Tablet: 4 columns
        "lg:grid-cols-5", // Desktop: 5 columns
        "xl:grid-cols-6", // Large: 6 columns
        "2xl:grid-cols-7", // XL: 7 columns
        stagger && "atv-stagger-grid",
        className
      )}
    >
      {children}
    </div>
  );
}
