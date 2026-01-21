"use client";

/**
 * Client component for public profile page.
 * Uses unified components: ItemHero, SortDropdown, GridItem, EmptyState.
 * Uses shared sortPublicItems utility (DRY).
 */

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ItemHero } from "@/components/items/item-hero";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { EmptyState } from "@/components/items/empty-state";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import { EXPLORE_SORT_OPTIONS, sortPublicItems } from "@/lib/item-utils";
import { cn } from "@/lib/utils";
import type { PublicProfile, PublicItem } from "@/lib/public-auth";

interface PublicProfileClientProps {
  profile: PublicProfile;
  items: PublicItem[];
  currentUserId: string | null;
}

/**
 * Main client component for public profile.
 * Structure matches private pages: Hero -> Toolbar -> Grid.
 */
export function PublicProfileClient({
  profile,
  items,
  currentUserId,
}: PublicProfileClientProps) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreSortFilter();
  const displayName = profile.name ?? `@${profile.username}`;
  const isOwnProfile = currentUserId === profile.id;

  // Use shared sort utility (DRY - no duplicate sort function)
  const sortedItems = useMemo(
    () => sortPublicItems(items, sortBy),
    [items, sortBy]
  );

  // Preload on hover for faster perceived navigation (Rule 2.5)
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

  // Build hero background URL if user has hero image
  const heroBackgroundUrl = profile.hasHeroImage
    ? `/api/user/hero?userId=${profile.id}`
    : undefined;

  const hasItems = items.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", !hasItems && "flex-1")}>
      {/* Hero banner */}
      <ItemHero
        name={displayName}
        description={
          isOwnProfile ? "Your public profile" : `@${profile.username}`
        }
        backgroundUrl={heroBackgroundUrl}
      />

      {/* Toolbar - Sort only */}
      <div className="flex items-center gap-2 sm:gap-3">
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
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {sortedItems.map((item, index) => (
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
              priority={index < 8}
            />
          ))}
        </div>
      ) : (
        <EmptyState variant="public-profile-empty" />
      )}
    </div>
  );
}
