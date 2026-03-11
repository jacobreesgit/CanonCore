/**
 * Hero action buttons with pill shape and glassmorphism.
 * Primary (solid white) and secondary (glass) variants.
 */

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

interface HeroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant. */
  variant?: "primary" | "secondary";
  /** Render as child element (e.g. wrapping a Link). */
  asChild?: boolean;
}

/**
 * Pill-shaped hero action button with glassmorphism.
 */
export const HeroButton = forwardRef<HTMLButtonElement, HeroButtonProps>(
  function HeroButton(
    { children, variant = "secondary", asChild = false, className, ...props },
    ref
  ) {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        {...props}
        className={cn(
          "inline-flex items-center gap-2",
          "h-10 rounded-full px-5",
          "text-sm font-medium",
          "transition-[background-color,transform,opacity] duration-150",
          "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variant === "primary"
            ? [
                "bg-white text-black",
                "hover:bg-white/90",
                "active:scale-[0.97]",
              ]
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
);
