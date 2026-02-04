/**
 * Hero action buttons with pill shape and glassmorphism.
 * Primary (solid) and secondary (ghost) variants.
 */

import { cn } from "@/lib/utils";

interface DemoHeroButtonProps {
  /** Button content. */
  children: React.ReactNode;
  /** Button variant. */
  variant?: "primary" | "secondary";
  /** Click handler. */
  onClick?: () => void;
  /** Disabled state. */
  disabled?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Pill-shaped hero action button with glassmorphism.
 */
export function DemoHeroButton({
  children,
  variant = "secondary",
  onClick,
  disabled,
  className,
}: DemoHeroButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2",
        "h-10 rounded-full px-5",
        "text-sm font-medium",
        "transition-all duration-150",
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
    </button>
  );
}
