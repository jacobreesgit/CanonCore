/**
 * Hero action buttons with pill shape and glassmorphism.
 * Primary (solid white) and secondary (glass) variants.
 */

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

interface HeroButtonProps {
  /** Button content. */
  children: React.ReactNode;
  /** Button variant. */
  variant?: "primary" | "secondary";
  /** Render as child element (e.g. wrapping a Link). */
  asChild?: boolean;
  /** Click handler. */
  onClick?: () => void;
  /** Disabled state. */
  disabled?: boolean;
  /** Additional CSS classes. */
  className?: string;
  /** Accessible label for icon-only buttons. */
  "aria-label"?: string;
  /** Toggle state for toggle buttons. */
  "aria-pressed"?: boolean | "true" | "false";
  /** Test ID for E2E testing. */
  "data-testid"?: string;
}

/**
 * Pill-shaped hero action button with glassmorphism.
 */
export function HeroButton({
  children,
  variant = "secondary",
  asChild = false,
  onClick,
  disabled,
  className,
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
  "data-testid": dataTestId,
}: HeroButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      data-testid={dataTestId}
      className={cn(
        "inline-flex items-center gap-2",
        "h-10 rounded-full px-5",
        "text-sm font-medium",
        "transition-[background-color,transform,opacity] duration-150",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary"
          ? ["bg-white text-black", "hover:bg-white/90", "active:scale-[0.97]"]
          : [
              "bg-white/10 text-white backdrop-blur-sm",
              "border border-white/20",
              "hover:bg-white/20",
              "active:scale-[0.97]",
            ],
        className
      )}
    >
      {children}
    </Comp>
  );
}
