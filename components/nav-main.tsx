/**
 * Main navigation section for the sidebar.
 * Contains search trigger, primary navigation items,
 * collapsible Get Help with doc sections, and collapsible Legal links.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faFolder,
  faScaleBalanced,
  faShieldHalved,
  faFileContract,
  faCookieBite,
  faRocket,
  faUser,
  faBoxesStacked,
  faCloud,
  faRectangleList,
  faTableCells,
  faShareNodes,
  faGear,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { PinnedItem } from "@/lib/types";
import { faSlashForward } from "@/lib/icons";

import { NavCollapsibleItem } from "@/components/nav-collapsible-item";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useSpotlightOptional } from "@/contexts/spotlight-context";

interface NavItem {
  title: string;
  url: string;
  icon?: IconDefinition;
}

const docsLinks = [
  {
    href: "/docs/getting-started/create-account",
    label: "Getting Started",
    icon: faRocket,
  },
  {
    href: "/docs/account/profile-settings",
    label: "Your Account",
    icon: faUser,
  },
  {
    href: "/docs/files-and-folders/create-item",
    label: "Items",
    icon: faBoxesStacked,
  },
  {
    href: "/docs/google-drive/connect-drive",
    label: "Google Drive",
    icon: faCloud,
  },
  {
    href: "/docs/playlists/create-playlist",
    label: "Playlists",
    icon: faRectangleList,
  },
  { href: "/docs/views/tree-view", label: "Views", icon: faTableCells },
  {
    href: "/docs/sharing/public-profile",
    label: "Sharing",
    icon: faShareNodes,
  },
  {
    href: "/docs/preferences/default-settings",
    label: "Settings",
    icon: faGear,
  },
] as const;

const legalLinks = [
  {
    href: "/legal/privacy-policy",
    label: "Privacy Policy",
    icon: faShieldHalved,
  },
  {
    href: "/legal/terms-of-service",
    label: "Terms of Service",
    icon: faFileContract,
  },
  { href: "/legal/cookie-policy", label: "Cookie Policy", icon: faCookieBite },
] as const;

interface NavMainProps {
  /** Navigation items to display */
  items: NavItem[];
  /** Current user's username for active state detection */
  username?: string | null;
  /** Pinned items shown as children of My Items */
  pinnedItems?: PinnedItem[];
}

/**
 * Renders the main navigation section.
 * Includes spotlight search button when SpotlightProvider is available.
 * My Items renders as a link with a collapsible chevron for pinned children.
 * Get Help renders as a collapsible with doc section sub-items.
 * Legal renders as a collapsible with legal page sub-items.
 *
 * @param items - Navigation items to display
 * @param username - Current user's username for active state detection
 * @param pinnedItems - Pinned items shown as children of My Items
 */
export function NavMain({ items, username, pinnedItems }: NavMainProps) {
  const pathname = usePathname();
  const spotlight = useSpotlightOptional();

  // Build base URL for user's items (profile page)
  const myItemsBaseUrl = username ? `/u/${username}` : null;

  // Check if current path is anywhere under the user's profile
  const isMyItemsPath = myItemsBaseUrl
    ? pathname === myItemsBaseUrl || pathname.startsWith(`${myItemsBaseUrl}/`)
    : false;

  const hasPinnedItems = pinnedItems && pinnedItems.length > 0;

  // Check if a pinned item is currently active
  const isPinnedItemActive =
    hasPinnedItems &&
    pinnedItems!.some((pinned) => {
      const pinnedHref = myItemsBaseUrl
        ? `${myItemsBaseUrl}/${pinned.id}`
        : `/my-items/${pinned.id}`;
      return pathname === pinnedHref || pathname.startsWith(`${pinnedHref}/`);
    });

  return (
    <SidebarGroup data-testid="nav-sidebar">
      <SidebarGroupContent>
        <SidebarMenu>
          {items
            .filter((item) => item.title === "Home")
            .map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  asChild
                  isActive={pathname === item.url}
                >
                  <Link href={item.url}>
                    {item.icon && (
                      <FontAwesomeIcon icon={item.icon} aria-hidden="true" />
                    )}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          {spotlight && (
            <SidebarMenuItem>
              <SidebarMenuButton
                data-testid="nav-search-button"
                onClick={spotlight.openSpotlight}
                tooltip="Search"
              >
                <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
                <span>Search</span>
              </SidebarMenuButton>
              <SidebarMenuAction
                onClick={spotlight.openSpotlight}
                className="bg-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground border"
              >
                <FontAwesomeIcon icon={faSlashForward} aria-hidden="true" />
                <span className="sr-only">Press / to search</span>
              </SidebarMenuAction>
            </SidebarMenuItem>
          )}
          {items
            .filter(
              (item) => item.title !== "Home" && item.title !== "Get Help"
            )
            .map((item) => {
              const isMyItems = item.title === "My Items";

              const isActive = isMyItems
                ? isMyItemsPath && !isPinnedItemActive
                : item.url === "/explore"
                  ? pathname === "/explore" ||
                    (pathname.startsWith("/u/") && !isMyItemsPath)
                  : pathname === item.url ||
                    pathname.startsWith(`${item.url}/`);

              // My Items with pinned children
              if (isMyItems && hasPinnedItems) {
                return (
                  <NavCollapsibleItem
                    key={item.title}
                    label={item.title}
                    icon={item.icon!}
                    href={item.url}
                    isActive={isActive}
                  >
                    {pinnedItems!.map((pinned) => {
                      const pinnedHref = myItemsBaseUrl
                        ? `${myItemsBaseUrl}/${pinned.id}`
                        : `/my-items/${pinned.id}`;
                      const isPinnedActive =
                        pathname === pinnedHref ||
                        pathname.startsWith(`${pinnedHref}/`);

                      return (
                        <SidebarMenuSubItem key={pinned.id}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isPinnedActive}
                          >
                            <Link href={pinnedHref}>
                              <FontAwesomeIcon
                                icon={faFolder}
                                className="size-3"
                                aria-hidden="true"
                              />
                              <span>{pinned.name}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </NavCollapsibleItem>
                );
              }

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    asChild
                    isActive={isActive}
                  >
                    <Link href={item.url}>
                      {item.icon && (
                        <FontAwesomeIcon icon={item.icon} aria-hidden="true" />
                      )}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          {items.some((item) => item.title === "Get Help") && (
            <NavCollapsibleItem
              label="Get Help"
              icon={items.find((i) => i.title === "Get Help")!.icon!}
              href="/docs"
              isActive={pathname.startsWith("/docs")}
              defaultOpen={false}
            >
              {docsLinks.map(({ href, label, icon: docIcon }) => (
                <SidebarMenuSubItem key={href}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={
                      pathname === href || pathname.startsWith(`${href}/`)
                    }
                  >
                    <Link href={href}>
                      <FontAwesomeIcon
                        icon={docIcon}
                        className="size-3"
                        aria-hidden="true"
                      />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </NavCollapsibleItem>
          )}
          <NavCollapsibleItem
            label="Legal"
            icon={faScaleBalanced}
            isActive={false}
            defaultOpen={false}
          >
            {legalLinks.map(({ href, label, icon: legalIcon }) => (
              <SidebarMenuSubItem key={href}>
                <SidebarMenuSubButton asChild isActive={pathname === href}>
                  <Link href={href}>
                    <FontAwesomeIcon
                      icon={legalIcon}
                      className="size-3"
                      aria-hidden="true"
                    />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </NavCollapsibleItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
