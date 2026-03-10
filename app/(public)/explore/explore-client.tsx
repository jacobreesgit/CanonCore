"use client";

/**
 * Client component for the explore page.
 * Features HeroCarousel for featured items and grid for all public items.
 */

import { useMemo, useCallback, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserXmark } from "@fortawesome/free-solid-svg-icons";
import { emptySubscribe } from "@/lib/empty-subscribe";
import { useForkDialog } from "@/hooks/use-fork-dialog";
import { CinematicHero, type HeroSlide } from "@/components/hero";
import { HeroButton } from "@/components/items/hero-button";
import { ViewerDetailSettingsMenu } from "@/components/items/viewer-detail-settings-menu";
import { PlaylistGridItem } from "@/components/playlists/playlist-grid-item";
import { PlaylistContextMenu } from "@/components/playlists/playlist-context-menu";
import { GridItem } from "@/components/sortable-grid/grid-item";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import { ViewerItemContextMenu } from "@/components/items/viewer-item-context-menu";
import { EmptyState } from "@/components/items/empty-state";
import { ForkDestinationDialog } from "@/components/items/fork-destination-dialog";
import { Section } from "@/components/ui/section";
import { HeroContentLayout } from "@/components/ui/hero-content-layout";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import { SearchInput } from "@/components/ui/search-input";
import { InfiniteScrollTrigger } from "@/components/ui/infinite-scroll-trigger";
import { cn } from "@/lib/utils";
import { useExploreUrlState } from "@/hooks/use-explore-url-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInfiniteItems } from "@/hooks/use-infinite-items";
import { useSearchParam } from "@/hooks/use-search-param";
import { getExploreItems, getExplorePlaylists } from "@/lib/public-auth";
import { EXPLORE_SORT_OPTIONS, sortPublicItems } from "@/lib/item-utils";

// Lazy-load swipeable tabs (mobile-only, keeps Embla out of desktop bundle)
const SwipeableUnderlineTabs = dynamic(
  () =>
    import("@/components/ui/swipeable-underline-tabs").then((mod) => ({
      default: mod.SwipeableUnderlineTabs,
    })),
  { ssr: false }
);

import { deleteItem, pinItem, unpinItem } from "@/lib/item-actions";
import { updatePlaylist, deletePlaylist } from "@/lib/playlist-actions";
import { getTmdbBackdropUrl, getTmdbLogoUrl } from "@/lib/tmdb-image-utils";
import type {
  ExploreItem,
  ExplorePlaylistItem,
  FeaturedItem,
} from "@/lib/public-auth";
import type { TmdbItemMetadata } from "@/lib/tmdb-client";
import type { PaginatedResult, SortOption, SyncStatus } from "@/lib/types";

/** Sync data for the current user's own featured items (passed from server). */
interface OwnItemSyncData {
  syncStatus: SyncStatus;
  driveFileId: string | null;
}

interface CurrentUser {
  id: string;
  username: string | null;
  name: string | null;
}

interface ExploreClientProps {
  initialItems: PaginatedResult<ExploreItem>;
  initialPlaylists: PaginatedResult<ExplorePlaylistItem>;
  initialSearch: string;
  featuredItems: (FeaturedItem & { tmdbMetadata?: TmdbItemMetadata | null })[];
  currentUser: CurrentUser | null;
  /** Sync data for the current user's own featured items, keyed by item ID. */
  ownItemSyncData?: Record<string, OwnItemSyncData>;
}

/**
 * Main explore client component.
 * Structure: HeroCarousel -> ContentToolbar -> Grid.
 * Shows "You" for own items, clickable @username for others.
 */
