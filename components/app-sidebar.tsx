/**
 * Main application sidebar component.
 * Adapts navigation content based on context (dashboard, docs, or home).
 */

"use client";

import * as React from "react";
import Link from "next/link";
import {
  Cable,
  ChevronRight,
  Folder,
  HelpCircle,
  Layers,
  Settings,
} from "lucide-react";
import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import type { SidebarUser } from "@/lib/auth";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { NavDocs } from "@/components/nav-docs";
import { NavGuest, AuthButtons } from "@/components/nav-guest";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

/**
 * Sidebar context determines which navigation items to display.
 */
type SidebarContext = "dashboard" | "docs" | "home";

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

/** Main navigation items for the dashboard. */
const dashboardNavMain = [
  {
    title: "My Files",
    url: "/dashboard",
    icon: Folder,
  },
];

/** Settings sub-items with Connections nested inside. */
const settingsSubItems = [
  {
    title: "Connections",
    url: "/dashboard/connections",
    icon: Cable,
  },
];

/** Secondary navigation items. */
const dashboardNavSecondary = [
  {
    title: "Get Help",
    url: "/docs",
    icon: HelpCircle,
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
  // Logo links to dashboard if authenticated, home if guest
  const logoHref = user ? "/dashboard" : "/";

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
                <Layers className="!size-5" />
                <span className="text-base font-semibold">CanonCore</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {context === "dashboard" && (
          <>
            <NavMain items={dashboardNavMain} />

            {/* Settings group with collapsible sub-items */}
            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible
                    asChild
                    defaultOpen
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip="Settings">
                          <Settings />
                          <span>Settings</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {settingsSubItems.map((item) => (
                            <SidebarMenuSubItem key={item.title}>
                              <SidebarMenuSubButton asChild>
                                <Link href={item.url}>
                                  <item.icon className="size-4" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <NavSecondary items={dashboardNavSecondary} />
          </>
        )}

        {context === "docs" && docsTree && <NavDocs tree={docsTree} />}

        {context === "home" && <NavGuest className="mt-auto" />}
      </SidebarContent>

      <SidebarFooter>
        {user ? <NavUser user={user} /> : <AuthButtons />}
      </SidebarFooter>
    </Sidebar>
  );
}
