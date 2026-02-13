"use client";

/**
 * Client component for public item detail page.
 * Uses CinematicHero for cinematic header and Contents/About tabs for content.
 * Includes fork functionality in hero actions slot.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CinematicHero } from "@/components/hero";
import { HeroButton } from "@/components/items/hero-button";
import { PlaylistButton } from "@/components/items/playlist-button";
import { AboutTabContent } from "@/components/items/about-tab-content";
import { GridItem } from "@/components/sortable-grid";
import { Tree } from "@/components/sortable-tree";
import { useStoredViewMode } from "@/hooks/use-stored-view-mode";
import { EmptyState } from "@/components/items/empty-state";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { Section } from "@/components/ui/section";
import { useIsMobile } from "@/hooks/use-mobile";

// Lazy-load swipeable tabs (mobile-only, keeps Embla out of desktop bundle)
const SwipeableUnderlineTabs = dynamic(
  () =>
    import("@/components/ui/swipeable-underline-tabs").then((mod) => ({
      default: mod.SwipeableUnderlineTabs,
    })),
  { ssr: false }
);
import { HeroContentLayout } from "@/components/ui/hero-content-layout";
import { ContentToolbar } from "@/components/ui/content-toolbar";
import { useItemsSortFilter } from "@/hooks/use-items-sort-filter";
import { sortItems, filterItems, publicItemsToTree } from "@/lib/item-utils";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getTmdbBackdropUrl } from "@/lib/tmdb-image-utils";
import type { PublicProfile, PublicItem } from "@/lib/public-auth";
import type { ForkInfo, ForkStatus } from "@/lib/fork-actions";
import type { TmdbItemMetadata, TmdbItemDetails } from "@/lib/tmdb-client";
import type { TmdbDisplayOptions } from "@/lib/types";
import type { UniqueIdentifier } from "@dnd-kit/core";

interface PublicItemClientProps {
  profile: PublicProfile;
  item: PublicItem;
  childItems: (PublicItem & {
    progressPercentage?: number | null;
    watchedCount?: number;
    totalMediaCount?: number;
    totalItems?: number;
  })[];
  forkInfo: ForkInfo | null;
  forkStatus: ForkStatus | null;
  isAuthenticated: boolean;
  isOwnItem: boolean;
  /** Current user's username for navigation after forking. */
  currentUserUsername?: string | null;
  /** Current user's ID for hero carousel fork button. */
  currentUserId?: string | null;
  /** TMDB metadata for hero display. */
  tmdbMetadata?: TmdbItemMetadata | null;
  /** TMDB details for About tab (cast, providers, videos, recommendations). */
  tmdbDetails?: TmdbItemDetails | null;
  /** Per-item TMDB display preferences. */
  tmdbDisplayOptions?: TmdbDisplayOptions | null;
}

/**
 * Safe error messages to expose to users (sanitization).
 * Prevents leaking internal details in error responses.
 */
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  "Cannot fork your own item": "Cannot fork your own item",
  "Already forked": "This item is already in your library",
  "Item not found": "This item could not be found",
  "Rate limit exceeded": "Too many requests. Please try again later.",
};

/**
 * Returns a safe error message for display to users.
 * Sanitizes error messages to avoid leaking internal details.
 */
function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return SAFE_ERROR_MESSAGES[error.message] ?? "Failed to fork item";
  }
  return "Failed to fork item";
}

/**
 * Main client component.
 * Structure: HeroContentLayout -> Contents/About tabs -> Tree/Grid.
 */
