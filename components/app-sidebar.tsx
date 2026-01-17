/**
 * Main application sidebar component.
 * Adapts navigation content based on context (my-items, docs, or home).
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, HelpCircle } from "lucide-react";
import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import type { SidebarUser } from "@/lib/auth";
import type { GoogleDriveConnection, PinnedItem } from "@/lib/types";

import { NavMain } from "@/components/nav-main";
import { NavPinnedItems } from "@/components/nav-pinned-items";
import { NavUser } from "@/components/nav-user";
import { NavDocs } from "@/components/nav-docs";
import { AuthButtons } from "@/components/nav-guest";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Sidebar context determines which navigation items to display.
 */
type SidebarContext = "my-items" | "docs" | "home";

/**
 * Props for AppSidebar component.
 */
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  /** Current user (null for guests) */
  user?: SidebarUser | null;
  /** Context determines navigation content */
  context: SidebarContext;
  /** Fumadocs page tree (required when context="docs") */
  docsTree?: PageTreeRoot;
  /** Google Drive connection (null if not connected) */
  driveConnection?: GoogleDriveConnection | null;
  /** Pinned items for sidebar (only for my-items context) */
  pinnedItems?: PinnedItem[];
}

/** Main navigation items for authenticated users. */
const myItemsNavMain = [
  {
    title: "My Items",
    url: "/my-items",
    icon: Folder,
  },
];

/**
 * Renders the collapsible sidebar with context-aware navigation.
 * Supports offcanvas mode for mobile viewports.
 *
 * @param user - Current user data (null for guests)
 * @param context - Determines which navigation items to display
 * @param docsTree - Fumadocs page tree for docs context
 * @param driveConnection - Google Drive connection or null
 * @param pinnedItems - Pinned items for sidebar navigation
 */
export function AppSidebar({
  user,
  context,
  docsTree,
  driveConnection,
  pinnedItems,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname();

  // Logo always links to homepage
  const logoHref = "/";

  // Active state for footer nav items
  // Pattern: exact match OR prefix with trailing slash (prevents false positives)
  const isDocsActive = pathname === "/docs" || pathname.startsWith("/docs/");

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={logoHref} className="flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/black.png"
                  alt="CanonCore"
                  className="h-5 w-auto dark:invert"
                />
                <span className="text-base font-semibold">CanonCore</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Show my-items nav for authenticated users on any page */}
        {user && <NavMain items={myItemsNavMain} />}

        {/* Show pinned items for my-items context */}
        {pinnedItems && pinnedItems.length > 0 && (
          <NavPinnedItems items={pinnedItems} />
        )}

        {context === "docs" && docsTree && (
          <NavDocs tree={docsTree} isAuthenticated={!!user} />
        )}
      </SidebarContent>

      <SidebarFooter>
        {/* Show footer nav for authenticated users on any page (except docs where it's redundant) */}
        {user && context !== "docs" && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Get Help"
                isActive={isDocsActive}
              >
                <Link href="/docs">
                  <HelpCircle />
                  <span>Get Help</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        {user ? (
          <NavUser user={user} driveConnection={driveConnection} />
        ) : (
          <AuthButtons />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
