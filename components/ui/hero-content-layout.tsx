/**
 * Shared page shell for hero + content layout.
 * Renders a full-bleed hero, children (toolbar + content), and footer spacing.
 *
 * When `dominantColour` is provided, CSS custom properties from
 * `createColourShades` are applied to the outermost wrapper, theming the
 * entire page (hero AND below-hero content). Item detail pages pass a static
 * colour; the explore carousel passes the active slide's colour via callback.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { createColourShades } from "@/lib/colour-utils";

interface HeroContentLayoutProps {
  /** Optional hero element (e.g., CinematicHero). */
  hero?: ReactNode;
  /** Whether the page is in a pending/loading state. */
  isPending?: boolean;
  /** Dominant colour for full-page theming (hex, e.g. "#1a3a5c"). */
  dominantColour?: string | null;
  /** Enable 500ms colour transition (only for multi-slide carousels). */
  animateColour?: boolean;
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
 * @param dominantColour - Hex colour for full-page theming (detail pages only)
 * @param children - Toolbar and content below hero
 */
export function HeroContentLayout({
  hero,
  isPending,
  dominantColour,
  animateColour,
  className,
  "data-testid": dataTestId,
  children,
}: HeroContentLayoutProps) {
  const colourStyles = dominantColour
    ? createColourShades(dominantColour)
    : undefined;

  return (
    <div
      data-testid={dataTestId}
      className={cn(
        "flex flex-1 flex-col bg-[var(--dark-900)]",
        !hero && "pt-[calc(var(--header-height)+1rem)]",
        isPending && "opacity-70",
        animateColour && dominantColour && "transition-colours-pipeline",
        className
      )}
      style={colourStyles}
    >
      {hero}
      {children}
    </div>
  );
}
