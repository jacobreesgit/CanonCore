/**
 * Main application sidebar component.
 * Adapts navigation content based on context (my-items, docs, or home).
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Folder, HelpCircle } from "lucide-react";
import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import type { SidebarUser } from "@/lib/auth";
import type { GoogleDriveConnection } from "@/lib/types";

import { NavMain } from "@/components/nav-main";
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
}

/**
 * Builds navigation items for authenticated users.
 * Uses dynamic URL based on username.
 *
 * @param username - User's username for profile URL
 * @returns Array of navigation items
 */
function getAuthNavItems(username: string | null | undefined) {
  return [
    {
      title: "My Items",
      url: username ? `/u/${username}` : "/sign-in",
      icon: Folder,
    },
    {
      title: "Explore",
      url: "/explore",
      icon: Compass,
    },
  ];
}

/** Navigation items for guests (unauthenticated). */
const guestNavItems = [
  {
    title: "Explore",
    url: "/explore",
    icon: Compass,
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
 */
export function AppSidebar({
  user,
  context,
  docsTree,
  driveConnection,
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
                  width={20}
                  height={20}
                  className="h-5 w-auto dark:invert"
                />
                <span className="text-base font-semibold">CanonCore</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Docs context: Show only docs navigation tree */}
        {context === "docs" ? (
          docsTree && (
            <NavDocs
              tree={docsTree}
              isAuthenticated={!!user}
              username={user?.username}
            />
          )
        ) : (
          /* Other contexts: Show main nav items */
          <NavMain
            items={user ? getAuthNavItems(user.username) : guestNavItems}
            username={user?.username}
          />
        )}
      </SidebarContent>

      {/* Hide footer entirely on docs pages */}
      {context !== "docs" && (
        <SidebarFooter>
          {/* Show footer nav for authenticated users */}
          {user && (
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
      )}
    </Sidebar>
  );
}
