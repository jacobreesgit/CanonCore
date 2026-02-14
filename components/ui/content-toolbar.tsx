/**
 * Unified toolbar for all content pages.
 * Renders glassmorphism container with optional sort, filter, sync, and actions.
 * Responsive: collapses sort/filter into MobileOptionsSheet (or MobileItemSheet) on mobile.
 */

"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { LayoutGrid, List, Loader2, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { FilterDropdown } from "@/components/items/filter-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";
import type { SortOptionConfig } from "@/lib/item-utils";
import type { SortOption, ContentFilter, ViewMode } from "@/lib/types";
import type {
  ItemSettingsFormItem,
  ItemSettingsFormFiles,
} from "@/hooks/use-item-settings-form";

// Lazy-load MobileItemSheet (mobile-only, pulls in Framer Motion)
const MobileItemSheet = dynamic(
  () =>
    import("@/components/items/mobile-item-sheet").then((mod) => ({
      default: mod.MobileItemSheet,
    })),
  { ssr: false }
);

const MobileItemSheetTrigger = dynamic(
  () =>
    import("@/components/items/mobile-item-sheet").then((mod) => ({
      default: mod.MobileItemSheetTrigger,
    })),
  { ssr: false }
);

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

const VIEW_OPTIONS: {
  value: ViewMode;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "tree", label: "Tree", icon: List },
];

/**
 * Dropdown for switching between grid and tree view modes.
 * Matches the glassmorphism styling of SortDropdown and FilterDropdown.
 */