export function PublicItemClient({
  profile,
  item,
  childItems,
  forkInfo,
  forkStatus,
  isAuthenticated,
  isOwnItem,
  currentUserUsername,
  currentUserId: _currentUserId,
  tmdbMetadata,
  tmdbDetails,
  tmdbDisplayOptions,
}: PublicItemClientProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  // Delay tab component rendering until after mount so isMobile is accurate.
  // Prevents UnderlineTabs → SwipeableUnderlineTabs swap that causes focus loss.
  const [tabsMounted, setTabsMounted] = useState(false);
  useEffect(() => setTabsMounted(true), []);

  const [isForking, setIsForking] = useState(false);

  // Sort/filter state (same as private item pages)
  const { sortBy, setSortBy, filterBy, setFilterBy } = useItemsSortFilter();

  // View mode state (persisted to localStorage)
  const [viewMode, setViewMode] = useStoredViewMode();

  // Filter to get only direct children of this item, then apply sort and filter
  type ChildItem = (typeof childItems)[number];
  const directChildren = useMemo(() => {
    const children = childItems.filter((child) => child.parentId === item.id);
    // sortItems/filterItems expect ItemWithArtwork but work on any item with name/order/updatedAt
    // Cast through unknown to preserve ChildItem type while using shared sort/filter logic
    const sortedChildren = sortItems(
      children as unknown as Parameters<typeof sortItems>[0],
      sortBy
    ) as unknown as ChildItem[];
    return filterItems(
      sortedChildren as unknown as Parameters<typeof filterItems>[0],
      filterBy
    ) as unknown as ChildItem[];
  }, [childItems, item.id, sortBy, filterBy]);

  // Convert to tree structure for Tree component (includes all descendants)
  // Only include progress data for own items
  const treeItems = useMemo(() => {
    const itemsForTree = isOwnItem
      ? childItems
      : childItems.map((child) => ({
          ...child,
          progressPercentage: undefined,
          watchedCount: undefined,
          totalMediaCount: undefined,
          totalItems: undefined,
        }));
    return publicItemsToTree(itemsForTree, item.depth);
  }, [childItems, item.depth, isOwnItem]);

  // Preload on hover for faster perceived navigation
  const handleMouseEnter = useCallback(
    (id: string) => {
      router.prefetch(`/u/${profile.username}/${id}`);
    },
    [router, profile.username]
  );

  const handleItemClick = useCallback(
    (id: UniqueIdentifier) => {
      router.push(`/u/${profile.username}/${id}`);
    },
    [router, profile.username]
  );

  const handleFork = async () => {
    setIsForking(true);
    try {
      const response = await fetch(`/api/fork/${item.id}`, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fork item");
      }

      toast.success("Added to your library!", {
        description: `${item.name} has been forked to your library.`,
        action: currentUserUsername
          ? {
              label: "View",
              onClick: () =>
                router.push(`/u/${currentUserUsername}/${data.itemId}`),
            }
          : undefined,
      });

      router.refresh();
    } catch (error) {
      // Sanitize error message to avoid leaking internal details
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsForking(false);
    }
  };

  const hasChildren = childItems.length > 0;
  const hasTmdb = !!item.tmdbId;
  const isTV = item.tmdbType === "tv";

  // Fork actions for hero slot
  const forkActions = (
    <>
      {!isOwnItem && !forkStatus?.hasForked && isAuthenticated && (
        <HeroButton
          onClick={handleFork}
          disabled={isForking}
          data-testid="hero-fork-button"
        >
          {isForking ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          Fork to Library
        </HeroButton>
      )}
      {!isOwnItem && forkStatus?.hasForked && (
        <HeroButton
          variant="secondary"
          data-testid="hero-fork-button"
          onClick={() => {
            if (currentUserUsername && forkStatus.forkedItemId) {
              router.push(
                `/u/${currentUserUsername}/${forkStatus.forkedItemId}`
              );
            }
          }}
        >
          <Check className="size-4 text-green-400" aria-hidden="true" />
          In Your Library
        </HeroButton>
      )}
      {!isOwnItem && !isAuthenticated && (
        <HeroButton
          onClick={() => router.push("/sign-in")}
          data-testid="hero-fork-button"
        >
          <Copy className="size-4" aria-hidden="true" />
          Sign in to Fork
        </HeroButton>
      )}
      {/* Playlist (placeholder feature) */}
      <PlaylistButton />
    </>
  );

  // Contents toolbar right actions
  const contentsActions =
    forkInfo && forkInfo.forkCount > 0 ? (
      <span className="text-muted-foreground hidden items-center gap-1.5 text-sm lg:flex">
        <Copy className="size-4" />
        {forkInfo.forkCount} {forkInfo.forkCount === 1 ? "fork" : "forks"}
      </span>
    ) : undefined;

  // About tab content (shared component with internal filter state)
  const aboutContent = (
    <AboutTabContent
      description={item.description}
      tmdbDetails={tmdbDetails}
      tmdbDisplayOptions={tmdbDisplayOptions}
      isTV={isTV}
    />
  );

  // Contents tab content (toolbar + tree/grid)
  const contentsContent = (
    <div className="flex flex-col">
      <ContentToolbar
        sortBy={sortBy}
        onSortChange={setSortBy}
        filterBy={filterBy}
        onFilterChange={setFilterBy}
        viewMode={viewMode}
        onViewChange={setViewMode}
        disabled={!hasChildren}
        actions={contentsActions}
      />

      {/* Forked from attribution */}
      {forkInfo?.source && (
        <Section>
          <p className="text-muted-foreground text-sm">
            Forked from{" "}
            <Link
              href={`/u/${forkInfo.source.ownerUsername}/${forkInfo.source.id}`}
              className="hover:text-foreground underline"
            >
              {forkInfo.source.name}
            </Link>
            {forkInfo.source.ownerUsername && (
              <>
                {" "}
                by{" "}
                <Link
                  href={`/u/${forkInfo.source.ownerUsername}`}
                  className="hover:text-foreground underline"
                >
                  @{forkInfo.source.ownerUsername}
                </Link>
              </>
            )}
          </p>
        </Section>
      )}

      {/* Child items - Tree or Grid view based on viewMode */}
      {hasChildren ? (
        viewMode === "grid" ? (
          <Section className="py-8" aria-label="Contents">
            <div
              data-testid="items-grid-view"
              className="stagger-grid grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6"
            >
              {directChildren.map((child, index) => (
                <GridItem
                  key={child.id}
                  id={child.id}
                  name={child.name}
                  description={child.description}
                  tmdbPosterPath={child.tmdbPosterPath}
                  artworkId={child.artworkId}
                  onClick={() => handleItemClick(child.id)}
                  onMouseEnter={() => handleMouseEnter(child.id)}
                  showArtwork={true}
                  showDescription={true}
                  priority={index < 8}
                  ownerLabel={isOwnItem ? "You" : `@${profile.username}`}
                  ownerHref={`/u/${profile.username}`}
                  ownerUserId={isOwnItem ? undefined : profile.id}
                  ownerName={isOwnItem ? undefined : profile.name}
                  progressPercentage={
                    isOwnItem ? child.progressPercentage : null
                  }
                  watchedCount={isOwnItem ? child.watchedCount : undefined}
                  totalMediaCount={
                    isOwnItem ? child.totalMediaCount : undefined
                  }
                  totalItems={isOwnItem ? child.totalItems : undefined}
                />
              ))}
            </div>
          </Section>
        ) : (
          <Section className="py-8" aria-label="Contents">
            <Tree items={treeItems} onItemClick={handleItemClick} />
          </Section>
        )
      ) : (
        <Section className="py-8">
          <EmptyState variant="public-item-empty" />
        </Section>
      )}
    </div>
  );

  // Determine whether to show tabs
  const showTabs = hasChildren || hasTmdb;

  // Active tab for mobile swipeable tabs (controlled)
  const defaultTabId = hasChildren ? "contents" : "about";
  const [activeTab, setActiveTab] = useState(defaultTabId);

  // Sync activeTab when defaultTabId changes (e.g. children added/removed)
  useEffect(() => {
    setActiveTab(defaultTabId);
  }, [defaultTabId]);

  // Resolve hero background URL: TMDB backdrop takes precedence over artwork
  const heroBackgroundUrl = item.tmdbBackdropPath
    ? getTmdbBackdropUrl(item.tmdbBackdropPath)
    : undefined;

  // Hero element
  const hero = (
    <CinematicHero
      slides={[
        {
          id: item.id,
          name: item.name,
          backgroundUrl: heroBackgroundUrl,
          artworkId: item.artworkId,
          tagline:
            tmdbDisplayOptions?.showTagline !== false
              ? tmdbMetadata?.tagline
              : undefined,
          description: item.description ?? undefined,
          metadata:
            tmdbDisplayOptions?.showMetadata !== false && tmdbMetadata
              ? {
                  year: tmdbMetadata.year,
                  runtime: tmdbMetadata.runtime,
                  contentRating: tmdbMetadata.contentRating,
                  voteAverage: tmdbMetadata.voteAverage,
                }
              : undefined,
          genres:
            tmdbDisplayOptions?.showGenres !== false &&
            tmdbMetadata?.genres?.length
              ? tmdbMetadata.genres
              : undefined,
          attribution: `Shared by @${profile.username}`,
        },
      ]}
      headingLevel="h1"
      actions={forkActions}
    />
  );

  return (
    <HeroContentLayout hero={hero}>
      {/* Tabbed content or simple content */}
      {showTabs && tabsMounted ? (
        isMobile ? (
          <SwipeableUnderlineTabs
            tabs={[
              {
                id: "contents",
                label: "Contents",
                content: contentsContent,
              },
              { id: "about", label: "About", content: aboutContent },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        ) : (
          <UnderlineTabs
            defaultTab={defaultTabId}
            tabs={[
              {
                id: "contents",
                label: "Contents",
                content: contentsContent,
              },
              { id: "about", label: "About", content: aboutContent },
            ]}
          />
        )
      ) : showTabs ? (
        // During SSR/initial render, show content directly (tabs appear after mount)
        contentsContent
      ) : (
        // No tabs needed — just show fork info and empty state
        <div className="flex flex-1 flex-col">
          {forkInfo?.source && (
            <Section>
              <p className="text-muted-foreground text-sm">
                Forked from{" "}
                <Link
                  href={`/u/${forkInfo.source.ownerUsername}/${forkInfo.source.id}`}
                  className="hover:text-foreground underline"
                >
                  {forkInfo.source.name}
                </Link>
                {forkInfo.source.ownerUsername && (
                  <>
                    {" "}
                    by{" "}
                    <Link
                      href={`/u/${forkInfo.source.ownerUsername}`}
                      className="hover:text-foreground underline"
                    >
                      @{forkInfo.source.ownerUsername}
                    </Link>
                  </>
                )}
              </p>
            </Section>
          )}
          <Section className="flex flex-1 flex-col">
            <EmptyState variant="public-item-empty" />
          </Section>
        </div>
      )}
    </HeroContentLayout>
  );
}
