/**
 * Mobile bottom drawer for toolbar options.
 * Consolidates Sort and Filter controls into a swipe-up drawer.
 * Uses MobileBottomSheet for consistent mobile sheet behavior.
 * Glassmorphism styling.
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { SlidersHorizontal, ArrowUpDown, Filter, Check } from "lucide-react";
import {
  MobileBottomSheet,
  MobileBottomSheetHeader,
  MobileBottomSheetTitle,
  MobileBottomSheetContent,
} from "@/components/mobile/mobile-bottom-sheet";
import { cn } from "@/lib/utils";
import {
  SORT_OPTIONS,
  FILTER_OPTIONS,
  type SortOptionConfig,
  type FilterOptionConfig,
} from "@/lib/item-utils";
import type { SortOption, FilterOption } from "@/lib/types";

export interface MobileOptionsSheetProps {
  /** Current sort option. */
  sortBy: SortOption;
  /** Callback when sort option changes. */
  onSortChange: (value: SortOption) => void;
  /** Current filter option. Optional - when omitted, filter section is hidden. */
  filterBy?: FilterOption;
  /** Callback when filter option changes. Optional - when omitted, filter section is hidden. */
  onFilterChange?: (value: FilterOption) => void;
  /** Whether controls are disabled (e.g., no items). */
  disabled?: boolean;
  /** Custom sort options to display. Defaults to SORT_OPTIONS. */
  sortOptions?: SortOptionConfig[];
  /** Custom filter options to display. Defaults to FILTER_OPTIONS. */
  filterOptions?: FilterOptionConfig[];
  /** Default sort option for determining "active" state. Defaults to "custom". */
  defaultSort?: SortOption;
}

/**
 * Bottom drawer containing Sort and Filter options for mobile.
 * Provides a native-feeling swipe-to-close interaction.
 *
 * @param sortBy - Current sort option
 * @param onSortChange - Callback when sort changes
 * @param filterBy - Current filter option
 * @param onFilterChange - Callback when filter changes
 * @param disabled - Whether controls are disabled
 * @param sortOptions - Custom sort options (defaults to SORT_OPTIONS)
 * @param filterOptions - Custom filter options (defaults to FILTER_OPTIONS)
 * @param defaultSort - Default sort for active indicator (defaults to "custom")
 */
export function MobileOptionsSheet({
  sortBy,
  onSortChange,
  filterBy,
  onFilterChange,
  disabled = false,
  sortOptions = SORT_OPTIONS,
  filterOptions = FILTER_OPTIONS,
  defaultSort = "custom",
}: MobileOptionsSheetProps) {
  const [open, setOpen] = useState(false);
  const sortRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const filterRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Calculate if any non-default options are active
  const hasActiveSort = sortBy !== defaultSort;
  const hasActiveFilter = filterBy !== undefined && filterBy !== "all";
  const hasActiveOptions = hasActiveSort || hasActiveFilter;

  // Whether to show the filter section
  const showFilter = filterBy !== undefined && onFilterChange !== undefined;

  /**
   * Handles keyboard navigation within a list of options.
   * Arrow keys move focus, Enter/Space select.
   */
  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLButtonElement>,
      refs: React.MutableRefObject<(HTMLButtonElement | null)[]>,
      currentIndex: number
    ) => {
      const items = refs.current.filter(Boolean) as HTMLButtonElement[];
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          break;
      }

      if (nextIndex !== null) {
        items[nextIndex]?.focus();
      }
    },
    []
  );

  return (
    <>
      {/* Trigger button - glassmorphism styling */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "relative inline-flex items-center gap-2 rounded-md px-3 py-1.5",
          "text-sm",
          "text-muted-foreground",
          "hover:bg-white/5",
          "transition-colors",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        <span>Options</span>
        {/* Active indicator dot */}
        {hasActiveOptions && (
          <span className="bg-primary absolute -top-1 -right-1 size-2 rounded-full" />
        )}
      </button>

      {/* Bottom sheet - glassmorphism styling */}
      <MobileBottomSheet
        open={open}
        onOpenChange={setOpen}
        snapPoints={["auto"]}
        title="View Options"
        description="Sort and filter your items"
        className={cn(
          "bg-[#1a1a1a]/95 backdrop-blur-xl",
          "border-t border-white/[0.08]",
          "text-foreground"
        )}
      >
        <MobileBottomSheetHeader className="border-b border-white/[0.08] pb-4">
          <MobileBottomSheetTitle className="text-foreground">
            View Options
          </MobileBottomSheetTitle>
        </MobileBottomSheetHeader>

        <MobileBottomSheetContent className="space-y-6 px-0 pb-8">
          {/* Sort Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-4 text-xs font-medium tracking-wider text-[var(--tertiary-foreground)] uppercase">
              <ArrowUpDown aria-hidden="true" className="size-4" />
              <span>Sort By</span>
            </div>
            <div
              className="space-y-1 px-2"
              role="listbox"
              aria-label="Sort options"
            >
              {sortOptions.map((option, index) => (
                <button
                  key={option.value}
                  ref={(el) => {
                    sortRefs.current[index] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={sortBy === option.value}
                  onClick={() => {
                    onSortChange(option.value);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, sortRefs, index)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-4 py-3",
                    "text-sm font-medium",
                    "transition-colors duration-150",
                    sortBy === option.value
                      ? "text-foreground bg-white/20"
                      : "text-muted-foreground hover:bg-white/10",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                  )}
                >
                  <span>{option.label}</span>
                  {sortBy === option.value && <Check className="size-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Section - only shown when filter props provided */}
          {showFilter && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-4 text-xs font-medium tracking-wider text-[var(--tertiary-foreground)] uppercase">
                <Filter aria-hidden="true" className="size-4" />
                <span>Filter</span>
              </div>
              <div
                className="space-y-1 px-2"
                role="listbox"
                aria-label="Filter options"
              >
                {filterOptions.map((option, index) => (
                  <button
                    key={option.value}
                    ref={(el) => {
                      filterRefs.current[index] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={filterBy === option.value}
                    onClick={() => {
                      onFilterChange(option.value);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, filterRefs, index)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-4 py-3",
                      "text-sm font-medium",
                      "transition-colors duration-150",
                      filterBy === option.value
                        ? "text-foreground bg-white/20"
                        : "text-muted-foreground hover:bg-white/10",
                      "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    )}
                  >
                    <span>{option.label}</span>
                    {filterBy === option.value && <Check className="size-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Safe area padding for iPhone */}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </MobileBottomSheetContent>
      </MobileBottomSheet>
    </>
  );
}
