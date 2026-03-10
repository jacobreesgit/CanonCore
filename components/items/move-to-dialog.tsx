/**
 * Dialog for moving an item to a different parent folder.
 * Renders as Dialog on desktop (sm+) and MobileBottomSheet on mobile.
 * Uses ItemTreePicker in single-select mode with the item excluded.
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faSpinner,
  faArrowRightArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MobileBottomSheet,
  MobileBottomSheetHeader,
  MobileBottomSheetTitle,
  MobileBottomSheetContent,
  MobileBottomSheetFooter,
} from "@/components/mobile/mobile-bottom-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAllItems } from "@/lib/item-actions";
import { MAX_ITEM_DEPTH } from "@/lib/config/items";
import {
  ItemTreePicker,
  type PickerItem,
} from "@/components/items/item-tree-picker";
import { toast } from "sonner";
import type { ItemResult, ItemWithArtwork } from "@/lib/types";

interface MoveToDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  currentParentId: string | null;
  onMove: (newParentId: string | null) => Promise<ItemResult>;
}

/**
 * Collects an item and all its descendants by ID.
 */
function collectDescendantIds(
  itemId: string,
  childMap: Map<string, string[]>
): Set<string> {
  const ids = new Set<string>([itemId]);
  const queue = [itemId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childMap.get(current) ?? [];
    for (const childId of children) {
      ids.add(childId);
      queue.push(childId);
    }
  }
  return ids;
}

/**
 * Computes the height of a subtree rooted at the given item.
 * Height 0 = leaf node, height 1 = has direct children only, etc.
 */
function computeSubtreeHeight(
  itemId: string,
  itemDepth: number,
  descendantIds: Set<string>,
  depthMap: Map<string, number>
): number {
  let maxDepth = itemDepth;
  for (const id of descendantIds) {
    if (id === itemId) continue;
    const depth = depthMap.get(id) ?? 0;
    if (depth > maxDepth) maxDepth = depth;
  }
  return maxDepth - itemDepth;
}

/**
 * Shared folder list content used by both desktop and mobile variants.
 */
function FolderListContent({
  loading,
  error,
  folders,
  selectedId,
  setSelectedId,
  isMoving,
}: {
  loading: boolean;
  error: string | null;
  folders: PickerItem[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  isMoving: boolean;
}) {
  const pickerSelectedIds = useMemo(
    () => new Set(selectedId ? [selectedId] : []),
    [selectedId]
  );

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <FontAwesomeIcon
          icon={faSpinner}
          className="h-6 w-6 text-[var(--tertiary-foreground)]"
          spin
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Root option — always visible, sets parentId to null */}
      <button
        onClick={() => setSelectedId(null)}
        disabled={isMoving}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left",
          "transition-colors duration-150",
          selectedId === null
            ? "text-foreground bg-white/20"
            : "text-muted-foreground hover:bg-white/10",
          isMoving && "pointer-events-none opacity-50"
        )}
      >
        <FontAwesomeIcon icon={faHouse} className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">My Items (Root)</span>
      </button>

      {/* Virtualised item tree */}
      <ItemTreePicker
        items={folders}
        selectedIds={pickerSelectedIds}
        onToggle={(id) => setSelectedId(id)}
        disabled={isMoving}
        emptyMessage="No other folders available."
      />
    </div>
  );
}

/**
 * Move-to dialog component.
 * Renders as Dialog on desktop (sm+) and MobileBottomSheet on mobile.
 */
