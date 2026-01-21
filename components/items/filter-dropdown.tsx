/**
 * Dropdown component for filtering items.
 * Integrates with shadcn/ui DropdownMenu for consistent styling.
 */

"use client";

import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FILTER_OPTIONS, type FilterOptionConfig } from "@/lib/item-utils";
import type { FilterOption } from "@/lib/types";

interface FilterDropdownProps {
  /** Current filter option value. */
  value: FilterOption;
  /** Callback when filter option changes. */
  onChange: (value: FilterOption) => void;
  /** Whether the dropdown is disabled. */
  disabled?: boolean;
  /** Custom filter options to display. Defaults to FILTER_OPTIONS. */
  options?: FilterOptionConfig[];
}

/**
 * Dropdown for filtering items by various criteria.
 * Shows a visual indicator (dot) when a filter is active.
 *
 * @param value - Current filter option
 * @param onChange - Callback when filter option changes
 * @param disabled - Whether the dropdown is disabled
 * @param options - Custom filter options to display (defaults to FILTER_OPTIONS)
 */
export function FilterDropdown({
  value,
  onChange,
  disabled,
  options = FILTER_OPTIONS,
}: FilterDropdownProps) {
  const currentLabel =
    options.find((opt) => opt.value === value)?.label ?? "Filter";
  const isActive = value !== "all";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Filter aria-hidden="true" className="mr-2 size-4" />
          {currentLabel}
          {isActive && (
            <span
              aria-hidden="true"
              data-active="true"
              className="bg-primary ml-2 size-2 rounded-full"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as FilterOption)}
        >
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
