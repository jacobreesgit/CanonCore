"use client";

/**
 * Client component for public item detail page.
 * Uses same components as private pages: ItemHero + GridItem.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ItemHero } from "@/components/items/item-hero";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { Copy, Check, Loader2, ChevronRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { PublicProfile, PublicItem } from "@/lib/public-auth";
import type { ForkInfo, ForkStatus } from "@/lib/fork-actions";

interface PublicItemClientProps {
  profile: PublicProfile;
  item: PublicItem;
  childItems: PublicItem[];
  breadcrumb: Array<{ id: string; name: string }>;
  forkInfo: ForkInfo | null;
  forkStatus: ForkStatus | null;
  isAuthenticated: boolean;
  isOwnItem: boolean;
}

/**
 * Fork action bar - toolbar-like section for fork actions.
 */
function ForkActionBar({
  forkInfo,
  forkStatus,
  isAuthenticated,
  isOwnItem,
  onFork,
  isForking,
}: {
  forkInfo: ForkInfo | null;
  forkStatus: ForkStatus | null;
  isAuthenticated: boolean;
  isOwnItem: boolean;
  onFork: () => void;
  isForking: boolean;
}) {
  if (isOwnItem) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Fork count */}
      {forkInfo && forkInfo.forkCount > 0 && (
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Copy className="size-4" />
          {forkInfo.forkCount} {forkInfo.forkCount === 1 ? "fork" : "forks"}
        </span>
      )}

      {/* Fork button */}
      {forkStatus?.hasForked ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/my-items/${forkStatus.forkedItemId}`}>
            <Check className="mr-2 size-4 text-green-500" />
            In Your Library
          </Link>
        </Button>
      ) : isAuthenticated ? (
        <Button onClick={onFork} disabled={isForking} size="sm">
          {isForking ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Copy className="mr-2 size-4" />
          )}
          Fork to Library
        </Button>
      ) : (
        <Button variant="outline" size="sm" asChild>
          <Link href="/sign-in">
            <Copy className="mr-2 size-4" />
            Sign in to Fork
          </Link>
        </Button>
      )}

      {/* Forked from attribution */}
      {forkInfo?.source && (
        <span className="text-muted-foreground text-sm">
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
        </span>
      )}
    </div>
  );
}

/**
 * Main client component.
 * Structure matches private ItemDetailClient: Hero -> Toolbar -> Grid.
 */
export function PublicItemClient({
  profile,
  item,
  childItems,
  breadcrumb,
  forkInfo,
  forkStatus,
  isAuthenticated,
  isOwnItem,
}: PublicItemClientProps) {
  const router = useRouter();
  const [isForking, setIsForking] = useState(false);

  const handleFork = async () => {
    setIsForking(true);
    try {
      const response = await fetch(`/api/fork/${item.id}`, {
        method: "POST",
      });

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
      toast.error(
        error instanceof Error ? error.message : "Failed to fork item"
      );
    } finally {
      setIsForking(false);
    }
  };

  const handleItemClick = (id: string) => {
    router.push(`/u/${profile.username}/${id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
        <Link
          href={`/u/${profile.username}`}
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="size-3.5" />@{profile.username}
        </Link>
        {breadcrumb.slice(0, -1).map((crumb) => (
          <div key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="text-muted-foreground/40 size-3.5" />
            <Link
              href={`/u/${profile.username}/${crumb.id}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {crumb.name}
            </Link>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <ChevronRight className="text-muted-foreground/40 size-3.5" />
          <span className="text-foreground font-medium">{item.name}</span>
        </div>
      </nav>

      {/* Hero banner - same component as private pages */}
      <ItemHero
        name={item.name}
        description={item.description}
        artworkId={item.artworkId}
      />

      {/* Fork action bar - similar position to toolbar */}
      <ForkActionBar
        forkInfo={forkInfo}
        forkStatus={forkStatus}
        isAuthenticated={isAuthenticated}
        isOwnItem={isOwnItem}
        onFork={handleFork}
        isForking={isForking}
      />

      {/* Child items grid - same layout as private pages */}
      {childItems.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-lg font-semibold">Contents</h2>
            <span className="text-muted-foreground text-sm">
              {childItems.length} {childItems.length === 1 ? "item" : "items"}
            </span>
          </div>

          <div
            data-testid="items-grid-view"
            className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
          >
            {childItems.map((child, index) => (
              <GridItem
                key={child.id}
                id={child.id}
                name={child.name}
                description={child.description}
                artworkId={child.artworkId}
                onClick={() => handleItemClick(child.id)}
                showArtwork={true}
                showDescription={true}
                priority={index < 8}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for items with no children */}
      {childItems.length === 0 && (
        <div className="text-muted-foreground py-12 text-center text-sm">
          No child items in this collection.
        </div>
      )}
    </div>
  );
}
