/**
 * Unified toolbar for all content pages.
 * Renders glassmorphism container with optional sort, filter, sync, and actions.
 * Responsive: collapses sort/filter into MobileOptionsSheet on mobile.
 */

"use client";

import type { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { FilterDropdown } from "@/components/items/filter-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import type { SortOptionConfig, FilterOptionConfig } from "@/lib/item-utils";
import type { SortOption, FilterOption } from "@/lib/types";

/**
 * Icon button for toolbar actions with glassmorphism styling.
 */
export function ToolbarIconButton({
  onClick,
  disabled,
  ariaLabel,
  children,
  className,
}: {
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center",
        "size-8 rounded-full",
        "text-muted-foreground",
        "hover:text-foreground hover:bg-white/10",
        "transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

/**
 * Vertical divider between toolbar sections.
 */
export function ToolbarDivider() {
  return <div className="mx-1 h-4 w-px bg-white/10" aria-hidden="true" />;
}

interface ContentToolbarProps {
  // --- Sort (optional) ---
  /** Current sort option. */
  sortBy?: SortOption;
  /** Callback when sort option changes. */
  onSortChange?: (value: SortOption) => void;
  /** Custom sort options to display. */
  sortOptions?: SortOptionConfig[];
  /** Default sort for MobileOptionsSheet active indicator. */
  defaultSort?: SortOption;

  // --- Filter (optional) ---
  /** Current filter option. */
  filterBy?: FilterOption | string;
  /** Callback when filter option changes. */
  onFilterChange?: (value: FilterOption) => void;
  /** Custom filter options to display. Accepts standard FilterOptionConfig or generic string-value options. */
  filterOptions?: FilterOptionConfig[] | { value: string; label: string }[];

  // --- Sync (optional) ---
  /** Show sync button. */
  showSync?: boolean;
  /** Whether a sync is in progress. */
  isSyncing?: boolean;
  /** Callback when sync is triggered. */
  onSync?: () => void;
  /** Whether Google Drive is connected (enables sync button). */
  hasDriveConnection?: boolean;

  // --- General ---
  /** Whether controls are disabled (e.g., no items). */
  disabled?: boolean;
  /** Left-side actions slot, rendered before sort/filter (e.g., ViewToggle). */
  leftActions?: ReactNode;
  /** Right-side actions slot (e.g., Add, Edit, Settings buttons). */
  actions?: ReactNode;
}

/**
 * Unified toolbar for content pages.
 * Renders a glassmorphism container inside a Section with responsive layout.
 *
 * Desktop: leftActions + sort + filter on left, actions + sync on right.
 * Mobile: MobileOptionsSheet on left, actions + sync icon on right.
 *
 * @param sortBy - Current sort option (omit to hide sort)
 * @param filterBy - Current filter option (omit to hide filter)
 * @param showSync - Show sync button (rendered on right side)
 * @param leftActions - Left-side action buttons (e.g., ViewToggle)
 * @param actions - Right-side action buttons (e.g., Add, Edit, Settings)
 */
export function ContentToolbar({
  sortBy,
  onSortChange,
  sortOptions,
  defaultSort,
  filterBy,
  onFilterChange,
  filterOptions,
  showSync,
  isSyncing,
  onSync,
  hasDriveConnection,
  disabled,
  leftActions,
  actions,
}: ContentToolbarProps) {
  const hasSortFilter =
    sortBy !== undefined &&
    onSortChange !== undefined &&
    filterBy !== undefined &&
    onFilterChange !== undefined;

  const hasRightContent = actions || showSync;

  return (
    <Section className="py-4" aria-label="Content controls">
      <div
        className={cn(
          "flex w-full items-center justify-between gap-2 sm:gap-3",
          "rounded-xl px-3 py-2",
          "bg-white/[0.04] backdrop-blur-md",
          "border border-white/[0.06]"
        )}
      >
        {/* Left side: sort/filter dropdowns + leftActions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile layout */}
          <div className="flex items-center gap-2 sm:hidden">
            {hasSortFilter && (
              <MobileOptionsSheet
                sortBy={sortBy}
                onSortChange={onSortChange}
                filterBy={filterBy as FilterOption}
                onFilterChange={onFilterChange}
                disabled={disabled}
                sortOptions={sortOptions}
                filterOptions={
                  filterOptions as FilterOptionConfig[] | undefined
                }
                defaultSort={defaultSort}
              />
            )}
            {leftActions && (
              <>
                {hasSortFilter && <ToolbarDivider />}
                {leftActions}
              </>
            )}
          </div>

          {/* Desktop layout */}
          <div className="hidden items-center gap-2 sm:flex sm:gap-3">
            {sortBy !== undefined && onSortChange && (
              <SortDropdown
                value={sortBy}
                onChange={onSortChange}
                disabled={disabled}
                options={sortOptions}
              />
            )}
            {filterBy !== undefined && onFilterChange && (
              <FilterDropdown
                value={filterBy}
                onChange={onFilterChange as (value: string) => void}
                disabled={disabled}
                options={filterOptions}
              />
            )}
            {leftActions && (
              <>
                {hasSortFilter && <ToolbarDivider />}
                {leftActions}
              </>
            )}
          </div>
        </div>

        {/* Right side: Actions + Sync */}
        {hasRightContent && (
          <div className="flex items-center gap-2 sm:gap-3">
            {actions}
            {showSync && (
              <>
                {actions && <ToolbarDivider />}
                {/* Mobile sync icon */}
                <div className="sm:hidden">
                  <ToolbarIconButton
                    onClick={onSync}
                    disabled={!hasDriveConnection || isSyncing}
                    ariaLabel={isSyncing ? "Syncing" : "Sync"}
                  >
                    {isSyncing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                  </ToolbarIconButton>
                </div>
                {/* Desktop sync button */}
                <button
                  type="button"
                  onClick={onSync}
                  disabled={!hasDriveConnection || isSyncing}
                  className={cn(
                    "hidden sm:inline-flex",
                    "items-center gap-1.5 rounded-md px-3 py-1.5",
                    "text-sm",
                    "text-muted-foreground",
                    "hover:text-foreground hover:bg-white/10",
                    "transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  {isSyncing ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden="true" />
                  )}
                  <span>{isSyncing ? "Syncing\u2026" : "Sync"}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
