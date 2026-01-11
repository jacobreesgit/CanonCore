/**
 * Keyboard shortcut display component.
 * Shows a styled keyboard key hint like macOS.
 */

import { cn } from "@/lib/utils";

interface KbdProps {
  /** The keyboard key to display */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a styled keyboard shortcut key.
 * Used in UI to show keyboard hints like "/" or "esc".
 *
 * @example
 * <Kbd>/</Kbd>
 * <Kbd>esc</Kbd>
 */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none",
        className
      )}
    >
      {children}
    </kbd>
  );
}
