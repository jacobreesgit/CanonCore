"use client";

/**
 * Dialog for selecting where to place a forked item in user's library.
 * Renders as Dialog on desktop (sm+) and MobileBottomSheet on mobile.
 * Uses virtualisation via ItemTreePicker for large item lists (1000+ items).
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHouse, faSpinner, faCopy } from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { getAllItems } from "@/lib/item-actions";
import { MAX_ITEM_DEPTH } from "@/lib/config/items";
import {
  ItemTreePicker,
  type PickerItem,
} from "@/components/items/item-tree-picker";
import type { ItemWithArtwork } from "@/lib/types";

interface ForkDestinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: (parentId: string | null) => void;
  isForking: boolean;
}

/**
 * Loading overlay shown during fork operation.
 */
function ForkingOverlay() {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm"
      >
        <FontAwesomeIcon icon={faSpinner} className="h-8 w-8 text-white" spin />
        <p className="text-muted-foreground mt-3 text-sm font-medium">
          Adding to your library...
        </p>
      </motion.div>
    </AnimatePresence>
  );
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
  isForking,
}: {
  loading: boolean;
  error: string | null;
  folders: PickerItem[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  isForking: boolean;
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
        <FontAwesomeIcon icon={faHouse} className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">My Items (Root)</span>
      </motion.button>

      {/* Virtualised item tree */}
      <ItemTreePicker
        items={folders}
        selectedIds={pickerSelectedIds}
        onToggle={(id) => setSelectedId(id)}
        disabled={isForking}
        emptyMessage="No folders in your library yet. The item will be added to root."
      />
    </div>
  );
}

/**
 * Fork destination dialog component.
 * Renders as Dialog on desktop (sm+) and MobileBottomSheet on mobile.
 */
export function ForkDestinationDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
  isForking,
}: ForkDestinationDialogProps) {
  const isMobile = useIsMobile();
  const [folders, setFolders] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset state synchronously during render when dialog opens
  // (React's "adjust state during render" pattern — avoids setState in effect)
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setLoading(true);
    setError(null);
    setSelectedId(null);
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
        // Pre-compute set of parent IDs for O(1) hasChildren lookup
        const parentIds = new Set(items.map((i) => i.parentId).filter(Boolean));
        // Convert to picker items, filtering by depth
        const pickerItems: PickerItem[] = items
          .filter((item: ItemWithArtwork) => item.depth < MAX_ITEM_DEPTH - 1)
          .map((item: ItemWithArtwork) => ({
            id: item.id,
            name: item.name,
            depth: item.depth,
            hasChildren: parentIds.has(item.id),
          }))
          .sort((a: PickerItem, b: PickerItem) => {
            // Sort by depth first, then by name
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
  }, [open]);

  const handleConfirm = () => {
    onConfirm(selectedId);
  };

  const sharedListProps = {
    loading,
    error,
    folders,
    selectedId,
    setSelectedId,
    isForking,
  };

  return (
    <>
      {/* Desktop: Dialog — only open when not mobile to prevent dual portals
          (CSS hidden wrappers don't prevent portal-based dialogs rendering to <body>) */}
      <Dialog open={open && !isMobile} onOpenChange={onOpenChange}>
        <DialogContent
          data-testid="dialog-fork-destination"
          className={cn(
            "sm:max-w-md",
            "bg-[#1a1a1a]/95 backdrop-blur-xl",
            "border border-[var(--glass-border)]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
            "text-foreground"
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <FontAwesomeIcon icon={faCopy} className="h-5 w-5" />
              Fork to Library
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose where to add &ldquo;{itemName}&rdquo; in your library.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-4">
            {isForking && <ForkingOverlay />}
            <FolderListContent {...sharedListProps} />
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
                  <FontAwesomeIcon icon={faSpinner} className="h-4 w-4" spin />
                  Forking…
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCopy} className="h-4 w-4" />
                  Fork Here
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile: MobileBottomSheet — only open when mobile */}
      <MobileBottomSheet
        open={open && isMobile}
        onOpenChange={onOpenChange}
        snapPoints={[0.85]}
        repositionInputs
        title="Fork to Library"
        description={`Choose where to add "${itemName}" in your library`}
        data-testid="sheet-fork-destination"
        className={cn(
          "bg-[#1a1a1a]/95 backdrop-blur-xl",
          "border-t border-white/[0.08]",
          "text-foreground"
        )}
      >
        <MobileBottomSheetHeader className="border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                "bg-primary/10 ring-primary/20 ring-1"
              )}
            >
              <FontAwesomeIcon
                icon={faCopy}
                aria-hidden="true"
                className="text-primary size-5"
              />
            </div>
            <div className="min-w-0">
              <MobileBottomSheetTitle>Fork to Library</MobileBottomSheetTitle>
              <p className="text-muted-foreground truncate text-sm">
                &ldquo;{itemName}&rdquo;
              </p>
            </div>
          </div>
        </MobileBottomSheetHeader>

        <MobileBottomSheetContent className="relative">
          {isForking && <ForkingOverlay />}
          <FolderListContent {...sharedListProps} />
        </MobileBottomSheetContent>

        <MobileBottomSheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isForking}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isForking || loading}
              className="flex-1"
            >
              {isForking ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    aria-hidden="true"
                    className="size-4"
                    spin
                  />
                  Forking…
                </>
              ) : (
                <>
                  <FontAwesomeIcon
                    icon={faCopy}
                    aria-hidden="true"
                    className="size-4"
                  />
                  Fork Here
                </>
              )}
            </Button>
          </div>
        </MobileBottomSheetFooter>
      </MobileBottomSheet>
    </>
  );
}
