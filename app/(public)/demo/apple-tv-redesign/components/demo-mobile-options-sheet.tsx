/**
 * Mobile bottom sheet for sort and filter options.
 * Apple TV+ styling with glassmorphism.
 */

"use client";

import { ArrowUpDown, Filter, Check, SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  DEMO_SORT_OPTIONS,
  DEMO_FILTER_OPTIONS,
  type DemoSortOption,
  type DemoFilterOption,
} from "./demo-mock-data";

interface DemoMobileOptionsSheetProps {
  /** Current sort value. */
  sortValue: string;
  /** Callback when sort changes. */
  onSortChange: (value: string) => void;
  /** Current filter value. */
  filterValue: string;
  /** Callback when filter changes. */
  onFilterChange: (value: string) => void;
  /** Custom sort options. */
  sortOptions?: DemoSortOption[];
  /** Custom filter options. */
  filterOptions?: DemoFilterOption[];
  /** Additional CSS classes for trigger. */
  className?: string;
}

/**
 * Option button component for the sheet.
 */
function OptionButton({
  label,
  isSelected,
  onClick,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-4 py-3",
        "text-sm font-medium",
        "transition-colors duration-150",
        isSelected
          ? "bg-white/20 text-[var(--atv-text-primary)]"
          : "text-[var(--atv-text-secondary)] hover:bg-white/10"
      )}
    >
      <span>{label}</span>
      {isSelected && <Check className="size-4" />}
    </button>
  );
}

/**
 * Mobile bottom sheet for sort and filter options.
 * Used on mobile devices where dropdowns are less accessible.
 */
export function DemoMobileOptionsSheet({
  sortValue,
  onSortChange,
  filterValue,
  onFilterChange,
  sortOptions = DEMO_SORT_OPTIONS,
  filterOptions = DEMO_FILTER_OPTIONS,
  className,
}: DemoMobileOptionsSheetProps) {
  return (
    <Sheet>
      <SheetTrigger
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5",
          "text-sm",
          "text-[var(--atv-text-secondary)]",
          "hover:bg-white/5",
          "transition-colors",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
          "md:hidden", // Only show on mobile
          className
        )}
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        <span>Options</span>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className={cn(
          "border-t border-[var(--atv-border)] bg-[var(--atv-surface)]",
          "text-[var(--atv-text-primary)]",
          "rounded-t-2xl",
          "max-h-[80vh] overflow-auto",
          // Override close button styles
          "[&_[data-slot=sheet-close]]:text-[var(--atv-text-secondary)]",
          "[&_[data-slot=sheet-close]]:hover:text-[var(--atv-text-primary)]"
        )}
      >
        <SheetHeader className="border-b border-[var(--atv-border)] pb-4">
          <SheetTitle className="text-[var(--atv-text-primary)]">
            View Options
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Sort Section */}
          <div>
            <div className="mb-2 flex items-center gap-2 px-4">
              <ArrowUpDown
                aria-hidden="true"
                className="size-4 text-[var(--atv-text-tertiary)]"
              />
              <span className="text-xs font-medium tracking-wider text-[var(--atv-text-tertiary)] uppercase">
                Sort By
              </span>
            </div>
            <div className="space-y-1">
              {sortOptions.map((option) => (
                <OptionButton
                  key={option.value}
                  label={option.label}
                  isSelected={sortValue === option.value}
                  onClick={() => onSortChange(option.value)}
                />
              ))}
            </div>
          </div>

          {/* Filter Section */}
          <div>
            <div className="mb-2 flex items-center gap-2 px-4">
              <Filter
                aria-hidden="true"
                className="size-4 text-[var(--atv-text-tertiary)]"
              />
              <span className="text-xs font-medium tracking-wider text-[var(--atv-text-tertiary)] uppercase">
                Filter
              </span>
            </div>
            <div className="space-y-1">
              {filterOptions.map((option) => (
                <OptionButton
                  key={option.value}
                  label={option.label}
                  isSelected={filterValue === option.value}
                  onClick={() => onFilterChange(option.value)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Safe area padding for iPhone */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </SheetContent>
    </Sheet>
  );
}
