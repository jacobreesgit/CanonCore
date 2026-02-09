/**
 * Dropdown component for selecting item sort order.
 * Glassmorphism styling with typed SortOption.
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
import { SORT_OPTIONS, type SortOptionConfig } from "@/lib/item-utils";
import type { SortOption } from "@/lib/types";

interface SortDropdownProps {
  /** Current sort option value. */
  value: SortOption;
  /** Callback when sort option changes. */
  onChange: (value: SortOption) => void;
  /** Whether the dropdown is disabled. */
  disabled?: boolean;
  /** Custom sort options to display. Defaults to SORT_OPTIONS. */
  options?: SortOptionConfig[];
  /** Additional CSS classes for trigger. */
  className?: string;
}

/**
 * Dropdown for selecting sort order for items.
 * Shows current selection and allows choosing from available sort options.
 */
export function SortDropdown({
  value,
  onChange,
  disabled,
  options = SORT_OPTIONS,
  className,
}: SortDropdownProps) {
  const currentLabel =
    options.find((opt) => opt.value === value)?.label ?? "Sort";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5",
          "text-sm",
          "text-muted-foreground",
          "border border-transparent",
          "hover:bg-white/5",
          "transition-colors",
          "data-[state=open]:text-foreground data-[state=open]:border-white/20 data-[state=open]:bg-white/10 data-[state=open]:backdrop-blur-sm",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <ArrowUpDown aria-hidden="true" className="size-4" />
        <span>{currentLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          "bg-[#1a1a1a]/90 backdrop-blur-xl",
          "border border-white/[0.08]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        )}
      >
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as SortOption)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="focus:bg-white/10"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
