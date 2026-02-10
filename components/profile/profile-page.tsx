/**
 * Profile page content component.
 * Renders full ItemsView for owners, read-only grid for viewers.
 * Supports both authenticated owner mode and public viewer mode.
 */

"use client";

import { useMemo, useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { getItems } from "@/lib/item-actions";
import { ItemsView } from "@/components/items";
import { EditModeToggle } from "@/components/items/edit-mode-toggle";
import { CinematicHero, type HeroSlide } from "@/components/hero";
import { GridItem } from "@/components/sortable-grid/grid-item";
import { EmptyState } from "@/components/items/empty-state";
import { Section } from "@/components/ui/section";
import { HeroContentLayout } from "@/components/ui/hero-content-layout";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import { Button } from "@/components/ui/button";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import { useItemsSortFilter } from "@/hooks/use-items-sort-filter";
import { useSyncHandler } from "@/hooks/use-sync-handler";
import {
  EXPLORE_SORT_OPTIONS,
  sortPublicItems,
  filterItems,
} from "@/lib/item-utils";
import { formatProgressLabel } from "@/lib/progress-utils";
import type { ItemWithArtwork, ItemProgress, FilterOption } from "@/lib/types";

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
}: ProfilePageProps) {
  if (isOwner) {
    return (
      <OwnerModeContent
        profile={profile}
        items={items}
        hasDriveConnection={hasDriveConnection}
        libraryProgress={libraryProgress}
      />
    );
  }

  return (
    <ViewerModeContent
      profile={profile}
      items={items}
      viewerProgress={viewerProgress}
    />
  );
}

/**
 * Owner mode content component.
 * Full ItemsView with editing, sync, and add item controls.
 * State is lifted out of ItemsView so ContentToolbar can control it.
 */
function OwnerModeContent({
  profile,
  items: initialItems,
  hasDriveConnection,
  libraryProgress,
}: {
  profile: ProfileData;
  items: ItemWithArtwork[];
  hasDriveConnection: boolean;
  libraryProgress?: ItemProgress | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);

  // Sort/filter state (persisted to localStorage)
  const { sortBy, setSortBy, filterBy, setFilterBy } = useItemsSortFilter();

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

  // Disable edit mode when not using custom sort
  const isCustomSort = sortBy === "custom";

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

  return (
    <HeroContentLayout hero={hero} isPending={isPending}>
      <ContentToolbar
        sortBy={sortBy}
        onSortChange={setSortBy}
        filterBy={filterBy}
        onFilterChange={setFilterBy}
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
        filterBy={filterBy}
        onFilterChange={setFilterBy}
        hasDriveConnection={hasDriveConnection}
        currentUser={currentUser}
        disableTreeView
        onItemsChange={setItems}
      />
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
}: {
  profile: ProfileData;
  items: ItemWithArtwork[];
  viewerProgress?: { percentage: number } | null;
}) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreSortFilter();
  const [filterBy, setFilterBy] = useState<FilterOption>("all");

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
    const filtered = filterItems(unpinnedItems, filterBy);
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
  }, [unpinnedItems, sortBy, filterBy]);

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
        onSortChange={setSortBy}
        filterBy={filterBy}
        onFilterChange={setFilterBy}
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
              <div
                data-testid="pinned-items-grid"
                className="stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6"
              >
                {pinnedItems.map((item, index) => (
                  <GridItem
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    description={item.description}
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
              <div
                data-testid="items-grid-view"
                className="stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6"
              >
                {sortableItems.map((item, index) => {
                  // O(1) lookup for original item data
                  const originalItem = itemsById.get(item.id);
                  return (
                    <GridItem
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      description={item.description}
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
        </>
      ) : (
        <Section className="flex flex-1 flex-col">
          <EmptyState variant="public-profile-empty" />
        </Section>
      )}
    </HeroContentLayout>
  );
}
