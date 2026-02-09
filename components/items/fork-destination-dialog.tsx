"use client";

/**
 * Dialog for selecting where to place a forked item in user's library.
 * Allows choosing root level or as a child of an existing item.
 * Uses virtualization for large item lists (1000+ items).
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  Loader2,
  Copy,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllItems } from "@/lib/item-actions";
import { MAX_ITEM_DEPTH } from "@/lib/config/items";
import type { ItemWithArtwork } from "@/lib/types";

interface ForkDestinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: (parentId: string | null) => void;
  isForking: boolean;
}

interface FolderItem {
  id: string;
  name: string;
  depth: number;
  hasChildren: boolean;
}

/** Row height for virtualization calculations. */
const FOLDER_ROW_HEIGHT = 40;

/**
 * Single folder item in the selection list.
 * Uses a regular button instead of motion for virtualization compatibility.
 * Glassmorphism styling.
 */
function FolderItemRow({
  folder,
  isSelected,
  onSelect,
  style,
}: {
  folder: FolderItem;
  isSelected: boolean;
  onSelect: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left",
        "transition-colors duration-150",
        isSelected
          ? "text-foreground bg-white/20"
          : "text-muted-foreground hover:bg-white/10"
      )}
      style={{ ...style, paddingLeft: `${12 + folder.depth * 16}px` }}
    >
      {folder.hasChildren ? (
        <FolderOpen className="h-4 w-4 flex-shrink-0" />
      ) : (
        <Folder className="h-4 w-4 flex-shrink-0" />
      )}
      <span className="min-w-0 truncate text-sm font-medium">
        {folder.name}
      </span>
      {folder.hasChildren && (
        <ChevronRight className="ml-auto h-4 w-4 flex-shrink-0 opacity-50" />
      )}
    </button>
  );
}

/**
 * Fork destination dialog component.
 */
export function ForkDestinationDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
  isForking,
}: ForkDestinationDialogProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter folders based on search query
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const query = searchQuery.toLowerCase();
    return folders.filter((folder) =>
      folder.name.toLowerCase().includes(query)
    );
  }, [folders, searchQuery]);

  // Virtualization for large lists
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual API is intentionally used here for virtualization
  const virtualizer = useVirtualizer({
    count: filteredFolders.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => FOLDER_ROW_HEIGHT,
    overscan: 5,
  });

  // Reset state when dialog opens and fetch items
  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);
      setSelectedId(null);
      setSearchQuery("");

      getAllItems()
        .then((result) => {
          if (!result.success) {
            setError("error" in result ? result.error : "Unknown error");
            setLoading(false);
            return;
          }

          const items: ItemWithArtwork[] = result.data ?? [];
          // Pre-compute set of parent IDs for O(1) hasChildren lookup
          const parentIds = new Set(
            items.map((i) => i.parentId).filter(Boolean)
          );
          // Convert to folder items, filtering by depth
          const folderItems: FolderItem[] = items
            .filter((item: ItemWithArtwork) => item.depth < MAX_ITEM_DEPTH - 1)
            .map((item: ItemWithArtwork) => ({
              id: item.id,
              name: item.name,
              depth: item.depth,
              hasChildren: parentIds.has(item.id),
            }))
            .sort((a: FolderItem, b: FolderItem) => {
              // Sort by depth first, then by name
              if (a.depth !== b.depth) return a.depth - b.depth;
              return a.name.localeCompare(b.name);
            });

          setFolders(folderItems);
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load items");
          setLoading(false);
        });
    }
  }, [open]);

  const handleConfirm = () => {
    onConfirm(selectedId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
          "bg-[#1a1a1a]/95 backdrop-blur-xl",
          "border border-white/[0.08]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          "text-foreground"
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Fork to Library
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose where to add &ldquo;{itemName}&rdquo; in your library.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-4">
          {/* Loading overlay during fork operation */}
          <AnimatePresence>
            {isForking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm"
              >
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <p className="text-muted-foreground mt-3 text-sm font-medium">
                  Adding to your library...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--tertiary-foreground)]" />
            </div>
          ) : error ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Search input - only show if there are folders */}
              {folders.length > 0 && (
                <div className="relative mb-3">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--tertiary-foreground)]" />
                  <input
                    type="text"
                    placeholder="Search folders…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isForking}
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
              )}

              {/* Root option - only show when not searching */}
              {!searchQuery && (
                <motion.button
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedId(null)}
                  disabled={isForking}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left",
                    "transition-colors duration-150",
                    selectedId === null
                      ? "text-foreground bg-white/20"
                      : "text-muted-foreground hover:bg-white/10",
                    isForking && "pointer-events-none opacity-50"
                  )}
                >
                  <Home className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium">My Items (Root)</span>
                </motion.button>
              )}

              {/* Virtualized folder list */}
              {folders.length > 0 && (
                <div
                  ref={scrollContainerRef}
                  className={cn(
                    "mt-2 flex h-48 flex-col overflow-auto rounded-lg",
                    "border border-white/10",
                    isForking && "pointer-events-none opacity-50"
                  )}
                >
                  {filteredFolders.length > 0 ? (
                    <div
                      className="relative w-full p-2"
                      style={{ height: `${virtualizer.getTotalSize()}px` }}
                    >
                      {virtualizer.getVirtualItems().map((virtualRow) => {
                        const folder = filteredFolders[virtualRow.index];
                        return (
                          <div
                            key={folder.id}
                            className="absolute top-0 left-0 w-full px-2"
                            style={{
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                          >
                            <FolderItemRow
                              folder={folder}
                              isSelected={selectedId === folder.id}
                              onSelect={() => setSelectedId(folder.id)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12">
                      <Search
                        aria-hidden="true"
                        className="size-8 text-[var(--tertiary-foreground)]"
                      />
                      <p className="text-muted-foreground text-sm">
                        No results found.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {folders.length === 0 && (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No folders in your library yet. The item will be added to
                  root.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isForking}
            className={cn(
              "rounded-full px-4 py-2",
              "text-sm font-medium",
              "border border-white/20 bg-white/10",
              "text-muted-foreground",
              "hover:text-foreground hover:bg-white/20",
              "transition-colors duration-150",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isForking || loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2",
              "text-sm font-medium",
              "bg-white text-black",
              "hover:bg-white/90",
              "active:scale-[0.97]",
              "transition-all duration-150",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {isForking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Forking…
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Fork Here
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
