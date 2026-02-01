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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted text-foreground"
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
          // Convert to folder items, filtering by depth
          const folderItems: FolderItem[] = items
            .filter((item: ItemWithArtwork) => item.depth < MAX_ITEM_DEPTH - 1)
            .map((item: ItemWithArtwork) => ({
              id: item.id,
              name: item.name,
              depth: item.depth,
              hasChildren: items.some(
                (i: ItemWithArtwork) => i.parentId === item.id
              ),
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Fork to Library
          </DialogTitle>
          <DialogDescription>
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
                className="bg-background/80 absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm"
              >
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
                <p className="text-muted-foreground mt-3 text-sm font-medium">
                  Adding to your library...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Search input - only show if there are folders */}
              {folders.length > 0 && (
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search folders…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isForking}
                    className="h-9 pl-9"
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
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors",
                    selectedId === null
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground",
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
                    "flex h-48 flex-col overflow-auto rounded-lg border",
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
                    <div className="flex flex-1 flex-col items-center gap-2 py-12">
                      <Search
                        aria-hidden="true"
                        className="text-muted-foreground/50 size-8"
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isForking}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isForking || loading}>
            {isForking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Forking…
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Fork Here
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
