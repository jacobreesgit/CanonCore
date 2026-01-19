/**
 * Password input component with visibility toggle.
 * Provides Eye/EyeOff button to show/hide password text.
 */

"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Props for PasswordInput component.
 * Extends standard input props, excluding type which is always "password" or "text".
 */
export type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">;

/**
 * Renders a password input with visibility toggle button.
 * Uses Eye/EyeOff icons to indicate current visibility state.
 * Disables spellcheck by default since passwords should not be checked.
 *
 * @param className - Additional CSS classes
 * @param spellCheck - Whether to enable spellcheck (defaults to false)
 * @param props - Standard input props (excluding type)
 *
 * @example
 * <PasswordInput
 *   placeholder="Password"
 *   value={password}
 *   onChange={(e) => setPassword(e.target.value)}
 * />
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, spellCheck = false, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          spellCheck={spellCheck}
          data-slot="input"
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-10 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            className
          )}
          ref={ref}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2 p-0"
          onClick={() => setShowPassword((prev) => !prev)}
          tabIndex={-1}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </Button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
