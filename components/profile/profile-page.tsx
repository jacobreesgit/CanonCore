/**
 * Profile page content component.
 * Renders full ItemsView for owners, read-only grid for viewers.
 * Supports both authenticated owner mode and public viewer mode.
 */

"use client";

import {
  useMemo,
  useCallback,
  useState,
  useDeferredValue,
  useTransition,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { getItems } from "@/lib/item-actions";
import { ItemsView } from "@/components/items";
import { EditModeToggle } from "@/components/items/edit-mode-toggle";
import { CinematicHero, type HeroSlide } from "@/components/hero";
import { GridItem } from "@/components/sortable-grid/grid-item";
import { ViewerItemContextMenu } from "@/components/items/viewer-item-context-menu";
import { ForkDestinationDialog } from "@/components/items/fork-destination-dialog";
import { EmptyState } from "@/components/items/empty-state";
import { Section } from "@/components/ui/section";
import { HeroContentLayout } from "@/components/ui/hero-content-layout";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import {
  SearchInput,
  DebouncedSearchInput,
} from "@/components/ui/search-input";
import { InfiniteScrollTrigger } from "@/components/ui/infinite-scroll-trigger";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useItemsUrlState } from "@/hooks/use-items-url-state";
import { useViewerUrlState } from "@/hooks/use-viewer-url-state";
import { useSyncHandler } from "@/hooks/use-sync-handler";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInfiniteItems } from "@/hooks/use-infinite-items";
import { useSearchParam } from "@/hooks/use-search-param";
import { useForkDialog } from "@/hooks/use-fork-dialog";
import { emptySubscribe } from "@/lib/empty-subscribe";
import {
  getPublicItemsForUser,
  getPublicPlaylistsForUser,
} from "@/lib/public-auth";

// Lazy-load swipeable tabs (mobile-only, keeps Embla out of desktop bundle)
const SwipeableUnderlineTabs = dynamic(
  () =>
    import("@/components/ui/swipeable-underline-tabs").then((mod) => ({
      default: mod.SwipeableUnderlineTabs,
    })),
  { ssr: false }
);
import { EXPLORE_SORT_OPTIONS, sortPublicItems } from "@/lib/item-utils";
import { formatProgressLabel } from "@/lib/progress-utils";
import { PlaylistSection } from "@/components/playlists/playlist-section";
import type {
  ItemWithArtwork,
  ItemProgress,
  PaginatedResult,
  SortOption,
  PublicPlaylistCard,
  PlaylistWithCount,
} from "@/lib/types";
import type { PublicProfileItem } from "@/lib/public-auth";

/**
 * Profile data for unified display.
 * Subset of PublicProfile with fields needed by CinematicHero.
 */
interface ProfileData {
  /** User ID */
  id: string;
  /** Username for URL routing */
  username: string;
  /** Display name */
  name: string | null;
  /** Whether user has a profile image */
  hasImage: boolean;
  /** Whether user has a hero image */
  hasHeroImage: boolean;
  /** Dominant colour extracted from hero image */
  dominantColour: string | null;
  /** User bio for public display */
  bio: string | null;
}

interface ProfilePageProps {
  /** Profile data to display */
  profile: ProfileData;
  /** Items to display (full data for owner, public data for viewer) */
  items: ItemWithArtwork[];
  /** Whether the current viewer is the profile owner */
  isOwner: boolean;
  /** Whether user has Google Drive connected (owner mode only) */
  hasDriveConnection?: boolean;
  /** Library progress data (owner mode only) */
  libraryProgress?: ItemProgress | null;
  /** Public library progress for viewers (non-owner mode) */
  viewerProgress?: { percentage: number } | null;
  /** Public playlists for viewer mode */
  publicPlaylists?: PublicPlaylistCard[];
  /** Server-fetched owner playlists (avoids client-side flash) */
  ownerPlaylists?: PlaylistWithCount[];
  /** Server-rendered shelves (inserted between pinned and library) */
  shelves?: React.ReactNode;
  /** Paginated initial items for viewer mode infinite scroll */
  initialViewerItems?: PaginatedResult<PublicProfileItem>;
  /** Paginated initial playlists for viewer mode infinite scroll */
  initialViewerPlaylists?: PaginatedResult<PublicPlaylistCard>;
  /** Initial search query from URL for viewer mode */
  initialSearch?: string;
  /** Current user ID for viewer context menu (null = guest). */
  currentUserId?: string | null;
}

