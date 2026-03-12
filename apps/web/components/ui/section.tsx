/**
 * Content section wrapper with consistent responsive padding.
 * Uses section spacing CSS variables.
 */

import { cn } from "@/lib/utils";

type SectionProps = React.ComponentPropsWithoutRef<"section"> & {
  /** Section content. */
  children: React.ReactNode;
  /** Additional CSS classes. */
  className?: string;
};

/**
 * Wrapper for content sections with responsive horizontal padding.
 */
export function Section({ children, className, ...rest }: SectionProps) {
  return (
    <section
      className={cn(
        "px-[var(--section-px-mobile)]",
        "sm:px-[var(--section-px-sm)]",
        "md:px-[var(--section-px-md)]",
        "lg:px-[var(--section-px-lg)]",
        "xl:px-[var(--section-px-xl)]",
        "2xl:px-[var(--section-px-2xl)]",
        className
      )}
      {...rest}
    >
      {children}
    </section>
  );
}
