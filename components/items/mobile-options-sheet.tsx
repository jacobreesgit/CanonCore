/**
 * Mobile bottom drawer for toolbar options.
 * Consolidates Sort, multi-select Filter, and View controls into a swipe-up drawer.
 * Uses MobileBottomSheet for consistent mobile sheet behavior.
 * Glassmorphism styling.
 */

"use client";

import { useState, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSliders,
  faArrowsUpDown,
  faFilter,
  faCheck,
  faXmark,
  faTableCells,
  faList,
} from "@fortawesome/free-solid-svg-icons";
import {
  MobileBottomSheet,
  MobileBottomSheetHeader,
  MobileBottomSheetTitle,
  MobileBottomSheetContent,
} from "@/components/mobile/mobile-bottom-sheet";
import { cn } from "@/lib/utils";
import {
  SORT_OPTIONS,
  CONTENT_FILTER_OPTIONS,
  type SortOptionConfig,
} from "@/lib/item-utils";
import type { SortOption, ContentFilter, ViewMode } from "@/lib/types";

/** File status filter options. */
const FILE_OPTIONS = CONTENT_FILTER_OPTIONS.filter((o) => o.group === "file");

/** Sync status filter options. */
const SYNC_OPTIONS = CONTENT_FILTER_OPTIONS.filter((o) => o.group === "sync");

export interface MobileOptionsSheetProps {
  /** Current sort option. Optional - when omitted, sort section is hidden. */
  sortBy?: SortOption;
  /** Callback when sort option changes. Optional - when omitted, sort section is hidden. */
  onSortChange?: (value: SortOption) => void;
  /** Active content filters. Optional - when omitted, filter section is hidden. */
  filters?: ContentFilter[];
  /** Toggle a single filter on/off. */
  toggleFilter?: (filter: ContentFilter) => void;
  /** Clear all active filters. */
  clearFilters?: () => void;
  /** Whether controls are disabled (e.g., no items). */
  disabled?: boolean;
  /** Custom sort options to display. Defaults to SORT_OPTIONS. */
  sortOptions?: SortOptionConfig[];
  /** Default sort option for determining "active" state. Defaults to "custom". */
  defaultSort?: SortOption;

  // --- View mode (optional) ---
  /** Current view mode. Optional - when omitted, view section is hidden. */
  viewMode?: ViewMode;
  /** Callback when view mode changes. */
  onViewChange?: (value: ViewMode) => void;
}

/**
 * Bottom drawer containing Sort and Filter options for mobile.
 * Provides a native-feeling swipe-to-close interaction.
 *
 * @param sortBy - Current sort option
 * @param onSortChange - Callback when sort changes
 * @param filters - Active content filters
 * @param toggleFilter - Toggle a single filter on/off
 * @param clearFilters - Clear all active filters
 * @param disabled - Whether controls are disabled
 * @param sortOptions - Custom sort options (defaults to SORT_OPTIONS)
 * @param defaultSort - Default sort for active indicator (defaults to "custom")
 */
