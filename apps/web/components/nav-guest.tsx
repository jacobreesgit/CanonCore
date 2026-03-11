/**
 * Guest navigation component.
 * Shows auth button for unauthenticated users.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Renders auth button for the sidebar footer.
 * Get Help is now in the main nav collapsible section.
 */
export function AuthButtons() {
  const pathname = usePathname();
  const isSignInActive = pathname === "/sign-in";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isSignInActive}>
          <Link href="/sign-in">
            <FontAwesomeIcon
              icon={faArrowRight}
              className="size-4"
              aria-hidden="true"
            />
            <span>Get Started</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
