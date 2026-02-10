/**
 * Shared tabbed interface for item dialogs.
 * Provides consistent Details/Files/TMDB tab structure for Add Item and Item Settings dialogs.
 * Always resets to first tab when dialog opens (no persistence by default).
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FileIcon, Film, InfoIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** localStorage key for persisting selected tab */
const TAB_STORAGE_KEY = "canon-item-dialog-tab";

/** Available tab values */
export type ItemDialogTab = "details" | "files" | "tmdb";

interface ItemDialogTabsProps {
  /** Content for the Details tab */
  detailsContent: ReactNode;
  /** Content for the Files tab. Only shown when provided. */
  filesContent?: ReactNode;
  /** Optional content for TMDB display options tab. Only shown when provided. */
  tmdbContent?: ReactNode;
  /** Default tab to show (defaults to "details") */
  defaultTab?: ItemDialogTab;
  /** Whether to persist tab selection to localStorage (default: false) */
  persistSelection?: boolean;
  /** Optional callback when tab changes */
  onTabChange?: (tab: ItemDialogTab) => void;
  /** Additional className for the tabs container */
  className?: string;
}

/** Lookup for grid column classes — static strings for Tailwind CSS purging. */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

/**
 * Tabbed interface wrapper for item dialogs.
 * Provides Details, Files, and TMDB tabs with optional localStorage persistence.
 *
 * @param detailsContent - Content to render in Details tab
 * @param filesContent - Content to render in Files tab (optional)
 * @param tmdbContent - Content to render in TMDB tab (optional)
 * @param defaultTab - Initial tab selection
 * @param persistSelection - Whether to save/restore tab from localStorage
 * @param onTabChange - Callback when tab changes
 * @param className - Additional styling
 */
export function ItemDialogTabs({
  detailsContent,
  filesContent,
  tmdbContent,
  defaultTab = "details",
  persistSelection = false,
  onTabChange,
  className,
}: ItemDialogTabsProps) {
  const showFiles = !!filesContent;
  const showTmdb = !!tmdbContent;
  const tabCount = 1 + (showFiles ? 1 : 0) + (showTmdb ? 1 : 0);
  const gridCols = GRID_COLS[tabCount];

  const [activeTab, setActiveTab] = useState<ItemDialogTab>(() => {
    if (persistSelection && typeof window !== "undefined") {
      const stored = localStorage.getItem(TAB_STORAGE_KEY);
      if (
        stored === "details" ||
        (stored === "files" && showFiles) ||
        (stored === "tmdb" && showTmdb)
      ) {
        return stored;
      }
    }
    return defaultTab;
  });

  // Persist tab selection to localStorage
  useEffect(() => {
    if (persistSelection && typeof window !== "undefined") {
      localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    }
  }, [activeTab, persistSelection]);

  /**
   * Handles tab value change with type safety.
   */
  function handleTabChange(value: string) {
    const tab = value as ItemDialogTab;
    setActiveTab(tab);
    onTabChange?.(tab);
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className={cn("w-full", className)}
    >
      <TabsList className={cn("grid w-full", gridCols)}>
        <TabsTrigger
          value="details"
          className="data-[state=active]:bg-background gap-2"
        >
          <InfoIcon className="size-4" />
          <span>Details</span>
        </TabsTrigger>
        {showFiles && (
          <TabsTrigger
            value="files"
            className="data-[state=active]:bg-background gap-2"
          >
            <FileIcon className="size-4" />
            <span>Files</span>
          </TabsTrigger>
        )}
        {showTmdb && (
          <TabsTrigger
            value="tmdb"
            className="data-[state=active]:bg-background gap-2"
          >
            <Film className="size-4" />
            <span>TMDB</span>
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="details" className="mt-4 space-y-4">
        {detailsContent}
      </TabsContent>

      {showFiles && (
        <TabsContent value="files" className="mt-4 space-y-4">
          {filesContent}
        </TabsContent>
      )}

      {showTmdb && (
        <TabsContent value="tmdb" className="mt-4 space-y-4">
          {tmdbContent}
        </TabsContent>
      )}
    </Tabs>
  );
}
