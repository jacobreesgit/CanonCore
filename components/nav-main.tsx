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

/**
 * Renders the main navigation section.
 * Includes spotlight search button when SpotlightProvider is available.
 *
 * @param items - Array of navigation items with title, url, and optional icon
 */
export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
  }[];
}) {
  const pathname = usePathname();
  const spotlight = useSpotlightOptional();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {spotlight && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={spotlight.openSpotlight}
                tooltip="Search"
                className="group"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
                <Kbd className="ml-auto">/</Kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {items.map((item) => {
            // Active when on exact path OR any nested child path
            // Trailing slash prevents false positives (e.g., /my-items-other won't match /my-items/)
            const isActive =
              pathname === item.url || pathname.startsWith(`${item.url}/`);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  asChild
                  isActive={isActive}
                >
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
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
