/**
 * Top header bar component for the dashboard layout.
 * Contains sidebar toggle, breadcrumb navigation, and context menu.
 *
 * @example
 * ```tsx
 * <SiteHeader
 *   breadcrumbs={[
 *     { id: "1", name: "Projects", href: "/dashboard/1" },
 *   ]}
 *   currentItemId="1"
 *   onRename={() => openRenameDialog()}
 *   onDelete={() => openDeleteDialog()}
 * />
 * ```
 */

"use client";

import Link from "next/link";
import { ChevronRight, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
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
  title = "My Files",
  breadcrumbs = [],
  currentItemId,
  onRename,
  onDelete,
}: SiteHeaderProps) {
  const showContextMenu = currentItemId && (onRename || onDelete);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" data-testid="sidebar-trigger" />
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
            href="/dashboard"
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
                  className={cn(
                    "truncate transition-colors duration-150",
                    "hover:text-foreground focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    isLast
                      ? "text-foreground max-w-48 font-medium"
                      : "text-muted-foreground max-w-32"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.name}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Context Menu for current item actions */}
        {showContextMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring ml-auto rounded-md p-1.5 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label="Item actions"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onRename && (
                <DropdownMenuItem
                  onClick={onRename}
                  className="cursor-pointer gap-2"
                >
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive cursor-pointer gap-2"
                >
                  <Trash2 className="size-4" />
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
