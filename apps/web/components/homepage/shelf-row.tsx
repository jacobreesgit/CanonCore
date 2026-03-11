/**
 * Horizontal scrolling shelf row with gradient edge fades.
 * Client component for scroll interaction and keyboard navigation.
 */

"use client";

import { useRef, useCallback, useState, useEffect, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GridItem } from "@/components/sortable-grid/grid-item";
import { ItemContextMenu } from "@/components/items/item-context-menu";
import { ShelfActionsContext } from "@/components/items/grid-view-content";
import type { ItemVisibilityOptions, ShelfItem } from "@/lib/types";

interface ShelfRowProps {
  items: ShelfItem[];
  playlistId: string;
}

/**
 * Renders a horizontally scrollable row of shelf cards with:
 * - Snap scrolling on touch devices
 * - Left/Right arrow key navigation
 * - Gradient edge fades indicating scrollable content
 * - Staggered fade-in entrance animation
 * - Click to navigate + right-click context menu + more-options button
 */
export function ShelfRow({ items, playlistId }: ShelfRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const actions = useContext(ShelfActionsContext);

  // Extract username from /u/[username] path
  const segments = pathname.split("/");
  const username = segments[1] === "u" ? segments[2] : undefined;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = 240;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      el.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    }
  }, []);

  const handleItemClick = useCallback(
    (id: string) => {
      if (actions) {
        actions.onItemClick(id);
      } else if (username) {
        router.push(`/u/${username}/${id}`);
      }
    },
    [actions, router, username]
  );

  /**
   * Build menu props for a shelf item using context actions.
   * Falls back to navigation-only when context is unavailable.
   */
  const buildMenuProps = useCallback(
    (item: ShelfItem) => {
      if (!actions) {
        return {
          itemName: item.name,
          onSettings: () => handleItemClick(item.id),
        };
      }
      return {
        itemName: item.name,
        showAddChild: true,
        hasDriveConnection: actions.hasDriveConnection,
        onSettings: () => actions.onOpenSettings(item.id),
        onDelete: () => actions.onDeleteItem(item.id),
        onPin: () => actions.onPinItem(item.id),
        onUnpin: () => actions.onUnpinItem(item.id),
        // Shelf items lack watch-state data, so leaf items default to
        // "Mark as Watched" and parents to "Mark All as Watched".
        // Full watched/unwatched toggle is on the item detail page.
        ...(item.childCount > 0
          ? {
              onMarkAllWatched: () => actions.onMarkAllWatched(item.id),
              onMarkAllUnwatched: () => actions.onMarkAllUnwatched(item.id),
            }
          : {
              onMarkWatched: () => actions.onMarkWatched(item.id),
              onMarkUnwatched: () => actions.onMarkUnwatched(item.id),
            }),
        onAddChild: actions.onAddChild
          ? (n: string, d?: string, v?: ItemVisibilityOptions) =>
              actions.onAddChild!(item.id, n, d, v)
          : undefined,
        onAddChildComplete: actions.onAddChildComplete,
      };
    },
    [actions, handleItemClick]
  );

  return (
    <div className="relative">
      {/* Left gradient fade */}
      <div
        className={cn(
          "pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 md:w-12",
          "transition-opacity duration-200",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
        style={{
          background:
            "linear-gradient(to right, var(--background) 0%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* Right gradient fade */}
      <div
        className={cn(
          "pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 md:w-12",
          "transition-opacity duration-200",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
        style={{
          background:
            "linear-gradient(to left, var(--background) 0%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="list"
        aria-label="Scroll with left and right arrow keys"
        className={cn(
          "flex gap-4 overflow-x-auto overflow-y-hidden",
          // Padding accommodates hover:scale-105 overflow; negative margin compensates layout
          "-my-4 py-4",
          "snap-x snap-mandatory",
          "scrollbar-none",
          // Prevent vertical scroll hijacking on touch
          "touch-pan-x",
          "focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none",
          "rounded-md"
        )}
      >
        {items.map((item, index) => {
          const menuProps = buildMenuProps(item);
          return (
            <div
              key={item.id}
              role="listitem"
              className={cn(
                // Card sizing — match grid-cols-2/4/6 gap-4 layout
                "w-[calc((100%-1rem)/2)] flex-shrink-0 snap-start md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-5rem)/6)]",
                // Stagger animation
                "animate-fade-in opacity-0",
                "motion-reduce:animate-none motion-reduce:opacity-100"
              )}
              style={{
                animationDelay: `${Math.min(index * 40, 480)}ms`,
                animationFillMode: "forwards",
              }}
            >
              <ItemContextMenu {...menuProps}>
                <GridItem
                  id={item.id}
                  name={item.name}
                  tmdbPosterPath={item.tmdbPosterPath}
                  artworkId={item.artworkId}
                  progressPercentage={item.playbackProgress}
                  showDescription={false}
                  priority={index < 6}
                  onClick={() => handleItemClick(item.id)}
                  moreMenuProps={menuProps}
                />
              </ItemContextMenu>
            </div>
          );
        })}

        {/* "See all" card — links to the full playlist detail page */}
        {username && items.length > 0 && (
          <div
            role="listitem"
            className={cn(
              "w-[calc((100%-1rem)/2)] flex-shrink-0 snap-start md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-5rem)/6)]",
              "animate-fade-in opacity-0",
              "motion-reduce:animate-none motion-reduce:opacity-100"
            )}
            style={{
              animationDelay: `${Math.min(items.length * 40, 480)}ms`,
              animationFillMode: "forwards",
            }}
          >
            <Link
              href={`/u/${username}/playlists/${playlistId}`}
              className={cn(
                "flex aspect-[2/3] flex-col items-center justify-center gap-3 rounded-lg",
                "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                "transition-all duration-300 ease-out",
                "hover:scale-105 hover:border-[var(--glass-hover)] hover:bg-[var(--glass-hover)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
                "focus-visible:scale-105 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
              )}
            >
              <span className="text-sm font-medium text-[var(--tertiary-foreground)]">
                See all
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
