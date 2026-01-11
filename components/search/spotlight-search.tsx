/**
 * Spotlight search dialog component.
 * Provides macOS Spotlight-style search for items with fuzzy filtering.
 * Displays artwork thumbnails and breadcrumb paths for nested items.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Folder } from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { useSpotlight } from "@/contexts/spotlight-context";
import { getSearchableItems } from "@/lib/item-actions";
import type { SearchableItem } from "@/lib/types";

interface SpotlightSearchProps {
  /** For testing - force dialog open state */
  defaultOpen?: boolean;
}

/**
 * Module-level cache for SWR-style behavior.
 * Shows cached data immediately while fetching fresh data in background.
 */
let cachedItems: SearchableItem[] | null = null;

/**
 * Clears the search cache. Used for testing.
 */
export function clearSearchCache() {
  cachedItems = null;
}

/**
 * Global spotlight search dialog.
 * Opens with "/" keyboard shortcut or sidebar button.
 * Uses SWR-style caching: shows cached data immediately while fetching fresh data.
 * cmdk handles fuzzy filtering client-side.
 */
export function SpotlightSearch({ defaultOpen }: SpotlightSearchProps) {
  const router = useRouter();
  const { isOpen, closeSpotlight } = useSpotlight();
  const [items, setItems] = useState<SearchableItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const prevOpenRef = useRef(false);

  // Use defaultOpen for testing, otherwise use context
  const open = defaultOpen ?? isOpen;

  // Fetch items and reset search when dialog opens (SWR-style)
  useEffect(() => {
    // Track previous open state with ref
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (!open) {
      // Dialog is closing, no action needed
      return;
    }

    if (wasOpen) {
      // Already open, no fetch needed
      return;
    }

    let cancelled = false;

    const fetchItems = async () => {
      // Reset search and show cached data immediately (SWR pattern)
      setSearchValue("");
      if (cachedItems !== null) {
        setItems(cachedItems);
      } else {
        setIsLoading(true);
      }

      const result = await getSearchableItems();
      if (!cancelled) {
        if (result.success) {
          const freshItems = result.data ?? [];
          cachedItems = freshItems;
          setItems(freshItems);
        } else {
          // On error, keep cached data if available, otherwise show empty
          if (cachedItems === null) {
            setItems([]);
          }
          toast.error("Failed to load items", {
            description: result.error,
          });
        }
        setIsLoading(false);
      }
    };

    fetchItems();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSelect = useCallback(
    (itemId: string) => {
      closeSpotlight();
      router.push(`/my-items/${itemId}`);
    },
    [closeSpotlight, router]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeSpotlight();
      }
    },
    [closeSpotlight]
  );

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search items..."
        className="border-none focus:ring-0"
        value={searchValue}
        onValueChange={setSearchValue}
      />
      <CommandList className="max-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        ) : (
          <>
            <CommandEmpty className="py-12 text-center">
              <div className="flex flex-col items-center gap-2">
                <Search className="text-muted-foreground/50 h-8 w-8" />
                <p className="text-muted-foreground text-sm">No items found.</p>
              </div>
            </CommandEmpty>
            {items.length > 0 && (
              <CommandGroup heading="Items">
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.description || ""} ${item.breadcrumb || ""}`}
                    onSelect={() => handleSelect(item.id)}
                    className="group cursor-pointer gap-3 px-3 py-2.5"
                  >
                    {/* Artwork thumbnail or folder icon */}
                    {item.artworkId ? (
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/artwork/${item.artworkId}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="bg-muted/50 text-muted-foreground group-aria-selected:bg-primary/10 group-aria-selected:text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
                        <Folder className="h-4 w-4" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{item.name}</span>
                      {/* Breadcrumb path for nested items */}
                      {item.breadcrumb && (
                        <span className="text-muted-foreground/70 truncate text-xs">
                          {item.breadcrumb}
                        </span>
                      )}
                      {/* Description if no breadcrumb, or show both */}
                      {item.description && !item.breadcrumb && (
                        <span className="text-muted-foreground truncate text-xs">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
      <div className="flex items-center justify-between border-t px-3 py-2">
        <span className="text-muted-foreground text-xs">
          Press <Kbd>/</Kbd> to toggle
        </span>
        <span className="text-muted-foreground text-xs">
          <Kbd>esc</Kbd> to close
        </span>
      </div>
    </CommandDialog>
  );
}
