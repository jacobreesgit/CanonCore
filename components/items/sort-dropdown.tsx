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
import { SORT_OPTIONS } from "@/lib/item-utils";
import type { SortOption } from "@/lib/types";

interface SortDropdownProps {
  /** Current sort option value. */
  value: SortOption;
  /** Callback when sort option changes. */
  onChange: (value: SortOption) => void;
  /** Whether the dropdown is disabled. */
  disabled?: boolean;
}

/**
 * Dropdown for selecting sort order for items.
 * Shows current selection and allows choosing from available sort options.
 *
 * @param value - Current sort option
 * @param onChange - Callback when sort option changes
 * @param disabled - Whether the dropdown is disabled
 */
export function SortDropdown({ value, onChange, disabled }: SortDropdownProps) {
  const currentLabel =
    SORT_OPTIONS.find((opt) => opt.value === value)?.label ?? "Sort";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <ArrowUpDown className="mr-2 size-4" />
          {currentLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as SortOption)}
        >
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
