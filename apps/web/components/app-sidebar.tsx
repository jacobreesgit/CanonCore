/**
 * Main application sidebar component.
 * Renders consistent navigation across all contexts.
 */

"use client";

import * as React from "react";
import {
  faCompass,
  faFolder,
  faCircleQuestion,
  faHouse,
} from "@fortawesome/free-solid-svg-icons";
import type { SidebarUser } from "@/lib/auth";
import type { GoogleDriveConnection, PinnedItem } from "@/lib/types";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { AuthButtons } from "@/components/nav-guest";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Props for AppSidebar component.
 */
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  /** Current user (null for guests) */
  user?: SidebarUser | null;
  /** Google Drive connection (null if not connected) */
  driveConnection?: GoogleDriveConnection | null;
  /** Pinned items for sidebar (authenticated users only) */
  pinnedItems?: PinnedItem[];
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
      title: "Home",
      url: "/",
      icon: faHouse,
    },
    {
      title: "My Items",
      url: username ? `/u/${username}` : "/sign-in",
      icon: faFolder,
    },
    {
      title: "Explore",
      url: "/explore",
      icon: faCompass,
    },
    {
      title: "Get Help",
      url: "/docs",
      icon: faCircleQuestion,
    },
  ];
}

/** Navigation items for guests (unauthenticated). */
const guestNavItems = [
  {
    title: "Home",
    url: "/",
    icon: faHouse,
  },
  {
    title: "Explore",
    url: "/explore",
    icon: faCompass,
  },
  {
    title: "Get Help",
    url: "/docs",
    icon: faCircleQuestion,
  },
];

/**
 * Renders the collapsible sidebar with consistent navigation.
 * Supports offcanvas mode for mobile viewports.
 *
 * @param user - Current user data (null for guests)
 * @param driveConnection - Google Drive connection or null
 * @param pinnedItems - Pinned items for sidebar
 */
export function AppSidebar({
  user,
  driveConnection,
  pinnedItems,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex cursor-default items-center gap-1.5 p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/black.png"
                alt="CanonCore"
                width={20}
                height={20}
                className="h-5 w-auto invert"
              />
              <span className="text-base font-semibold">CanonCore</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={user ? getAuthNavItems(user.username) : guestNavItems}
          username={user?.username}
          pinnedItems={pinnedItems}
        />
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <NavUser user={user} driveConnection={driveConnection} />
        ) : (
          <AuthButtons />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
