/**
 * Dropdown component for filtering items.
 * Glassmorphism styling with generic string values.
 */

"use client";

import { Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FILTER_OPTIONS } from "@/lib/item-utils";

interface FilterDropdownProps<T extends string = string> {
  /** Current filter value. */
  value: T;
  /** Callback when filter value changes. */
  onChange: (value: T) => void;
  /** Whether the dropdown is disabled. */
  disabled?: boolean;
  /** Custom filter options to display. Defaults to FILTER_OPTIONS. */
  options?: { value: T; label: string }[];
  /** Additional CSS classes for trigger. */
  className?: string;
}

/**
 * Dropdown for filtering items by various criteria.
 * Shows a visual indicator (dot) when a filter is active.
 */
export function FilterDropdown<T extends string = string>({
  value,
  onChange,
  disabled,
  options = FILTER_OPTIONS as { value: T; label: string }[],
  className,
}: FilterDropdownProps<T>) {
  const currentLabel =
    options.find((opt) => opt.value === value)?.label ?? "Filter";
  const isActive = value !== "all";

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
        <Filter aria-hidden="true" className="size-4" />
        <span>{currentLabel}</span>
        {isActive && (
          <span
            data-active="true"
            aria-hidden="true"
            className="bg-primary ml-1 size-2 rounded-full"
          />
        )}
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
          onValueChange={(v) => onChange(v as T)}
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
