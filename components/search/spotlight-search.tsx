/**
 * Spotlight search dialog component.
 * Provides macOS Spotlight-style search for items with fuzzy filtering.
 * Displays artwork thumbnails and breadcrumb paths for nested items.
 */

"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Folder } from "lucide-react";
import { useImageLoaded } from "@/hooks/use-image-loaded";
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
import { cn } from "@/lib/utils";
import type { SearchableItem } from "@/lib/types";

/**
 * Resets scroll position to top when search value changes.
 *
 * @param listRef - Ref to the scrollable list element
 * @param searchValue - Current search input value
 */
function useScrollReset(
  listRef: RefObject<HTMLDivElement | null>,
  searchValue: string
) {
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [listRef, searchValue]);
}

/**
 * Artwork thumbnail with load state tracking.
 * Shows folder icon until image loads, then fades in.
 * Uses useImageLoaded hook to handle cached images.
 *
 * @param artworkId - ID of the artwork to display
 */
function ArtworkThumbnail({ artworkId }: { artworkId: string }) {
  const artworkSrc = `/api/artwork/${artworkId}`;
  const { ref, loaded, onLoad, onError } = useImageLoaded(artworkSrc);

  return (
    <div className="bg-muted relative size-8 shrink-0 overflow-hidden rounded-md">
      {/* Folder icon placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Folder aria-hidden="true" className="text-muted-foreground/50 size-4" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={artworkSrc}
        alt=""
        loading="lazy"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-150",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}

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
  const listRef = useRef<HTMLDivElement>(null);

  // Reset scroll to top when search value changes
  useScrollReset(listRef, searchValue);

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
        placeholder="Search items…"
        className="border-none focus:ring-0"
        value={searchValue}
        onValueChange={setSearchValue}
      />
      <CommandList ref={listRef} className="max-h-[400px]">
        {/* Screen reader announcement for search results */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {isLoading
            ? "Loading items…"
            : items.length === 0
              ? "No items found"
              : `${items.length} ${items.length === 1 ? "item" : "items"} available`}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 aria-hidden="true" className="text-muted-foreground size-4 animate-spin" />
            <span className="text-muted-foreground text-sm">Loading…</span>
          </div>
        ) : (
          <>
            <CommandEmpty className="py-12 text-center">
              <div className="flex flex-col items-center gap-2">
                <Search aria-hidden="true" className="text-muted-foreground/50 size-8" />
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
                      <ArtworkThumbnail artworkId={item.artworkId} />
                    ) : (
                      <div className="bg-muted/50 text-muted-foreground group-aria-selected:bg-primary/10 group-aria-selected:text-primary flex size-8 shrink-0 items-center justify-center rounded-md transition-colors">
                        <Folder aria-hidden="true" className="size-4" />
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
      <div className="flex items-center justify-start gap-3 border-t px-3 py-2">
        <span className="text-muted-foreground text-xs">
          <Kbd>/</Kbd> to search
        </span>
        <span className="text-muted-foreground text-xs">
          <Kbd>esc</Kbd> to close
        </span>
      </div>
    </CommandDialog>
  );
}
