/**
 * Main navigation section for the sidebar.
 * Contains search trigger, primary navigation items, and playlists section.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon, Search, ListMusic } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Kbd } from "@/components/ui/kbd";
import { useSpotlightOptional } from "@/contexts/spotlight-context";
import { getUserPlaylists } from "@/lib/playlist-actions";

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
 *
 * @param items - Array of navigation items with title, url, and optional icon
 * @param username - Current user's username for building item URLs
 */
export function NavMain({ items, username }: NavMainProps) {
  const pathname = usePathname();
  const spotlight = useSpotlightOptional();
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>(
    []
  );

  // Build base URL for user's items (profile page)
  const myItemsBaseUrl = username ? `/u/${username}` : null;

  // Check if current path is the user's own profile
  const isMyItemsPath = myItemsBaseUrl
    ? pathname === myItemsBaseUrl || pathname.startsWith(`${myItemsBaseUrl}/`)
    : false;

  // Fetch playlists for authenticated users
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    getUserPlaylists().then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setPlaylists(result.data.map((p) => ({ id: p.id, name: p.name })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  return (
    <>
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

              // Use prefix matching for section awareness
              const isActive = isMyItems
                ? isMyItemsPath
                : item.url === "/explore"
                  ? pathname === "/explore" ||
                    (pathname.startsWith("/u/") && !isMyItemsPath)
                  : pathname === item.url ||
                    pathname.startsWith(`${item.url}/`);

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

      {playlists.length > 0 && username && (
        <SidebarGroup>
          <SidebarGroupLabel>Playlists</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {playlists.map((playlist) => {
                const href = `/u/${username}/playlists/${playlist.id}`;
                const isActive =
                  pathname === href || pathname.startsWith(`${href}/`);

                return (
                  <SidebarMenuItem key={playlist.id}>
                    <SidebarMenuButton
                      tooltip={playlist.name}
                      asChild
                      isActive={isActive}
                    >
                      <Link href={href}>
                        <ListMusic aria-hidden="true" className="size-4" />
                        <span>{playlist.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}
