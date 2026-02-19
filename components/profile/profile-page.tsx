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
  useTransition,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { getItems } from "@/lib/item-actions";
import { ItemsView } from "@/components/items";
import { EditModeToggle } from "@/components/items/edit-mode-toggle";
import { CinematicHero, type HeroSlide } from "@/components/hero";
import { GridItem } from "@/components/sortable-grid/grid-item";
import { EmptyState } from "@/components/items/empty-state";
import { Section } from "@/components/ui/section";
import { HeroContentLayout } from "@/components/ui/hero-content-layout";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import { Button } from "@/components/ui/button";
import { useItemsUrlState } from "@/hooks/use-items-url-state";
import { useExploreUrlState } from "@/hooks/use-explore-url-state";
import { useSyncHandler } from "@/hooks/use-sync-handler";
import { useIsMobile } from "@/hooks/use-mobile";

// Lazy-load swipeable tabs (mobile-only, keeps Embla out of desktop bundle)
const SwipeableUnderlineTabs = dynamic(
  () =>
    import("@/components/ui/swipeable-underline-tabs").then((mod) => ({
      default: mod.SwipeableUnderlineTabs,
    })),
  { ssr: false }
);
import {
  EXPLORE_SORT_OPTIONS,
  sortPublicItems,
  filterItems,
  toggleContentFilter,
} from "@/lib/item-utils";
import { formatProgressLabel } from "@/lib/progress-utils";
import { PlaylistSection } from "@/components/playlists/playlist-section";
import type {
  ItemWithArtwork,
  ItemProgress,
  ContentFilter,
  SortOption,
  PublicPlaylistCard,
  PlaylistWithCount,
} from "@/lib/types";

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
}: ProfilePageProps) {
  if (isOwner) {
    return (
      <OwnerModeContent
        profile={profile}
        items={items}
        hasDriveConnection={hasDriveConnection}
        libraryProgress={libraryProgress}
        ownerPlaylists={ownerPlaylists}
      />
    );
  }

  return (
    <ViewerModeContent
      profile={profile}
      items={items}
      viewerProgress={viewerProgress}
      publicPlaylists={publicPlaylists ?? []}
    />
  );
}

/** No-op subscribe for useSyncExternalStore (value never changes). */
const emptySubscribe = () => () => {};

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
}: {
  profile: ProfileData;
  items: ItemWithArtwork[];
  hasDriveConnection: boolean;
  libraryProgress?: ItemProgress | null;
  ownerPlaylists?: PlaylistWithCount[];
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
        <Plus className="size-4" strokeWidth={2} />
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
          progress: libraryProgress?.percentage ?? undefined,
          progressLabel: libraryProgress
            ? (formatProgressLabel(libraryProgress) ?? undefined)
            : undefined,
          profile: {
            id: profile.id,
            username: profile.username,
            name: profile.name,
            hasImage: profile.hasImage,
          },
        } satisfies HeroSlide,
      ]}
    />
  );

  // Items tab content (toolbar + items grid)
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
    <HeroContentLayout hero={hero} isPending={isPending}>
      {tabsMounted ? (
        isMobile ? (
          <SwipeableUnderlineTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(id) => setTab(id as "items" | "playlists")}
            swipeEnabled={!isEditing}
          />
        ) : (
          <UnderlineTabs defaultTab="items" tabs={tabs} />
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
  items,
  viewerProgress,
  publicPlaylists,
}: {
  profile: ProfileData;
  items: ItemWithArtwork[];
  viewerProgress?: { percentage: number } | null;
  publicPlaylists: PublicPlaylistCard[];
}) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreUrlState();
  const [filters, setFilters] = useState<ContentFilter[]>([]);

  const toggleFilter = useCallback((filter: ContentFilter) => {
    setFilters((prev) => toggleContentFilter(prev, filter));
  }, []);

  const clearFilters = useCallback(() => setFilters([]), []);

  // Create O(1) lookup map for original items (avoids O(n²) find in render loop)
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );

  // Split items into pinned and unpinned
  const pinnedItems = useMemo(
    () =>
      items
        .filter((item) => item.pinnedOrder !== null)
        .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0)),
    [items]
  );

  const unpinnedItems = useMemo(
    () => items.filter((item) => item.pinnedOrder === null),
    [items]
  );

  // Filter unpinned items, then transform to sortable format and sort
  const sortableItems = useMemo(() => {
    const filtered = filterItems(unpinnedItems, filters);
    const publicItems = filtered.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      artworkId: item.artworkId,
      updatedAt: item.updatedAt,
      // These fields are needed by sortPublicItems but may not be present
      parentId: item.parentId,
      depth: item.depth,
      order: item.order,
      userId: item.userId,
      tmdbId: null,
      tmdbType: null,
      forkCount: 0,
    }));
    return sortPublicItems(publicItems, sortBy);
  }, [unpinnedItems, sortBy, filters]);

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

  const hasItems = items.length > 0;

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
          },
        } satisfies HeroSlide,
      ]}
    />
  );

  return (
    <HeroContentLayout hero={hero} className={!hasItems ? "flex-1" : undefined}>
      <ContentToolbar
        sortBy={sortBy}
        onSortChange={setSortBy as (value: SortOption) => void}
        filters={filters}
        toggleFilter={toggleFilter}
        clearFilters={clearFilters}
        disabled={!hasItems}
        sortOptions={EXPLORE_SORT_OPTIONS}
        defaultSort="updated-desc"
      />

      {/* Items grid or empty state */}
      {hasItems ? (
        <>
          {/* Pinned items section */}
          {pinnedItems.length > 0 && (
            <Section className="py-8" aria-label="Pinned items">
              <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
                Pinned
              </h2>
              <div className="stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
                {pinnedItems.map((item, index) => (
                  <GridItem
                    key={item.id}
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
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Library section (items not pinned) */}
          {sortableItems.length > 0 && (
            <Section className="py-8" aria-label="Library">
              {pinnedItems.length > 0 && (
                <h2 className="mb-4 text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
                  Library
                </h2>
              )}
              <div className="stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
                {sortableItems.map((item, index) => {
                  // O(1) lookup for original item data
                  const originalItem = itemsById.get(item.id);
                  return (
                    <GridItem
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      description={item.description}
                      tmdbPosterPath={originalItem?.tmdbPosterPath ?? null}
                      artworkId={originalItem?.artworkId ?? item.artworkId}
                      onClick={() => handleItemClick(item.id)}
                      onMouseEnter={() => handleMouseEnter(item.id)}
                      showArtwork={true}
                      showDescription={true}
                      priority={index < 8}
                      ownerLabel={`@${profile.username}`}
                      ownerHref={`/u/${profile.username}`}
                      ownerUserId={profile.id}
                      ownerName={profile.name}
                    />
                  );
                })}
              </div>
            </Section>
          )}

          {/* Playlists section */}
          <PlaylistSection
            mode="viewer"
            username={profile.username}
            playlists={publicPlaylists}
          />
        </>
      ) : (
        <>
          <PlaylistSection
            mode="viewer"
            username={profile.username}
            playlists={publicPlaylists}
          />
          {publicPlaylists.length === 0 && (
            <Section className="flex flex-1 flex-col">
              <EmptyState variant="public-profile-empty" />
            </Section>
          )}
        </>
      )}
    </HeroContentLayout>
  );
}
