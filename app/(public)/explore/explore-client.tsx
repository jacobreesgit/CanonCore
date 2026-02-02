"use client";

/**
 * Client component for the explore page.
 * Features HeroCarousel for featured items and grid for all public items.
 */

import { useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { EmptyState } from "@/components/items/empty-state";
import { ForkDestinationDialog } from "@/components/items/fork-destination-dialog";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import { EXPLORE_SORT_OPTIONS, sortPublicItems } from "@/lib/item-utils";
import { deleteItem, pinItem, unpinItem } from "@/lib/item-actions";
import { forkItem } from "@/lib/fork-actions";
import { cn } from "@/lib/utils";
import type { PublicItem, FeaturedItem } from "@/lib/public-auth";

interface CurrentUser {
  id: string;
  username: string | null;
  name: string | null;
}

interface ExploreClientProps {
  items: (PublicItem & {
    ownerUsername: string;
    ownerName: string | null;
    progressPercentage?: number | null;
    watchedCount?: number;
    totalMediaCount?: number;
    totalItems?: number;
    pinnedOrder?: number | null;
  })[];
  featuredItems: FeaturedItem[];
  currentUser: CurrentUser | null;
}

/**
 * Main explore client component.
 * Structure: HeroCarousel -> Toolbar -> Grid.
 * Shows "You" for own items, clickable @username for others.
 */
export function ExploreClient({
  items,
  featuredItems,
  currentUser,
}: ExploreClientProps) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreSortFilter();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.pinnedOrder != null).map((i) => i.id))
  );

  // Fork dialog state
  const [forkDialogOpen, setForkDialogOpen] = useState(false);
  const [forkingItemId, setForkingItemId] = useState<string | null>(null);
  const [forkingItemName, setForkingItemName] = useState<string>("");
  const [isForking, setIsForking] = useState(false);

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

  // Open fork dialog from carousel
  const handleForkClick = useCallback(
    (slideId: string) => {
      const item = featuredItems.find((i) => i.id === slideId);
      if (item) {
        setForkingItemId(slideId);
        setForkingItemName(item.name);
        setForkDialogOpen(true);
      }
    },
    [featuredItems]
  );

  // Execute fork with destination
  const handleForkConfirm = useCallback(
    async (parentId: string | null) => {
      if (!forkingItemId) return;

      setIsForking(true);
      try {
        const result = await forkItem(forkingItemId, parentId);
        if (result.success) {
          toast.success("Added to your library!", {
            description: `${forkingItemName} has been forked to your library.`,
            action:
              currentUser?.username && result.data
                ? {
                    label: "View",
                    onClick: () =>
                      router.push(
                        `/u/${currentUser.username}/${result.data?.itemId}`
                      ),
                  }
                : undefined,
          });
          setForkDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error ?? "Failed to fork item");
        }
      } catch {
        toast.error("Failed to fork item");
      } finally {
        setIsForking(false);
      }
    },
    [forkingItemId, forkingItemName, currentUser, router]
  );

  // Convert featured items to carousel slides
  const carouselSlides: HeroSlide[] = useMemo(
    () =>
      featuredItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        artworkId: item.artworkId,
        link: item.link,
        ownerUsername: item.ownerUsername,
        ownerName: item.ownerName,
        ownerUserId: item.ownerUserId,
        profileId: item.ownerUserId,
        profileHasImage: item.ownerHasImage,
      })),
    [featuredItems]
  );

  // Use shared sort utility (DRY - no duplicate sort function)
  // Filter out deleted items
  const sortedItems = useMemo(
    () =>
      sortPublicItems(
        items.filter((i) => !deletedIds.has(i.id)),
        sortBy
      ),
    [items, sortBy, deletedIds]
  );

  // Preload on hover for faster perceived navigation
  const handleMouseEnter = useCallback(
    (item: ExploreClientProps["items"][number]) => {
      router.prefetch(`/u/${item.ownerUsername}/${item.id}`);
    },
    [router]
  );

  const handleItemClick = useCallback(
    (item: ExploreClientProps["items"][number]) => {
      router.push(`/u/${item.ownerUsername}/${item.id}`);
    },
    [router]
  );

  const hasItems = items.length > 0;
  const hasFeatured = carouselSlides.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", !hasItems && "flex-1")}>
      {/* Hero Carousel - Featured Items */}
      {hasFeatured && (
        <HeroCarousel
          slides={carouselSlides}
          currentUserId={currentUser?.id}
          onFork={currentUser ? handleForkClick : undefined}
        />
      )}

      {/* Toolbar - Sort only (no filter, no view toggle) */}
      <div className="flex items-center justify-between gap-2 px-4 sm:gap-3 md:px-6 lg:px-8">
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
      </div>

      {/* Items grid or empty state */}
      {hasItems ? (
        <div
          data-testid="items-grid-view"
          className="grid grid-cols-1 gap-4 px-4 md:grid-cols-3 md:px-6 lg:grid-cols-5 lg:px-8"
        >
          {sortedItems.map((item, index) => {
            const isOwnItem = currentUser?.id === item.userId;
            // For own items: show "You" linked to your profile (no pic)
            // For others: show profile pic + @username linked to their profile
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
                progressPercentage={isOwnItem ? item.progressPercentage : null}
                watchedCount={isOwnItem ? item.watchedCount : undefined}
                totalMediaCount={isOwnItem ? item.totalMediaCount : undefined}
                totalItems={isOwnItem ? item.totalItems : undefined}
              />
            );

            // Wrap own items with context menu for settings/delete/pin
            if (isOwnItem) {
              return (
                <ItemContextMenu
                  key={item.id}
                  itemName={item.name}
                  showAddChild={false}
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

            return <div key={item.id}>{gridItem}</div>;
          })}
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-4 md:px-6 lg:px-8">
          <EmptyState variant="explore-empty" />
        </div>
      )}

      {/* Fork destination dialog */}
      <ForkDestinationDialog
        open={forkDialogOpen}
        onOpenChange={setForkDialogOpen}
        itemName={forkingItemName}
        onConfirm={handleForkConfirm}
        isForking={isForking}
      />
    </div>
  );
}
