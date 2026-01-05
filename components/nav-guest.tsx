/**
 * Guest navigation component.
 * Shows Get Help link and auth button for unauthenticated users.
 */

"use client";

import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Renders help and auth buttons for the sidebar footer.
 * Shows Get Help and Get Started for guests.
 */
export function AuthButtons() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link href="/docs">
            <HelpCircle className="size-4" />
            <span>Get Help</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link href="/sign-in">
            <ArrowRight className="size-4" />
            <span>Get Started</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
