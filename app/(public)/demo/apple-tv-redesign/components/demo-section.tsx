/**
 * Content section wrapper with consistent padding.
 */

import { cn } from "@/lib/utils";

interface DemoSectionProps {
  /** Section content. */
  children: React.ReactNode;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Wrapper for content sections with responsive horizontal padding.
 */
export function DemoSection({ children, className }: DemoSectionProps) {
  return (
    <section
      className={cn(
        "px-[var(--atv-px-mobile)]",
        "sm:px-[var(--atv-px-sm)]",
        "md:px-[var(--atv-px-md)]",
        "lg:px-[var(--atv-px-lg)]",
        "xl:px-[var(--atv-px-xl)]",
        "2xl:px-[var(--atv-px-2xl)]",
        className
      )}
    >
      {children}
    </section>
  );
}
