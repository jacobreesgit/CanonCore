/**
 * Guest navigation component.
 * Shows Get Help link and Sign In/Sign Up buttons for unauthenticated users.
 */

"use client";

import Link from "next/link";
import { HelpCircle, LogIn, UserPlus } from "lucide-react";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Props for NavGuest component.
 */
interface NavGuestProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders navigation for unauthenticated users.
 * Includes Get Help link pushed to bottom of sidebar.
 *
 * @param className - Additional CSS classes for positioning
 */
export function NavGuest({ className }: NavGuestProps) {
  return (
    <SidebarGroup className={className}>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/docs">
              <HelpCircle className="size-4" />
              <span>Get Help</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

/**
 * Renders authentication buttons for the sidebar footer.
 * Shows Sign In and Sign Up options.
 */
export function AuthButtons() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link href="/sign-in">
            <LogIn className="size-4" />
            <span>Sign In</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link href="/sign-up">
            <UserPlus className="size-4" />
            <span>Sign Up</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