export function MoveToDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  currentParentId,
  onMove,
}: MoveToDialogProps) {
  const isMobile = useIsMobile();
  const [folders, setFolders] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(currentParentId);
  const [isMoving, setIsMoving] = useState(false);

  // Dialog reset pattern — synchronous reset when dialog opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setLoading(true);
    setError(null);
    setSelectedId(currentParentId);
    setIsMoving(false);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  // Fetch items when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    getAllItems()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setError("error" in result ? result.error : "Unknown error");
          setLoading(false);
          return;
        }

        const items: ItemWithArtwork[] = result.data ?? [];

        // Build child map for descendant detection
        const childMap = new Map<string, string[]>();
        for (const item of items) {
          if (item.parentId) {
            const children = childMap.get(item.parentId) ?? [];
            children.push(item.id);
            childMap.set(item.parentId, children);
          }
        }

        // Exclude the item being moved and all its descendants
        const excludeIds = collectDescendantIds(itemId, childMap);

        // Compute subtree height so we only show destinations with enough room
        const movedItem = items.find((i) => i.id === itemId);
        const depthMap = new Map(items.map((i) => [i.id, i.depth]));
        const subtreeHeight = movedItem
          ? computeSubtreeHeight(itemId, movedItem.depth, excludeIds, depthMap)
          : 0;

        // Pre-compute set of parent IDs for O(1) hasChildren lookup
        const parentIds = new Set(items.map((i) => i.parentId).filter(Boolean));

        // Convert to picker items, excluding self and descendants.
        // A destination at depth D means the moved item lands at D+1,
        // so the deepest descendant would be at D+1+subtreeHeight.
        // That must be < MAX_ITEM_DEPTH.
        const maxDestinationDepth = MAX_ITEM_DEPTH - 1 - subtreeHeight;
        const pickerItems: PickerItem[] = items
          .filter(
            (item: ItemWithArtwork) =>
              !excludeIds.has(item.id) && item.depth < maxDestinationDepth
          )
          .map((item: ItemWithArtwork) => ({
            id: item.id,
            name: item.name,
            depth: item.depth,
            hasChildren: parentIds.has(item.id),
          }))
          .sort((a: PickerItem, b: PickerItem) => {
            if (a.depth !== b.depth) return a.depth - b.depth;
            return a.name.localeCompare(b.name);
          });

        setFolders(pickerItems);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load items");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, itemId]);

  const handleMove = useCallback(async () => {
    if (selectedId === currentParentId) {
      onOpenChange(false);
      return;
    }
    setIsMoving(true);
    try {
      const result = await onMove(selectedId);
      if (result.success) {
        toast.success(`Moved "${itemName}"`);
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to move item");
      }
    } finally {
      setIsMoving(false);
    }
  }, [selectedId, currentParentId, onMove, itemName, onOpenChange]);

  const sharedListProps = {
    loading,
    error,
    folders,
    selectedId,
    setSelectedId,
    isMoving,
  };

  return (
    <>
      {/* Desktop: Dialog — only open when not mobile to prevent dual portals */}
      <Dialog open={open && !isMobile} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "sm:max-w-md",
            "glass-dialog",
            "border border-[var(--glass-border)]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <FontAwesomeIcon
                icon={faArrowRightArrowLeft}
                className="h-5 w-5"
              />
              Move &ldquo;{itemName}&rdquo;
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose a new location for this item.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <FolderListContent {...sharedListProps} />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isMoving}
            >
              Cancel
            </Button>
            <Button onClick={handleMove} disabled={isMoving || loading}>
              {isMoving ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    className="mr-2 h-4 w-4"
                    spin
                  />
                  Moving…
                </>
              ) : (
                "Move"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile: MobileBottomSheet — only open when mobile */}
      <MobileBottomSheet
        open={open && isMobile}
        onOpenChange={onOpenChange}
        snapPoints={[0.7]}
        repositionInputs
        title="Move Item"
        description={`Choose a new location for "${itemName}"`}
        className={cn(
          "bg-[#1a1a1a]/95 backdrop-blur-xl",
          "border-t border-white/[0.08]",
          "text-foreground"
        )}
      >
        <MobileBottomSheetHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <FontAwesomeIcon
                icon={faArrowRightArrowLeft}
                aria-hidden="true"
                className="text-primary size-5"
              />
            </div>
            <div className="min-w-0">
              <MobileBottomSheetTitle>Move Item</MobileBottomSheetTitle>
              <p className="text-muted-foreground truncate text-sm">
                &ldquo;{itemName}&rdquo;
              </p>
            </div>
          </div>
        </MobileBottomSheetHeader>

        <MobileBottomSheetContent>
          <FolderListContent {...sharedListProps} />
        </MobileBottomSheetContent>

        <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isMoving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMove}
              disabled={isMoving || loading}
              className="flex-1"
            >
              {isMoving ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    aria-hidden="true"
                    className="size-4"
                    spin
                  />
                  Moving…
                </>
              ) : (
                "Move"
              )}
            </Button>
          </div>
        </MobileBottomSheetFooter>
      </MobileBottomSheet>
    </>
  );
}
