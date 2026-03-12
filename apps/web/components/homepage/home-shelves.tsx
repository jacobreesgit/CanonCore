/**
 * Personalised home shelves — horizontal scrolling rows of item cards.
 * Server component that fetches shelf data and renders each shelf.
 * Uses Suspense-friendly async pattern.
 */

import { getServerCaller } from "@/lib/trpc/server";
import { Section } from "@/components/ui/section";
import type { HomeShelf } from "@/lib/types";
import { ShelfRow } from "./shelf-row";

/**
 * Fetches and renders all configured home shelves.
 * Empty when user has no configured shelves or no items in any shelf.
 */
export async function HomeShelves() {
  const trpc = await getServerCaller();
  const shelves = await trpc.shelf.getHomeShelves();

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
