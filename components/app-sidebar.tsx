/**
 * Main application sidebar component.
 * Contains navigation and user menu sections.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { Folder, HelpCircle, Layers, Settings } from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
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
 * User data for sidebar display.
 */
interface SidebarUser {
  /** Display name for the user */
  name: string;
  /** User's email address */
  email: string;
  /** URL to user's avatar image */
  avatar?: string;
}

/**
 * Props for AppSidebar component.
 */
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: SidebarUser;
}

const data = {
  navMain: [
    {
      title: "My Files",
      url: "/dashboard",
      icon: Folder,
    },
  ],
  navSecondary: [
    {
      title: "Get Help",
      url: "/docs",
      icon: HelpCircle,
    },
    {
      // TODO: Implement settings page at /settings
      title: "Settings",
      url: "#",
      icon: Settings,
    },
  ],
};

/**
 * Renders the collapsible sidebar with navigation and user controls.
 * Supports offcanvas mode for mobile viewports.
 *
 * @param user - Current user data for display in footer
 */
export function AppSidebar({ user, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <Layers className="!size-5" />
                <span className="text-base font-semibold">CanonCore</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
