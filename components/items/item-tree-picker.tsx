/**
 * Shared virtualised item tree picker.
 * Extracted from ForkDestinationDialog for reuse in playlist creation.
 * Supports single-select (fork) and multi-select (playlist) modes.
 */

"use client";

import { useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faFolderOpen,
  faCheck,
  faChevronRight,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

/** Shape of an item in the picker list. */
export interface PickerItem {
  id: string;
  name: string;
  depth: number;
  hasChildren: boolean;
}

export interface ItemTreePickerProps {
  /** Flat list of items with depth metadata. */
  items: PickerItem[];
  /** Currently selected item IDs. */
  selectedIds: Set<string>;
  /** Toggle selection for an item. */
  onToggle: (id: string) => void;
  /** Multi-select (checkbox) vs single-select (radio). Defaults to false. */
  multiSelect?: boolean;
  /** Message when no items exist. */
  emptyMessage?: string;
  /** Whether the picker is disabled. */
  disabled?: boolean;
  className?: string;
}

/** Row height for virtualisation calculations. */
const ROW_HEIGHT = 40;

/** Single item row in the picker list. */
function PickerItemRow({
  item,
  isSelected,
  multiSelect,
  onSelect,
  style,
}: {
  item: PickerItem;
  isSelected: boolean;
  multiSelect: boolean;
  onSelect: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={multiSelect ? isSelected : undefined}
      aria-selected={!multiSelect ? isSelected : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left",
        "transition-colors duration-150",
        isSelected
          ? "text-foreground bg-white/20"
          : "text-muted-foreground hover:bg-white/10"
      )}
      style={{ ...style, paddingLeft: `${12 + item.depth * 16}px` }}
    >
      {multiSelect ? (
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
            isSelected
              ? "border-white/40 bg-white/20"
              : "border-white/20 bg-white/5"
          )}
        >
          {isSelected && (
            <FontAwesomeIcon icon={faCheck} className="size-2.5" />
          )}
        </span>
      ) : item.hasChildren ? (
        <FontAwesomeIcon
          icon={faFolderOpen}
          className="h-4 w-4 flex-shrink-0"
        />
      ) : (
        <FontAwesomeIcon icon={faFolder} className="h-4 w-4 flex-shrink-0" />
      )}
      <span className="min-w-0 truncate text-sm font-medium">{item.name}</span>
      {!multiSelect && item.hasChildren && (
        <FontAwesomeIcon
          icon={faChevronRight}
          className="ml-auto h-4 w-4 flex-shrink-0 opacity-50"
        />
      )}
    </button>
  );
}

/**
 * Virtualised tree picker with search filtering.
 * Used by ForkDestinationDialog (single-select) and CreatePlaylistDialog (multi-select).
 */
export function ItemTreePicker({
  items,
  selectedIds,
  onToggle,
  multiSelect = false,
  emptyMessage = "No items in your library yet.",
  disabled = false,
  className,
}: ItemTreePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, searchQuery]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns non-memoizable functions by design; component is leaf-level so no stale-UI risk
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Search input */}
      <div className="relative">
        <FontAwesomeIcon
          icon={faMagnifyingGlass}
          className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--tertiary-foreground)]"
        />
        <input
          type="text"
          placeholder="Search items…"
          aria-label="Search items"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
          className={cn(
            "h-9 w-full rounded-lg pr-3 pl-9",
            "border border-white/20 bg-white/10",
            "text-foreground text-sm",
            "placeholder:text-[var(--tertiary-foreground)]",
            "focus:ring-2 focus:ring-white/30 focus:outline-none",
            "disabled:opacity-50"
          )}
        />
      </div>

      {/* Virtualised list */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex h-48 flex-col overflow-auto rounded-lg",
          "border border-white/10",
          disabled && "pointer-events-none opacity-50"
        )}
        style={{ contain: "strict", overflowAnchor: "none" }}
      >
        {filteredItems.length > 0 ? (
          <div
            className="relative w-full p-2"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = filteredItems[virtualRow.index];
              return (
                <div
                  key={item.id}
                  className="absolute top-0 left-0 w-full px-2"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <PickerItemRow
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    multiSelect={multiSelect}
                    onSelect={() => onToggle(item.id)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              aria-hidden="true"
              className="size-8 text-[var(--tertiary-foreground)]"
            />
            <p className="text-muted-foreground text-sm">No results found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