/**
 * Profile page content for both owner and viewer modes.
 * Owner mode: Full ItemsView with editing, CRUD, drag-drop, pinned items
 * Viewer mode: Read-only grid with sort functionality
 *
 * @example
 * // Owner viewing own profile
 * <ProfilePage
 *   profile={profile}
 *   items={allItems}
 *   isOwner={true}
 *   hasDriveConnection={true}
 *   libraryProgress={progress}
 * />
 *
 * @example
 * // Guest viewing public profile
 * <ProfilePage
 *   profile={profile}
 *   items={publicItems}
 *   isOwner={false}
 * />
 */
export function ProfilePage({
  profile,
  items,
  isOwner,
  hasDriveConnection = false,
  libraryProgress,
  viewerProgress,
  publicPlaylists,
  ownerPlaylists,
  shelves,
  initialViewerItems,
  initialViewerPlaylists,
  initialSearch,
  currentUserId,
}: ProfilePageProps) {
  if (isOwner) {
    return (
      <OwnerModeContent
        profile={profile}
        items={items}
        hasDriveConnection={hasDriveConnection}
        libraryProgress={libraryProgress}
        ownerPlaylists={ownerPlaylists}
        shelves={shelves}
      />
    );
  }

  return (
    <ViewerModeContent
      profile={profile}
      viewerProgress={viewerProgress}
      publicPlaylists={publicPlaylists ?? []}
      initialItems={initialViewerItems}
      initialPlaylists={initialViewerPlaylists}
      initialSearch={initialSearch ?? ""}
      currentUserId={currentUserId ?? null}
    />
  );
}

/**
 * Owner mode content component.
 * Full ItemsView with editing, sync, and add item controls.
 * Uses Items/Playlists tabs matching the item detail page pattern.
 * State is lifted out of ItemsView so ContentToolbar can control it.
 */
