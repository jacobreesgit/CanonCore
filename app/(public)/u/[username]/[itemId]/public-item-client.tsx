"use client";

/**
 * Client component for public item detail page.
 * Uses unified components: ItemHero, SortDropdown, GridItem, EmptyState.
 * Uses shared sortPublicItems utility (DRY).
 * Includes fork functionality in toolbar.
 */

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ItemHero } from "@/components/items/item-hero";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { EmptyState } from "@/components/items/empty-state";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import { EXPLORE_SORT_OPTIONS, sortPublicItems } from "@/lib/item-utils";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PublicProfile, PublicItem } from "@/lib/public-auth";
import type { ForkInfo, ForkStatus } from "@/lib/fork-actions";

interface PublicItemClientProps {
  profile: PublicProfile;
  item: PublicItem;
  childItems: PublicItem[];
  forkInfo: ForkInfo | null;
  forkStatus: ForkStatus | null;
  isAuthenticated: boolean;
  isOwnItem: boolean;
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
 * Structure matches private pages: Hero -> Toolbar -> Grid.
 */
export function PublicItemClient({
  profile,
  item,
  childItems,
  forkInfo,
  forkStatus,
  isAuthenticated,
  isOwnItem,
}: PublicItemClientProps) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreSortFilter();
  const [isForking, setIsForking] = useState(false);

  // Use shared sort utility (DRY - no duplicate sort function)
  const sortedChildItems = useMemo(
    () => sortPublicItems(childItems, sortBy),
    [childItems, sortBy]
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
        action: {
          label: "View",
          onClick: () => router.push(`/my-items/${data.itemId}`),
        },
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

  return (
    <div className={cn("flex flex-col gap-6", !hasChildren && "flex-1")}>
      {/* Hero banner */}
      <ItemHero
        name={item.name}
        description={item.description}
        artworkId={item.artworkId}
      />

      {/* Toolbar - Sort + Fork */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {/* Left side: Sort */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="sm:hidden">
            <MobileOptionsSheet
              sortBy={sortBy}
              onSortChange={setSortBy}
              disabled={!hasChildren}
              sortOptions={EXPLORE_SORT_OPTIONS}
              defaultSort="updated-desc"
            />
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <SortDropdown
              value={sortBy}
              onChange={setSortBy}
              disabled={!hasChildren}
              options={EXPLORE_SORT_OPTIONS}
            />
          </div>
        </div>

        {/* Right side: Fork info + button */}
        <div className="flex items-center gap-3">
          {/* Fork count */}
          {forkInfo && forkInfo.forkCount > 0 && (
            <span className="text-muted-foreground hidden items-center gap-1.5 text-sm sm:flex">
              <Copy className="size-4" />
              {forkInfo.forkCount} {forkInfo.forkCount === 1 ? "fork" : "forks"}
            </span>
          )}

          {/* Fork button - only show for non-owners */}
          {!isOwnItem &&
            (forkStatus?.hasForked ? (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/my-items/${forkStatus.forkedItemId}`}
                  aria-label="In Your Library"
                >
                  <Check className="mr-2 size-4 text-green-500" />
                  <span className="hidden sm:inline">In Your Library</span>
                  <span className="sm:hidden">Library</span>
                </Link>
              </Button>
            ) : isAuthenticated ? (
              <Button
                onClick={handleFork}
                disabled={isForking}
                size="sm"
                aria-label="Fork to Library"
              >
                {isForking ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                <span className="hidden sm:inline">Fork to Library</span>
                <span className="sm:hidden">Fork</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/sign-in" aria-label="Sign in to Fork">
                  <Copy className="mr-2 size-4" />
                  <span className="hidden sm:inline">Sign in to Fork</span>
                  <span className="sm:hidden">Sign in</span>
                </Link>
              </Button>
            ))}
        </div>
      </div>

      {/* Forked from attribution */}
      {forkInfo?.source && (
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
      )}

      {/* Child items grid or empty state */}
      {hasChildren ? (
        <div
          data-testid="items-grid-view"
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {sortedChildItems.map((child, index) => (
            <GridItem
              key={child.id}
              id={child.id}
              name={child.name}
              description={child.description}
              artworkId={child.artworkId}
              onClick={() => handleItemClick(child.id)}
              onMouseEnter={() => handleMouseEnter(child.id)}
              showArtwork={true}
              showDescription={true}
              priority={index < 8}
            />
          ))}
        </div>
      ) : (
        <EmptyState variant="public-item-empty" />
      )}
    </div>
  );
}
