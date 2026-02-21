/**
 * Mobile search bottom sheet component.
 * Provides Spotlight-style search in a swipeable drawer format.
 * Reuses search logic from SpotlightSearch with mobile-optimized UI.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faXmark,
  faGlobe,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { getSearchableItems } from "@/lib/item-actions";
import { searchPublicUsers, searchPublicItems } from "@/lib/public-auth";
import { MobileBottomSheet } from "./mobile-bottom-sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserThumbnail } from "@/components/search/user-thumbnail";
import { ItemThumbnail } from "@/components/search/item-thumbnail";
import type {
  SearchableItem,
  SearchableUser,
  SearchablePublicItem,
} from "@/lib/types";

/** Cache TTL in milliseconds (60 seconds) */
const CACHE_TTL = 60_000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Module-level cache for SWR-style behavior
let itemsCache: CacheEntry<SearchableItem[]> | null = null;
let usersCache: CacheEntry<SearchableUser[]> | null = null;
let publicItemsCache: CacheEntry<SearchablePublicItem[]> | null = null;

/**
 * Checks if a cache entry is still valid based on TTL.
 *
 * @param cache - Cache entry to validate
 * @returns True if cache is valid (not expired)
 */
function isCacheValid<T>(cache: CacheEntry<T> | null): cache is CacheEntry<T> {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL;
}

/**
 * Skeleton loader for search result items.
 */
function ItemSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 px-1 py-3">
      <div className="bg-muted size-10 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="bg-muted h-4 w-32 rounded" />
        <div className="bg-muted h-3 w-20 rounded" />
      </div>
    </div>
  );
}

/**
 * Section heading for search results.
 */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
      {children}
    </h3>
  );
}

/**
 * Props for MobileSearchSheet component.
 */
export interface MobileSearchSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Mobile search bottom sheet with Spotlight-style search.
 * Features:
 * - Half-screen snap point, expandable to 90%
 * - Auto-expands when keyboard opens
 * - No auto-focus (user taps to focus)
 * - Three sections: Your Items, Public Items, People
 * - Tap result to close sheet and navigate
 *
 * @param open - Whether the sheet is open
 * @param onOpenChange - Callback when open state changes
 */
