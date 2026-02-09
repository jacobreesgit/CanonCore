/**
 * Top header bar component for the protected layout.
 * Contains sidebar toggle, breadcrumb navigation, and context menu.
 *
 * @example
 * ```tsx
 * <SiteHeader
 *   title="My Items"
 *   titleHref="/u/johndoe"
 *   breadcrumbs={[
 *     { id: "1", name: "Projects", href: "/u/johndoe/1" },
 *   ]}
 *   currentItemId="1"
 *   onRename={() => openRenameDialog()}
 *   onDelete={() => openDeleteDialog()}
 * />
 * ```
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronRight, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Breadcrumb item representing a navigation ancestor */
interface BreadcrumbItem {
  /** Unique identifier for the item */
  id: string;
  /** Display name shown in breadcrumb */
  name: string;
  /** Navigation href for the item */
  href: string;
}

interface SiteHeaderProps {
  /** Root title displayed at breadcrumb start */
  title?: string;
  /** Root href for the title link */
  titleHref?: string;
  /** Array of breadcrumb items for navigation hierarchy */
  breadcrumbs?: BreadcrumbItem[];
  /** Current item ID when viewing item detail (enables context menu) */
  currentItemId?: string;
  /** Callback when rename action is triggered */
  onRename?: () => void;
  /** Callback when delete action is triggered */
  onDelete?: () => void;
}

/**
 * Renders the sticky header with sidebar trigger, breadcrumb navigation,
 * and optional context menu for item actions.
 *
 * Features refined utility aesthetic with:
 * - Smooth hover transitions on all interactive elements
 * - Muted ancestors with emphasized current location
 * - Subtle context menu with destructive delete styling
 */
export function SiteHeader({
  title = "My Items",
  titleHref = "/",
  breadcrumbs = [],
  currentItemId,
  onRename,
  onDelete,
}: SiteHeaderProps) {
  const showContextMenu = currentItemId && (onRename || onDelete);

  // Scroll-based header visibility
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Find the scrollable container (main element by stable ID, or window fallback)
    const getScrollContainer = () => {
      const main = document.getElementById("main-content");
      return main || window;
    };

    // Standard threshold: hide after scrolling down 64px (header height)
    const SCROLL_THRESHOLD = 64;

    const handleScroll = () => {
      if (ticking.current) return;

      ticking.current = true;
      requestAnimationFrame(() => {
        const container = getScrollContainer();
        const currentScrollY =
          container instanceof Window
            ? container.scrollY
            : (container as HTMLElement).scrollTop;
        const isScrollingUp = currentScrollY < lastScrollY.current;
        const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);

        // Ignore tiny scroll movements (less than 5px) to prevent jitter
        if (scrollDelta < 5) {
          ticking.current = false;
          return;
        }

        // Show header when:
        // - Near top (within threshold)
        // - OR scrolling up
        // Hide header when:
        // - Past threshold AND scrolling down
        if (currentScrollY <= SCROLL_THRESHOLD) {
          // Near top - always show
          setIsVisible(true);
        } else if (isScrollingUp) {
          // Scrolling up - show
          setIsVisible(true);
        } else {
          // Scrolling down past threshold - hide
          setIsVisible(false);
        }

        lastScrollY.current = currentScrollY;
        ticking.current = false;
      });
    };

    const container = getScrollContainer();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "bg-background sticky top-0 z-50 hidden h-(--header-height) shrink-0 items-center gap-2 border-b transition-all duration-300 ease-out group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) md:flex",
        !isVisible && "-translate-y-full opacity-0"
      )}
    >
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger
          className="-ml-1 cursor-pointer"
          data-testid="sidebar-trigger"
        />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />

        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-1 items-center gap-1 text-sm"
        >
          {/* Root link */}
          <Link
            href={titleHref}
            data-testid="site-header-breadcrumb-root"
            className={cn(
              "shrink-0 transition-colors duration-150",
              "hover:text-foreground focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              breadcrumbs.length === 0
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            {title}
          </Link>

          {/* Breadcrumb items */}
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <div key={crumb.id} className="flex min-w-0 items-center gap-1">
                <ChevronRight
                  className="text-muted-foreground/40 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <Link
                  href={crumb.href}
                  data-testid="site-header-breadcrumb-item"
                  className={cn(
                    "truncate transition-colors duration-150",
                    "hover:text-foreground focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    isLast
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.name}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Context Menu for current item actions */}
        {showContextMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring ml-auto rounded-md p-1.5 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label="Item actions"
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onRename && (
                <DropdownMenuItem
                  onClick={onRename}
                  className="cursor-pointer gap-2"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Rename
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive cursor-pointer gap-2"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
