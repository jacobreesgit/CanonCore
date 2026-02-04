/**
 * Unified toolbar assembling sort, filter, view toggle, add, and edit controls.
 * Apple TV+ glassmorphism styling.
 */

"use client";

import { Plus, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DemoSortDropdown } from "./demo-sort-dropdown";
import { DemoFilterDropdown } from "./demo-filter-dropdown";
import { DemoViewToggle } from "./demo-view-toggle";

type ViewMode = "grid" | "tree";

interface DemoToolbarProps {
  /** Current sort value. */
  sortValue: string;
  /** Callback when sort changes. */
  onSortChange: (value: string) => void;
  /** Current filter value. */
  filterValue: string;
  /** Callback when filter changes. */
  onFilterChange: (value: string) => void;
  /** Current view mode. */
  viewMode?: ViewMode;
  /** Callback when view mode changes. */
  onViewModeChange?: (value: ViewMode) => void;
  /** Whether to show view toggle. */
  showViewToggle?: boolean;
  /** Whether to show sync button. */
  showSync?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Toolbar pill button component.
 */
function ToolbarButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5",
        "text-sm",
        "text-[var(--atv-text-secondary)]",
        "hover:bg-white/5",
        "transition-colors",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        className
      )}
    >
      {children}
    </button>
  );
}

/**
 * Unified toolbar for demo pages.
 * Combines sort, filter, view toggle, add, and edit controls.
 */
export function DemoToolbar({
  sortValue,
  onSortChange,
  filterValue,
  onFilterChange,
  viewMode = "grid",
  onViewModeChange,
  showViewToggle = true,
  showSync = false,
  className,
}: DemoToolbarProps) {
  const handleSync = () => {
    toast.info("Sync would start now");
  };

  const handleAdd = () => {
    toast.info("Add item dialog would open");
  };

  const handleEdit = () => {
    toast.info("Edit mode would toggle");
  };

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {/* Left side: Sort, Filter, Sync */}
      <div className="flex items-center gap-2">
        {showSync && (
          <ToolbarButton onClick={handleSync}>
            <RefreshCw aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Sync</span>
          </ToolbarButton>
        )}
        <DemoSortDropdown value={sortValue} onChange={onSortChange} />
        <DemoFilterDropdown value={filterValue} onChange={onFilterChange} />
      </div>

      {/* Right side: View Toggle, Add, Edit */}
      <div className="flex items-center gap-2">
        {showViewToggle && onViewModeChange && (
          <DemoViewToggle value={viewMode} onChange={onViewModeChange} />
        )}
        <ToolbarButton onClick={handleAdd}>
          <Plus aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Add</span>
        </ToolbarButton>
        <ToolbarButton onClick={handleEdit}>
          <Pencil aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Edit</span>
        </ToolbarButton>
      </div>
    </div>
  );
}
