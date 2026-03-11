/**
 * Personalised home shelves — horizontal scrolling rows of item cards.
 * Server component that fetches shelf data and renders each shelf.
 * Uses Suspense-friendly async pattern.
 */

import { getHomeShelves } from "@/lib/shelf-actions";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import type { HomeShelf } from "@/lib/types";
import { ShelfRow } from "./shelf-row";

/**
 * Fetches and renders all configured home shelves.
 * Empty when user has no configured shelves or no items in any shelf.
 */
export async function HomeShelves() {
  const shelves = await getHomeShelves();

  if (shelves.length === 0) return null;

  return (
    <>
      {shelves.map((shelf) => (
        <ShelfSection key={shelf.playlistId} shelf={shelf} />
      ))}
    </>
  );
}

/**
 * A single shelf section with title and horizontal scroll row.
 */
function ShelfSection({ shelf }: { shelf: HomeShelf }) {
  return (
    <Section
      aria-label={`${shelf.name} shelf`}
      className="space-y-3 py-8 md:space-y-4"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-[0.2em] text-[var(--tertiary-foreground)] uppercase">
          {shelf.name}
        </h2>
      </div>

      {/* Horizontal scroll row */}
      <ShelfRow items={shelf.items} playlistId={shelf.playlistId} />
    </Section>
  );
}

/**
 * Loading skeleton for shelves (used as Suspense fallback).
 */
export function ShelfSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <Section key={i} className="space-y-3 py-8 md:space-y-4">
          {/* Title skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          {/* Card skeletons — match ShelfRow: gap-4, calc-based widths, overflow-x-auto */}
          <div className="scrollbar-none -my-4 flex gap-4 overflow-x-auto overflow-y-hidden py-4">
            {Array.from({ length: 8 }).map((_, j) => (
              <Skeleton
                key={j}
                className="aspect-[2/3] w-[calc((100%-1rem)/2)] flex-shrink-0 rounded-lg md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-5rem)/6)]"
              />
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
