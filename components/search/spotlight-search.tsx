/**
 * Spotlight search dialog component.
 * Provides macOS Spotlight-style search for:
 * - User's own items
 * - Public items from other users
 * - Public user profiles
 *
 * Features:
 * - Parallel data fetching with independent loading states
 * - SWR-style caching with 60-second TTL
 * - Section skeletons show while data loads
 * - Aria-live announcements for screen readers
 */

"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { Search, Globe, ListMusic } from "lucide-react";
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
import {
  searchPublicUsers,
  searchPublicItems,
  searchPublicPlaylists,
} from "@/lib/public-auth";
import { ItemThumbnail } from "./item-thumbnail";
import { UserThumbnail } from "./user-thumbnail";
import type {
  SearchableItem,
  SearchableUser,
  SearchablePublicItem,
  SearchablePlaylist,
} from "@/lib/types";

/** Cache TTL in milliseconds (60 seconds) */
const CACHE_TTL = 60_000;

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
 * Skeleton loader for search result items.
 * Displays animated placeholder while data loads.
 * Height matches CommandItem styling (py-2.5 + size-8 icon = 52px).
 */
function ItemSkeleton() {
  return (
    <div className="flex h-[52px] animate-pulse items-center gap-3 px-3">
      <div className="bg-muted size-8 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="bg-muted h-3.5 w-32 rounded" />
        <div className="bg-muted h-3 w-20 rounded" />
      </div>
    </div>
  );
}

interface SpotlightSearchProps {
  /** For testing - force dialog open state */
  defaultOpen?: boolean;
}

// Module-level cache for SWR-style behavior with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let itemsCache: CacheEntry<SearchableItem[]> | null = null;
let usersCache: CacheEntry<SearchableUser[]> | null = null;
let publicItemsCache: CacheEntry<SearchablePublicItem[]> | null = null;
let playlistsCache: CacheEntry<SearchablePlaylist[]> | null = null;

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
 * Clears all search caches. Used for testing.
 */
export function clearSearchCache() {
  itemsCache = null;
  usersCache = null;
  publicItemsCache = null;
  playlistsCache = null;
}

/**
 * Global spotlight search dialog.
 * Opens with "/" keyboard shortcut or sidebar button.
 * Uses SWR-style caching: shows cached data immediately while fetching fresh data.
 * cmdk handles fuzzy filtering client-side.
 *
 * @param props - Component props
 * @param props.defaultOpen - Force dialog open (for testing)
 */
