/**
 * Main application sidebar component.
 * Adapts navigation content based on context (my-items, docs, or home).
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { Cable, Folder, HelpCircle } from "lucide-react";
import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import type { SidebarUser } from "@/lib/auth";

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
 */
export function AppSidebar({
  user,
  context,
  docsTree,
  ...props
}: AppSidebarProps) {
  // Logo links to my-items if authenticated, home if guest
  const logoHref = user ? "/my-items" : "/";

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={logoHref}>
                <span className="text-base font-semibold">CanonCore</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Show my-items nav for my-items context, or for authenticated users on home */}
        {(context === "my-items" || (context === "home" && user)) && (
          <NavMain items={myItemsNavMain} />
        )}

        {context === "docs" && docsTree && (
          <NavDocs tree={docsTree} isAuthenticated={!!user} />
        )}
      </SidebarContent>

      <SidebarFooter>
        {/* Show footer nav for my-items context, or for authenticated users on home */}
        {(context === "my-items" || (context === "home" && user)) && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Connections">
                <Link href="/my-items/connections">
                  <Cable />
                  <span>Connections</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Get Help">
                <Link href="/docs">
                  <HelpCircle />
                  <span>Get Help</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        {user ? <NavUser user={user} /> : <AuthButtons />}
      </SidebarFooter>
    </Sidebar>
  );
}
