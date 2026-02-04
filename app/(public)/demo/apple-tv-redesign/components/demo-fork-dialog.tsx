/**
 * Fork destination dialog with Apple TV+ styling.
 * Visual demonstration with mock folder list.
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
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
import { MOCK_FOLDERS, type MockFolder } from "./demo-mock-data";

interface DemoForkDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to change open state. */
  onOpenChange: (open: boolean) => void;
  /** Item name being forked. */
  itemName: string;
}

/**
 * Single folder row in the selection list.
 */
function FolderRow({
  folder,
  isSelected,
  onSelect,
}: {
  folder: MockFolder;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left",
        "transition-colors duration-150",
        isSelected
          ? "bg-white/20 text-[var(--atv-text-primary)]"
          : "text-[var(--atv-text-secondary)] hover:bg-white/10"
      )}
      style={{ paddingLeft: `${12 + folder.depth * 16}px` }}
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
 * Fork destination dialog for Apple TV+ demo.
 * Shows mock folder structure and triggers toast on fork.
 */
export function DemoForkDialog({
  open,
  onOpenChange,
  itemName,
}: DemoForkDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isForking, setIsForking] = useState(false);

  // Filter folders based on search
  const filteredFolders = searchQuery.trim()
    ? MOCK_FOLDERS.filter((folder) =>
        folder.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : MOCK_FOLDERS;

  const handleFork = async () => {
    setIsForking(true);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsForking(false);
    onOpenChange(false);

    const destinationName =
      selectedId === null
        ? "My Items (Root)"
        : (MOCK_FOLDERS.find((f) => f.id === selectedId)?.name ?? "folder");

    toast.success(`"${itemName}" added to ${destinationName}!`);

    // Reset state for next open
    setSelectedId(null);
    setSearchQuery("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isForking) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setSelectedId(null);
        setSearchQuery("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
          "border border-[var(--atv-border)] bg-[var(--atv-surface)]",
          "text-[var(--atv-text-primary)]"
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Fork to Library
          </DialogTitle>
          <DialogDescription className="text-[var(--atv-text-secondary)]">
            Choose where to add &ldquo;{itemName}&rdquo; in your library.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-4">
          {/* Loading overlay */}
          <AnimatePresence>
            {isForking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm"
              >
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <p className="mt-3 text-sm font-medium text-[var(--atv-text-secondary)]">
                  Adding to your library...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search input */}
          <div className="relative mb-3">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--atv-text-tertiary)]" />
            <input
              type="text"
              placeholder="Search folders…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isForking}
              className={cn(
                "h-9 w-full rounded-lg pr-3 pl-9",
                "border border-white/20 bg-white/10",
                "text-sm text-[var(--atv-text-primary)]",
                "placeholder:text-[var(--atv-text-tertiary)]",
                "focus:ring-2 focus:ring-white/30 focus:outline-none",
                "disabled:opacity-50"
              )}
            />
          </div>

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
                  ? "bg-white/20 text-[var(--atv-text-primary)]"
                  : "text-[var(--atv-text-secondary)] hover:bg-white/10",
                isForking && "pointer-events-none opacity-50"
              )}
            >
              <Home className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">My Items (Root)</span>
            </motion.button>
          )}

          {/* Folder list */}
          <div
            className={cn(
              "mt-2 flex h-48 flex-col overflow-auto rounded-lg border border-white/10",
              isForking && "pointer-events-none opacity-50"
            )}
          >
            {filteredFolders.length > 0 ? (
              <div className="p-2">
                {filteredFolders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    isSelected={selectedId === folder.id}
                    onSelect={() => setSelectedId(folder.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12">
                <Search
                  aria-hidden="true"
                  className="size-8 text-[var(--atv-text-tertiary)]"
                />
                <p className="text-sm text-[var(--atv-text-secondary)]">
                  No results found.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => handleOpenChange(false)}
            disabled={isForking}
            className={cn(
              "rounded-full px-4 py-2",
              "text-sm font-medium",
              "border border-white/20 bg-white/10",
              "text-[var(--atv-text-secondary)]",
              "hover:bg-white/20 hover:text-[var(--atv-text-primary)]",
              "transition-colors duration-150",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleFork}
            disabled={isForking}
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
