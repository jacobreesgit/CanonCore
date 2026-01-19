"use client";

/**
 * Client component for public profile page.
 * Uses same components as private pages: ItemHero + GridItem.
 */

import { useRouter } from "next/navigation";
import { Folder } from "lucide-react";
import { ItemHero } from "@/components/items/item-hero";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { cn } from "@/lib/utils";
import type { PublicProfile, PublicItem } from "@/lib/public-auth";

interface PublicProfileClientProps {
  profile: PublicProfile;
  items: PublicItem[];
}

/**
 * Main client component for public profile.
 * Structure matches My Items root page: Hero -> Items count header -> Grid.
 */
export function PublicProfileClient({
  profile,
  items,
}: PublicProfileClientProps) {
  const router = useRouter();
  const displayName = profile.name ?? `@${profile.username}`;

  const handleItemClick = (id: string) => {
    router.push(`/u/${profile.username}/${id}`);
  };

  // Build hero background URL if user has hero image
  const heroBackgroundUrl = profile.hasHeroImage
    ? `/api/user/hero?userId=${profile.id}`
    : undefined;

  return (
    <div className={cn("flex flex-col gap-6", items.length === 0 && "flex-1")}>
      {/* Hero banner - same component as private pages */}
      <ItemHero
        name={displayName}
        description={`@${profile.username}`}
        backgroundUrl={heroBackgroundUrl}
      />

      {/* Items section */}
      {items.length > 0 ? (
        <div className="flex flex-col gap-4">
          {/* Section header - matches private page style */}
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-lg font-semibold">
              Public Collection
            </h2>
            <span className="text-muted-foreground text-sm">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>

          {/* Grid - same layout as private pages */}
          <div
            data-testid="items-grid-view"
            className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
          >
            {items.map((item, index) => (
              <GridItem
                key={item.id}
                id={item.id}
                name={item.name}
                description={item.description}
                artworkId={item.artworkId}
                onClick={() => handleItemClick(item.id)}
                showArtwork={true}
                showDescription={true}
                priority={index < 8}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-5",
            "border-border/40 rounded-xl border-2 border-dashed",
            "from-muted/30 to-muted/10 bg-gradient-to-b",
            "min-h-[280px] p-8"
          )}
        >
          <div
            className={cn(
              "relative flex size-20 items-center justify-center rounded-2xl",
              "from-muted/80 to-muted/40 bg-gradient-to-br",
              "ring-border/50 shadow-sm ring-1"
            )}
          >
            <Folder
              className="text-muted-foreground/70 size-10"
              strokeWidth={1.25}
            />
            <div className="from-foreground/5 absolute inset-0 rounded-2xl bg-gradient-to-t to-transparent" />
          </div>
          <div className="max-w-xs text-center">
            <h3 className="text-foreground text-lg font-semibold tracking-tight">
              No public items yet
            </h3>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              {displayName} hasn&apos;t shared any items publicly. Check back
              later!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
