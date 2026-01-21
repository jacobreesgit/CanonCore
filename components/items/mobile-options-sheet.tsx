/**
 * Mobile bottom drawer for toolbar options.
 * Consolidates Sort and Filter controls into a swipe-up drawer.
 * Uses Vaul for native-feeling swipe gestures and spring animations.
 * Only rendered on mobile viewports for a cleaner toolbar experience.
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { SlidersHorizontal, ArrowUpDown, Filter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="relative gap-1.5"
        >
          <SlidersHorizontal className="size-4" />
          <span>Options</span>
          {/* Active indicator dot */}
          {hasActiveOptions && (
            <span className="bg-primary absolute -top-1 -right-1 size-2 rounded-full" />
          )}
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>View Options</DrawerTitle>
        </DrawerHeader>

        <div className="space-y-6 overflow-y-auto pb-8">
          {/* Sort Section */}
          <div className="space-y-2">
            <div className="text-muted-foreground flex items-center gap-2 px-4 text-xs font-medium tracking-wider uppercase">
              <ArrowUpDown className="size-3.5" />
              <span>Sort By</span>
            </div>
            <div
              className="border-border/50 border-y"
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
                    "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors",
                    "hover:bg-muted/50 active:bg-muted",
                    "focus-visible:bg-muted/50 focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                    sortBy === option.value && "bg-muted/30"
                  )}
                >
                  <span
                    className={cn(
                      sortBy === option.value
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {option.label}
                  </span>
                  {sortBy === option.value && (
                    <Check className="text-primary size-4" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Section - only shown when filter props provided */}
          {showFilter && (
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 px-4 text-xs font-medium tracking-wider uppercase">
                <Filter className="size-3.5" />
                <span>Filter</span>
              </div>
              <div
                className="border-border/50 border-y"
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
                      "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors",
                      "hover:bg-muted/50 active:bg-muted",
                      "focus-visible:bg-muted/50 focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                      filterBy === option.value && "bg-muted/30"
                    )}
                  >
                    <span
                      className={cn(
                        filterBy === option.value
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {option.label}
                    </span>
                    {filterBy === option.value && (
                      <Check className="text-primary size-4" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
