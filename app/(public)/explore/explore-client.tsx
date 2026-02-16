"use client";

/**
 * Client component for the explore page.
 * Features HeroCarousel for featured items and grid for all public items.
 */

import { useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, UserX } from "lucide-react";
import { CinematicHero, type HeroSlide } from "@/components/hero";
import { HeroButton } from "@/components/items/hero-button";
import { PlaylistButton } from "@/components/items/playlist-button";
import { GridItem } from "@/components/sortable-grid/grid-item";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import { EmptyState } from "@/components/items/empty-state";
import { ForkDestinationDialog } from "@/components/items/fork-destination-dialog";
import { Section } from "@/components/ui/section";
import { HeroContentLayout } from "@/components/ui/hero-content-layout";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import { cn } from "@/lib/utils";
import { useExploreUrlState } from "@/hooks/use-explore-url-state";
import { EXPLORE_SORT_OPTIONS, sortPublicItems } from "@/lib/item-utils";
import { deleteItem, pinItem, unpinItem } from "@/lib/item-actions";
import { forkItem } from "@/lib/fork-actions";
import { getTmdbBackdropUrl } from "@/lib/tmdb-image-utils";
import type { PublicItem, FeaturedItem } from "@/lib/public-auth";
import type { TmdbItemMetadata } from "@/lib/tmdb-client";
import type { SortOption } from "@/lib/types";

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
    isForkedByCurrentUser?: boolean;
  })[];
  featuredItems: (FeaturedItem & { tmdbMetadata?: TmdbItemMetadata | null })[];
  currentUser: CurrentUser | null;
}

/**
 * Main explore client component.
 * Structure: HeroCarousel -> ContentToolbar -> Grid.
 * Shows "You" for own items, clickable @username for others.
 */
export function ExploreClient({
  items,
  featuredItems,
  currentUser,
}: ExploreClientProps) {
  const router = useRouter();
  const { sortBy, setSortBy, excludeMine, setExcludeMine, autoplay } =
    useExploreUrlState();
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
      })),
    [featuredItems]
  );

  // Use shared sort utility (DRY - no duplicate sort function)
  // Filter out deleted items, then apply exclude-mine toggle and sort
  const sortedItems = useMemo(() => {
    const activeItems = items.filter((i) => !deletedIds.has(i.id));
    const filtered =
      excludeMine && currentUser
        ? activeItems.filter((i) => i.userId !== currentUser.id)
        : activeItems;
    return sortPublicItems(filtered, sortBy);
  }, [items, sortBy, excludeMine, deletedIds, currentUser]);

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

  // Hero element
  const hero = hasFeatured ? (
    <CinematicHero
      slides={carouselSlides}
      autoAdvanceInterval={autoplay ? 5000 : 0}
      renderActions={(slide) => {
        const item = featuredItems.find((i) => i.id === slide.id);
        if (!item) return null;

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

            {/* Fork / Sign in */}
            {item.ownerUserId !== currentUser?.id && (
              <>
                {currentUser ? (
                  <HeroButton
                    data-testid="hero-fork-button"
                    onClick={() => handleForkClick(slide.id)}
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    Fork
                  </HeroButton>
                ) : (
                  <HeroButton onClick={() => router.push("/sign-in")}>
                    <Copy className="size-4" aria-hidden="true" />
                    Sign in to Fork
                  </HeroButton>
                )}
              </>
            )}

            {/* Playlist (placeholder feature) */}
            <PlaylistButton />
          </>
        );
      }}
    />
  ) : undefined;

  return (
    <HeroContentLayout hero={hero} className={!hasItems ? "flex-1" : undefined}>
      <ContentToolbar
        sortBy={sortBy}
        onSortChange={setSortBy as (value: SortOption) => void}
        disabled={!hasItems}
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
              <UserX aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Exclude Mine</span>
            </button>
          ) : undefined
        }
      />

      {/* Items grid or empty state */}
      {hasItems ? (
        <div className="flex flex-col">
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
                        showAddChild: false,
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
                      showAddChild={false}
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
                            showAddChild: false,
                            isPinned: pinnedIds.has(item.id),
                            onSettings: () => handleOpenSettings(item.id),
                            onDelete: () => handleDelete(item.id),
                            onPin: () => handlePin(item.id),
                            onUnpin: () => handleUnpin(item.id),
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
          </Section>
        </div>
      ) : (
        <Section className="flex flex-1 flex-col">
          <EmptyState variant="explore-empty" />
        </Section>
      )}

      {/* Fork destination dialog */}
      <ForkDestinationDialog
        open={forkDialogOpen}
        onOpenChange={setForkDialogOpen}
        itemName={forkingItemName}
        onConfirm={handleForkConfirm}
        isForking={isForking}
      />
    </HeroContentLayout>
  );
}
