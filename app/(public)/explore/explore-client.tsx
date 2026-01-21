"use client";

/**
 * Client component for the explore page.
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
import type { PublicItem } from "@/lib/public-auth";

interface ExploreClientProps {
  items: (PublicItem & { ownerUsername: string })[];
  currentUserId: string | null;
}

/**
 * Main explore client component.
 * Structure matches My Items page: Hero -> Toolbar -> Grid.
 * Shows "You" for own items, clickable @username for others.
 */
export function ExploreClient({ items, currentUserId }: ExploreClientProps) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreSortFilter();

  // Use shared sort utility (DRY - no duplicate sort function)
  const sortedItems = useMemo(
    () => sortPublicItems(items, sortBy),
    [items, sortBy]
  );

  // Preload on hover for faster perceived navigation (Rule 2.5)
  const handleMouseEnter = useCallback(
    (item: PublicItem & { ownerUsername: string }) => {
      router.prefetch(`/u/${item.ownerUsername}/${item.id}`);
    },
    [router]
  );

  const handleItemClick = useCallback(
    (item: PublicItem & { ownerUsername: string }) => {
      router.push(`/u/${item.ownerUsername}/${item.id}`);
    },
    [router]
  );

  const hasItems = items.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", !hasItems && "flex-1")}>
      {/* Hero banner */}
      <ItemHero
        name="Explore Collections"
        description="Discover curated media libraries from the community. Fork collections to build your own."
      />

      {/* Toolbar - Sort only (no filter, no view toggle) */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile: Options sheet (sort only) */}
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

        {/* Right side: Collection count */}
        {hasItems && (
          <span className="text-muted-foreground text-sm">
            {items.length} {items.length === 1 ? "collection" : "collections"}
          </span>
        )}
      </div>

      {/* Items grid or empty state */}
      {hasItems ? (
        <div
          data-testid="items-grid-view"
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {sortedItems.map((item, index) => {
            const isOwnItem = currentUserId === item.userId;
            return (
              <GridItem
                key={item.id}
                id={item.id}
                name={item.name}
                description={isOwnItem ? "You" : `@${item.ownerUsername}`}
                descriptionHref={
                  isOwnItem ? undefined : `/u/${item.ownerUsername}`
                }
                artworkId={item.artworkId}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => handleMouseEnter(item)}
                showArtwork={true}
                showDescription={true}
                priority={index < 8}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState variant="explore-empty" />
      )}
    </div>
  );
}