export function MobileSearchSheet({
  open,
  onOpenChange,
}: MobileSearchSheetProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = React.useState("");
  const [hasInitialized, setHasInitialized] = React.useState(false);

  // Independent loading states per section
  const [items, setItems] = React.useState<SearchableItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = React.useState(false);

  const [users, setUsers] = React.useState<SearchableUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = React.useState(false);

  const [publicItems, setPublicItems] = React.useState<SearchablePublicItem[]>(
    []
  );
  const [isLoadingPublicItems, setIsLoadingPublicItems] = React.useState(false);

  // Fetch data when sheet opens
  React.useEffect(() => {
    if (!open) {
      setHasInitialized(false);
      setSearchValue("");
      return;
    }

    let cancelled = false;
    setHasInitialized(true);

    // Fetch own items
    const fetchItems = async () => {
      if (isCacheValid(itemsCache)) {
        setItems(itemsCache.data);
        return;
      }

      setIsLoadingItems(true);
      const result = await getSearchableItems();
      if (!cancelled) {
        if (result.success) {
          const data = result.data ?? [];
          itemsCache = { data, timestamp: Date.now() };
          setItems(data);
        } else {
          setItems([]);
          // Don't show error toast for unauthenticated users - expected behavior
          if (result.error !== "Not authenticated") {
            toast.error("Failed to load items", { description: result.error });
          }
        }
        setIsLoadingItems(false);
      }
    };

    // Fetch public users
    const fetchUsers = async () => {
      if (isCacheValid(usersCache)) {
        setUsers(usersCache.data);
        return;
      }

      setIsLoadingUsers(true);
      const result = await searchPublicUsers();
      if (!cancelled) {
        if (result.success) {
          const data = result.data ?? [];
          usersCache = { data, timestamp: Date.now() };
          setUsers(data);
        } else {
          setUsers([]);
        }
        setIsLoadingUsers(false);
      }
    };

    // Fetch public items
    const fetchPublicItems = async () => {
      if (isCacheValid(publicItemsCache)) {
        setPublicItems(publicItemsCache.data);
        return;
      }

      setIsLoadingPublicItems(true);
      const result = await searchPublicItems();
      if (!cancelled) {
        if (result.success) {
          const data = result.data ?? [];
          publicItemsCache = { data, timestamp: Date.now() };
          setPublicItems(data);
        } else {
          setPublicItems([]);
        }
        setIsLoadingPublicItems(false);
      }
    };

    // Fetch all in parallel
    void Promise.all([fetchItems(), fetchUsers(), fetchPublicItems()]);

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Filter results based on search value
  const filteredItems = React.useMemo(() => {
    if (!searchValue.trim()) return items;
    const query = searchValue.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.breadcrumb?.toLowerCase().includes(query)
    );
  }, [items, searchValue]);

  const filteredPublicItems = React.useMemo(() => {
    if (!searchValue.trim()) return publicItems;
    const query = searchValue.toLowerCase();
    return publicItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.ownerUsername.toLowerCase().includes(query)
    );
  }, [publicItems, searchValue]);

  const filteredUsers = React.useMemo(() => {
    if (!searchValue.trim()) return users;
    const query = searchValue.toLowerCase();
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(query) ||
        user.name?.toLowerCase().includes(query)
    );
  }, [users, searchValue]);

  const isAnyLoading = isLoadingItems || isLoadingUsers || isLoadingPublicItems;
  const hasResults =
    filteredItems.length > 0 ||
    filteredPublicItems.length > 0 ||
    filteredUsers.length > 0;

  // Navigation handlers
  const handleSelectItem = React.useCallback(
    (itemId: string, ownerUsername: string | null) => {
      onOpenChange(false);
      if (ownerUsername) {
        router.push(`/u/${ownerUsername}/${itemId}`);
      } else {
        router.push("/explore");
      }
    },
    [onOpenChange, router]
  );

  const handleSelectPublicItem = React.useCallback(
    (itemId: string, ownerUsername: string) => {
      onOpenChange(false);
      router.push(`/u/${ownerUsername}/${itemId}`);
    },
    [onOpenChange, router]
  );

  const handleSelectUser = React.useCallback(
    (username: string) => {
      onOpenChange(false);
      router.push(`/u/${username}`);
    },
    [onOpenChange, router]
  );

  const clearSearch = React.useCallback(() => {
    setSearchValue("");
    inputRef.current?.focus();
  }, []);

  return (
    <MobileBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      repositionInputs
      snapPoints={[0.85]}
      title="Search"
      description="Search items and people"
    >
      {/* Search input */}
      <div className="px-4 pt-2 pb-3">
        <div className="relative">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search items and people…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            className="pr-9 pl-9"
          />
          {searchValue && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <FontAwesomeIcon
                icon={faXmark}
                className="size-4"
                aria-hidden="true"
              />
            </Button>
          )}
        </div>
      </div>

      {/* Results - data-vaul-no-drag prevents swipe-to-dismiss when scrolling */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4"
        data-vaul-no-drag
        tabIndex={0}
      >
        {/* Empty state */}
        {hasInitialized && !isAnyLoading && !hasResults && (
          <div className="flex flex-col items-center justify-center py-12">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="text-muted-foreground/50 mb-3 size-10"
              aria-hidden="true"
            />
            <p className="text-muted-foreground text-sm">
              {searchValue ? "No matches found." : "No results found."}
            </p>
            {searchValue && (
              <p className="text-muted-foreground/70 mt-1 text-xs">
                Try a different search term.
              </p>
            )}
          </div>
        )}

        {/* Your Items */}
        {(filteredItems.length > 0 || isAnyLoading || !hasInitialized) && (
          <section className="mb-6">
            <SectionHeading>Your Items</SectionHeading>
            {isAnyLoading || !hasInitialized ? (
              <>
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
              </>
            ) : (
              <ul className="space-y-1" role="listbox" aria-label="Your items">
                {filteredItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      onClick={() =>
                        handleSelectItem(item.id, item.ownerUsername)
                      }
                      className="hover:bg-muted/50 active:bg-muted flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                    >
                      <ItemThumbnail
                        tmdbPosterPath={item.tmdbPosterPath}
                        artworkId={item.artworkId}
                        size="size-10"
                        rounded="rounded-lg"
                        iconSize="size-5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        {item.breadcrumb && (
                          <p className="text-muted-foreground/70 truncate text-xs">
                            {item.breadcrumb}
                          </p>
                        )}
                        {item.description && !item.breadcrumb && (
                          <p className="text-muted-foreground truncate text-xs">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Public Items */}
        {(filteredPublicItems.length > 0 ||
          isAnyLoading ||
          !hasInitialized) && (
          <section className="mb-6">
            <SectionHeading>Public Collections</SectionHeading>
            {isAnyLoading || !hasInitialized ? (
              <>
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
              </>
            ) : (
              <ul
                className="space-y-1"
                role="listbox"
                aria-label="Public collections"
              >
                {filteredPublicItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      onClick={() =>
                        handleSelectPublicItem(item.id, item.ownerUsername)
                      }
                      className="hover:bg-muted/50 active:bg-muted flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                    >
                      <ItemThumbnail
                        tmdbPosterPath={item.tmdbPosterPath}
                        artworkId={item.artworkId}
                        size="size-10"
                        rounded="rounded-lg"
                        iconSize="size-5"
                        fallbackIcon={faGlobe}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          by @{item.ownerUsername}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* People */}
        {(filteredUsers.length > 0 || isAnyLoading || !hasInitialized) && (
          <section>
            <SectionHeading>People</SectionHeading>
            {isAnyLoading || !hasInitialized ? (
              <>
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
              </>
            ) : (
              <ul className="space-y-1" role="listbox" aria-label="People">
                {filteredUsers.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      role="option"
                      onClick={() => handleSelectUser(user.username)}
                      className="hover:bg-muted/50 active:bg-muted flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                    >
                      <UserThumbnail
                        userId={user.id}
                        name={user.name}
                        showImage
                        className="size-10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {user.name || user.username}
                        </p>
                        {user.name && (
                          <p className="text-muted-foreground truncate text-xs">
                            @{user.username}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </MobileBottomSheet>
  );
}
