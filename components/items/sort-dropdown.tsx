/**
 * Dropdown component for selecting item sort order.
 * Integrates with shadcn/ui DropdownMenu for consistent styling.
 */

"use client";

import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}

/**
 * Dropdown for selecting sort order for items.
 * Shows current selection and allows choosing from available sort options.
 *
 * @param value - Current sort option
 * @param onChange - Callback when sort option changes
 * @param disabled - Whether the dropdown is disabled
 * @param options - Custom sort options to display (defaults to SORT_OPTIONS)
 */
export function SortDropdown({
  value,
  onChange,
  disabled,
  options = SORT_OPTIONS,
}: SortDropdownProps) {
  const currentLabel =
    options.find((opt) => opt.value === value)?.label ?? "Sort";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <ArrowUpDown aria-hidden="true" className="mr-2 size-4" />
          {currentLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as SortOption)}
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
