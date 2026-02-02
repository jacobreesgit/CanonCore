/**
 * Profile page content component.
 * Renders full ItemsView for owners, read-only grid for viewers.
 * Supports both authenticated owner mode and public viewer mode.
 */

"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ItemsView } from "@/components/items";
import { ProfileHero } from "./profile-hero";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { EmptyState } from "@/components/items/empty-state";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import { EXPLORE_SORT_OPTIONS, sortPublicItems } from "@/lib/item-utils";
import { cn } from "@/lib/utils";
import type { ItemWithArtwork, ItemProgress } from "@/lib/types";
import type { PublicProfile } from "@/lib/public-auth";

/**
 * Profile data for unified display.
 * Subset of PublicProfile with fields needed by ProfileHero.
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
}

/**
 * Profile page content for both owner and viewer modes.
 * Owner mode: Full ItemsView with editing, CRUD, drag-drop
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
}: ProfilePageProps) {
  // Build hero URL with userId
  const heroBackgroundUrl = profile.hasHeroImage
    ? `/api/user/hero?userId=${profile.id}`
    : undefined;

  // Convert profile to PublicProfile shape for ProfileHero
  // Use epoch date as placeholder since createdAt is not used by ProfileHero
  const publicProfile: PublicProfile = useMemo(
    () => ({
      id: profile.id,
      username: profile.username,
      name: profile.name,
      hasImage: profile.hasImage,
      hasHeroImage: profile.hasHeroImage,
      createdAt: new Date(0),
    }),
    [
      profile.id,
      profile.username,
      profile.name,
      profile.hasImage,
      profile.hasHeroImage,
    ]
  );

  // Current user info for owner display in grid items
  const currentUser = isOwner
    ? {
        id: profile.id,
        username: profile.username,
        name: profile.name,
      }
    : null;

  if (isOwner) {
    // Owner mode: Full ItemsView with all functionality
    return (
      <ItemsView
        items={items}
        heroTitle={profile.name ?? `@${profile.username}`}
        heroBackgroundUrl={heroBackgroundUrl}
        heroProgress={libraryProgress}
        hasDriveConnection={hasDriveConnection}
        currentUser={currentUser}
        disableTreeView
        addContainerPadding
        // Pass profile data for avatar in hero carousel
        heroProfile={publicProfile}
      />
    );
  }

  // Viewer mode: Read-only grid with ProfileHero
  return <ViewerModeContent profile={publicProfile} items={items} />;
}

/**
 * Viewer mode content component.
 * Read-only grid with ProfileHero and sort functionality.
 */
function ViewerModeContent({
  profile,
  items,
}: {
  profile: PublicProfile;
  items: ItemWithArtwork[];
}) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreSortFilter();

  // Create O(1) lookup map for original items (avoids O(n²) find in render loop)
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );

  // Transform ItemWithArtwork to sortable format and sort
  const sortableItems = useMemo(() => {
    const publicItems = items.map((item) => ({
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
  }, [items, sortBy]);

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

  return (
    <div className={cn("flex flex-col gap-6", !hasItems && "flex-1")}>
      {/* Profile hero with cover photo and avatar */}
      <ProfileHero profile={profile} isOwnProfile={false} addContainerPadding />

      {/* Toolbar - Sort only */}
      <div className="flex items-center gap-2 px-4 sm:gap-3 md:px-6 lg:px-8">
        {/* Mobile: Options sheet */}
        <div className="sm:hidden">
          <MobileOptionsSheet
            sortBy={sortBy}
            onSortChange={setSortBy}
            disabled={!hasItems}
            sortOptions={EXPLORE_SORT_OPTIONS}
            defaultSort="updated-desc"
          />
        </div>

        {/* Desktop: Sort dropdown */}
        <div className="hidden items-center gap-3 sm:flex">
          <SortDropdown
            value={sortBy}
            onChange={setSortBy}
            disabled={!hasItems}
            options={EXPLORE_SORT_OPTIONS}
          />
        </div>
      </div>

      {/* Items grid or empty state */}
      {hasItems ? (
        <div
          data-testid="items-grid-view"
          className="grid grid-cols-2 gap-4 px-4 md:grid-cols-3 md:px-6 lg:grid-cols-5 lg:px-8"
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
      ) : (
        <div className="flex flex-1 flex-col px-4 md:px-6 lg:px-8">
          <EmptyState variant="public-profile-empty" />
        </div>
      )}
    </div>
  );
}