export function ExploreClient({
  initialItems,
  initialPlaylists,
  initialSearch,
  featuredItems,
  currentUser,
  ownItemSyncData,
}: ExploreClientProps) {
  const router = useRouter();
  const {
    sortBy,
    setSortBy,
    excludeMine,
    setExcludeMine,
    autoplay,
    tab,
    setTab,
  } = useExploreUrlState();

  // Search state: debounced URL sync via nuqs ?q= param
  const {
    inputValue,
    committedValue,
    setInputValue,
    clear: clearSearch,
  } = useSearchParam();

  // Infinite scroll for items — queryKey includes search so refetch on search change
  const {
    items: allItems,
    fetchNextPage: fetchNextItems,
    hasNextPage: hasNextItems,
    isFetchingNextPage: isFetchingNextItems,
    isPlaceholderData: isItemsPlaceholder,
  } = useInfiniteItems<ExploreItem>({
    queryKey: ["explore-items", committedValue],
    fetchAction: (cursor) =>
      getExploreItems({
        cursor,
        search: committedValue || undefined,
        currentUserId: currentUser?.id,
      }),
    initialData: initialSearch === committedValue ? initialItems : undefined,
  });

  // Infinite scroll for playlists
  const {
    items: allPlaylists,
    fetchNextPage: fetchNextPlaylists,
    hasNextPage: hasNextPlaylists,
    isFetchingNextPage: isFetchingNextPlaylists,
    isPlaceholderData: isPlaylistsPlaceholder,
  } = useInfiniteItems<ExplorePlaylistItem>({
    queryKey: ["explore-playlists", committedValue],
    fetchAction: (cursor) =>
      getExplorePlaylists({
        cursor,
        search: committedValue || undefined,
      }),
    initialData:
      initialSearch === committedValue ? initialPlaylists : undefined,
  });

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [hiddenPlaylistIds, setHiddenPlaylistIds] = useState<Set<string>>(
    new Set()
  );
  const [activeColour, setActiveColour] = useState<string | null>(null);

  // Viewport detection for responsive tab rendering
  const isMobile = useIsMobile();

  // Delay tab rendering until after mount so isMobile is accurate.
  const tabsMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Active tab — URL-backed, defaults to "items"
  const activeTab = tab ?? "items";
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(
    () =>
      new Set(
        initialItems.items.filter((i) => i.pinnedOrder != null).map((i) => i.id)
      )
  );

  // Fork dialog (shared hook with custom toast for "View" action)
  const fork = useForkDialog({
    suppressToast: true,
    onSuccess: (result) => {
      toast.success("Added to your library!", {
        description: `${fork.itemName} has been forked to your library.`,
        action:
          currentUser?.username && result
            ? {
                label: "View",
                onClick: () =>
                  router.push(`/u/${currentUser.username}/${result.itemId}`),
              }
            : undefined,
      });
      router.refresh();
    },
  });

  // Handle delete for own items
  const handleDelete = useCallback(async (itemId: string) => {
    const result = await deleteItem(itemId);
    if (result.success) {
      setDeletedIds((prev) => new Set(prev).add(itemId));
      toast.success("Item deleted");
    } else {
      toast.error(result.error ?? "Failed to delete item");
    }
  }, []);

  // Handle pin for own items
  const handlePin = useCallback(async (itemId: string) => {
    const result = await pinItem(itemId);
    if (result.success) {
      setPinnedIds((prev) => new Set(prev).add(itemId));
      toast.success("Item pinned to sidebar");
    } else {
      toast.error(result.error ?? "Failed to pin item");
    }
  }, []);

  // Handle unpin for own items
  const handleUnpin = useCallback(async (itemId: string) => {
    const result = await unpinItem(itemId);
    if (result.success) {
      setPinnedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      toast.success("Item unpinned from sidebar");
    } else {
      toast.error(result.error ?? "Failed to unpin item");
    }
  }, []);

  // Navigate to settings in user's library
  const handleOpenSettings = useCallback(
    (itemId: string) => {
      if (currentUser?.username) {
        router.push(`/u/${currentUser.username}/${itemId}?settings=true`);
      }
    },
    [currentUser, router]
  );

  // Handle making own playlist private (removes from explore)
  const handlePlaylistToggleVisibility = useCallback(
    async (playlistId: string) => {
      setHiddenPlaylistIds((prev) => new Set(prev).add(playlistId));
      const result = await updatePlaylist(playlistId, { isPublic: false });
      if (result.error) {
        setHiddenPlaylistIds((prev) => {
          const next = new Set(prev);
          next.delete(playlistId);
          return next;
        });
        toast.error(result.error);
      } else {
        toast.success("Playlist set to private");
      }
    },
    []
  );

  // Handle deleting own playlist
  const handlePlaylistDelete = useCallback(async (playlistId: string) => {
    setHiddenPlaylistIds((prev) => new Set(prev).add(playlistId));
    const result = await deletePlaylist(playlistId);
    if (result.error) {
      setHiddenPlaylistIds((prev) => {
        const next = new Set(prev);
        next.delete(playlistId);
        return next;
      });
      toast.error(result.error);
    } else {
      toast.success("Playlist deleted");
    }
  }, []);

  // Open fork dialog from carousel
  const handleForkClick = useCallback(
    (slideId: string) => {
      const item = featuredItems.find((i) => i.id === slideId);
      if (item) {
        fork.openDialog(slideId, item.name);
      }
    },
    [featuredItems, fork]
  );

  // Convert featured items to carousel slides with TMDB data
  const carouselSlides: HeroSlide[] = useMemo(
    () =>
      featuredItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        backgroundUrl: item.tmdbBackdropPath
          ? getTmdbBackdropUrl(item.tmdbBackdropPath)
          : undefined,
        artworkId: item.artworkId,
        // Logo priority: TMDB logo (no artwork files in explore query)
        logoImage: item.tmdbLogoPath
          ? getTmdbLogoUrl(item.tmdbLogoPath)
          : undefined,
        dominantColour: item.dominantColour ?? undefined,
        link: item.link,
        attribution: `Shared by @${item.ownerUsername}`,
        attributionHref: `/u/${item.ownerUsername}`,
        tagline: item.tmdbMetadata?.tagline,
        metadata: item.tmdbMetadata
          ? {
              year: item.tmdbMetadata.year,
              runtime: item.tmdbMetadata.runtime,
              contentRating: item.tmdbMetadata.contentRating,
              voteAverage: item.tmdbMetadata.voteAverage,
            }
          : undefined,
        genres: item.tmdbMetadata?.genres?.length
          ? item.tmdbMetadata.genres
          : undefined,
        // Sync data is only provided for the current user's own items (filtered server-side)
        syncStatus: ownItemSyncData?.[item.id]?.syncStatus,
        driveFileId: ownItemSyncData?.[item.id]?.driveFileId,
      })),
    [featuredItems, ownItemSyncData]
  );

  // Use shared sort utility (DRY - no duplicate sort function)
  // Filter out deleted items, then apply exclude-mine toggle and sort
  const sortedItems = useMemo(() => {
    const activeItems = allItems.filter((i) => !deletedIds.has(i.id));
    const filtered =
      excludeMine && currentUser
        ? activeItems.filter((i) => i.userId !== currentUser.id)
        : activeItems;
    return sortPublicItems(filtered, sortBy);
  }, [allItems, sortBy, excludeMine, deletedIds, currentUser]);

  // Split into pinned (current user's only) and unpinned for section rendering
  const pinnedExploreItems = useMemo(
    () =>
      sortedItems.filter(
        (i) => currentUser?.id === i.userId && pinnedIds.has(i.id)
      ),
    [sortedItems, pinnedIds, currentUser]
  );
  const unpinnedExploreItems = useMemo(
    () =>
      sortedItems.filter(
        (i) => !(currentUser?.id === i.userId && pinnedIds.has(i.id))
      ),
    [sortedItems, pinnedIds, currentUser]
  );

  // Preload on hover for faster perceived navigation
  const handleMouseEnter = useCallback(
    (item: ExploreItem) => {
      router.prefetch(`/u/${item.ownerUsername}/${item.id}`);
    },
    [router]
  );

  const handleItemClick = useCallback(
    (item: ExploreItem) => {
      router.push(`/u/${item.ownerUsername}/${item.id}`);
    },
    [router]
  );

  const hasItems = allItems.length > 0;
  const isSearching = committedValue.length > 0;
  const hasFeatured = carouselSlides.length > 0;

  // Hero element
  const hero = hasFeatured ? (
    <CinematicHero
      slides={carouselSlides}
      autoAdvanceInterval={autoplay ? 5000 : 0}
      onColourChange={setActiveColour}
      renderActions={(slide) => {
        const item = featuredItems.find((i) => i.id === slide.id);
        if (!item) return null;

        const isOwnItem = item.ownerUserId === currentUser?.id;

        return (
          <>
            {/* View Item CTA */}
            {slide.link && (
              <HeroButton
                variant="primary"
                onClick={() => router.push(slide.link!)}
              >
                View Item
              </HeroButton>
            )}

            {/* Settings gear for non-owner items */}
            {!isOwnItem && (
              <ViewerDetailSettingsMenu
                itemId={item.id}
                itemName={item.name}
                onFork={
                  currentUser ? () => handleForkClick(slide.id) : undefined
                }
                showAddToPlaylist={!!currentUser}
                isGuest={!currentUser}
              />
            )}
          </>
        );
      }}
    />
  ) : undefined;

  // Items tab content (toolbar + grid)
  const itemsContent = (
    <>
      <ContentToolbar
        sortBy={sortBy}
        onSortChange={setSortBy as (value: SortOption) => void}
        disabled={!hasItems && !isSearching}
        sortOptions={EXPLORE_SORT_OPTIONS}
        defaultSort="updated-desc"
        sortTestId="explore-sort-dropdown"
        leftActions={
          currentUser ? (
            <button
              type="button"
              onClick={() => setExcludeMine(!excludeMine)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5",
                "text-sm transition-colors",
                excludeMine
                  ? "text-foreground bg-white/10"
                  : "text-muted-foreground hover:bg-white/5"
              )}
              aria-pressed={excludeMine}
              aria-label="Exclude my items"
              data-testid="explore-exclude-mine"
            >
              <FontAwesomeIcon
                icon={faUserXmark}
                className="size-4"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Exclude Mine</span>
            </button>
          ) : undefined
        }
      />

      <Section className="pt-2 pb-0">
        <SearchInput
          value={inputValue}
          onChange={setInputValue}
          onClear={clearSearch}
          testId="explore-items-search"
        />
      </Section>

      {/* Items grid or empty state */}
      {hasItems ? (
        <div
          className={cn(
            "flex flex-col transition-opacity duration-200",
            isItemsPlaceholder && "opacity-60"
          )}
        >
          {/* Pinned section (current user's pinned items only) */}
          {pinnedExploreItems.length > 0 && (
            <Section className="py-8" aria-label="Pinned items">
              <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
                Pinned
              </h2>
              <div className="stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
                {pinnedExploreItems.map((item, index) => {
                  const gridItem = (
                    <GridItem
                      id={item.id}
                      name={item.name}
                      description={item.description}
                      tmdbPosterPath={item.tmdbPosterPath}
                      artworkId={item.artworkId}
                      onClick={() => handleItemClick(item)}
                      onMouseEnter={() => handleMouseEnter(item)}
                      showArtwork={true}
                      showDescription={true}
                      priority={index < 5}
                      ownerLabel="You"
                      ownerHref={
                        currentUser?.username
                          ? `/u/${currentUser.username}`
                          : undefined
                      }
                      ownerUserId={currentUser?.id}
                      ownerName={currentUser?.name}
                      progressPercentage={item.progressPercentage}
                      watchedCount={item.watchedCount}
                      totalMediaCount={item.totalMediaCount}
                      totalItems={item.totalItems}
                      isOwn
                      moreMenuProps={{
                        itemName: item.name,
                        itemId: item.id,
                        showAddChild: false,
                        showAddToPlaylist: true,
                        isPinned: true,
                        onSettings: () => handleOpenSettings(item.id),
                        onDelete: () => handleDelete(item.id),
                        onPin: () => handlePin(item.id),
                        onUnpin: () => handleUnpin(item.id),
                      }}
                    />
                  );

                  return (
                    <ItemContextMenu
                      key={item.id}
                      itemName={item.name}
                      itemId={item.id}
                      showAddChild={false}
                      showAddToPlaylist
                      isPinned={true}
                      onSettings={() => handleOpenSettings(item.id)}
                      onDelete={() => handleDelete(item.id)}
                      onPin={() => handlePin(item.id)}
                      onUnpin={() => handleUnpin(item.id)}
                    >
                      {gridItem}
                    </ItemContextMenu>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Library section */}
          <Section className="py-8" aria-label="Library">
            {pinnedExploreItems.length > 0 && (
              <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
                Library
              </h2>
            )}
            <div className="stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
              {unpinnedExploreItems.map((item, index) => {
                const isOwnItem = currentUser?.id === item.userId;
                const ownerHref = isOwnItem
                  ? currentUser?.username
                    ? `/u/${currentUser.username}`
                    : undefined
                  : `/u/${item.ownerUsername}`;

                const gridItem = (
                  <GridItem
                    id={item.id}
                    name={item.name}
                    description={item.description}
                    tmdbPosterPath={item.tmdbPosterPath}
                    artworkId={item.artworkId}
                    onClick={() => handleItemClick(item)}
                    onMouseEnter={() => handleMouseEnter(item)}
                    showArtwork={true}
                    showDescription={true}
                    priority={index < 8}
                    ownerLabel={isOwnItem ? "You" : `@${item.ownerUsername}`}
                    ownerHref={ownerHref}
                    ownerUserId={isOwnItem ? currentUser?.id : item.userId}
                    ownerName={isOwnItem ? currentUser?.name : item.ownerName}
                    progressPercentage={
                      isOwnItem ? item.progressPercentage : null
                    }
                    watchedCount={isOwnItem ? item.watchedCount : undefined}
                    totalMediaCount={
                      isOwnItem ? item.totalMediaCount : undefined
                    }
                    totalItems={isOwnItem ? item.totalItems : undefined}
                    isOwn={isOwnItem}
                    isForked={!isOwnItem && item.isForkedByCurrentUser}
                    moreMenuProps={
                      isOwnItem
                        ? {
                            itemName: item.name,
                            itemId: item.id,
                            showAddChild: false,
                            showAddToPlaylist: true,
                            isPinned: pinnedIds.has(item.id),
                            onSettings: () => handleOpenSettings(item.id),
                            onDelete: () => handleDelete(item.id),
                            onPin: () => handlePin(item.id),
                            onUnpin: () => handleUnpin(item.id),
                          }
                        : undefined
                    }
                    viewerMenuProps={
                      !isOwnItem
                        ? {
                            itemId: item.id,
                            itemName: item.name,
                            isForked: item.isForkedByCurrentUser,
                            isGuest: !currentUser,
                            showAddToPlaylist: !!currentUser,
                            onFork: currentUser
                              ? () => fork.openDialog(item.id, item.name)
                              : undefined,
                          }
                        : undefined
                    }
                  />
                );

                if (isOwnItem) {
                  return (
                    <ItemContextMenu
                      key={item.id}
                      itemName={item.name}
                      itemId={item.id}
                      showAddChild={false}
                      showAddToPlaylist
                      isPinned={pinnedIds.has(item.id)}
                      onSettings={() => handleOpenSettings(item.id)}
                      onDelete={() => handleDelete(item.id)}
                      onPin={() => handlePin(item.id)}
                      onUnpin={() => handleUnpin(item.id)}
                    >
                      {gridItem}
                    </ItemContextMenu>
                  );
                }

                return (
                  <ViewerItemContextMenu
                    key={item.id}
                    itemId={item.id}
                    itemName={item.name}
                    isForked={item.isForkedByCurrentUser}
                    isGuest={!currentUser}
                    showAddToPlaylist={!!currentUser}
                    onFork={
                      currentUser
                        ? () => fork.openDialog(item.id, item.name)
                        : undefined
                    }
                  >
                    {gridItem}
                  </ViewerItemContextMenu>
                );
              })}
            </div>
          </Section>

          {/* Infinite scroll trigger for items */}
          <InfiniteScrollTrigger
            hasNextPage={hasNextItems}
            isFetchingNextPage={isFetchingNextItems}
            fetchNextPage={fetchNextItems}
          />
        </div>
      ) : isSearching ? (
        <Section className="flex flex-1 flex-col pt-6">
          <EmptyState
            variant="search-empty"
            searchQuery={committedValue}
            onAction={clearSearch}
          />
        </Section>
      ) : (
        <Section className="flex flex-1 flex-col pt-6">
          <EmptyState variant="explore-empty" />
        </Section>
      )}
    </>
  );

  // Filter out optimistically hidden playlists
  const visiblePlaylists = useMemo(
    () => allPlaylists.filter((p) => !hiddenPlaylistIds.has(p.id)),
    [allPlaylists, hiddenPlaylistIds]
  );

  // Playlists tab content
  const playlistsContent = (
    <>
      <Section className="pt-2 pb-0">
        <SearchInput
          value={inputValue}
          onChange={setInputValue}
          onClear={clearSearch}
          testId="explore-playlists-search"
        />
      </Section>

      {visiblePlaylists.length > 0 ? (
        <div
          className={cn(
            "transition-opacity duration-200",
            isPlaylistsPlaceholder && "opacity-60"
          )}
        >
          <Section className="py-8" aria-label="Playlists">
            <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
              Public Playlists
            </h2>
            <div className="stagger-grid grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              {visiblePlaylists.map((playlist) => {
                const isOwn = currentUser?.username === playlist.ownerUsername;

                const card = (
                  <PlaylistGridItem
                    playlist={playlist}
                    username={playlist.ownerUsername}
                    isOwner={isOwn}
                  />
                );

                if (isOwn) {
                  return (
                    <PlaylistContextMenu
                      key={playlist.id}
                      playlistName={playlist.name}
                      isPublic={true}
                      onRename={() =>
                        router.push(
                          `/u/${playlist.ownerUsername}/playlists/${playlist.id}`
                        )
                      }
                      onToggleVisibility={() =>
                        handlePlaylistToggleVisibility(playlist.id)
                      }
                      onDelete={() => handlePlaylistDelete(playlist.id)}
                    >
                      {card}
                    </PlaylistContextMenu>
                  );
                }

                return (
                  <PlaylistGridItem
                    key={playlist.id}
                    playlist={playlist}
                    username={playlist.ownerUsername}
                  />
                );
              })}
            </div>
          </Section>

          {/* Infinite scroll trigger for playlists */}
          <InfiniteScrollTrigger
            hasNextPage={hasNextPlaylists}
            isFetchingNextPage={isFetchingNextPlaylists}
            fetchNextPage={fetchNextPlaylists}
          />
        </div>
      ) : isSearching ? (
        <Section className="flex flex-1 flex-col pt-6">
          <EmptyState
            variant="search-empty"
            searchQuery={committedValue}
            onAction={clearSearch}
          />
        </Section>
      ) : (
        <Section className="flex flex-1 flex-col pt-6">
          <EmptyState variant="explore-empty" />
        </Section>
      )}
    </>
  );

  const tabs = [
    { id: "items", label: "Items", content: itemsContent },
    { id: "playlists", label: "Playlists", content: playlistsContent },
  ];

  return (
    <HeroContentLayout
      hero={hero}
      dominantColour={activeColour}
      animateColour
      className={!hasItems && !isSearching ? "flex-1" : undefined}
    >
      {tabsMounted ? (
        isMobile ? (
          <SwipeableUnderlineTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(id) => setTab(id as "items" | "playlists")}
          />
        ) : (
          <UnderlineTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(id) => setTab(id as "items" | "playlists")}
          />
        )
      ) : (
        itemsContent
      )}

      {/* Fork destination dialog */}
      <ForkDestinationDialog
        open={fork.open}
        onOpenChange={fork.setOpen}
        itemName={fork.itemName}
        onConfirm={fork.handleConfirm}
        isForking={fork.isForking}
      />
    </HeroContentLayout>
  );
}
