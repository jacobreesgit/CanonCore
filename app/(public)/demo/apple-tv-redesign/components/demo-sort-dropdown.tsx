/**
 * Sort dropdown with Apple TV+ glassmorphism styling.
 * Visual demonstration with no-op functionality.
 */

"use client";

import { ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DEMO_SORT_OPTIONS, type DemoSortOption } from "./demo-mock-data";

interface DemoSortDropdownProps {
  /** Current sort value. */
  value: string;
  /** Callback when sort changes. */
  onChange: (value: string) => void;
  /** Whether the dropdown is disabled. */
  disabled?: boolean;
  /** Custom sort options. */
  options?: DemoSortOption[];
  /** Additional CSS classes for trigger. */
  className?: string;
}

/**
 * Glassmorphism sort dropdown for Apple TV+ demo.
 */
export function DemoSortDropdown({
  value,
  onChange,
  disabled = false,
  options = DEMO_SORT_OPTIONS,
  className,
}: DemoSortDropdownProps) {
  const currentLabel =
    options.find((opt) => opt.value === value)?.label ?? "Sort";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5",
          "text-sm",
          "text-[var(--atv-text-secondary)]",
          "border border-transparent",
          "hover:bg-white/5",
          "transition-colors",
          "data-[state=open]:bg-white/10 data-[state=open]:backdrop-blur-sm data-[state=open]:border-white/20 data-[state=open]:text-[var(--atv-text-primary)]",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <ArrowUpDown aria-hidden="true" className="size-4" />
        <span>{currentLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