function OwnerModeContent({
  profile,
  items: initialItems,
  hasDriveConnection,
  libraryProgress,
  ownerPlaylists,
  shelves,
}: {
  profile: ProfileData;
  items: ItemWithArtwork[];
  hasDriveConnection: boolean;
  libraryProgress?: ItemProgress | null;
  ownerPlaylists?: PlaylistWithCount[];
  shelves?: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);

  // Viewport detection for responsive tab rendering
  const isMobile = useIsMobile();

  // Delay tab rendering until after mount so isMobile is accurate.
  // Prevents UnderlineTabs → SwipeableUnderlineTabs swap that causes focus loss.
  const tabsMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Sort/filter state (URL + localStorage backup)
  const {
    sortBy,
    setSortBy,
    filters,
    toggleFilter,
    clearFilters,
    isCustomSort,
    tab,
    setTab,
  } = useItemsUrlState();

  // Active tab — URL-backed, defaults to "items"
  const activeTab = tab ?? "items";

  // Client-side search state (NOT URL-backed — tree-view compat, no server round-trips)
  // useDeferredValue keeps input responsive while ItemsView re-render is interruptible
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const clearSearch = useCallback(() => setSearchQuery(""), []);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);

  // Add item dialog state
  const [addItemOpen, setAddItemOpen] = useState(false);

  // Sync with post-sync explicit refetch
  const handleSyncSuccess = useCallback(() => {
    startTransition(async () => {
      const result = await getItems(null);
      if (result.success && result.data) {
        setItems(result.data);
      }
    });
  }, []);
  const { isSyncing, handleSync } = useSyncHandler({
    onSuccess: handleSyncSuccess,
  });

  // Build hero URL with userId
  const heroBackgroundUrl = profile.hasHeroImage
    ? `/api/user/hero?userId=${profile.id}`
    : undefined;

  // Current user info for owner display in grid items
  const currentUser = {
    id: profile.id,
    username: profile.username,
    name: profile.name,
  };

  // Toolbar actions
  const toolbarActions = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAddItemOpen(true)}
        className="gap-1.5"
        aria-label="Add"
        data-testid="items-add-button"
      >
        <FontAwesomeIcon icon={faPlus} className="size-4" />
        <span className="hidden xl:inline">Add</span>
      </Button>
      <EditModeToggle
        isEditing={isEditing}
        onToggle={() => setIsEditing((prev) => !prev)}
        disabled={items.length === 0 || !isCustomSort}
        disabledReason={
          items.length === 0
            ? "No items to edit"
            : !isCustomSort
              ? "Set sort to Custom Order to reorder"
              : undefined
        }
      />
    </>
  );

  // Hero element
  const hero = (
    <CinematicHero
      headingLevel="h1"
      slides={[
        {
          id: "hero",
          name: profile.name ?? `@${profile.username}`,
          backgroundUrl: heroBackgroundUrl,
          dominantColour: profile.dominantColour ?? undefined,
          progress: libraryProgress?.percentage ?? undefined,
          progressLabel: libraryProgress
            ? (formatProgressLabel(libraryProgress) ?? undefined)
            : undefined,
          profile: {
            id: profile.id,
            username: profile.username,
            name: profile.name,
            hasImage: profile.hasImage,
            bio: profile.bio,
          },
        } satisfies HeroSlide,
      ]}
    />
  );

  // Items tab content (toolbar + search + items grid)
  const itemsContent = (
    <>
      <ContentToolbar
        sortBy={sortBy}
        onSortChange={setSortBy}
        filters={filters}
        toggleFilter={toggleFilter}
        clearFilters={clearFilters}
        showSync
        isSyncing={isSyncing}
        onSync={handleSync}
        hasDriveConnection={hasDriveConnection}
        disabled={items.length === 0}
        actions={toolbarActions}
      />
      <Section className="pt-2 pb-0">
        <DebouncedSearchInput
          value={searchQuery}
          onValueCommit={setSearchQuery}
          placeholder="Search your library…"
        />
      </Section>
      <ItemsView
        items={items}
        hideToolbar
        isEditing={isEditing}
        onEditingChange={setIsEditing}
        addItemOpen={addItemOpen}
        onAddItemOpenChange={setAddItemOpen}
        sortBy={sortBy}
        onSortChange={setSortBy}
        filters={filters}
        clearFilters={clearFilters}
        hasDriveConnection={hasDriveConnection}
        currentUser={currentUser}
        disableTreeView
        onItemsChange={setItems}
        shelves={shelves}
        searchQuery={deferredSearch}
        onSearchClear={clearSearch}
      />
    </>
  );

  // Playlists tab content
  const playlistsContent = (
    <PlaylistSection
      mode="owner"
      username={profile.username}
      initialPlaylists={ownerPlaylists}
    />
  );

  const tabs = [
    { id: "items", label: "Items", content: itemsContent },
    { id: "playlists", label: "Playlists", content: playlistsContent },
  ];

  return (
    <HeroContentLayout
      hero={hero}
      isPending={isPending}
      dominantColour={profile.dominantColour}
    >
      {tabsMounted ? (
        isMobile ? (
          <SwipeableUnderlineTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(id) => setTab(id as "items" | "playlists")}
            swipeEnabled={!isEditing}
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
    </HeroContentLayout>
  );
}

/**
 * Viewer mode content component.
 * Read-only grid with CinematicHero and sort functionality.
 */
function ViewerModeContent({
  profile,
  viewerProgress,
  publicPlaylists,
  initialItems,
  initialPlaylists,
  initialSearch,
  currentUserId,
}: {
  profile: ProfileData;
  viewerProgress?: { percentage: number } | null;
  publicPlaylists: PublicPlaylistCard[];
  initialItems?: PaginatedResult<PublicProfileItem>;
  initialPlaylists?: PaginatedResult<PublicPlaylistCard>;
  initialSearch: string;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const { sortBy, setSortBy, tab, setTab } = useViewerUrlState();

  // Fork dialog (shared hook)
  const fork = useForkDialog();

  // Search state: debounced URL sync via nuqs ?q= param
  const {
    inputValue,
    committedValue,
    setInputValue,
    clear: clearSearch,
  } = useSearchParam();

  // Infinite scroll for items
  const {
    items: allItems,
    fetchNextPage: fetchNextItems,
    hasNextPage: hasNextItems,
    isFetchingNextPage: isFetchingNextItems,
    isPlaceholderData: isItemsPlaceholder,
  } = useInfiniteItems<PublicProfileItem>({
    queryKey: ["profile-items", profile.id, committedValue],
    fetchAction: (cursor) =>
      getPublicItemsForUser({
        userId: profile.id,
        cursor,
        search: committedValue || undefined,
      }),
    initialData: initialSearch === committedValue ? initialItems : undefined,
  });

  // Infinite scroll for playlists
  const {
    items: allViewerPlaylists,
    fetchNextPage: fetchNextPlaylists,
    hasNextPage: hasNextPlaylists,
    isFetchingNextPage: isFetchingNextPlaylists,
    isPlaceholderData: isPlaylistsPlaceholder,
  } = useInfiniteItems<PublicPlaylistCard>({
    queryKey: ["profile-playlists", profile.id, committedValue],
    fetchAction: (cursor) =>
      getPublicPlaylistsForUser({
        userId: profile.id,
        cursor,
        search: committedValue || undefined,
      }),
    initialData:
      initialSearch === committedValue ? initialPlaylists : undefined,
  });

  const isMobile = useIsMobile();
  const tabsMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const activeTab = tab ?? "items";
  const isSearching = committedValue.length > 0;

  // Split items into pinned and unpinned, then sort unpinned
  const pinnedItems = useMemo(
    () =>
      allItems
        .filter((item) => item.pinnedOrder !== null)
        .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0)),
    [allItems]
  );

  const sortedUnpinnedItems = useMemo(() => {
    const unpinned = allItems.filter((item) => item.pinnedOrder === null);
    return sortPublicItems(unpinned, sortBy);
  }, [allItems, sortBy]);

  // Preload on hover for faster navigation
  const handleMouseEnter = useCallback(
    (id: string) => {
      router.prefetch(`/u/${profile.username}/${id}`);
    },
    [router, profile.username]
  );

  const handleItemClick = useCallback(
    (id: string) => {
      router.push(`/u/${profile.username}/${id}`);
    },
    [router, profile.username]
  );

  const hasItems = allItems.length > 0;

  // Hero element
  const hero = (
    <CinematicHero
      headingLevel="h1"
      slides={[
        {
          id: profile.id,
          name: profile.name ?? `@${profile.username}`,
          backgroundUrl: profile.hasHeroImage
            ? `/api/user/hero?userId=${profile.id}`
            : undefined,
          dominantColour: profile.dominantColour ?? undefined,
          progress: viewerProgress?.percentage,
          progressLabel:
            viewerProgress && viewerProgress.percentage > 0
              ? `${viewerProgress.percentage}% watched`
              : undefined,
          profile: {
            id: profile.id,
            username: profile.username,
            name: profile.name,
            hasImage: profile.hasImage,
            bio: profile.bio,
          },
        } satisfies HeroSlide,
      ]}
    />
  );

  // Items tab content
  const itemsContent = (
    <>
      <ContentToolbar
        sortBy={sortBy}
        onSortChange={setSortBy as (value: SortOption) => void}
        disabled={!hasItems && !isSearching}
        sortOptions={EXPLORE_SORT_OPTIONS}
        defaultSort="updated-desc"
      />

      <Section className="pt-2 pb-0">
        <SearchInput
          value={inputValue}
          onChange={setInputValue}
          onClear={clearSearch}
        />
      </Section>

      {hasItems ? (
        <div
          className={cn(
            "flex flex-col transition-opacity duration-200",
            isItemsPlaceholder && "opacity-60"
          )}
        >
          {/* Pinned items section */}
          {pinnedItems.length > 0 && (
            <Section className="py-8" aria-label="Pinned items">
              <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
                Pinned
              </h2>
              <div className="stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
                {pinnedItems.map((item, index) => (
                  <ViewerItemContextMenu
                    key={item.id}
                    itemId={item.id}
                    itemName={item.name}
                    isForked={item.isForkedByCurrentUser}
                    isGuest={!currentUserId}
                    showAddToPlaylist={!!currentUserId}
                    onFork={
                      currentUserId
                        ? () => fork.openDialog(item.id, item.name)
                        : undefined
                    }
                  >
                    <GridItem
                      id={item.id}
                      name={item.name}
                      description={item.description}
                      tmdbPosterPath={item.tmdbPosterPath}
                      artworkId={item.artworkId}
                      onClick={() => handleItemClick(item.id)}
                      onMouseEnter={() => handleMouseEnter(item.id)}
                      showArtwork={true}
                      showDescription={true}
                      priority={index < 5}
                      ownerLabel={`@${profile.username}`}
                      ownerHref={`/u/${profile.username}`}
                      ownerUserId={profile.id}
                      ownerName={profile.name}
                      isForked={item.isForkedByCurrentUser}
                      viewerMenuProps={{
                        itemId: item.id,
                        itemName: item.name,
                        isForked: item.isForkedByCurrentUser,
                        isGuest: !currentUserId,
                        showAddToPlaylist: !!currentUserId,
                        onFork: currentUserId
                          ? () => fork.openDialog(item.id, item.name)
                          : undefined,
                      }}
                    />
                  </ViewerItemContextMenu>
                ))}
              </div>
            </Section>
          )}

          {/* Library section */}
          {sortedUnpinnedItems.length > 0 && (
            <Section className="py-8" aria-label="Library">
              {pinnedItems.length > 0 && (
                <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
                  Library
                </h2>
              )}
              <div className="stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
                {sortedUnpinnedItems.map((item, index) => (
                  <ViewerItemContextMenu
                    key={item.id}
                    itemId={item.id}
                    itemName={item.name}
                    isForked={item.isForkedByCurrentUser}
                    isGuest={!currentUserId}
                    showAddToPlaylist={!!currentUserId}
                    onFork={
                      currentUserId
                        ? () => fork.openDialog(item.id, item.name)
                        : undefined
                    }
                  >
                    <GridItem
                      id={item.id}
                      name={item.name}
                      description={item.description}
                      tmdbPosterPath={item.tmdbPosterPath}
                      artworkId={item.artworkId}
                      onClick={() => handleItemClick(item.id)}
                      onMouseEnter={() => handleMouseEnter(item.id)}
                      showArtwork={true}
                      showDescription={true}
                      priority={index < 8}
                      ownerLabel={`@${profile.username}`}
                      ownerHref={`/u/${profile.username}`}
                      ownerUserId={profile.id}
                      ownerName={profile.name}
                      isForked={item.isForkedByCurrentUser}
                      viewerMenuProps={{
                        itemId: item.id,
                        itemName: item.name,
                        isForked: item.isForkedByCurrentUser,
                        isGuest: !currentUserId,
                        showAddToPlaylist: !!currentUserId,
                        onFork: currentUserId
                          ? () => fork.openDialog(item.id, item.name)
                          : undefined,
                      }}
                    />
                  </ViewerItemContextMenu>
                ))}
              </div>
            </Section>
          )}

          {/* Infinite scroll trigger */}
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
          <EmptyState variant="public-profile-empty" />
        </Section>
      )}
    </>
  );

  // Playlists tab content
  const playlistsContent = (
    <>
      <Section className="pt-2 pb-0">
        <SearchInput
          value={inputValue}
          onChange={setInputValue}
          onClear={clearSearch}
        />
      </Section>

      {allViewerPlaylists.length > 0 ? (
        <div
          className={cn(
            "transition-opacity duration-200",
            isPlaylistsPlaceholder && "opacity-60"
          )}
        >
          <PlaylistSection
            mode="viewer"
            username={profile.username}
            playlists={allViewerPlaylists}
          />

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
        <Section className="flex flex-1 flex-col items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">
            No public playlists yet
          </p>
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
      dominantColour={profile.dominantColour}
      className={
        !hasItems && !isSearching && publicPlaylists.length === 0
          ? "flex-1"
          : undefined
      }
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

      <ForkDestinationDialog
        open={fork.open}
        onOpenChange={fork.setOpen}
        onConfirm={fork.handleConfirm}
        isForking={fork.isForking}
        itemName={fork.itemName}
      />
    </HeroContentLayout>
  );
}