export function SpotlightSearch({ defaultOpen }: SpotlightSearchProps) {
  const router = useRouter();
  const { isOpen, closeSpotlight } = useSpotlight();

  // Independent loading states per section
  const [items, setItems] = useState<SearchableItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const [users, setUsers] = useState<SearchableUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [publicItems, setPublicItems] = useState<SearchablePublicItem[]>([]);
  const [isLoadingPublicItems, setIsLoadingPublicItems] = useState(false);

  const [playlists, setPlaylists] = useState<SearchablePlaylist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  // Track whether initial fetch has completed (prevents flash of "No results")
  const [hasInitialized, setHasInitialized] = useState(false);
  const prevOpenRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useScrollReset(listRef, searchValue);

  const open = defaultOpen ?? isOpen;

  // Reset initialization state when dialog closes
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on close
      setHasInitialized(false);
    }
  }, [open]);

  // Fetch all data when dialog opens - independent loading states
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (!open || wasOpen) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on open
    setSearchValue("");
    // Mark as initialized immediately to prevent "No results" flash
    // Individual loading states handle skeleton display from here
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

    // Fetch public playlists
    const fetchPlaylists = async () => {
      if (isCacheValid(playlistsCache)) {
        setPlaylists(playlistsCache.data);
        return;
      }

      setIsLoadingPlaylists(true);
      const result = await searchPublicPlaylists();
      if (!cancelled) {
        if (result.success) {
          const data = result.data ?? [];
          playlistsCache = { data, timestamp: Date.now() };
          setPlaylists(data);
        } else {
          setPlaylists([]);
        }
        setIsLoadingPlaylists(false);
      }
    };

    // Fetch all in parallel
    void Promise.all([
      fetchItems(),
      fetchUsers(),
      fetchPublicItems(),
      fetchPlaylists(),
    ]);

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSelectItem = useCallback(
    (itemId: string, ownerUsername: string | null) => {
      closeSpotlight();
      if (ownerUsername) {
        router.push(`/u/${ownerUsername}/${itemId}`);
      } else {
        // Fallback to explore if no username (shouldn't happen)
        router.push("/explore");
      }
    },
    [closeSpotlight, router]
  );

  const handleSelectUser = useCallback(
    (username: string) => {
      closeSpotlight();
      router.push(`/u/${username}`);
    },
    [closeSpotlight, router]
  );

  const handleSelectPublicItem = useCallback(
    (itemId: string, ownerUsername: string) => {
      closeSpotlight();
      router.push(`/u/${ownerUsername}/${itemId}`);
    },
    [closeSpotlight, router]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeSpotlight();
    },
    [closeSpotlight]
  );

  // Memoize hasResults to avoid recalculation on every render
  const hasResults = useMemo(
    () =>
      items.length > 0 ||
      users.length > 0 ||
      publicItems.length > 0 ||
      playlists.length > 0,
    [items.length, users.length, publicItems.length, playlists.length]
  );

  const isAnyLoading =
    isLoadingItems ||
    isLoadingUsers ||
    isLoadingPublicItems ||
    isLoadingPlaylists;

  // Aria announcement that updates when search value or results change
  const announcement = useMemo(() => {
    if (isAnyLoading && !hasResults) {
      return "Loading…";
    }
    if (!hasResults && searchValue) {
      return `No results found for "${searchValue}"`;
    }
    if (!hasResults) {
      return "No results found";
    }
    const parts: string[] = [];
    if (items.length > 0) parts.push(`${items.length} of your items`);
    if (publicItems.length > 0)
      parts.push(`${publicItems.length} public items`);
    if (playlists.length > 0) parts.push(`${playlists.length} playlists`);
    if (users.length > 0) parts.push(`${users.length} people`);
    return parts.join(", ") + " available";
  }, [
    isAnyLoading,
    hasResults,
    searchValue,
    items.length,
    publicItems.length,
    playlists.length,
    users.length,
  ]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      data-testid="spotlight-dialog"
    >
      <CommandInput
        placeholder="Search items, playlists, and people…"
        className="border-none focus:ring-0"
        value={searchValue}
        onValueChange={setSearchValue}
        data-testid="spotlight-input"
      />
      <CommandList
        ref={listRef}
        className="flex max-h-[60vh] min-h-[300px] flex-col sm:max-h-[400px]"
      >
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        {/* Only show empty state after data has loaded - skeletons show during loading */}
        {hasInitialized && !isAnyLoading && (
          <CommandEmpty className="flex-1 py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <Search
                aria-hidden="true"
                className="text-muted-foreground/50 size-8"
              />
              <p className="text-muted-foreground text-sm">No results found.</p>
            </div>
          </CommandEmpty>
        )}

        {/* User's Items - with distinct icon style (solid folder) */}
        {(items.length > 0 || isAnyLoading || !hasInitialized) && (
          <CommandGroup heading="Your Items">
            {isAnyLoading || !hasInitialized ? (
              <>
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
              </>
            ) : (
              items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`item:${item.name} ${item.description || ""} ${item.breadcrumb || ""}`}
                  onSelect={() => handleSelectItem(item.id, item.ownerUsername)}
                  className="group h-[52px] cursor-pointer gap-3 px-3"
                >
                  <ItemThumbnail
                    tmdbPosterPath={item.tmdbPosterPath}
                    artworkId={item.artworkId}
                    fallbackClassName="group-aria-selected:bg-primary/10 group-aria-selected:text-primary transition-colors"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.name}</span>
                    {item.breadcrumb && (
                      <span className="text-muted-foreground/70 truncate text-xs">
                        {item.breadcrumb}
                      </span>
                    )}
                    {item.description && !item.breadcrumb && (
                      <span className="text-muted-foreground truncate text-xs">
                        {item.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))
            )}
          </CommandGroup>
        )}

        {/* Public Items - with distinct icon style (globe) */}
        {(publicItems.length > 0 || isAnyLoading || !hasInitialized) && (
          <CommandGroup heading="Public Items">
            {isAnyLoading || !hasInitialized ? (
              <>
                <ItemSkeleton />
                <ItemSkeleton />
              </>
            ) : (
              publicItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`public:${item.name} ${item.description || ""} ${item.ownerUsername}`}
                  onSelect={() =>
                    handleSelectPublicItem(item.id, item.ownerUsername)
                  }
                  className="group h-[52px] cursor-pointer gap-3 px-3"
                >
                  <ItemThumbnail
                    tmdbPosterPath={item.tmdbPosterPath}
                    artworkId={item.artworkId}
                    fallbackIcon={Globe}
                    fallbackClassName="group-aria-selected:bg-primary/10 group-aria-selected:text-primary transition-colors"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      by @{item.ownerUsername}
                    </span>
                  </div>
                </CommandItem>
              ))
            )}
          </CommandGroup>
        )}

        {/* Playlists - with distinct icon style (list music) */}
        {(playlists.length > 0 || isAnyLoading || !hasInitialized) && (
          <CommandGroup heading="Playlists">
            {isAnyLoading || !hasInitialized ? (
              <>
                <ItemSkeleton />
                <ItemSkeleton />
              </>
            ) : (
              playlists.map((playlist) => (
                <CommandItem
                  key={`playlist-${playlist.id}`}
                  value={`playlist-${playlist.name}-${playlist.ownerUsername}`}
                  onSelect={() =>
                    handleSelectItem(
                      `playlists/${playlist.id}`,
                      playlist.ownerUsername
                    )
                  }
                  className="group h-[52px] cursor-pointer gap-3 px-3"
                >
                  {playlist.hasArtwork ? (
                    <div className="bg-muted relative size-9 shrink-0 overflow-hidden rounded">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/playlist/artwork?playlistId=${playlist.id}`}
                        alt=""
                        className="size-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="bg-muted group-aria-selected:bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded transition-colors">
                      <ListMusic className="text-muted-foreground group-aria-selected:text-primary size-4 transition-colors" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {playlist.name}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {playlist.itemCount}{" "}
                      {playlist.itemCount === 1 ? "item" : "items"} · @
                      {playlist.ownerUsername}
                    </span>
                  </div>
                  <Globe className="text-muted-foreground/50 size-3.5 shrink-0" />
                </CommandItem>
              ))
            )}
          </CommandGroup>
        )}

        {/* People - with distinct icon style (user circle) */}
        {(users.length > 0 || isAnyLoading || !hasInitialized) && (
          <CommandGroup heading="People">
            {isAnyLoading || !hasInitialized ? (
              <>
                <ItemSkeleton />
                <ItemSkeleton />
              </>
            ) : (
              users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`user:${user.username} ${user.name || ""}`}
                  onSelect={() => handleSelectUser(user.username)}
                  className="group h-[52px] cursor-pointer gap-3 px-3"
                >
                  <UserThumbnail userId={user.id} name={user.name} showImage />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {user.name || user.username}
                    </span>
                    {user.name && (
                      <span className="text-muted-foreground truncate text-xs">
                        @{user.username}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))
            )}
          </CommandGroup>
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