function ViewDropdown({
  value,
  onChange,
  disabled,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  disabled?: boolean;
}) {
  const current =
    VIEW_OPTIONS.find((opt) => opt.value === value) ?? VIEW_OPTIONS[0];
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}

        aria-label={`View mode: ${current.label}`}
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5",
          "text-sm",
          "text-muted-foreground",
          "border border-transparent",
          "hover:bg-white/5",
          "transition-colors",
          "data-[state=open]:text-foreground data-[state=open]:border-white/20 data-[state=open]:bg-white/10 data-[state=open]:backdrop-blur-sm",
          "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
        <span>{current.label}</span>
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
          onValueChange={(v) => onChange(v as ViewMode)}
        >
          {VIEW_OPTIONS.map((option) => (
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

/** Mobile settings configuration for combined MobileItemSheet. */
export interface MobileSettingsConfig {
  /** Item data for settings form. */
  item: ItemSettingsFormItem;
  /** Files for settings form. */
  files: ItemSettingsFormFiles;
  /** Whether user has Google Drive connected. */
  hasDriveConnection?: boolean;
  /** Callback when settings change. */
  onSettingsChange?: () => Promise<void>;
  /** Whether the sheet is open. */
  settingsOpen: boolean;
  /** Callback when sheet open state changes. */
  onSettingsOpenChange: (open: boolean) => void;
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

  // --- Filter (optional, multi-select) ---
  /** Active content filters. */
  filters?: ContentFilter[];
  /** Toggle a single filter on/off. */
  toggleFilter?: (filter: ContentFilter) => void;
  /** Clear all active filters. */
  clearFilters?: () => void;

  // --- Sync (optional) ---
  /** Show sync button. */
  showSync?: boolean;
  /** Whether a sync is in progress. */
  isSyncing?: boolean;
  /** Callback when sync is triggered. */
  onSync?: () => void;
  /** Whether Google Drive is connected (enables sync button). */
  hasDriveConnection?: boolean;

  // --- View mode (optional) ---
  /** Current view mode. Desktop renders dropdown, mobile uses bottom sheet. */
  viewMode?: ViewMode;
  /** Callback when view mode changes. */
  onViewChange?: (value: ViewMode) => void;

  // --- General ---
  /** Whether controls are disabled (e.g., no items). */
  disabled?: boolean;
  /** Left-side actions slot, rendered after sort/filter/view dropdowns. */
  leftActions?: ReactNode;
  /** Right-side actions slot (e.g., Add, Edit, Settings buttons). */
  actions?: ReactNode;

  // --- Mobile settings (optional) ---
  /** When provided, mobile renders combined MobileItemSheet instead of MobileOptionsSheet. */
  mobileSettings?: MobileSettingsConfig;
}

/**
 * Unified toolbar for content pages.
 * Renders a glassmorphism container inside a Section with responsive layout.
 *
 * Desktop: leftActions + sort + filter on left, actions + sync on right.
 * Mobile: MobileOptionsSheet (or MobileItemSheet) on left, actions + sync icon on right.
 *
 * @param sortBy - Current sort option (omit to hide sort)
 * @param filterBy - Current filter option (omit to hide filter)
 * @param showSync - Show sync button (rendered on right side)
 * @param leftActions - Left-side action buttons
 * @param actions - Right-side action buttons (e.g., Add, Edit, Settings)
 * @param mobileSettings - When provided, mobile uses combined settings sheet
 */
export function ContentToolbar({
  sortBy,
  onSortChange,
  sortOptions,
  defaultSort,
  filters,
  toggleFilter,
  clearFilters,
  viewMode,
  onViewChange,
  showSync,
  isSyncing,
  onSync,
  hasDriveConnection,
  disabled,
  leftActions,
  actions,
  mobileSettings,
}: ContentToolbarProps) {
  const hasSort = sortBy !== undefined && onSortChange !== undefined;
  const hasFilter =
    filters !== undefined &&
    toggleFilter !== undefined &&
    clearFilters !== undefined;
  const hasView = viewMode !== undefined && onViewChange !== undefined;
  const hasMobileSheet = hasSort || hasFilter || hasView;

  const hasRightContent = actions || showSync;

  // Calculate active options for trigger indicator
  const hasActiveSort =
    sortBy !== undefined && sortBy !== (defaultSort ?? "custom");
  const hasActiveFilter = filters !== undefined && filters.length > 0;
  const hasActiveOptions = hasActiveSort || hasActiveFilter;

  return (
    <Section className="py-4" aria-label="Content controls">
      <div
        className={cn(
          "flex w-full items-center justify-between gap-2 lg:gap-3",
          "rounded-xl px-3 py-2",
          "bg-white/[0.04] backdrop-blur-md",
          "border border-white/[0.06]"
        )}
      >
        {/* Left side: sort/filter dropdowns + leftActions */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Mobile layout */}
          <div className="flex items-center gap-2 lg:hidden">
            {mobileSettings ? (
              <>
                <MobileItemSheetTrigger
                  onClick={() => mobileSettings.onSettingsOpenChange(true)}
                  disabled={false}
                  hasActiveOptions={hasActiveOptions}
                />
                <MobileItemSheet
                  open={mobileSettings.settingsOpen}
                  onOpenChange={mobileSettings.onSettingsOpenChange}
                  sortBy={sortBy}
                  onSortChange={onSortChange}
                  filters={filters}
                  toggleFilter={toggleFilter}
                  clearFilters={clearFilters}
                  sortOptions={sortOptions}
                  defaultSort={defaultSort}
                  viewMode={viewMode}
                  onViewChange={onViewChange}
                  item={mobileSettings.item}
                  files={mobileSettings.files}
                  hasDriveConnection={mobileSettings.hasDriveConnection}
                  onSettingsChange={mobileSettings.onSettingsChange}
                  disabled={disabled}
                />
              </>
            ) : (
              hasMobileSheet && (
                <MobileOptionsSheet
                  sortBy={sortBy}
                  onSortChange={onSortChange}
                  filters={filters}
                  toggleFilter={toggleFilter}
                  clearFilters={clearFilters}
                  disabled={disabled}
                  sortOptions={sortOptions}
                  defaultSort={defaultSort}
                  viewMode={viewMode}
                  onViewChange={onViewChange}
                />
              )
            )}
            {leftActions && (
              <>
                {(hasMobileSheet || mobileSettings) && <ToolbarDivider />}
                {leftActions}
              </>
            )}
          </div>

          {/* Desktop layout */}
          <div className="hidden items-center gap-2 lg:flex lg:gap-3">
            {hasView && (
              <ViewDropdown
                value={viewMode}
                onChange={onViewChange}
                disabled={disabled}
              />
            )}
            {sortBy !== undefined && onSortChange && (
              <SortDropdown
                value={sortBy}
                onChange={onSortChange}
                disabled={disabled}
                options={sortOptions}
              />
            )}
            {hasFilter && (
              <FilterDropdown
                filters={filters!}
                toggleFilter={toggleFilter!}
                clearFilters={clearFilters!}
                disabled={disabled}
              />
            )}
            {leftActions && (
              <>
                {(hasSort || hasFilter || hasView) && <ToolbarDivider />}
                {leftActions}
              </>
            )}
          </div>
        </div>

        {/* Right side: Actions + Sync */}
        {hasRightContent && (
          <div className="flex items-center gap-2 lg:gap-3">
            {actions}
            {showSync && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={!hasDriveConnection || isSyncing}
                className="gap-1.5"
                aria-label={isSyncing ? "Syncing" : "Sync"}
              >
                {isSyncing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-4" aria-hidden="true" />
                )}
                <span className="hidden xl:inline">
                  {isSyncing ? "Syncing\u2026" : "Sync"}
                </span>
              </Button>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
