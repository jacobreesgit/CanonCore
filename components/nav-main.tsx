/**
 * Main navigation section for the sidebar.
 * Contains primary navigation items and quick create action.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus, type LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useQuickCreateOptional } from "@/contexts/add-item-context";

/**
 * Renders the main navigation section with quick create action.
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
  const quickCreate = useQuickCreateOptional();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Quick Create"
              onClick={() => quickCreate?.openDialog()}
              className="min-w-8 cursor-pointer bg-gradient-to-r from-teal-400 to-emerald-400 text-white transition-all duration-200 ease-out hover:from-teal-500 hover:to-emerald-500 hover:text-white"
            >
              <CirclePlus />
              <span>Quick Create</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
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
