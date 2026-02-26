/**
 * Shared page shell for hero + content layout.
 * Renders a full-bleed hero, children (toolbar + content), and footer spacing.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HeroContentLayoutProps {
  /** Optional hero element (e.g., CinematicHero). */
  hero?: ReactNode;
  /** Whether the page is in a pending/loading state. */
  isPending?: boolean;
  /** Additional CSS classes. */
  className?: string;
  /** Test ID for E2E testing. */
  "data-testid"?: string;
  /** Page content (toolbar + grids/trees). */
  children: ReactNode;
}

/**
 * Page shell that wraps hero, content, and footer spacing.
 * Used across profile, item detail, and explore pages.
 *
 * @param hero - Full-bleed hero element
 * @param isPending - Dims content when true
 * @param children - Toolbar and content below hero
 */
export function HeroContentLayout({
  hero,
  isPending,
  className,
  "data-testid": dataTestId,
  children,
}: HeroContentLayoutProps) {
  return (
    <div
      data-testid={dataTestId}
      className={cn(
        "flex flex-col",
        !hero && "pt-[calc(var(--header-height)+1rem)]",
        isPending && "opacity-70",
        className
      )}
    >
      {hero}
      {children}
    </div>
  );
}
