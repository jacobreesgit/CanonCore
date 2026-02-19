/**
 * Main navigation section for the sidebar.
 * Contains search trigger and primary navigation items.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon, Search } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Kbd } from "@/components/ui/kbd";
import { useSpotlightOptional } from "@/contexts/spotlight-context";

interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
}

interface NavMainProps {
  /** Navigation items to display */
  items: NavItem[];
  /** Current user's username for active state detection */
  username?: string | null;
}

/**
 * Renders the main navigation section.
 * Includes spotlight search button when SpotlightProvider is available.
 */
export function NavMain({ items, username }: NavMainProps) {
  const pathname = usePathname();
  const spotlight = useSpotlightOptional();

  // Build base URL for user's items (profile page)
  const myItemsBaseUrl = username ? `/u/${username}` : null;

  // Check if current path is anywhere under the user's profile
  const isMyItemsPath = myItemsBaseUrl
    ? pathname === myItemsBaseUrl || pathname.startsWith(`${myItemsBaseUrl}/`)
    : false;

  return (
    <SidebarGroup data-testid="nav-sidebar">
      <SidebarGroupContent>
        <SidebarMenu>
          {spotlight && (
            <SidebarMenuItem>
              <SidebarMenuButton
                data-testid="nav-search-button"
                onClick={spotlight.openSpotlight}
                tooltip="Search"
                className="group"
              >
                <Search aria-hidden="true" className="size-4" />
                <span>Search</span>
                <Kbd className="ml-auto">/</Kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {items.map((item) => {
            const isMyItems = item.title === "My Items";

            const isActive = isMyItems
              ? isMyItemsPath
              : item.url === "/explore"
                ? pathname === "/explore" ||
                  (pathname.startsWith("/u/") && !isMyItemsPath)
                : pathname === item.url || pathname.startsWith(`${item.url}/`);

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  asChild
                  isActive={isActive}
                >
                  <Link href={item.url}>
                    {item.icon && <item.icon aria-hidden="true" />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
