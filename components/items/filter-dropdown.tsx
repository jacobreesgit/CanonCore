/**
 * Multi-select dropdown for filtering items by content criteria.
 * Grouped checkboxes with glassmorphism styling matching the cinematic design system.
 */

"use client";

import { Filter, X } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONTENT_FILTER_OPTIONS } from "@/lib/item-utils";
import type { ContentFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterDropdownProps {
  /** Currently active content filters. */
  filters: ContentFilter[];
  /** Toggle a single filter on/off (handles mutual exclusion). */
  toggleFilter: (filter: ContentFilter) => void;
  /** Clear all active filters. */
  clearFilters: () => void;
  /** Whether the dropdown is disabled. */
  disabled?: boolean;
  /** Additional CSS classes for trigger. */
  className?: string;
}

/** File status filter options. */
const FILE_OPTIONS = CONTENT_FILTER_OPTIONS.filter((o) => o.group === "file");

/** Sync status filter options. */
const SYNC_OPTIONS = CONTENT_FILTER_OPTIONS.filter((o) => o.group === "sync");

/**
 * Multi-select dropdown for filtering items by file and sync status.
 * Uses grouped checkboxes with "File Status" and "Sync Status" sections.
 * Shows active filter count badge and a clear button when filters are active.
 *
 * @param props - Filter dropdown props
 */
export function FilterDropdown({
  filters,
  toggleFilter,
  clearFilters,
  disabled,
  className,
}: FilterDropdownProps) {
  const activeCount = filters.length;
  const hasActive = activeCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        data-testid="items-filter-dropdown"
        aria-label={hasActive ? `Filter, ${activeCount} active` : "Filter"}
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
        <span>Filter{hasActive ? ` (${activeCount})` : ""}</span>
        {hasActive && (
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
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          "min-w-[180px]"
        )}
      >
        {/* File Status Group */}
        <DropdownMenuLabel className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          File Status
        </DropdownMenuLabel>
        {FILE_OPTIONS.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={filters.includes(option.value)}
            onCheckedChange={() => toggleFilter(option.value)}
            onSelect={(e) => e.preventDefault()}
            className="focus:bg-white/10"
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator className="bg-white/[0.08]" />

        {/* Sync Status Group */}
        <DropdownMenuLabel className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Sync Status
        </DropdownMenuLabel>
        {SYNC_OPTIONS.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={filters.includes(option.value)}
            onCheckedChange={() => toggleFilter(option.value)}
            onSelect={(e) => e.preventDefault()}
            className="focus:bg-white/10"
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}

        {/* Clear Filters */}
        {hasActive && (
          <>
            <DropdownMenuSeparator className="bg-white/[0.08]" />
            <button
              type="button"
              onClick={clearFilters}
              aria-label="Clear all filters"
              data-testid="items-filter-clear"
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5",
                "text-muted-foreground text-sm",
                "hover:text-foreground hover:bg-white/10",
                "rounded-sm transition-colors",
                "cursor-pointer"
              )}
            >
              <X aria-hidden="true" className="size-4" />
              Clear filters
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