export function MobileOptionsSheet({
  sortBy,
  onSortChange,
  filters,
  toggleFilter,
  clearFilters,
  disabled = false,
  sortOptions = SORT_OPTIONS,
  defaultSort = "custom",
  viewMode,
  onViewChange,
}: MobileOptionsSheetProps) {
  const [open, setOpen] = useState(false);
  const sortRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Calculate if any non-default options are active
  const hasActiveSort =
    sortBy !== undefined &&
    onSortChange !== undefined &&
    sortBy !== defaultSort;
  const hasActiveFilter = filters !== undefined && filters.length > 0;
  const hasActiveOptions = hasActiveSort || hasActiveFilter;

  // Whether to show each section
  const showView = viewMode !== undefined && onViewChange !== undefined;
  const showSort = sortBy !== undefined && onSortChange !== undefined;
  const showFilter = filters !== undefined && toggleFilter !== undefined;

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
          "min-h-[44px]",
          "text-sm",
          "text-muted-foreground",
          "hover:bg-white/5",
          "transition-colors",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <FontAwesomeIcon
          icon={faSliders}
          aria-hidden="true"
          className="size-4"
        />
        <span>Options</span>
        {/* Active indicator dot */}
        {hasActiveOptions && (
          <span className="bg-primary absolute -top-1 -right-1 size-2 rounded-full">
            <span className="sr-only">(active filters)</span>
          </span>
        )}
      </button>

      {/* Bottom sheet - glassmorphism styling */}
      <MobileBottomSheet
        open={open}
        onOpenChange={setOpen}
        snapPoints={["auto"]}
        title="View Options"
        description="Sort and filter your items"
        data-testid="sheet-mobile-options"
        className={cn(
          "glass-dialog",
          "border-t border-white/[0.08]",
          "text-foreground"
        )}
      >
        <MobileBottomSheetHeader>
          <MobileBottomSheetTitle className="text-foreground">
            View Options
          </MobileBottomSheetTitle>
        </MobileBottomSheetHeader>

        <MobileBottomSheetContent className="space-y-6 pb-8">
          {/* View Mode Section */}
          {showView && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-[var(--tertiary-foreground)] uppercase">
                <FontAwesomeIcon
                  icon={faTableCells}
                  aria-hidden="true"
                  className="size-4"
                />
                <span>View</span>
              </div>
              <div
                className="-mx-2 space-y-1"
                role="listbox"
                aria-label="View mode"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={viewMode === "grid"}
                  onClick={() => onViewChange!("grid")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-4 py-3",
                    "text-sm font-medium",
                    "transition-colors duration-150",
                    "min-h-[44px]",
                    viewMode === "grid"
                      ? "text-foreground bg-white/20"
                      : "text-muted-foreground hover:bg-white/10",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <FontAwesomeIcon
                      icon={faTableCells}
                      aria-hidden="true"
                      className="size-4"
                    />
                    Grid
                  </span>
                  {viewMode === "grid" && (
                    <FontAwesomeIcon
                      icon={faCheck}
                      aria-hidden="true"
                      className="size-4"
                    />
                  )}
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={viewMode === "tree"}
                  onClick={() => onViewChange!("tree")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-4 py-3",
                    "text-sm font-medium",
                    "transition-colors duration-150",
                    "min-h-[44px]",
                    viewMode === "tree"
                      ? "text-foreground bg-white/20"
                      : "text-muted-foreground hover:bg-white/10",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <FontAwesomeIcon
                      icon={faList}
                      aria-hidden="true"
                      className="size-4"
                    />
                    Tree
                  </span>
                  {viewMode === "tree" && (
                    <FontAwesomeIcon
                      icon={faCheck}
                      aria-hidden="true"
                      className="size-4"
                    />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Sort Section */}
          {showSort && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-[var(--tertiary-foreground)] uppercase">
                <FontAwesomeIcon
                  icon={faArrowsUpDown}
                  aria-hidden="true"
                  className="size-4"
                />
                <span>Sort By</span>
              </div>
              <div
                className="-mx-2 space-y-1"
                role="radiogroup"
                aria-label="Sort options"
              >
                {sortOptions.map((option, index) => (
                  <button
                    key={option.value}
                    ref={(el) => {
                      sortRefs.current[index] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={sortBy === option.value}
                    onClick={() => {
                      onSortChange!(option.value);
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
                    {sortBy === option.value && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        aria-hidden="true"
                        className="size-4"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Section - multi-select checkboxes grouped by type */}
          {showFilter && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-[var(--tertiary-foreground)] uppercase">
                  <FontAwesomeIcon
                    icon={faFilter}
                    aria-hidden="true"
                    className="size-4"
                  />
                  <span>
                    Filter{hasActiveFilter ? ` (${filters!.length})` : ""}
                  </span>
                </div>
                {hasActiveFilter && clearFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    aria-label="Clear all filters"
                    className={cn(
                      "flex items-center gap-1 text-xs",
                      "text-muted-foreground hover:text-foreground",
                      "transition-colors"
                    )}
                  >
                    <FontAwesomeIcon
                      icon={faXmark}
                      aria-hidden="true"
                      className="size-3"
                    />
                    Clear all
                  </button>
                )}
              </div>

              {/* File Status Group */}
              <div
                className="-mx-2 space-y-1"
                role="group"
                aria-label="File status filters"
              >
                <span className="text-muted-foreground px-4 text-[11px] font-medium tracking-wider uppercase">
                  File Status
                </span>
                {FILE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="checkbox"
                    aria-checked={filters!.includes(option.value)}
                    onClick={() => toggleFilter!(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-4 py-3",
                      "text-sm font-medium",
                      "transition-colors duration-150",
                      "min-h-[44px]",
                      filters!.includes(option.value)
                        ? "text-foreground bg-white/20"
                        : "text-muted-foreground hover:bg-white/10",
                      "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    )}
                  >
                    <span>{option.label}</span>
                    {filters!.includes(option.value) && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        aria-hidden="true"
                        className="size-4"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Sync Status Group */}
              <div
                className="-mx-2 space-y-1 pt-1"
                role="group"
                aria-label="Sync status filters"
              >
                <span className="text-muted-foreground px-4 text-[11px] font-medium tracking-wider uppercase">
                  Sync Status
                </span>
                {SYNC_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="checkbox"
                    aria-checked={filters!.includes(option.value)}
                    onClick={() => toggleFilter!(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-4 py-3",
                      "text-sm font-medium",
                      "transition-colors duration-150",
                      "min-h-[44px]",
                      filters!.includes(option.value)
                        ? "text-foreground bg-white/20"
                        : "text-muted-foreground hover:bg-white/10",
                      "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    )}
                  >
                    <span>{option.label}</span>
                    {filters!.includes(option.value) && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        aria-hidden="true"
                        className="size-4"
                      />
                    )}
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
